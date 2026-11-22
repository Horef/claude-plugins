# Review of project-foundations 5.17.0 implementation (22 Nov 2026)

Reviewed `git diff origin/main..HEAD` (`163f01a..c0d16c9`, 13 files) against `spec.md`. Verified with `loop.py eval project-foundations` (0 failures), `loop.py check --base origin/main` (0 errors, 0 warnings), read-only checks on `/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1`, and synthetic fixtures in `scratch/check_diff.py`.

## High severity

1. **Companion matching moves live code/configs and even live `Status: current` docs** — `scripts/docmap.py:2356-2358`
   `Path(c).stem == stem ... and not (c.endswith(".md") and c in picked)` attaches *any* same-stem sibling in the folder. Retiring `docs/calc/model.md` also moves `docs/calc/model.py` and `docs/calc/model.json` into `docs/archive/`. Worse, `archive --legacy 'docs/*.txt'` on `docs/live_doc.txt` moves live `docs/live_doc.md` (`Status: current`) as a companion because it is not in `picked`.
   - **Fix:** Attach companions only when `f.endswith(".md")`, and allow only non-code, non-doc rendered artifacts (e.g., `COMPANION_EXT = {".pdf", ".png", ".svg", ".jpg", ".jpeg", ".webp", ".html", ".docx", ".pptx"}`) that are not in `archive_keep`.

2. **Code files inside archived subfolders stay active in `MAP.md` and `check`** — `scripts/docmap.py:395-409, 561, 1126-1137, 1141`
   `generated()` filters only `d != adir` (not `under(d, adir)`), and `code_dirs()`, `analyse()`, and `cmd_check` do not exclude `archive_dir`. Archiving a folder containing a script (`archive --apply --dir docs/old_work` with `helper.py`, like `docs/literature/calc/` in `simple_complex_v1`) puts `docs/archive/old_work/` into `docs/MAP.md` and makes `check` require a README/docstrings inside the archive. Also, a custom `archive_dir` (e.g. `docs/retired`) is not exempt from the broken-link check at `:1141` because `link_exempt` hardcodes `["docs/archive/*"]`.
   - **Fix:** Skip `under(d, CFG["archive_dir"])` in `code_dirs()` and `under(f, CFG["archive_dir"])` in `analyse()`, the non-Python header check (`:1136`), and the link check (`:1141`).

3. **`archive --dir` has no ancestor/overlap guard and breaks on `./` or Windows paths** — `scripts/docmap.py:2334-2346`
   - `d = d.strip("/")` rejects `--dir ./docs/old_work` and Windows `--dir docs\old_work` (`rc=1`); `--legacy 'docs\briefs\*'` matches nothing on Windows because `files` are POSIX.
   - `--dir docs` (any ancestor of `archive_dir`) does not exclude `archive_dir`, planning `docs/archive/existing.md -> docs/archive/docs/archive/existing.md`.
   - Overlapping flags (`--dir docs/a --dir docs/a/b`) do not check `f not in used`, queuing `docs/a/b/*` twice so `git mv` aborts partway through.
   - **Fix:** Normalize `d = d.replace("\\", "/").removeprefix("./").strip("/")` (and `g.replace("\\", "/")` for `--legacy`); reject `under(d, adir) or under(adir, d)`; filter `members = [f for f in files if under(f, d) and not under(f, adir) and f not in used]`.

## Medium severity

4. **`rewrite_links` edits inside code blocks/spans and mutates already-archived files** — `scripts/docmap.py:2376-2398, 2477-2478, 2496-2503`
   - `rewrite_links` substitutes `](...)` across raw text, rewriting Markdown examples inside inline backticks (`` `[old](OLD.md)` ``) and fenced code blocks in both live and moved docs.
   - `links` at `:2477-2478` scans every `.md` file not in `moved`, including already-archived files in `docs/archive/`, mutating archive history and counting them as "live doc(s)".
   - `:2502-2503` rewrites every moved `.md` file unconditionally (with `errors="replace"`), touching files with no link changes.
   - **Fix:** Exclude `under(f, adir)` at `:2478`; mask fenced blocks and inline code spans in `rewrite_links` before substituting and restore them after; write at `:2503` only when `new != text`.

5. **STATUS `Works` date parsing has false positives on `"may"`, filenames, and capability text, and misses month-first dates** — `scripts/docmap.py:1071-1087, 1215-1218`
   - `re.I` matches modal verb `"may"`: `| Modal may | up to 5 may fail on GPU |` parses `"5 may"` as May 5 and emits a false stale-Works warning; `12 may be skipped (verified 2025-01-01)` parses May 12, which can mask an older date via `max(ds)`.
   - Scanning the whole row hits dates in filenames (`schema_2024-01-01.sql`) and the Capability column.
   - Misses month-first/month-year dates (`Oct 1 2025`, `Sep 2025`) and silently drops `29 Feb` without a year (`ValueError` on non-leap `today.year` or `year - 1`).
   - **Fix:** Strip backtick code spans and parse only verification cell(s) (`cells[1:]`) for table rows; require capitalized `May` (or drop `re.I` for `May`) so prose `"may"` is ignored; optionally support `Mon DD[, YYYY]`; for Feb 29 step back to the latest leap year `<= today`.

