# Review of project-foundations 5.17 proposal (22 Nov 2026)

Checked against `/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1` (docmap 5.11.0; read-only via `scratch/inspect_project.py`) and this repository's `SKILL.md`, `references/modules.md`, `references/docmap-config.md`, `scripts/docmap.py` (5.15.0).

## 1. Findings check (what holds, what is off, what is missing)

- **F-c is misdiagnosed on both counts.** `docmap.py check` emits **20** bare-id warnings (15 `F`, 4 `R`, 1 `A`; 25 warnings total), not 21:
  - `F1/F0` and `F2/F0` are **already ignored** by `ID_CITE`'s `(?![A-Za-z0-9_/-])`. All 15 `F` warnings come from **standalone** `F1`/`F2` (`counterphase F2 fraction`, `F1 modulation`, `CP F2`, `F1 / (F0 − ...)`) colliding with `F1–F9` defined in all three write-ups' `ledger.md`. Adding `id_ignore_patterns = ["\\bF\\d+/F\\d+\\b"]` fixes **0 of 15** warnings.
  - The `R1.x` / `A1–A6` warnings are **not** mainly missing titles (the write-ups' `\title`s are 2-line LaTeX sentences nobody quotes, their `README.md` headings are just folder paths, and `twinprop_circles/` has no README). They are a **2-line bug at `docmap.py:691`**: `id_analysis` strips inline backticks *before* checking whether the line names the defining folder slug, erasing `` `docs/writeups/twinprop_circles/` `` in `configs/search/README.md:7`, `docs/STATUS.md:21`, and `docs/RESULTS.md:3438`.
- **F-b is twice as large and hides a `lifecycle_strict` CI time bomb.** `docmap.py docs` prints **145 rows** (not ~75): 70 `historical`, 6 `superseded`, 63 `current`, 6 `proposal`. Even hiding `historical`/`superseded` leaves **69 rows**, of which **53** are finished or point-in-time records in `docs/literature/**` (26, incl. 4 `proposal` checker briefs), closed `docs/research/nmda_tc_l23_mechanism/` (11 `current`, incl. `audit-1..4.md` and append-only `log.md`), `docs/writeups/*/review/**` (10: 9 `current` round-2 reports + 1 `proposal`), and `docs/writeups/**` (6). Only **16** are live project docs. Under `lifecycle_strict = true`, `proposal_max_days = 30`, and `verify_max_days = 60`, the 4 literature checker briefs break CI in **15 days** and ~40 completed literature/research/review files break CI in **45 days**.
- **F-a & F-g details.** 11 top-level `docs/*.md` are retired (not 12: `DOCS_AUDIT_2026-10.md` and completed `GUI_REDESIGN_2026-10.md` are still `current`). Those 11 have 27 Markdown links `[...](...)` and **~95 plain/backtick references** (`STATUS.md`, `DECISIONS.md`, `RESULTS.md`, `MAP.md`, `plans/`, folder READMEs). Note also that `docs/MAP.md` does not list `docs/*.md` or `docs/archive/` (it lists code folders only); `docs/README.md` is what lists them, and its hand-written table still labels superseded docs "Current"/"Proposal" a day after being verified `2026-11-21`. On F-g, `find "twin families"` returned 0 entries only because `cmd_find` does not split whitespace inside one quoted arg (`find twin families` returns **33 entries**—though 3 of the top 4 hits are `historical` round-1 review files drowning out `DECISIONS.md` and `RESULTS.md`).
- **Two larger costs missed:**
  1. **`docs/STATUS.md` half-rots silently.** `worklog ... --status` bumps `Updated <date>` mechanically, hiding 3–4 weeks of rot in `## Where the project stands` (20–23 Oct), `## Works (verified)` (Sep–29 Oct, still claiming 0 warnings), and `## Open problems` (Oct–Nov 3). Three `## Workstreams` rows (L12, L15, L16) also have broken 5-column Markdown tables, and completed workstreams (`Mel 1998`, `dLGN encoder`, `GUI`) never leave the table.
  2. **Unmeasured session-start bloat.** `stats` reports 22.9k tokens (10.5k without `WORKLOG.md`, leaving only 1.5k headroom under `read_total_max_tokens = 12000`), while `AGENTS.md` step 3–4 also directs agents to `PROJECT_BRIEF.md` (3.2k every session), `REVIEW_2026-10-06.md` (20.3k), and `references/PAPER_NOTES.md` (23.2k).

## 2. Answers to the five questions

1. **Move files (P1) vs. generated live-docs index?** **Move retired top-level docs (`docs/archive/`), AND show Status in `docs/README.md`'s folder table.** An index alone does not clean `ls docs/`, IDE trees, or glob searches when 33 top-level files and 20 briefs pile up. Moving is low-churn if it runs at milestones (`--apply`, never automatically on commit), keeps workstream-internal records in place (`archive_keep`), and flags unrewritten backtick paths so they don't go silently stale.
2. **`docs/archive/<same relative path>` vs. `docs/archive/<YYYY-MM>/...`?** **Keep `<same relative path>`.** Old citations in `DECISIONS.md`, `RESULTS.md`, and `WORKLOG.md` name `docs/TWIN_DATASET_DESIGN.md` without knowing which month it was archived; keeping the relative path makes archive locations deterministic and avoids the created-vs-retired-vs-moved date ambiguity. Put the move date in `docs/archive/README.md`, and suffix `-YYYY-MM` only on collision.
3. **P3 heuristics: false negatives? Is grouping enough?** Both proposed heuristics miss the real causes (see §1): `F1/F0` is already excluded, and `\title`/README-title matching is brittle (LaTeX markup, path-only READMEs) and risks false negatives if generic words from titles appear in prose. Grouping alone hides bugs without fixing them; the right fix is: (a) check slugs on the raw line before stripping backticks, (b) use existing `id_cite_exempt` for domain collisions (`F[0-2]`), *then* (c) group one line per family and sort warnings by consequence.
4. **What is missing as a project grows (more workstreams, parallel agents)?**
   - **Non-expiring record semantics** for completed research, literature, audit, and reader-round artifacts (otherwise `lifecycle_strict` breaks CI every 60 days).
   - **Parallel-branch safety for `WORKLOG.md`**: auto-rotating inside `worklog` writes both `WORKLOG.md` and `docs/worklog/YYYY-MM.md`, doubling hand-written merge conflicts across parallel worktrees.
   - **STATUS pruning & sanity** (table column check, finished-workstream retirement, stale `Works` verification dates).
   - **`find` ranking & arg splitting**: split multi-word quoted args and demote `historical`/`superseded`/archive files below live docs and ledgers.
5. **Small-project impact and modules?** Small projects stay unaffected if every new rule is silent until used and modularised strictly: P1–P2 in **`lifecycle`** (do *not* drop `lifecycle_exempt` support for throwaway briefs), P3 and `find` fixes in **`core`** (zero new config keys), P4 skill-internal, **P5 in `compute`** (not `core`—small local repos don't have multi-hour cluster jobs and shouldn't carry an empty `In flight` table), P6 in **`core`** with opt-in/guarded rotation.

## 3. Verdicts on P1–P6

### P1. `docmap.py archive` — **CHANGE**
Good core design (dry-run default, `--apply` via `git mv`, same-stem companions, generated `docs/archive/README.md`, aggregated warning + `archive_grace_days` under `lifecycle_strict`). Concrete changes:
- **Exempt `archive_keep` from `verify_max_days` / `proposal_max_days` (or add a non-expiring `record (YYYY-MM-DD)` state)** so completed literature/research/review records stay in place *without* breaking CI at 60 days.
- **Report backtick path references on `--apply`:** rewrite relative Markdown links `[...](...)`, and print every live-doc plain/backtick mention of moved files so nothing silently breaks (~95 refs in `simple_complex_v1`). Also drop the claim about `MAP.md` (which doesn't list `docs/*.md`); instead, show Status in `docs/README.md`'s generated table when lifecycle is active.
- **Keep `lifecycle_exempt` available for throwaway briefs** rather than forcing Status lines on all briefs by default; keep `--legacy GLOB` for migrating undated files.
- **Drop automatic whole-folder retirement prompts** (fragile in non-interactive runs; use an explicit `archive --dir PATH` if needed) and guard against archive filename collisions (suffix `-YYYY-MM`, never overwrite).

### P2. Live-only `docmap.py docs` — **CHANGE**
Filtering `historical` and `superseded` into a summary line (`--all` for full list) is right, but leaves 69 rows in `simple_complex_v1` because 53 `current`/`proposal` files sit in completed literature/research/review folders. Concrete change:
- Default `docmap.py docs` lists only live docs *outside* `archive_keep` (16 rows in `simple_complex_v1`), printing two summary counts at the bottom: `N retired (historical/superseded)` and `M kept records (archive_keep)`; `--all` prints everything.

### P3. Quieter id check — **CHANGE**
Drop `id_ignore_patterns` (0/15 hit rate on `simple_complex_v1`; `id_cite_exempt` already handles domain tokens like `F[0-2]` and `L[1-6]`) and drop `\title`/README-title matching. Concrete changes:
- **Fix `docmap.py:691`:** extract `ID_CITE` from the code-stripped line, but test defining-folder slugs against the **raw** line before backtick stripping.
- **Group bare-id warnings** to one line per family (`<fam> bare in N files ...; docmap.py ids <fam>`) and let `docmap.py ids [FAMILY]` filter to one family.
- **Order `check` warnings by consequence:** version drift, token budgets, merged worktrees, lifecycle/STATUS, then id warnings.

### P4. Version hygiene in the skill — **CHANGE**
Catches a real bug (5.16.0 shipped with `DOCMAP_VERSION = "5.15.0"`), but this monorepo has no per-plugin release tags. Concrete change:
- Add a check in `plugins/project-foundations/skills/project-foundations/evals/run.py` (or `loop.py check --base`) verifying that `DOCMAP_VERSION` in `scripts/docmap.py` matches `plugins/project-foundations/.claude-plugin/plugin.json`'s `version` whenever `scripts/docmap.py` changed since `--base` (or unconditionally assert `DOCMAP_VERSION == plugin.json["version"]`—simpler, zero git dependency, and matches `references/upgrade.md` step 6b which already keys AGENTS.md upgrades by `DOCMAP_VERSION`).

### P5. In-flight work in STATUS — **CHANGE**
Directly addresses the real failure mode (counting result files instead of checking health). Concrete changes:
- **Put it in the `compute` module, not `core`**, so small projects don't carry an unused table or extra session-start step.
- In `check`, stay silent when `## In flight` is absent; only parse ISO dates (`YYYY-MM-DD`) in the `Expected end` column (ignore prose like "about a day").
- Add two cheap `STATUS.md` guards alongside it: warn when a `## Workstreams` row has the wrong column count (catches L12/L15/L16 in `simple_complex_v1`), and note in Audit/templates to retire finished workstreams and re-check old `Works`/`Open problems` dates that `worklog --status` masks.

### P6. Session-start budget — **CHANGE**
Keeping `templates/agents.md`'s session-start list short and auditing stale additions during Upgrade is right, but auto-rotating `WORKLOG.md` at `read_max_tokens = 8000` has two flaws: (1) in `simple_complex_v1` the other 4 files already total 10.5k tokens, so an 8k WORKLOG still trips `read_total_max_tokens = 12000`; (2) rotating inside `worklog` on parallel branches writes `docs/worklog/YYYY-MM.md` too, causing 2-file merge conflicts. Concrete changes:
- Add a dedicated `worklog_max_tokens` (default `4000`, or derive `min(read_max_tokens, read_total_max_tokens // 2)`), auto-rotate inside `worklog` **only** when on the primary branch (not a linked worktree / feature branch) and support `--no-rotate`; otherwise print a one-line `rotate --keep N` hint.
- In `cmd_find` (1-line fix + ranking): split whitespace inside each argument (`[w.lower() for a in args for w in a.split()]`) so `find "twin families"` works, and rank live docs / `DECISIONS` / `RESULTS` above `historical`/`superseded`/archive files.
