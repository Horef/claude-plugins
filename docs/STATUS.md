# Status
Updated 2026-10-30. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Works (verified)
| Capability | How verified |
|---|---|
| Marketplace with five plugins, all units adopted (LEARNINGS, CHANGELOG, evals) | `loop.py check --base origin/main` → 0 errors, 1 warning (project-foundations SKILL.md 505/500 lines), 2026-10-30 |
| `loop.py` note/status/digest/check/eval/bump/absorb/pack/link | `loop.py eval strange-loop` → 10 unit tests OK, 2026-10-30 |
| `docmap.py` from its new home | `loop.py eval project-foundations` → 8/8 OK, 2026-10-30 |
| `sciencefig` in the skill: all benchmark figures build, lint and render outside the Mac | `loop.py eval scientific-figures` → 31 figures, 0 failures (26 differ slightly from the Mac renders: fonts and matplotlib version), plus a CVD check sheet looked at, 2026-10-30 |
| Upload zip for claude.ai | `loop.py pack scientific-figures` → 109 files, 2.1 MB, 2026-10-30 |
| Genome docs check | `docmap.py check` → 0 errors, 2026-10-30 |

## Doesn't work yet / known issues
- The Claude Code session-start hook (`plugins/strange-loop/hooks/hooks.json`) has not been tried in an installed session.
- The GitHub workflow runs for the first time on the merge to main.
- course-lecture-notes has judged cases only; its DEVONthink steps need the owner's Mac.
- The judged cases (`evals/cases.md`) have never been run; no tooling for blind A/B yet (strange-loop O1).
- Ripe now: scientific-figures O5 (t1_saddle eigen-directions differ by hue only), seen by looking at the renders.

## Next actions
1. Owner: set up the machine as in `plugins/strange-loop/README.md#setup` (pull, remove old copies, install or link, re-upload claude.ai zips); run `loop.py eval scientific-figures` on the Mac, then retire `~/Scripts/ScientificFigures`.
2. Use the skills normally; real observations are what the loop needs.
3. Reflection passes when units turn ripe: scientific-figures O5; project-foundations O3 (templates on demand, which also fixes the line budget).

## Blockers
- None.
