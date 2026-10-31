# Judged cases: session-status-line

Each case: a task, the rubric a blind judge applies, and where the case came from. This is a mod, not a skill, so there are no trigger cases; the scripted checks are `tests/render.test.tsx`.

## A typical session
**Task:** Open a new chat with the mod loaded on a subscription account, send a few prompts that edit a file, then look at the line above the prompt.
**Good looks like:**
- The line shows ✅ when idle and ⏳ while a reply streams.
- Model name and effort tag match `/model` and the effort setting.
- The context percentage and bar grow as the chat grows, and the colour follows the thresholds.
- `5h` and `7d` show a percentage and a time to reset; cost, last-turn time and the files count appear after the first turn and edit.
- Nothing shows "undefined" or "NaN"; parts without data are simply absent.
**Origin:** the mod's purpose.

## Narrow window
**Task:** Make the window narrow enough that one line does not fit; run `/status-line debug`.
**Good looks like:**
- In `auto` the row becomes two lines instead of cutting parts off; the budget line keeps the limits and their reset times.
- `/status-line debug` reports version, surface and a band width that matches what is drawn.
- `/status-line one` forces a single line that drops parts in `dropOrder`; `/status-line two` forces two lines; the choice survives a new chat.
**Origin:** the first desktop-app screenshots, where the single line cut off the reset times.

## Compaction counter
**Task:** Run `/compact` twice in one chat, then close and resume the chat.
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
- Every colour is readable on all three backgrounds; none is washed out.
**Origin:** the owner found plain yellow unreadable on off-white.
