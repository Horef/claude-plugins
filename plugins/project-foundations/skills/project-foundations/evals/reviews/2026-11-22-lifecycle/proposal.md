# project-foundations 5.17 proposal: docs that retire themselves, a quieter check, in-flight work (22 Nov 2026)

Evidence: one research project after five weeks of daily agent work, `simple_complex_v1` (`/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1`, docmap 5.11.0, lifecycle_strict, experiments + workstreams modules). Owner's request (22 Nov): (1) what is missing or costly in the scaffolding as the project grows; (2) a docs maintenance mechanism so that working folders hold only the up-to-date, relevant docs, and used reviews, plans, briefs and superseded designs move somewhere out of the way without being lost.

## Findings (from the project, by cost)

F-a **Retired docs stay in working folders.** `docs/` has 37 entries; 12 top-level docs are `historical` or `superseded by ...` (CLUSTER_PLAN, DLGN_ENCODER_REVIEW, DLGN_ENCODING, LEGACY_TWINDNN_AUDIT, MEL1998_EXPERIMENT_DESIGN, TWIN_DATASET_DESIGN, YOTAM_MORPHOLOGY_REVIEW, DIRECTIONS_2026-10, three WRITEUP_* with their PDFs, DOCS_AUDIT_2026-10), plus 20 one-off helper briefs and reports in `docs/briefs/` (exempt from lifecycle, mostly no Status line). `docs/archive/` exists but nothing has moved there since 20 Oct: the skill has the Status vocabulary but no step or command that acts on it. An agent listing `docs/` sees old designs next to live ones and must open each to learn which is which.

F-b **The audit queue is flooded.** `docmap.py docs` prints ~75 rows; ~45 are historical reader-round briefs and reports inside `docs/writeups/*/review/`, records that belong to their write-up but never need verifying. The live docs that do need re-verification (USER_GUIDE, CONFIG_SCHEMA, CONTRACTS, current plans) are buried.

F-c **`check` warnings are mostly noise, so real ones are lost.** 25 warnings; 21 are bare-id warnings, of which most are false positives: `F1`, `F2` are the harmonics in "F1/F0", "F2/F0" (a physical ratio, not a ledger id), and `R1.6` etc. are a write-up's reader-question ids cited in lines that name the write-up by its title, not its slug. The two warnings that mattered (docmap 4 versions behind; session-start reading 22.9k tokens against a 12k budget, WORKLOG alone 12.4k) sit among them, as the merged-worktree warning did before 5.15 (O-entry of 5.15.0).

F-d **Version drift is invisible from the skill side.** 5.16.0 added `docmap.py depends` but left `DOCMAP_VERSION = "5.15.0"`, so a project's upgrade check cannot see that 5.16 changed docmap.

F-e **No home for in-flight work.** A cluster search was reported "48 of 96 results" for a day when all 48 were failures (the agent counted result files). STATUS "Next actions" and agent memory said "in flight"; nothing named how to check it was healthy. Works rows have a verification column; in-flight rows have none.

F-f **Session-start reading is too long.** AGENTS.md's "Start of every session" is 209 words and asks for STATUS, the brief, the latest WORKLOG entry, two review documents (one from 6 Oct) and PAPER_NOTES. WORKLOG is not rotated (`rotate --keep N` exists; nothing triggers it except a warning).

F-g What works well (keep): `get D<n>/R<n>` (used ~20 times in one session; cheap and exact), `worklog ... --status`, Status lines, FACTS, the generated maps. `find` missed a two-word topic ("twin families": 0 entries) that grep over RESULTS headings found.

## Proposal

