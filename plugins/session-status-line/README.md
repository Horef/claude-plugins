# session-status-line

A compact status line above the prompt that shows the state of a session at a glance. Besides what Claude Code exposes to mods, it reads a few outside budgets (Kiro, Copilot, Codex, Antigravity, Claude extra usage) every five minutes where their logins exist, and shows the 5h / 7d limits of your other Claude accounts on the same machine; `/status-line quotas off` stops that.

```
✅ Opus 5.5 ·M │ ctx ▰▰▱▱▱▱ 30% 296k/1M │ 5h 21% ⟳4h14m │ 7d 30% ⟳4d16h
helpers  Kiro    42% ⟳18d3h         │ Copilot 28% ⟳21d16h      │ Codex   5h 4% 7d 1% ⟳4h10m
         agy     5h 0% 7d 1%        │ Argon   36% ⟳5d4h        │ uni     5h 21% 7d 30% ⟳3d4h
session  $35.3 │ ⏱8s │ 🗜1 │ 12 turns · 1h20m
```

The budgets shown depend on which CLIs and logins exist on the machine; the example has them all.

## What it shows

| Part | Source |
|---|---|
| ⏳ working / ✅ idle | the band's own "a turn is running" flag |
| model and effort `·H` | `$.session.model()`, re-read each turn, after `/model` and once a minute; the effort each main-loop request actually runs with. A model switch shows `⇄` in magenta for three turns |
| `ctx` bar, %, used/total | `$.session.usage()` and `session.measure`; green under 50%, then yellow, orange, red from 90% with a `/compact` hint |
| `5h` / `7d` limits | the rate-limit windows Claude Code reports (subscription accounts only), with time to reset; `⚠` appears only when the average pace would hit the limit well before the reset |
| `Kiro` | credits used of the month's limit, `+$` overage charges once past it, time to the monthly reset; `Kiro log in` when its login has gone stale. Read from the API `kiro-cli` uses, with the token `kiro-cli` keeps in `~/Library/Application Support/kiro-cli/data.sqlite3` (macOS) or `${XDG_DATA_HOME:-~/.local/share}/kiro-cli/data.sqlite3` (Linux; that path is the platform convention, not confirmed by Kiro's docs); the access token lasts about an hour, so an expired one is refreshed by running `kiro-cli whoami` first. Only your own overage is visible, not a shared organization budget |
| `Copilot` | premium credits used of the month's entitlement and time to reset, from `gh api /copilot_internal/user` (an internal GitHub endpoint; needs `gh` logged in) |
| `Codex` | the `codex` CLI's 5h and weekly limits (a monthly one on the free plan, labelled by its length) and the reset of the fullest window. Live from the endpoint Codex itself uses (`chatgpt.com/backend-api/wham/usage`, with the login in `${CODEX_HOME:-~/.codex}/auth.json`; the token goes only there and is never refreshed), else from the newest session rollout under `${CODEX_HOME:-~/.codex}/sessions` that carries `rate_limits` (dimmed when old) |
| `agy`, `Argon` | Antigravity: the 5h and weekly use of its shared model groups (the higher of Gemini and Claude/GPT), and Gemini 4 Argon's own weekly limit with its reset. From `agy -p /usage --output-format json`, a local command that answers without a model turn; `agy` is looked up on the PATH, then in `~/.local/bin` if it is there, and run with no browser opener (`open`, `xdg-open`) on its PATH, so a login it cannot refresh (offline, expired) makes the read fail instead of opening a login page |
| other accounts (`uni 5h 21% 7d 30% ⟳3d4h`) | every other Claude account on the machine that has run this mod: its label, its 5h and 7d use and the reset of the fuller window; dimmed when its reading is over 6 hours old, 0% for a window whose reset has passed, hidden when there is no other account. See "Several Claude accounts" |
| `extra` | Claude extra usage: credits spent past the plan's limits this month, of the monthly cap. Shown once credits are spent or a 5h / 7d window is full. Read from Claude's own usage endpoint with the session's login (subscription accounts only) |
| cost | the session's running cost, as `/cost` totals it |
| ⏱ last turn | duration of the last main-loop turn |
| 🗜 compactions | how many times this chat was compacted (manual or automatic; precomputed and vetoed ones are not counted). Saved per chat in `$.store`, so a resumed chat keeps it; turns orange from 3 |
| ✎ files | distinct files successfully edited or written this session |
| 🔥 cache warmer | a button at the end of the session row: dim when off; on, the time to the next warm (orange `cold` when the last warm found the cache gone, `!` when it failed). Click it (or focus the band with ctrl+x tab and press it) to switch the warmer on for 12 hours or off. See "Keeping the cache warm" |
| turns · age | completed turns and session length |

A part with no data is hidden, so each budget appears only where its CLI and login exist. Readings are shared across chats (`$.store`) and taken at most every five minutes; a failed reading keeps the last one, marked with a dim `~` before its number after 30 minutes (other accounts: 6 hours); the number keeps its colour, so a stale warning still shows.

