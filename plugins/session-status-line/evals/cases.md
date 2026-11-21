# Judged cases: session-status-line

Each case: a task, the rubric a blind judge applies, and where the case came from. This is a mod, not a skill, so there are no trigger cases; the scripted checks are `tests/render.test.tsx`, `tests/accounts.test.tsx` and `tests/behaviour.test.tsx` (run `claude plugin test plugins/session-status-line`). A case that needs a live chat, a real account or a real screen is marked *live*; a run with the function-hooks runner and stand-in engines grades those items "not testable", not pass.

## A typical session
**Task:** Open a new chat with the mod loaded on a subscription account, send a few prompts that edit a file, then look at the line above the prompt.
**Good looks like:**
- The line shows ✅ when idle and ⏳ while a reply streams.
- *(live)* Model name and effort tag match `/model` and the effort setting.
- *(live)* The context percentage and bar grow as the chat grows; the colour follows the thresholds (checked at fixed percentages in the scripted checks).
- `5h` and `7d` show a percentage and a time to reset; cost, last-turn time and the files count appear after the first turn and edit.
- Nothing shows "undefined" or "NaN"; parts without data are simply absent.
**Origin:** the mod's purpose.

## Narrow window
**Task:** Make the window narrow enough that one line does not fit; run `/status-line debug`.
**Good looks like:**
- In `auto` the row becomes two lines instead of cutting parts off; the budget line keeps the limits and their reset times.
- `/status-line debug` reports version, surface and a band width that matches what is drawn.
- `/status-line one` forces a single line that drops parts in `dropOrder`; `/status-line rows` forces grouped rows (`two` still works as an alias; rows can be more than two lines); the choice survives a new chat.
**Origin:** the first desktop-app screenshots, where the single line cut off the reset times.

## Compaction counter
**Task:** Run `/compact` twice in one chat, then close and resume the chat. For the subagent item, use a subagent whose own context compacts; where none can be made, send a `session.compact` event carrying an `agentId` (as `tests/behaviour.test.tsx` does).
**Good looks like:**
- The counter reads 0 before the first compaction, 2 after the second, and 2 again after resuming.
- A compaction a subagent runs for itself does not change it.
**Origin:** owner's request for a counter of summaries.

## No limits data
**Task:** Load the mod on an API-key account (no 5h or 7d windows) and check the line.
**Good looks like:**
- No limit parts and no error; everything else still shows.
**Origin:** the data is reported only for subscriptions.

## Light and dark themes
**Task:** Look at the line on a white, an off-white and a dark background, with context in each state (under 50%, 50 to 75, 75 to 90, over 90).
**Good looks like:**
- Every colour keeps at least 3:1 contrast on `#ffffff`, `#f5f0e6` and a dark `#1e1e1e` (the CONFIG promise; 4.5:1 cannot hold on off-white and dark together, best possible about 3.8:1), computed from the colours drawn; and, on a real screen, none looks washed out *(live)*.
**Origin:** the owner found plain yellow unreadable on off-white.

## Two Claude accounts
**Task:** With `CLAUDE_CONFIG_DIR` set to a second dir (e.g. `~/.claude-uni`), open a chat in each account on a subscription; in one run `/status-line account-label work`; compare both status lines.
**Good looks like:**
- Each chat shows the *other* account as `<label> 5h N% 7d N% ⟳…`, never itself; the label set with the command appears in the other chat within a minute or two.
- `~/.config/claude-accounts/` holds one small JSON file per account with no token or email.
- An account whose reading is over six hours old keeps its colour and gets a dim `~` before its number; with only one account nothing extra shows.
**Origin:** the several-accounts request (docs/WORKLOG 2026-11-11).

## Codex budget
**Task:** On a machine with `codex` logged in, open a chat and read the helpers row. Give it windows where the fullest and the nearest-to-reset differ (e.g. 5h at 4% resetting in 1 h, weekly at 40% resetting in 3 d) so the judge can tell them apart.
**Good looks like:**
- `Codex 5h N% 7d N%` (or a window labelled by its length on a free plan) with the reset of the fullest window; without Codex nothing shows.
**Origin:** Codex as a helper provider needs its budget in view.

