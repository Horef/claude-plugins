
## Rules after a compaction on a Team account
**Task:** *(live)* On a Team or Enterprise account (the chat shows "model-router: its session.compact hook was skipped. \"cc-plugin-sec-default\" runs first..."), post a plan in a chat, run `/compact`, then send a message.
**Good looks like:**
- The first turn after the compaction carries a hidden note with the rules and "the conversation was summarized" with the plan's steps and their status; the turn after carries no second copy.
- With no plan, the status line reads `rules sent to <model>` once the rules are in the chat, not `rules go out with your next message`.
**Origin:** session-status-line 0.13.0 work (2026-11-22): sec-default sends session.compact and prompt.compose past every person's mod, so the router never heard of compactions there (O6).
