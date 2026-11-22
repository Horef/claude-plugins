# GUARD (Zhang et al. 2026) and how the skill genome is maintained

**Read:** all 38 pages (main text, proofs, Appendices B and C). arXiv 2611.23476, Google Cloud, preprint.

**Fit.** The fit is closer than for most RSI papers. GUARD changes no weights. What it improves is a harness of Markdown files around a frozen model: a playbook, `SKILL.md` skills and `MEMORY.md` (§2, p.3-4). The main differences:
- GUARD runs hundreds of automatic rollouts per stage, each graded on a dense checklist with numeric per-task scores. Our evals are a handful of cases, plus sparse observations from real use.
- Its playbooks are small: 2.3-4.2k characters, capped (p.25). Our SKILL.md budget is 25 KB.
- Its numbers rest on one seed (Drift Gauntlet, p.23) and small test sets (43 hosted tasks; 16 DEV tasks). Several gains are not significant: vs Meta-Harness p=0.11 (Table 2); the Fin-Rate confidence interval touches 0 (Table C.3); none of the PAST-Bench sign tests survive Holm correction (Table B.4).
- Table 2 reports the best of five hosted configurations, although all five beat every baseline. FWT=0 comes from the gate abstaining, not from transfer (p.12). There is no limitations section.

So the mechanisms transfer qualitatively; the magnitudes do not.

## 1. Why self-improvement degrades

Editing one harness over and over without a grader "often backfires", and an agent can end up worse than it started (p.2, Fig. 1). The paper names three failure modes (p.2):
- **Over-triggering:** a broad rule written for recent failures breaks tasks that already worked.
- **Catastrophic forgetting:** new edits overwrite earlier skills.
- **Memory pollution:** unverified additions pile up as stale or conflicting rules that bloat the prompt.

Its root cause: free-form reflection and scalar scores mix two signals, what the latest edit newly broke and what was never solved (abstract; p.2; p.4).

Evidence:
- On Drift Gauntlet, every baseline had 3-8 block drops out of 12, and RRSI ended below the base agent (-2.00pp). GUARD had 0 (Table 3, p.14).
- Plasticity and stability were anticorrelated across the baseline runs (r=-0.82, p.14).
- Removing the gate cost -10.35pp and regressed 3 of 5 domains. In one domain an unvetted rule told the agent to call a tool that does not exist, and accuracy fell to 7.61% (p.35).
- Ranking by failure frequency alone (removing Analyze) cost -7.33pp and fell below the static base (p.34, Table C.7).

## 2. Growth versus pruning

