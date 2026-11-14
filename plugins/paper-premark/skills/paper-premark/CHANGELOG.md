# Changelog: paper-premark

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 1.3.0 (2026-11-14)
- Step 6: mark_record_text calls for one PDF go one at a time (parallel calls collide on DEVONthink's save: 'saving failed'); validate_marks.py ends a passing run with the apply plan saying so (O6)

## 1.2.0 (2026-11-06)
- Workflow step 0: DEVONthink MCP tools check (stop if unavailable) and a harness table for moving files (Claude Code local path vs claude.ai connected folder); owner decision 2026-11-06 (O3)

## 1.1.0 (2026-11-06)
- validate_marks.py checks mark strings against the extract (Workflow 5); calibration history moved to references/calibration-log.md; scripted evals (O1, O4)

## 1.0.0 (2026-10-31)
- Imported as found (copied with `loop.py new --from`).