6. **`archive_mentions` scans generated blocks and disagrees between dry run and `--apply` on collisions** — `scripts/docmap.py:2407-2449, 2481, 2509`
   - Does not strip `BEGIN..END` blocks: on `simple_complex_v1`, 14 of 128 reported "plain mentions to fix by hand" are rows inside `docs/README.md`'s generated table (which `update` overwrites).
   - When a collision suffix (`design-2026-11.md`) is used, dry run sees `count["design.md"] == 2` (omitting bare `design.md`), while `--apply` re-runs on post-move `files` where `count["design.md"] == 1`, reporting mentions dry run did not predict (and still missing `docs/`-relative paths like `` `plans/design.md` ``).
   - **Fix:** Strip `BEGIN..END` blocks while preserving newlines (as `id_text` does); compute `count` across `set(files) | set(moved)` so dry run and `--apply` agree; optionally match `src.removeprefix("docs/")` when unique.

7. **Grace-day dating (`max_retired_age`) is masked by any uncommitted edit, spawns 2–3 git calls/file, and fails open on shallow clones** — `scripts/docmap.py:1095-1111`
   - `if git_out("status", "--porcelain", "--", f).strip(): continue` resets age to 0 on *any* uncommitted body edit to a doc retired months ago, downgrading a `lifecycle_strict` error to a warning.
   - 40 retired docs within grace run ~80 sequential `git` calls (~1.0 s on macOS, slower on Windows).
   - Under a `--depth=1` shallow CI clone, `git log -1 -S...` returns the shallow boundary commit date (today), so `lifecycle_strict` never enforces `archive_grace_days` in shallow CI.
   - **Fix:** Batch `git status --porcelain` once before the loop, and for modified tracked files only treat them as age 0 if the `Status:` line itself changed vs `HEAD` (`git diff -U0 HEAD -- f`). Note in `references/docmap-config.md` that `lifecycle_strict` grace dating needs non-shallow history (e.g. `fetch-depth: 0`).

## Low severity / polish

