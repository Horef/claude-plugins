Status: historical. Brief for the first fresh review of research-assistant (2026-11-07; agy, Gemini 4 Argon).

# Brief: review the research-assistant skill

You are a fresh reviewer from another model family; you did not write this skill. It lives in `plugins/research-assistant/skills/research-assistant/` (this worktree). Read `SKILL.md`, `scripts/ra.py`, `templates/research/*.md`, `evals/run.py`, `evals/cases.md`, and the first 60 lines plus the section headings of `references/research-rules.md`. For context on the building blocks it hands work to, read only the section headings of `plugins/literature-research/skills/literature-research/SKILL.md` and `plugins/research-writing/skills/research-writing/SKILL.md`. A pilot of the first stage is in `~/Programming/Neuroscience/simple_complex_v1/docs/research/nmda_tc_l23_mechanism/question.md` (read only).

What the skill must do (owner's choices): run a research question through the loop with three human gates (after framing; after the literature, which hypotheses to test; before any compute); keep state in the project's docs; start from a project question, a new idea, reviewer questions or a paper.

Answer, with file:line references:
1. **Could an agent follow SKILL.md cold?** Where would it get stuck, guess, or do the wrong thing? Which steps are ambiguous?
2. **Does the procedure actually prevent the failures `references/research-rules.md` lists** (fabricated or substituted results, selection after seeing results, unsearched novelty, path-dependent conclusions, unaudited reports)? Name any failure mode the procedure or `ra.py check` lets through.
3. **ra.py:** bugs, checks that are too weak or too strict, and false positives on a reasonable folder. You may run `python3 evals/run.py`, and `python3 scripts/ra.py` against a scratch folder under /tmp.
4. **Gates:** do they ask the person the right things with the right artifacts, and is anything decided without the person that should not be?
5. **Bloat:** anything in SKILL.md that is redundant, too long, or belongs in references.

Write the review to `plugins/research-assistant/skills/research-assistant/review-1.md` (first line `Status: current (verified 2026-11-07).`): findings ranked most important first, each with a concrete fix. Do not edit any other file. Do not commit.

Report to the lead (t2g) with `hc send`: a 5-line summary and the path.
