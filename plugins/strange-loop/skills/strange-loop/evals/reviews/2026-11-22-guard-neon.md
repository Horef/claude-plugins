# GUARD review: Neon's critique (2026-11-22)

## Item-by-item verdict

- **(1) D explicit (no paraphrasing to fit budget) — Change.** Agree on banning paraphrasing/summarising (backed by GEPA's compression forgetting and ACE), but state it as a prohibition rather than an exclusive allow-list so it does not contradict §4 step 5's eval-tested removal of redundant rules.
- **(2) Light A (name covering cases in CHANGELOG) — Disagree.** Citing judged cases you did not run provides no regression gate (GUARD's −10.35pp came from *running* the gate, not logging citations) and adds clutter and false confidence to every `bump`; rely on codifying checks and scoping rules instead of unrun annotations.
- **(3) "Tried" line on open observations — Change.** Worth recording so later passes skip failed candidates, but `→ tried ...` breaks `scripts/loop.py`: `OBS` parses `→` into group 6 (resolution), which `add --same` and `resolve` silently drop and `cmd_note` prints as `resolved`. Use the existing bracketed syntax `[+<date> tried: <change>; <why>]` inside the body (preserved across `--same`/`bump` and stripped by `content_words()`), or update `loop.py` first.
- **(4) Scope before delete (E) — Change.** Add one clause to §4 triage (`rule`: narrow a rule that misled in one context before deleting it) *only when it still holds elsewhere*; reflexively scoping stale prose rules creates exception bloat.
- **(5) §6 forgetting ("no recorded win") — Change.** Drop "no recorded `win`" as a removal trigger (wins are sparse — 1 of 29 in `strange-loop` — so silence usually means a rule works). Saying "test removal on an eval case first" duplicates §3/§4 (removals are already Restructures) and fails when no case covers the rule; require instead checking or adding a task that exercises the rule ("which task would miss it?").
- **B (regression-first ranking in `status`) — Agree (not now).** Open lists are small (<15 per unit) so agents read them all, `status` already flags reopened fixes that did not hold (2.5.0), and matching free-text section names to bumps would be noisy.
- **G (long-range check in §10 audit) — Agree (not now).** Costly in subagent runs, noisy on 4–6 case suites, and §5 already checks new cases without the skill loaded.
- **H (two candidate edits for restructures) — Agree (not now).** High cost on top of 2.6.0's doubled blind runs (`--old` ×2 / `--new` ×2), and restructures are rare, owner-reviewed PRs.
- **Size move (move §8 adoption steps verbatim to `references/`) — Change (agree with process condition).** Good way to cut `SKILL.md` from 25.4 KB to ~22.6 KB and drop `size-exception`, but moving detail to `references/` is a Restructure (§3, like 2.3.0): land it in its own commit/PR and run the blind judged `Adopts the genome, not the expressions` case (`evals/cases.md`) to verify agents actually follow the pointer.

## What the assessment misses

- **Proposal F (replace superseded rules in the same commit) was omitted.** It is cheap (one clause in §4 step 4: when a new rule supersedes or contradicts an older one, edit or remove the old rule in the same commit and note it in CHANGELOG) and directly backed by GUARD's PAST-Bench stale-clause result (0.78–0.79 vs 0.924 update correctness). **Agree: include F.**
- **Commit separation.** Under Kernel rule 6 and D10, the Restructure (§8 move) and the Learn prose edits (1, 3, 4, 5, F) should be separate commits, not bundled together.

## Where GUARD's evidence is too weak to justify changes

- **Regime mismatch and thin statistics.** GUARD tunes 2.3–4.2k-char playbooks over hundreds of automated checklist-scored rollouts; our skills are 10–25 KB prose edited from sparse observations with 4–6 judged cases. Its own numbers rest on 1 seed (Drift Gauntlet), small test sets (43 hosted / 16 DEV), non-significant gaps (Meta-Harness p=0.11; Fin-Rate CI touches 0; no PAST-Bench sign test survives Holm correction), best-of-5 hosted configs, and no limitations section.
- **Several proposals were never ablated.** C (rejection ledger), E (`[iff]` vs deletion), G (long-range check), and on-demand reference loading (`references/` move) are unablated design choices or extrapolations in the paper — adopt C and the §8 move on our own grounds (SIM/2.5.0 precedent and budget hygiene), not GUARD's numbers.
- **Deterministic checks are the strongest transferable signal.** GUARD's cleanest empirical evidence for us is p.15 (LLM-only review passed 22.2% of failed traces vs 0% with a deterministic layer) and p.35's collapse from a nonexistent tool name — reinforcing our preference for *codify* and scripted checks over prose rules, while Risks 3 and 5 (ungated prose on small suites) remain genuinely hard to solve cheaply.