The paper neither supports nor rejects "keep it small and cut" as a whole. It splits it: **small is good, but how you get small decides whether you forget.**
- **Accumulating hurts.** Append-style arms (Hermes+, GEPA) keep stale clauses after updates (update correctness 0.791 and 0.777, versus GUARD's 0.924). Arms that rewrite aggressively fix updates but triple pollution (0.500) (p.12).
- **Its critic checks replacement directly.** One of its four criteria is "complete replacement of superseded rules" (Box B.1c, p.26).
- **Compressing to fit a cap causes forgetting.** This is the paper's most direct finding for us. GEPA rewrote its whole 4,200-character prompt to stay within the cap. That squeezed the earlier blocks' share of the prompt (BIRD-Code from 100% to 28.5%) and lost accuracy on an earlier task family (73.33% to 66.67%). GUARD kept a section per tool/schema signature and overwrote 0 characters of earlier sections (p.15).
- **Narrow, don't delete.** A rule that caused a regression is wrapped in an `[iff <condition>]` precondition "instead of deleting" it (p.3, p.6). The paper notes that filtering out rarely triggered patches suppresses valid edge cases (TextReg, p.5).
- **Rules that work are pinned against overwriting.** A criterion the incumbent always satisfies gets priority 0 and is protected (Proposition 1(iii), p.10).
- **Compact correlates with cheap.** The final GUARD playbook was 2,315 characters versus 4,538-10,013 for the baselines, with 54.5% fewer tokens per task and 0 of 43 tasks running out of step budget (p.13, p.30). But that compactness comes from gating; nobody cut anything to reach it.
- **Load only what applies.** Rendering only the matching section, and loading wiki sections on demand (p.30-31), resembles our `references/` move. That parallel is my extrapolation; the paper does not ablate it.

## 3. Cheap changes the paper supports

- **A. A guard slice for learn changes** (well supported: gate ablation; seed prompt Box B.3). Today fix and learn changes are gated only by scripted checks (strange-loop §4 step 6). For a learn change to SKILL.md prose, name in the bump which existing cases cover behaviour that must not change, and re-run the judged cases for the sections touched. The "per case, not on average" rule already matches the Soft-HURT gate; extend it to learn changes. Over-triggering is exactly a broad rule written from one failure, and §3 already lets one `failure` or `misled` observation ripen a change.
- **B. Rank regressions above old gaps** (well supported for the principle by the Analyze ablation; the loop.py mechanics are mine). `loop.py status` could flag observations recorded after a bump, in the section that bump edited, as regressions and list them first, before ×N recurrence. Recurrence alone is the frequency ranking the ablation found worse.
- **C. A rejection ledger** (moderate: part of the design, p.8, but not ablated on its own). When a pass drops a candidate change because evals or review got worse, record it, for example `→ tried <date>: <change>, <why it failed>`. Then later passes do not re-propose it. Today we track only fixes that did not hold after merging (2.5.0). Project-foundations 5.16 added a Tried line to decisions; skills lack the equivalent.
- **D. Never meet the budget by paraphrasing** (well supported by the GEPA evidence above plus ACE). Add to §6: get under budget only by verbatim moves into `references/`, removal of exact duplicates, or prose a check now enforces; otherwise use `size-exception`. The R3 restructures (5.14.0, 2.3.0) already worked this way; make it a rule.
- **E. Scope instead of delete** (moderate; extrapolation for prose skills). In §4 triage, a rule that misled in one context should first get a precondition ("only when ..."); delete it only when it is wrong everywhere.
- **F. Replace superseded rules in the same change** (supported by the PAST-Bench stale-clause result). A learn change that contradicts an older rule edits or removes that rule in the same commit, and the CHANGELOG says so.
- **G. An occasional long-range check** (extrapolation from the paper's own caveat, p.9). Theorem 1 guarantees non-regression only within each round's gated task set, not across drift. That is why GUARD replays old tasks and once reverted a carried playbook to the base after it failed the stage check (p.22). In a §10 audit, re-run a unit's judged cases against a version several bumps old, or with no skill loaded, to catch drift that each per-pass gate misses.
- **H. Two candidate edits for restructures** (well supported in its setting: +2.23pp, p=0.027, and 64% fewer rejected rounds, Table C.8; costly for us). For restructure-class changes only, draft two alternatives and judge them blind against each other.

## 4. What in our procedure looks risky

1. **"No recorded win → removal candidate" (§6 Forgetting)** runs against pinning. In GUARD, a rule that never fails is the one most protected. In our logs wins are rarely recorded, so silence often means a rule works. §4 step 5 already says "test by removing them on an eval case"; make that test mandatory before any removal.
2. **Recurrence (×N) as the main evidence** mixes regressions with old gaps. That is the failure GUARD diagnoses, and ranking by frequency alone fell below baseline (p.34).
3. **Prose learn changes without a behavioural gate.** These are the over-triggering path, and the paper's largest effect is the gate (-10.35pp without it).
4. **The size budget invites compression.** Without the verbatim-move rule (D), getting under 25 KB is the GEPA failure.
5. **Small suites.** GUARD needs a noise floor (15 points) and a limit on hurt tasks, because single tasks are noisy (Appendix B). Project-foundations has 4 judged cases plus 2 trigger cases. Behaviour no case covers is ungated, so treat green evals as weak evidence for prose changes.

Our signal ranking (scripted checks, then a blind judge, then impression) is supported: an LLM-only reviewer passed 22.2% of traces whose execution had failed, versus 0% with a deterministic layer (p.15). So is the rule against editing graders and the graded together.
