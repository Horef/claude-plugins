# Status
Updated 2026-10-30. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Works (verified)
| Capability | How verified |
|---|---|
| Marketplace with five plugins, all units adopted (LEARNINGS, CHANGELOG, evals) | `loop.py check --base origin/main` → 0 errors, 1 warning (project-foundations SKILL.md 505/500 lines), 2026-10-30 |
| `loop.py` note/status/digest/check/eval/bump/absorb/pack/link/sync/hook/new | `loop.py eval strange-loop` → 16 unit tests OK (incl. two clones syncing through one remote, new and --from), 2026-10-30 |
| Adding a skill end to end (sandbox) | `loop.py new` → check flags placeholders → written → check and `claude plugin validate` pass → pushed → `claude plugin install` → note command from its own SKILL.md recorded O1, 2026-10-30 |
| The whole round trip on a sandboxed Mac setup (fake home, local stand-in for GitHub, the real `claude` CLI) | install from the marketplace → session-start hook → notes from another project → auto-sync push → a second machine's note pulled → reply block absorbed → skills linked for a local agent → version bump reaches the installed plugin (0.7.0 → 0.7.1), 2026-10-30 |
| `docmap.py` from its new home | `loop.py eval project-foundations` → 8/8 OK, 2026-10-30 |
| `sciencefig` in the skill: all 31 worked-example figures build, lint and render outside the Mac | `loop.py eval scientific-figures` → pass (31 figures, 0 problems, one render sheet), 2026-10-30; the examples' output is byte-identical to the scripts they came from |
| docmap reading cost at scale | synthetic projects (15-400 decisions, 40-1500 modules): session start ~4k-12k tokens with `find`/`get` instead of 9k-66k; `loop.py eval project-foundations` 13/13, 2026-10-30 |
| Genome docs check | `docmap.py check` → 0 errors, 2026-10-30 |
| CI (unit tests, both skills' evals with the figure benchmarks on a GitHub runner, both checks) | PR #1 check run on bb21ada → success, 2026-10-30 |

## Doesn't work yet / known issues
- Not yet confirmed in the apps: claude.ai marketplace sync of this repo (documented, not tried), whether it needs a version change to pick up an update, and the hook inside a real Claude Code session (the same command was run by hand in the sandbox).
- The Claude Code session-start hook (`plugins/strange-loop/hooks/hooks.json`) has not been tried in an installed session.
- course-lecture-notes has judged cases only; its DEVONthink steps need the owner's Mac.
- The judged cases (`evals/cases.md`) have never been run; no tooling for blind A/B yet (strange-loop O1).
- Ripe now: scientific-figures O5 (eigen-directions in the saddle portrait, now `examples/saddle_portrait.py`, differ by hue only), seen by looking at the renders.

## Next actions
1. Owner: on the Mac, `git pull` in the clone and `echo on > ~/.config/strange-loop/auto_sync` (D10); add the marketplace in claude.ai with Sync automatically, then remove the hand-uploaded skills; install strange-loop locally in Claude Code; run `loop.py eval scientific-figures` on the Mac, then retire `~/Scripts/ScientificFigures`.
1a. Owner: save the figure profile to `~/.config/scientific-figures/profile.md` (sent in chat) and add one line to claude.ai's standing instructions so chats without Mac access know it (D9).
2. Use the skills normally; real observations are what the loop needs.
2a. To add a skill (e.g. paper-premark from its claude.ai upload): `loop.py new <name> --description ... --category ... --from <folder>` (strange-loop section 8).
3. Reflection passes when units turn ripe: scientific-figures O5; project-foundations O3 (templates on demand, which also fixes the line budget).

## Blockers
- None.
