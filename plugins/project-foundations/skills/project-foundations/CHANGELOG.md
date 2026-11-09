# Changelog: project-foundations

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

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
