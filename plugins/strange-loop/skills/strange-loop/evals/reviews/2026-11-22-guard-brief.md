# Brief for Neon: which GUARD lessons should change strange-loop? (22 Nov 2026)

The owner asked: look critically at proposed changes to the strange-loop skill drawn from the GUARD paper (Zhang et al. 2026, regret-guided gating of self-improving skill/playbook harnesses), and implement only what you (Neon) agree with.

Read:
- `plugins/strange-loop/skills/strange-loop/evals/reviews/2026-11-22-guard-paper.md` (a reading of the paper against our procedure, with proposals A-H and risks 1-5);
- `plugins/strange-loop/skills/strange-loop/SKILL.md` sections 3-7 and 10 (the procedure as it is; note it is already over its 25,000-byte budget with a `size-exception`);
- the lead's critical assessment below.

Lead's assessment:
- Much is already there: section 4 step 4 (change by deltas, no whole rewrites: context collapse), step 5 (shrink only by moving to references, prose a check enforces, rules models follow anyway tested by removal on an eval case, duplicates), restructures (which include removals) need blind before/after evals, rejected observations are recorded.
- Worth doing, small: (1) D, explicit: a budget is never met by paraphrasing; only verbatim moves, exact duplicates, prose a check now enforces, or a size-exception. (2) A light A: a learn change names the eval cases (scripted or judged) that cover the text it touched, or states "no case covers this" in the CHANGELOG line, without re-running judged cases (the full A would reverse the owner's 2026-11-14 decision that fix and learn changes rely on scripted checks, a cost choice). (3) A "tried" line: a candidate change dropped because evals or review got worse is recorded on its observation (`→ tried <date>: <change>, <why>`, observation stays open) so later passes do not re-propose it. (4) Scope before delete: in triage, a rule that misled in one context is first narrowed ("only when ...") and removed only when wrong everywhere. (5) Section 6 forgetting: "no recorded win" is weak evidence because wins are rarely recorded; a removal is tested on an eval case first.
- Not now: B (regression-first ranking: ~37 observations a month, ranking barely matters), G (long-range check against an old version: costly), H (two candidate edits for restructures: costly).
- To stay within the budget, make room by moving section 8's adoption steps verbatim to a reference file, as the size-exception note itself suggests.

Answer per item (1-5, B, G, H, the size move): agree / disagree / change, with a one-line reason, and anything important the assessment misses (including where the paper's evidence is too weak to justify a change). At most one page. Write it to `plugins/strange-loop/skills/strange-loop/evals/reviews/2026-11-22-guard-neon.md`; edit nothing else. Report to the lead (t8b) with `hc send` when done.