8. **Empty `archive_dir` fails `check`** — `scripts/docmap.py:536-538`: An empty `docs/archive/` directory makes `build_archive_readme` emit an empty table and fail `check` with `docs/archive/README.md: generated content is stale`. Return `None` when `not p.exists()` and no files exist under `adir`.
9. **`table_cells` mishandles escaped backslashes before `|`** — `scripts/docmap.py:1055-1056`: `| Double backslash | \`b/\` | ends \\\\| next |` is miscounted because `(?<!\\)\|` treats `\\|` as an escaped pipe. Split with `(?<!\\)(?:\\\\)*\|` and check trailing `|` has an even backslash count. (Splitting unescaped `|` inside code spans matches GFM.)
10. **Double-backtick code spans leak in `id_analysis`** — `scripts/docmap.py:786`: `` ``Q1`` `` is reported as a bare citation because `re.sub(r"`[^`\n]*`", "", t)` matches `` `` `` as an empty span. Use ``re.sub(r"(`+)[^\n]*?\1", "", t)``.
11. **Minor spec/template/eval nits:**
    - `scripts/docmap.py:1966`: `CFG.get("worklog_max_tokens") or ...` treats `0` as falsy; check `is not None`. At `:2011-2031`, when both earlier months and over-budget hold off the default branch, `worklog` prints two `not rotated` lines instead of one.
    - `templates/other-docs.md:5` still shows `Status: historical (done <date>)` without `; results <ids>` (spec A8 / `templates/agents.md:56`).
    - `evals/run.py:957-975` covers feature branch and `--no-rotate`, not a linked worktree (verified manually to work).

## Verified clean

- **Portability:** `ast.parse(..., feature_version=(3, 10))` passes; stdlib-only imports (`tomllib` guarded in `load_config`); `SKILL.md` is 184 lines / 24,746 bytes (< 25,000 B).
- **Shallow CI clone (`archive_dir/README.md`):** Committed README stays green on `git clone --depth=1` because `archive_rows(old)` preserves original paths and dates without calling `git log`.
- **ID check line numbers & raw-line slugs:** Exact line numbers across generated blocks, code fences, HTML comments, URLs, and single-backtick spans; raw-line slug test clears backticked-folder false positives.
- **Worklog rotation guard:** Blocks rotation on linked worktrees (even when checked out on `main`), feature branches, detached HEAD, and `--no-rotate`.
- **`simple_complex_v1` (read-only):** `docs` drops from 145 to 22 live rows + 2 summary lines (0.11 s); `check` emits 3 grouped id warnings ordered after budgets/STATUS and flags `STATUS.md` lines 12, 15, 16 (1.75 s); `find "twin families"` matches `find twin families` and ranks live logs/plans first (0.11 s); `archive` dry-run plans 13 retired docs + 3 PDF companions (0.72 s).

## Follow-up (fixes)

Checked `git diff c0d16c9..HEAD` (`4182732`). `loop.py eval project-foundations` passes (0 failures; all `N1`–`N11` checks green) and `scratch/check_diff.py` confirms the fixes.

**Original 11 findings:**
- **Fixed:** #1 (`COMPANION_EXT` + `.md`-only), #2 (`archive_dir` skipped in `analyse`, `code_dirs`, header & link checks), #3 (`--dir`/`--legacy` normalization, ancestor & overlap guards), #5 (verification cells only, code spans stripped, no lowercase `may`, month-first, Feb 29 leap year), #6 (generated blocks skipped; dry run == `--apply`; `simple_complex_v1` `docs/README.md` generated mentions 14 → 0), #7 (batched `git status`, `Status:`-only diff check, 40-doc grace check 0.99 s → 0.54 s, `fetch-depth: 0` note), #8 (empty `archive_dir`), #9 (`table_cells` even-backslash scanner), #10 (double-backtick spans in `id_analysis`), #11 (`worklog_max_tokens = 0`, single `not rotated` line, `other-docs.md`, linked-worktree eval).
- **Partially fixed / regressed by `rewrite_paths`:** #4 — `rewrite_links` now masks code and skips archived/unchanged files, but `rewrite_paths` runs right after it on live `.md` files without skipping fenced code blocks or inline-code links (see P2 below).

**New problems in exact-path rewriting (`scripts/docmap.py:2466-2565`):**
- **P1 (High) — `PATH_TOKEN` misses `../X.md`, `./X.md`, and `./docs/X.md` from subdirs (`:2466, :2487-2492`):** `[\w./-]*[\w-]/` requires `[\w-]` right before `/`, so single-slash dot/parent relative paths (`../OLD.md` — the docstring's own example at `:2472` — and `./OLD.md`) never match and are not listed in `archive_mentions` either. Also `./docs/OLD.md` inside `scripts/run.sh` fails `moved_to("./docs/OLD.md")` and joins to `scripts/docs/OLD.md`, staying unrewritten while `docs/OLD.md` on the line above rewrites.
  - **Fix:** Match leading `./`/`../` in `PATH_TOKEN` (`(?<![\w./~:-])((?:\.\.?/|[\w./-]*[\w-]/)[\w./-]*)`) and try `moved_to(core.removeprefix("./").rstrip("/"), moved)` (preserving any `./` prefix).
- **P2 (Medium) — `rewrite_paths` rewrites inside Markdown fenced code blocks and inline-code links (`:2497-2502`):** Only `BEGIN..END` is skipped; ```` ```md\nSee [old](docs/OLD.md)\n``` ```` and `` `[old](docs/OLD.md)` `` are rewritten, reintroducing #4 for any code example containing `/`.
  - **Fix:** When `f.endswith(".md")`, skip fenced blocks (` ``` ` / `~~~`) and inline-code Markdown links (or mask fenced blocks before `fix_line`, keeping inline-backtick paths like `` `docs/OLD.md` `` rewritten).
- **P3 (Medium) — `:` missing from `PATH_TOKEN` left boundary (`:2466`):** `git show HEAD:docs/OLD.md` (and `host:docs/OLD.md`) is rewritten to `HEAD:docs/archive/OLD.md`, breaking historical git refs.
  - **Fix:** Add `:` to the lookbehind: `(?<![\w./~:-])`.
- **P4 (Low) — `archive_mentions` `text_ext` narrower than `path_rewrite_candidates` (`:2553` vs `:2505-2527`):** `scripts/job.sbatch` gets exact paths rewritten, but bare `OLD.md` (and paths under `--no-rewrite-paths`) in `.sbatch`, `.js`, `.ts`, `.R`, `.jl`, `Makefile` are never listed.
  - **Fix:** Share the UTF-8/size/non-NUL check instead of hardcoding `text_ext`.
- **Verified clean:** Generated blocks (`BEGIN..END`) are untouched; `docs/OLD.md.bak`, `olddocs/OLD.md`, and `https://example.com/docs/OLD.md` are untouched; dry run and `--apply` counts match.
