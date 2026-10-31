# Changelog: session-status-line

Newest first. Entries are reconstructed from the conversation the mod was built in; dates are approximate. Later entries cite observations (O-ids in LEARNINGS.md) or evals.

## 0.3.0 (2026-10-11)
- Two-line layout when one line does not fit (`/status-line auto|one|two`, remembered); `/status-line debug` reports version, surface and measured width
- Dedicated compaction counter, shown from 0, saved per chat so a resumed chat keeps it; precomputed and vetoed compactions are not counted
- Colours chosen for 3:1 contrast on white, off-white and dark backgrounds
- Desktop bar glyphs that draw at an even size; pace warning only when the limit would be hit well before the reset

## 0.2.0 (2026-10-06)
- Narrower row: dropped the session token totals, cache hit rate and tool count; limits shown without bars
- Added the pace warning, last-turn duration and files-edited count

## 0.1.0 (2026-10-04)
- First version: model with effort tag, context bar, session tokens, 5h and weekly limits with reset, cost
