# project-foundations 5.17.0: final spec (22 Nov 2026)

Merges `proposal.md` with `neon.md` (read both). Where they disagree, this file decides. Observations resolved: O31-O35.

## A. Retire docs (`lifecycle` module)
1. `docmap.py archive` (dry run): lists every lifecycle doc whose Status is `historical` or `superseded ...` that sits outside `archive_dir` (default `docs/archive`) and outside `archive_keep`, with its destination: `archive_dir/<path relative to docs/>` (same relative layout; on a name collision add `-YYYY-MM`, never overwrite). Same-stem companions (`X.pdf`, `X.png` beside `X.md`) move with it.
2. `archive --apply`: `git mv` (plain move if untracked), rewrites relative Markdown links `[..](..)` in live docs that point to a moved file, then prints every remaining plain or backtick mention of a moved path in live files (file:line) so the agent can fix them by hand. Never runs on its own (no hook, not in `update`).
3. `archive --dir PATH`: retire a whole folder as a unit (explicit; no prompts). `archive --legacy GLOB`: also move files without a Status line that match GLOB (for one-off migrations, e.g. old briefs); dry run first like the rest.
4. Generated `archive_dir/README.md` (a marked generated block under a hand-written purpose line): one row per archived file: file, original path, date moved (from git log of the move, else today), its Status line. `find` searches the archive but ranks it last (see D).
5. `archive_keep` (globs; default `docs/writeups/*/review/**`, `docs/research/**`, `docs/literature/**`): records that belong to a live folder. They are never moved, never expire (exempt from `verify_max_days` and `proposal_max_days`, so `lifecycle_strict` cannot break CI on finished records), and are left out of the default audit queue.
6. `lifecycle_exempt` stays as it is (throwaway briefs may stay exempt).
7. `check`: one aggregated warning, `N retired docs in live folders: docmap.py archive`, never one line per file. Under `lifecycle_strict` it becomes an error only when the oldest such doc's Status changed more than `archive_grace_days` (default 7) ago (date from git log of the Status line, else the file's last commit).
8. A finished plan is retired as `historical (done YYYY-MM-DD; results <ids>)`; no new status word.
9. Where docmap writes a generated file table for a folder that holds lifecycle docs (e.g. `docs/README.md`, if the project has a generated table there), add a Status column with the state word. If docs/README is hand-written in a project, leave it.

## B. Audit queue (`lifecycle`)
`docmap.py docs` lists only `current` and `proposal` docs outside `archive_keep` and `archive_dir`, oldest verification first, then two summary lines: `N retired (historical/superseded)` and `M kept records (archive_keep)`. `--all` prints everything as today.

## C. A quieter, correct id check (`core`)
1. Bug fix: in `id_analysis`, find cited ids on the line with code spans and URLs stripped (as now), but test whether the line names a defining folder's slug on the raw line (backticks kept). This removes the R1.x / A1-A6 false positives.
2. No new ignore pattern (F1/F0 is already skipped by ID_CITE). Domain tokens that collide with ledger ids are handled by the existing `id_cite_exempt` (document this with an example such as `F[0-2]` for harmonics in `references/docmap-config.md`).
3. Group bare-id warnings into one line per id family: `<family> ids cited bare in N files (e.g. <file>, <file>): tag them or name the folder; docmap.py ids <family> lists them`. `docmap.py ids [FAMILY]` filters to one family and lists file:line.
4. Order check's warnings by consequence: version drift, token budgets, merged worktrees, lifecycle and STATUS, then id warnings.

## D. find (`core`)
Split whitespace inside each argument (`find "twin families"` = `find twin families`). Rank: live docs, DECISIONS, RESULTS and other indexes first; `historical`/`superseded` docs, `archive_keep` records and `archive_dir` last.

## E. STATUS guards (`core` / `workstreams`)
1. `check` warns when a row of a STATUS table has a different number of cells than its header (one warning per table with the line numbers).
2. Audit (SKILL.md Step 6) and the STATUS template: retire finished workstreams from the Workstreams table (point to their folder or write-up in one "Done" line) and re-check `Works` / `Open problems` rows whose dates are older than `verify_max_days` (a bumped `Updated` date does not verify them). `check` warns when a `Works` row's verification date is older than `verify_max_days`, if the row carries a date.

## F. In-flight work (`compute` module)
STATUS template (compute lines only): an `## In flight` table: what | started (date, job/run id) | health check (a command whose output counts successes and failures, never files) | expected end (YYYY-MM-DD). AGENTS template, session start, `[compute]` line: "Check every In-flight row with its command before other work; report successes and failures, not file counts." `check`: silent when the section is absent; warns when a row's ISO expected end is in the past (prose dates ignored).

## G. Session-start budget (`core`)
1. New key `worklog_max_tokens` (default `min(read_max_tokens, read_total_max_tokens // 2)`). `docmap.py worklog` rotates the oldest entries to `docs/worklog/YYYY-MM.md` when WORKLOG exceeds it, only in the primary worktree on the default branch; elsewhere, and with `--no-rotate`, it prints a one-line `rotate --keep N` hint.
2. AGENTS template session start: pull/status, AGENTS.local, STATUS, the latest WORKLOG entry; everything else "when the work touches it". `references/upgrade.md` 5.17 entry (step 6b): flag project-specific additions to the session-start list for the person to keep or drop.

## H. Version hygiene (skill-internal)
`evals/run.py` asserts `DOCMAP_VERSION` in `scripts/docmap.py` equals `.claude-plugin/plugin.json` `version`. This release: 5.17.0 for both (use `loop.py bump`, which writes the CHANGELOG entry and resolves O31-O35).

## I. Docs of the skill
SKILL.md (stay under 25,000 bytes; move detail to references), `references/modules.md` (which module owns A-G), `references/docmap-config.md` (new keys `archive_dir`, `archive_keep`, `archive_grace_days`, `worklog_max_tokens`; `id_cite_exempt` example), `references/upgrade.md` 6b entry, templates (agents.md, status.md), `evals/cases.md` (add cases; never edit existing ones in the same commit), `evals/run.py` scripted checks for: archive dry run/apply on a fixture (links rewritten, companions moved, README row, collision suffix, archive_keep untouched), docs queue filtering, the id slug-in-backticks fix and grouping, find splitting, STATUS cell-count warning, In-flight past-date warning, worklog rotation guard, version equality.