Colour means fill only: the context bar is green under 50% and the limits are plain, then both go gold, orange, and bold red from 90% (overage charges are bold red too); labels, resets and the whole session row are dim. Colours keep at least 3:1 contrast on white, off-white and dark backgrounds (checked in `tests/behaviour.test.tsx`); 4.5:1 is out of reach for one colour on both an off-white (#f5f0e6) and a dark (#1e1e1e) background, where the best possible is about 3.8:1. Layout: when everything fits, one line (budgets split by a dim `│`, groups by `┃`). Otherwise grouped rows: Claude's own state (model, context, 5h, 7d, extra usage), then `helpers` (Kiro, Copilot, Codex, Antigravity, other accounts), then `session` (cost, last turn, files, compactions, turns and age). Each group wraps onto as many rows as it needs, and a budget never splits from its reset time. In the terminal the helpers sit in equal columns with their names padded, so wrapped rows line up; the desktop app's proportional font gets plain spacing. A new provider or account goes into `helpers` with no code change (`groups` in `CONFIG` lists only the Claude and session ids). When the rows would not fit the band's height or width, parts go in `dropOrder`, resets first, one account at a time.

## Keeping the cache warm

Claude's prompt cache holds the conversation for an hour on a subscription (5 minutes otherwise). A chat left idle past that is either compacted or, at the next message, read again in full, which costs much more than reading it from the cache. In a long chat that waits for background work (a run that reports back every two hours) that happens at every wake-up: compaction loses detail each time, a full re-read costs usage each time.

The warmer keeps the cache alive while you wait. While it is on, 55 minutes after the last request of the main conversation (or the last warm) it sends one side request over the conversation (`$.model.fork`: the main thread's last request with one short message after it, "Automated cache keep-alive from the session-status-line mod ... reply with the single word ok"). The answer is dropped: nothing is added to the transcript, the context does not grow, and the model is not woken into a turn. Reading the conversation from the cache renews its lifetime; the warm costs the cache-read price of the conversation plus a few output tokens, and counts toward the session's cost and your limits like any request. Any real request (your message, a background task reporting back) restarts the countdown, so warms happen only in real idle stretches.

- `/status-line warm`: on for 12 hours (or off, when it is on); `warm on` the same without toggling; `warm off`.
- `/status-line warm for 8h` / `warm for 90m`; `warm until 07:30` (local time, the next time the clock shows it); `warm forever` (until switched off).
- `/status-line warm every 50m`: the wait (2 to 59 minutes, default 55; with a 5-minute cache use 3).
- `/status-line warm now`: warm at once and say how much the cache served; `warm status`: what it is doing.

The setting belongs to the chat: a new chat starts with the warmer off. A failed warm is tried again after 5 minutes; when there is nothing to warm yet (no request since the chat started or since `/clear`) it waits for the next request. The warmer does not stop compaction at the context threshold; it only keeps the cache from lapsing.

## Several Claude accounts

Each Claude account has its own config dir (`CLAUDE_CONFIG_DIR`, default `~/.claude`) and so its own *account key*: `default` for `~/.claude`, else the first 8 hex characters of the SHA-256 of the dir as you wrote it (the suffix Claude Code puts on its macOS Keychain item). Whenever a session gets new 5h / 7d windows from Claude Code (at most once a minute) it writes them, atomically, to `${XDG_CONFIG_HOME:-~/.config}/claude-accounts/<key>.json`: version, key, config dir, label, time and the two windows; no token, no email, no org id, and no plan (Claude Code does not give mods the plan). Sessions of the other accounts read those files and show each as a budget. The label defaults to the dir name without `.claude-` (`~/.claude-uni` is `uni`; the default dir is `main`); `/status-line account-label <name>` sets it, `account-label reset` restores it. The same files let other tools (the model-router's helper picker) know when an account is out of quota.

Optional live read: when a reading is over ten minutes old and the other account's OAuth token is readable (macOS Keychain item `Claude Code-credentials[-<key>]`, else `<config dir>/.credentials.json`) and not expired, the mod asks `api.anthropic.com/api/oauth/usage` for fresher figures, at most every five minutes per account. It never refreshes a token (that would log the other session out) and never stores or shows it. On macOS the first read may make Keychain ask for permission; `/status-line live off` turns the live read off.

## Commands

- `/status-line`: toggle; `on` / `off`.
- `/status-line auto|one|rows`: layout. `auto` (default) uses one line when it fits, else the rows; `two` still works and means `rows`.
- `/status-line quotas on|off`: read the outside budgets or not (on by default); `on` reads them now.
- `/status-line account-label <name>`: how this account appears in the other accounts' status lines (`reset` restores the default); with no name it shows the current one.
- `/status-line live on|off`: the optional live read of other accounts' limits (on by default).
- `/status-line warm [on | off | now | forever | for <span> | until HH:MM | every <minutes> | status]`: the cache warmer (above).
- `/status-line debug`: version, surface, measured band width, the width of each drawn line and the last budget readings.

The choices are remembered across chats. `NO_COLOR=1` drops colours; `SESSION_STATUS_ASCII=1` uses plain ASCII glyphs.

## Install

From this marketplace: `/plugin install session-status-line@horef-claude-plugins`. To load it from a folder instead, set `CLAUDE_CODE_PLUGIN_DIRS` to the plugin's path in the `settings.json` of `$CLAUDE_CONFIG_DIR` (default `~/.claude`; an `env` entry) and add `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` to reload it on edits.

Colours, thresholds, icons, widths, drop order and the groups are in the `CONFIG` object at the top of `hooks/register.tsx`.

## Known limits

- Claude Code does not announce a model or effort change between turns, so those update at the next request (model: at most a minute).
- Chats compacted before this mod was loaded start at 0; `/clear` starts a new conversation and resets the count.
- The Codex limits are verified against a live response (a free plan: one monthly window); how a paid plan's `secondary_window` looks is taken from Codex's rollout format. The Linux Kiro path and the live read of another account's usage (`utilization` field) are not verified against a real install.
- The cache warmer assumes the 1-hour cache a subscription gets; it cannot read the lifetime Claude Code chose, so on a 5-minute cache set `warm every 3m`. Whether a warm hit the cache shows in `warm status` (tokens the cache served) and as `cold` on the band.
- Tests (`tests/render.test.tsx`, `tests/accounts.test.tsx`, `tests/behaviour.test.tsx`, `tests/warm.test.tsx`) run in Claude Code's function-hooks test runner: `claude plugin test plugins/session-status-line`. They are not run in CI.
