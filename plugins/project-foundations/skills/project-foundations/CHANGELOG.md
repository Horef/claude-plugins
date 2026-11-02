# Changelog: project-foundations

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

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
