# session-status-line

A compact status line above the prompt that shows the state of a session at a glance. Besides what Claude Code exposes to mods, it reads a few outside budgets (Kiro, Copilot, Claude extra usage) every five minutes where their logins exist; `/status-line quotas off` stops that.

```
✅ ◆ Opus 5.5 (H) │ 🟢 ▰▰▱▱▱▱ 23% 227k/1M │ $7.62
5h 4% ⟳4h54m │ 7d 21% ⟳5d14h │ Kiro 42% ⟳18d3h │ Copilot 100% ⟳18d3h │ ⏱8s │ 🗜0 │ 12 turns · 1h20m
```

## What it shows

| Part | Source |
|---|---|
| ⏳ working / ✅ idle | the band's own "a turn is running" flag |
| model and effort `(H)` | `$.session.model()`, re-read each turn, after `/model` and once a minute; the effort each main-loop request actually runs with. A model switch shows `⇄` in magenta for three turns |
| context bar, %, used/total | `$.session.usage()` and `session.measure`; green under 50%, then yellow, orange, red from 90% with a `/compact` hint |
| `5h` / `7d` limits | the rate-limit windows Claude Code reports (subscription accounts only), with time to reset; `⚠` appears only when the average pace would hit the limit well before the reset |
| `Kiro` | credits used of the month's limit, `+$` overage charges once past it, time to the monthly reset; `Kiro log in` when its login has gone stale. Read from the API `kiro-cli` uses, with the token `kiro-cli` keeps in `~/Library/Application Support/kiro-cli/data.sqlite3` (macOS); the access token lasts about an hour, so an expired one is refreshed by running `kiro-cli whoami` first. Only your own overage is visible, not a shared organization budget |
| `Copilot` | premium credits used of the month's entitlement and time to reset, from `gh api /copilot_internal/user` (an internal GitHub endpoint; needs `gh` logged in) |
| `extra` | Claude extra usage: credits spent past the plan's limits this month, of the monthly cap. Shown once credits are spent or a 5h / 7d window is full. Read from Claude's own usage endpoint with the session's login (subscription accounts only) |
| cost | the session's running cost, as `/cost` totals it |
| ⏱ last turn | duration of the last main-loop turn |
| 🗜 compactions | how many times this chat was compacted (manual or automatic; precomputed and vetoed ones are not counted). Saved per chat in `$.store`, so a resumed chat keeps it; turns orange from 3 |
| ✎ files | distinct files successfully edited or written this session |
| turns · age | completed turns and session length |

A part with no data is hidden, so each budget appears only where its CLI and login exist. Readings are shared across chats (`$.store`) and taken at most every five minutes; a failed reading keeps the last one, dimmed after 30 minutes. Antigravity (`agy`) has no usage command or readable cache, so it is not shown. When the row does not fit, it becomes two lines ("now", then "budget"), and a line that is still too long drops parts from the least important end (`dropOrder` in `CONFIG`).

## Commands

- `/status-line`: toggle; `on` / `off`.
- `/status-line auto|one|two`: layout. `auto` (default) uses one line when it fits.
- `/status-line quotas on|off`: read the outside budgets or not (on by default); `on` reads them now.
- `/status-line debug`: version, surface, measured band width, the width of each drawn line and the last budget readings.

The choices are remembered across chats. `NO_COLOR=1` drops colours; `SESSION_STATUS_ASCII=1` uses plain ASCII glyphs.

## Install

From this marketplace: `/plugin install session-status-line@horef-claude-plugins`. To load it from a folder instead, set `CLAUDE_CODE_PLUGIN_DIRS` to the plugin's path in `~/.claude/settings.json` (an `env` entry) and add `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` to reload it on edits.

Colours, thresholds, icons, widths, drop order and the first-line split are in the `CONFIG` object at the top of `hooks/register.tsx`.

## Known limits

- Claude Code does not announce a model or effort change between turns, so those update at the next request (model: at most a minute).
- Chats compacted before this mod was loaded start at 0; `/clear` starts a new conversation and resets the count.
- Tests (`tests/render.test.tsx`) run in Claude Code's function-hooks test runner: `claude plugin test plugins/session-status-line`. They are not run in CI.
