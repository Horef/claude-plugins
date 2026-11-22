# Changelog: project-foundations

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 5.17.0 (2026-11-22)
- Lifecycle release (spec in evals/reviews/2026-11-22-lifecycle/spec.md, Neon's review merged): docmap.py archive [--apply] [--dir] [--legacy] retires historical/superseded docs into archive_dir (same layout, same-stem companions, -YYYY-MM on collisions, links rewritten, plain mentions listed, generated archive README); archive_keep records stay and never expire; check: one aggregated retired-docs warning (error under lifecycle_strict after archive_grace_days), Status column in generated folder tables; docs lists live docs only (--all for every doc); id check tests folder slugs on the raw line, groups bare-id warnings per family, ids FAMILY gives file:line, warnings ordered by consequence; find splits words and ranks live docs first; STATUS guards (table cell counts, stale Works dates, In-flight rows past their end); worklog rotates above worklog_max_tokens only on the default branch of the main worktree (--no-rotate); evals assert DOCMAP_VERSION == plugin.json version (5.17.0). Templates (session start, In flight, Done line), modules, docmap-config and upgrade 6b updated. Evals: 26 checks committed first fail on 5.16.0, all pass. (O31, O32, O33, O34, O35)
- archive --apply also rewrites exact path mentions of moved files in live text files, code and scripts included (repo-relative paths, moved folders as prefixes, paths relative to the citing file; path boundaries), listing code rewrites file:line to test; bare names are listed, append-only logs counted as history; --no-rewrite-paths keeps links only (owner-approved, 22 Nov)
- Neon's review fixes (evals/reviews/2026-11-22-lifecycle/neon-diff.md, 11 findings): companions only rendered artifacts of a retired doc; archive_dir outside MAP, README, header and link checks; --dir/--legacy path normalisation and archive_dir/ancestor/overlap guards; link rewriting masks code and leaves the archive and unchanged files alone; Works dates from verification cells only; generated blocks skipped and dry run == --apply; grace age reset only by a changed Status line (one git status call; full history needed); empty archive_dir; escaped backslashes in table cells; double-backtick spans; worklog_max_tokens = 0, one 'not rotated' line, linked-worktree eval; other-docs template Status

## 5.16.0 (2026-11-17)
- decisions record failed attempts (Tried) and what they depend on (Depends on); docmap.py depends [WORDS] lists live setting-dependent decisions to re-check after a model, platform or library switch; AGENTS template rows for both (owner request, after Yu et al. 2026 SIM) (O30)

## 5.15.1 (2026-11-17)
- docmap keeps folder keys POSIX on Windows (as_posix at every str(Path) site); fixes stale MAP/README reports there (O29)

## 5.15.0 (2026-11-17)
- Merged worktrees recurred after 5.11.0 (21 left in claude-plugins for up to 3 days, the rule only in the template and the warning lost among ~38): check now fails on a merged worktree idle longer than worktree_stale_days (default 1; a just-merged one stays a warning); new docmap.py worktrees [--remove] lists merged worktrees and removes the clean ones with their branches; AGENTS template, SKILL parallel-agents line and Audit: removal is part of the merge; Upgrade 6b: since 5.15 the worktree line. DOCMAP_VERSION 5.15.0. Owner request 2026-11-17. Evals: 5 new checks committed first (5 failed on 5.14.1), all pass (O28)

## 5.14.1 (2026-11-15)
- Learning loop footer shortened to the self-contained template (restructure R2, owner-approved 2026-11-15, D12); skill-specific hints kept under '### Observations'.

## 5.14.0 (2026-11-15)
- Restructure R3, owner-approved 2026-11-15 (audit C12): SKILL.md 37.4 KB -> 24.6 KB, under the 25 KB budget. Moved verbatim to references/: the module catalogue table (modules.md; Step 3 now lists the templates by module), the guiding principles (principles.md; a one-line list stays), the Retrofit procedure (retrofit.md) and the Upgrade procedure with its 5.x per-version list, step 6b (upgrade.md); the check fail/warn list moved to references/docmap-config.md, 'What check reports'. Removed as an exact duplicate: the Step 4.2 toml example (every line is in docmap-config.md). The documents table lost its column padding only. Headings stay with read-when cues; a fallback URL covers harnesses that show only SKILL.md. scripts/docmap.py unchanged (DOCMAP_VERSION stays 5.13.0).

## 5.13.0 (2026-11-15)
- root files in MAP, self_cmd path, STATUS Works deleted-code check, O21 fresh worktree skip, O6/Step 4/Step 6 rules, Use when description (O6, O21, O24)

## 5.12.0 (2026-11-13)
- docmap: id_missing_exempt silences the 'cites Dn, which is not in DECISIONS.md' warning for chosen paths; Retrofit step 6a (free prefix through indexes when old docs use another ledger's bare D ids); forwarding stubs (sys.modules[__name__] = importlib.import_module('pkg.mod')) are resolved: show/uses/where/deps/calls, folder tables and MAP follow the move and importer lists say '(via stub old.py)' (O22, O23) (O23)

## 5.11.0 (2026-11-09)
- Merged worktrees: docmap.py check warns about a linked worktree whose branch is merged into the main worktree's branch, with the remove command; AGENTS.md template: worktrees are for parallel work and are removed once merged (owner request 2026-11-09) (O20)

## 5.10.1 (2026-11-09)
- check: an id followed by 'by <its replacement>' in the same clause or table cell counts as marked superseded (O19)

## 5.10.0 (2026-11-09)
- partial supersession ("partly superseded by D<n>: <part>") and a skip for only the id a line marks; get and ids follow the configured indexes and '## A1 — Title' headings (O17, O18)

## 5.9.0 (2026-11-08)
- Building blocks and growing projects (owner's request, 2026-11-08; Argon review in evals/reviews/2026-11-08-argon.md): SKILL.md Step 2 is one module catalogue (core, code-map, python-graph, architecture, workstreams, lifecycle, facts, experiments, compute, releases, reviews, user-defaults, shims) and template lines carry [module] tags, so non-research and non-Python projects get only what they use. STATUS gets a Workstreams table (one line per line of work; check warns on STATUS lines over status_line_max_words). 'One id, one meaning': check warns when a file cites a bare id defined in two or more workstreams (headings, bullets, id tables; id_cite_exempt for domain words) and docmap.py ids lists families. [tool.docmap.facts] takes a glob over parameter files. Fixes: RFC 3986 URI schemes in the link check, /* */ headers, code folders no longer force READMEs on prose ancestors, folder descriptions skip Status lines and 'et al.', template Status lines pass check. Three existing eval cases changed with the behaviour they grade (O14 table rows now measured, O15 heading collisions replaced by citation cases, O16 labels carry the file stem). (O4, O5, O13, O14, O15, O16)

## 5.8.0 (2026-11-06)
- templates on demand: one file per template, read only for chosen modules (O3)

## 5.7.0 (2026-11-06)
- docmap: read_total_max_tokens budget checked by check and named in stats; rotate --keep N moves older WORKLOG entries regardless of month (O12)

## 5.6.0 (2026-11-04)
- AGENTS.md template, Conventions: 'Design for what will vary next' (data-driven over hand-listed cases; unlisted cases show or fail loudly). Owner request 2026-11-04 to generalise the gui-design rule across domains. (O11)

## 5.5.1 (2026-11-02)
- MAP.md intro names the code-graph commands (calls, deps, map), so agents reading the map first learn them (owner question, 2 Nov 2026)

## 5.5.0 (2026-11-02)
- docmap code graph (owner request, 2 Nov 2026): calls NAME [--depth N] (callers and callees resolved through imports, unresolved listed apart), deps [PATH] [--mermaid] (module imports, cycles flagged), map [PATH] [--budget N] (ranked signatures within a token budget); stdlib ast, Python only; every command ~2x faster on large repos

## 5.4.0 (2026-11-01)
- docmap worklog TITLE BODY|- [--status] inserts a dated WORKLOG entry in the project's date style, rotates earlier months and sets STATUS's Updated date; update now names merge conflicts it cannot heal (hand-written text) and reports the generated ones it healed (map, README tables, indexes: these already healed on update, which was undocumented), and check fails on leftover conflict markers; the parallel-agents rule says branches may run update. DOCMAP_VERSION 5.4.0. Owner request on 1 Nov 2026 (single friction observations, not yet ripe by count). Evals: 6 new checks, committed first (5 failed on 5.3.1), all pass. (O9, O10)

## 5.3.1 (2026-10-31)
- Learning loop: the reply-block fallback is opt-in (only when the person takes part in improving their skills), so people who installed this skill without strange-loop see no observation blocks.

## 5.3.0 (2026-10-30)
- Artifacts remember their origin: the AGENTS.md template names the scaffolding's source under the title and has a maintenance row that sends lessons about the scaffolding to this skill with the note command; docmap.py check warns when the person's genome clone has a newer docmap (DOCMAP_VERSION 5.3.0); Upgrade 6b brings older projects along. New eval check. (O8)

## 5.2.1 (2026-10-30)
- Learning loop: record lessons with the note command (routes to the genome clone) instead of editing LEARNINGS.md in a possibly installed copy, where notes are lost on update; found by the pre-launch end-to-end run.

## 5.2.0 (2026-10-30)
- docmap 5.2: `get D12 R5 <date>` prints single entries, `find WORDS` returns matching doc entries with a line each, `stats` shows what a session reads; check warns when a file read whole at session start passes read_max_tokens (8000); MAP.md lists folders only above map_files_max (150 code files). The AGENTS template's session start uses find/get and never reads DECISIONS or RESULTS whole; Upgrade 6b brings older projects along. Measured: session start at 150 decisions / 400 modules drops from ~43k to ~8k tokens, MAP.md from 10.6k to 1.5k (38k to 4.1k at 1500 modules). Config reference moved to references/docmap-config.md (SKILL.md 505 to 487 lines). 5 new eval checks. (O7)

## 5.1.0 (2026-10-30)
- `docmap.py` moved out of SKILL.md into `scripts/docmap.py` (SKILL.md 82 KB → 46 KB); Step 4 now says to copy the file, never retype it, with a download URL for harnesses that show only SKILL.md; each copy carries `DOCMAP_VERSION` so projects can tell when theirs is behind (O1).
- Fix: `docmap.py update` put the DECISIONS/RESULTS index after the first entry instead of above it whenever the title and intro are on adjacent lines, which is what the skill's own template does. It now inserts before the first `## ` entry. Projects whose index already sits in the wrong place keep it there until moved by hand (O2; found by the first run of `evals/run.py`).
- New `evals/run.py` (fixture project: update, check, where, failing cases) and `evals/cases.md` (judged cases).
- New "Learning loop" section, and a maintenance-table row that sends lessons about a skill or tool to that skill instead of the project's AGENTS.md.

## 5.0.0 (2026-10-30)
- Version as uploaded by the owner (imported into the genome unchanged).