### P1. Retire docs mechanically (`docmap.py archive`)
- **Rule:** a doc whose Status is `historical` or `superseded by X` does not stay in a working folder. Plans are retired the same way: a finished plan's Status becomes `historical (done YYYY-MM-DD; results <ids>)` (no new status word).
- **Command:** `docmap.py archive` lists the retired docs in live folders and where each would go (dry run); `archive --apply` moves them with `git mv` to `docs/archive/<path relative to docs/>` (same relative layout, so the old location is guessable), together with same-stem companions (`X.pdf`, `X.png` next to `X.md`), and rewrites relative Markdown links in live docs that point to a moved file. Id citations (D, R, B, Q) are unaffected: DECISIONS and RESULTS are append-only logs and are never archived.
- **Generated index:** `docs/archive/README.md` gets a generated table: file, original path, date moved, its Status line (why retired, what replaced it). `find` and `get` keep searching the archive, so nothing is lost; MAP shows the archive as one row, not its files.
- **Records that belong to a live folder stay:** `archive_keep` globs (default `docs/writeups/*/review/**`, `docs/research/*/**`, `docs/literature/*/**`): their historical files are not moved (a write-up's review rounds belong to it) but are hidden from the audit queue (P2). When a whole workstream folder is retired (its README or main doc historical), `archive` offers to move the folder as a unit.
- **Briefs:** a brief or helper report gets a Status line like any doc (`historical (used YYYY-MM-DD; outcome <id>)` once used); the `lifecycle_exempt` default for briefs goes. Undated legacy files without a Status line: `archive --legacy GLOB` moves them after the person confirms the list.
- **check:** one aggregated warning, "N retired docs in live folders (docmap.py archive)", never one per file; `lifecycle_strict` makes it an error only after `archive_grace_days` (default 7) since the Status changed (from git log), so retiring and moving can be separate commits.
- **When it runs:** the maintenance table row "reach a milestone" becomes: docs audit, then `docmap.py archive --apply`.

### P2. An audit queue of live docs only
`docmap.py docs` lists `current` and `proposal` docs, oldest verification first; historical and superseded files are counted in one summary line; `--all` restores today's list.

### P3. A quieter id check
- Ignore an id immediately followed by `/` and an id of the same family (`F1/F0`, `F2/F0`): a ratio, not a citation. Generalised: `id_ignore_patterns` (regexes, default `["\\bF\\d+/F\\d+\\b"]`).
- A local-id citation counts as tagged when the line names the folder's slug **or its title** (the write-up's `\title` or README title), not only the slug.
- Group bare-id warnings into one line per id family with a file count ("F2 bare in 14 files: tag or name the folder; docmap.py ids F2 lists them"), so 21 lines become 2-3.
- Order check's warnings by consequence: version drift, budget overruns and stale worktrees first.

### P4. Version hygiene in the skill itself
A test (or the strange-loop `check`) fails when `scripts/docmap.py` changed since the last release tag but `DOCMAP_VERSION` did not; bump it to 5.17.0 with this release.

### P5. In-flight work in STATUS
STATUS template gets an **In flight** table: what, started (date, job/run id), how to check it is healthy (a command whose output says ok/failed, not a file count), expected end. AGENTS template, session start: "check every In-flight row with its command before other work; report counts of successes and failures, not of files". `check` warns when an In-flight row is past its expected end.

### P6. Session-start budget
- `worklog` rotates automatically when the WORKLOG passes `read_max_tokens` (moves the oldest entries to `docs/worklog/YYYY-MM.md`, as `rotate --keep N` does), so the warning cannot persist.
- The AGENTS template's session-start list stays at: pull/status, AGENTS.local, STATUS, the latest WORKLOG entry; everything else "when the work touches it". Upgrade step: flag project-specific additions to that list older than a month for the person to keep or drop.

### Out of scope / later
RESULTS volumes (RESULTS.md is 175k tokens but read only by `get`; its index is 5.3k); O25/O26 provenance checks.

## Questions for the reviewer
1. Is moving files (P1) the right mechanism, or would a generated "live docs" index plus hiding retired docs from MAP and the audit queue be enough with less churn (links, muscle memory, other agents' open files)?
2. Is `docs/archive/<same relative path>` better than `docs/archive/<YYYY-MM>/...`?
3. P3's heuristics: false negatives you can see? Is grouping enough on its own?
4. What is missing from P1-P6 for a project that keeps growing (more workstreams, several agents in parallel)?
5. Anything here that would make the scaffolding harder to use for a small project? (Modules: P1 belongs to `lifecycle`, P5 to `workstreams`/`compute`?)