## Cache warmer over a long wait
**Task:** In a chat of a few hundred thousand tokens on a subscription account, run `/status-line warm until <a time 3 hours away>`, start a background job that reports back after about two hours, and leave the chat alone. Then run `/status-line warm status` and send a message.
**Good looks like:**
- The band's `cache` countdown falls from about 1h and jumps back to about 1h at each warm (about 50 minutes after the last request or warm) and at the job's report-back; 🔥 counts the warms sent.
- *(live)* `warm status` reports warms whose cache served roughly the whole conversation (not `cold`), and nothing about them appears in the transcript or the context size.
- *(live)* The message after the wait reads the conversation from the cache (cost of that turn far below a full re-read) and no compaction happened during the wait.
- Past the end time the warmer is off and says so; clicking the 🔥 switches it on and off.
**Origin:** owner's request (2026-11-21): chats waiting hours for background runs were compacted or re-read at every wake-up.

## Cache warmer only keeps a live cache
**Task:** In a chat on a subscription account, (a) run `/compact`, then press 🔥 and leave the chat for an hour; (b) send a message, leave it 70 minutes with the warmer off, then switch it on from the ⓘ row; (c) send a message, switch the warmer on, and check `/status-line warm status` after 50 and 55 minutes.
**Good looks like:**
- In (a) and (b) no warm is sent until the next message; the band's `cache` countdown is absent after the compaction and reads `lapsed` in (b).
- In (c) one warm is sent at about 50 minutes; *(live)* its cache read is roughly the whole conversation and the countdown restarts at about 1 h.
- The ⓘ row shows the state in one line and its buttons change the warmer without typing; `until…` puts the command in the prompt.
**Origin:** owner's follow-up (2026-11-21): the warmer must start only after the first new message once the chat was compacted or the cache expired; Gemini 4 Neon review findings 3-5.

## Cache warmer outlasts idle compaction; a chosen wait stays
**Task:** In a chat on a subscription account with `idleCompaction` left on, (a) send a message, press 🔥 and leave the chat for 70 minutes; (b) run `/status-line warm every 40m`, reload the plugins, and check `/status-line warm status`; then `warm every default` and check it again.
**Good looks like:**
- In (a) one warm is sent at about 50 minutes and no "Compacted while idle" happens: at most one line saying the cache warmer declined the compaction; the band still shows a `cache` countdown afterwards. With the warmer off, the idle compaction runs as before; `/compact` always runs.
- In (b) the status still reads 40m after the reload, then `50m (default)`; the ⓘ row's lit Every button matches.
**Origin:** owner report (2026-11-21): a 0.10.1 warm ran at 50 minutes, yet the chat was compacted while idle at 55 (O7); the owner asked that a deliberately chosen wait survive a new default (O8).

## Declined idle compaction made up once the warmer stops
**Task:** In a chat on a subscription account with `idleCompaction` on, send a message, run `/status-line warm for 1h` and leave the chat for two hours; check `/status-line warm status` at about 70 minutes.
**Good looks like:**
- At 70 minutes the status lists the idle compaction(s) declined (one time each; more than one means Claude Code retries) and says when the chat compacts.
- *(live)* The chat is compacted once, about 5 minutes before the cache lapses (about 1h55m after the message: the last warm at 50 minutes plus 1 h, less 5 minutes); the compaction counter rises by one.
- In a second run where a message is sent at 70 minutes, nothing is compacted.
**Origin:** owner request (2026-11-21): once the warmer stops, the chat should compact as Claude Code would have, since its idle compaction may not try again (O9).

## Warmer and its compaction give way when things go wrong
**Task:** (a) With the warmer on and a compaction declined, switch the warmer off and press `Skip compaction` in the ⓘ row; (b) with the warmer on, turn the network off from about 45 minutes after the last message until well past the hour.
**Good looks like:**
- In (a) switching off says when the chat would compact and how to skip it; after the press nothing is compacted.
- In (b) the warms fail and are retried only until the cache lapses; then the warmer is off with one toast saying no warm got through, nothing is compacted, and no further requests go out until it is switched on again.
**Origin:** owner request (2026-11-21): the made-up compaction must be cancellable and, when the connection breaks or anything else goes wrong, skipped rather than retried (O11).

## Short outages inside the warm window are ridden out
**Task:** (a) With the warmer on, cut the network from 50 to 55 minutes after the last message; (b) with a compaction owed and the warmer off, cut the network from 1 minute before the compaction is due for 3 minutes.
**Good looks like:**
- In (a) the warm goes through at about 55-56 minutes; the warmer stays on and the cache countdown restarts at about 1 h.
- In (b) one notice says the compaction failed and will be tried again; it then runs once, before the cache lapses. Had the network stayed off past the lapse, one notice says it was skipped and nothing more is sent.
**Origin:** owner question (2026-11-21): a warm due 10 minutes before the lapse with the internet down for 5 of them; the stopping mechanism should ride out errors while the cache is still warm (O12).
