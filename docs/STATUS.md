# Status
Updated 2026-10-30. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Works (verified)
| Capability | How verified |
|---|---|
| Marketplace with five plugins, all units adopted (LEARNINGS, CHANGELOG, evals) | `loop.py check --base origin/main` → 0 errors, 1 warning (project-foundations SKILL.md 505/500 lines), 2026-10-30 |
| `loop.py` note/status/digest/check/eval/bump/absorb/pack/link | `loop.py eval strange-loop` → 10 unit tests OK, 2026-10-30 |
| `docmap.py` from its new home | `loop.py eval project-foundations` → 8/8 OK, 2026-10-30 |
| `sciencefig` in the skill: all 31 worked-example figures build, lint and render outside the Mac | `loop.py eval scientific-figures` → pass (31 figures, 0 problems, one render sheet), 2026-10-30; the examples' output is byte-identical to the scripts they came from |
| docmap reading cost at scale | synthetic projects (15-400 decisions, 40-1500 modules): session start ~4k-12k tokens with `find`/`get` instead of 9k-66k; `loop.py eval project-foundations` 13/13, 2026-10-30 |
| Genome docs check | `docmap.py check` → 0 errors, 2026-10-30 |
| CI (unit tests, both skills' evals with the figure benchmarks on a GitHub runner, both checks) | PR #1 check run on bb21ada → success, 2026-10-30 |

## Doesn't work yet / known issues
- Not yet confirmed in the app: claude.ai marketplace sync of this repo (documented, not tried), and whether it needs a version change to pick up an update.
- The Claude Code session-start hook (`plugins/strange-loop/hooks/hooks.json`) has not been tried in an installed session.
- course-lecture-notes has judged cases only; its DEVONthink steps need the owner's Mac.
- The judged cases (`evals/cases.md`) have never been run; no tooling for blind A/B yet (strange-loop O1).
- Ripe now: scientific-figures O5 (eigen-directions in the saddle portrait, now `examples/saddle_portrait.py`, differ by hue only), seen by looking at the renders.

## Next actions
1. Owner: add the marketplace in claude.ai with Sync automatically, then remove the hand-uploaded skills; install strange-loop locally in Claude Code; run `loop.py eval scientific-figures` on the Mac, then retire `~/Scripts/ScientificFigures`.
1a. Owner: decide whether scientific-figures and course-lecture-notes should be generalised (D8).
2. Use the skills normally; real observations are what the loop needs.
3. Reflection passes when units turn ripe: scientific-figures O5; project-foundations O3 (templates on demand, which also fixes the line budget).

## Blockers
- None.
