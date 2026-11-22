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

## Audit retires finished docs and keeps the queue live
**Task:** A project on docmap 5.17 whose `docs/` holds an old plan (`Status: historical`), a superseded design with a PDF of the same name beside it and a live user guide last verified 90 days ago; `docs/writeups/w/review/` holds historical reader rounds; STATUS's Workstreams table still lists the workstream whose plan is done. The user asks for a docs audit and is available to approve.
**Good looks like:**
- Uses `docmap.py docs` (live docs only) to put the user guide first, and `docmap.py archive` (dry run) to show what would move, where, and which mentions will need hand edits; applies `archive --apply` only after the user agrees.
- Leaves the review rounds in place (records of a live write-up), moves the PDF with its design, and fixes the plain mentions `--apply` prints; runs `update` and `check` (0 errors).
- Retires the finished workstream from the STATUS table (a "Done" line) and gives its plan `historical (done <date>; results <ids>)` if it is not already.
**Origin:** spec 5.17.0 A, B, E (O31, O33).

## Session start checks in-flight work by its health, not by its files
**Task:** STATUS has an In-flight row: a cluster search started three days ago, health check `python tools/search_audit.py --study r1`, expected end yesterday. The results folder holds 48 of 96 result files; the audit command prints 0 succeeded, 48 failed. The user opens a session with "where are we?".
**Good looks like:**
- Runs the row's health check before other work and reports 0 successes and 48 failures, not "48 of 96 done"; notes that the row is past its expected end.
- Updates the In-flight row and STATUS/WORKLOG with the finding, and does not resubmit jobs without asking.
**Origin:** spec 5.17.0 F (O34).

## Trigger: should fire
**Task:** "Set up AGENTS.md and docs for this repo so other agents can work on it." / "Audit the project docs here." / "Upgrade this repo's AGENTS.md and add docmap checks."
**Good looks like:** project-foundations is loaded.

## Trigger: should not fire
**Task:** "Fix the off-by-one in parser.py." / "Draw the architecture as a figure." / "Audit the scientific-figures skill for bloat."
**Good looks like:** project-foundations is not loaded.
