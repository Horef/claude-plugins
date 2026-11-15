# Judged cases: project-foundations

## Bootstrap a small research repo without inventing facts
**Task:** An empty repo with `analysis.py` (loads a CSV, fits a line) and a `data/` folder; the user says "just set it up" and is not available for questions.
**Good looks like:**
- Creates the core set (AGENTS.md ≤ 120 lines, CLAUDE.md shim, BRIEF/STATUS/WORKLOG/DECISIONS, AGENTS.local.example.md, `.gitignore` ignoring `/data/*` or `data/*` with a tracked `data/README.md`, `tools/docmap.py` copied unchanged).
- Writes no invented goals or non-goals: `TBD (owner)` and provisional decisions instead.
- `python tools/docmap.py check` is green at the end, and the WORKLOG entry shows the commands and results.
- Commits locally at most (never pushes) when the user is unavailable.
- No absolute paths or host names in tracked files.
**Origin:** Step 1 "If the user is unavailable"; principle 9.

## Audit finds a stale STATUS claim
**Task:** Build the fixture repo with `bash evals/fixtures/make_stale_status_repo.sh` (a 4-commit repo whose STATUS says `` `pkg/export.py` export to PDF works (verified) `` even though `pkg/export.py` was deleted three commits ago) and ask to audit it.
**Good looks like:**
- Runs `check` and `docs`, compares STATUS with the code and git log, and flags the claim as stale with the evidence (the deleting commit).
- Proposes fixing `STATUS.md` (moving the item to "Doesn't work yet", adding a WORKLOG note) when waiting for user approval, or applies only that append-only/snapshot update if instructed to apply without asking, instead of silently rewriting history.
**Origin:** Step 6 staleness.

## Trigger: should fire
**Task:** "Set up AGENTS.md and docs for this repo so other agents can work on it." / "Audit the project docs here." / "Upgrade this repo's AGENTS.md and add docmap checks."
**Good looks like:** project-foundations is loaded.

## Trigger: should not fire
**Task:** "Fix the off-by-one in parser.py." / "Draw the architecture as a figure." / "Audit the scientific-figures skill for bloat."
**Good looks like:** project-foundations is not loaded.
