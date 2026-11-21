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
- The band's 🔥 shows the time to the next warm, about 55 minutes after the last request; the job's report-back restarts the countdown.
- *(live)* `warm status` reports warms whose cache served roughly the whole conversation (not `cold`), and nothing about them appears in the transcript or the context size.
- *(live)* The message after the wait reads the conversation from the cache (cost of that turn far below a full re-read) and no compaction happened during the wait.
- Past the end time the warmer is off and says so; clicking the 🔥 switches it on and off.
**Origin:** owner's request (2026-11-21): chats waiting hours for background runs were compacted or re-read at every wake-up.
