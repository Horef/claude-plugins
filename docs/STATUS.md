# Status
Updated 2026-10-30. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Works (verified)
| Capability | How verified |
|---|---|
| Marketplace with four plugins, all units adopted (LEARNINGS, CHANGELOG, evals) | `loop.py check` → 0 errors, 1 warning (project-foundations SKILL.md 505/500 lines), 2026-10-30 |
| `loop.py` note/status/digest/check/eval/bump/absorb | `loop.py eval strange-loop` → 7 unit tests OK, 2026-10-30 |
| `docmap.py` from its new home, with the index-placement fix | `loop.py eval project-foundations` → 8/8 checks OK, 2026-10-30 |
| Genome docs check | `docmap.py check` → 0 errors, 2026-10-30 |

## Doesn't work yet / known issues
- scientific-figures evals cannot run here: the `sciencefig` library lives only on the owner's Mac (scientific-figures O1). `loop.py eval scientific-figures` → exit 2, not run.
- The Claude Code session-start hook (`plugins/strange-loop/hooks/hooks.json`) is written to the documented command-hook format but has not been tried in an installed session.
- CI workflow (`.github/workflows/check.yml`) has not run yet; it runs on the first push or PR.
- The judged cases (`evals/cases.md`) have never been run; there is no tooling for blind A/B yet (strange-loop O1).

## Next actions
1. Owner: confirm D1 and D4 (provisional), and whether the `sciencefig` library may move into a repository (scientific-figures O1, licences of the assets).
2. Install the marketplace on the Mac, point `~/.config/strange-loop/genome` at the clone, and use the skills normally: the first real observations are what the loop needs.
3. First reflection pass when a unit turns ripe; candidates now: project-foundations O3 (templates on demand, which also fixes the line budget).

## Blockers
- None for the framework; the library move needs the owner.
