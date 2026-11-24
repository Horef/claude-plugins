
## Rules after a compaction on a Team account
**Task:** *(live)* On a Team or Enterprise account (the chat shows "model-router: its session.compact hook was skipped. \"cc-plugin-sec-default\" runs first..."), post a plan in a chat, run `/compact`, then send a message.
**Good looks like:**
- The first turn after the compaction carries a hidden note with the rules and "the conversation was summarized" with the plan's steps and their status; the turn after carries no second copy.
- With no plan, the status line reads `rules sent to <model>` once the rules are in the chat, not `rules go out with your next message`.
**Origin:** session-status-line 0.13.0 work (2026-11-22): sec-default sends session.compact and prompt.compose past every person's mod, so the router never heard of compactions there (O6).

## Routed subagents in auto mode
**Task:** *(live)* In a Claude Code chat in auto mode, post a plan with one `agent` step (say light, a file listing) and let the main chat delegate it.
**Good looks like:**
- The Agent call starts the subagent: no "a hook changed this call's input after auto mode reviewed it" refusal.
- The step's card shows the tier's model (e.g. haiku), and the subagent's requests go out at the tier's thinking level.
**Origin:** O8 (2026-11-24): the router rewrote the Agent call's model and effort in `tool.call`, after auto mode's server review, so every routed subagent was refused; 0.30.1 moves both to `agent.spawn` and the subagent's `turn.step`.
