# model-router

Routes each step of a multi-step task to the cheapest model tier that does it well, shows what it cost and what it saved, and learns from your reruns.

## How it works

- **Plan**: for a multi-step request the main agent first calls `mcp__model-router__plan` with steps tagged by tier (light, standard, deep) and by where they run (a subagent, or here in the main chat).
- **Approval**: the plan waits for your answer in the chat's question dialog. Edits you make in the pane while it waits (tier, where, model, thinking) are kept whatever you pick.
  - **Run it**: go with the plan as it now stands in the pane.
  - **Run it, and auto-approve future plans**: the same, and later plans run without asking.
  - **Change the steps**: the steps themselves need work (add, drop, split or reword). Nothing runs; the model asks what to change, or, if you typed it under Other, revises right away and asks again.
- **Routing**: an Agent call whose description starts with `[<step id>]` gets its model and thinking level from the plan, whatever the main agent asked for. Forks are never rerouted, since they always inherit the parent model.
- **Always plan** (Settings): every message you type carries a hidden reminder to plan before using tools.

## The pane (`/router`)

- **Cost**: a switch picks the span.
  - **This plan**: the main chat since the plan was posted, its subagents, and what they saved. A new plan (no step in common with the last) starts a new count.
  - **This chat**: since the chat was opened or its plugins reloaded; earlier turns are not counted.
  - **All time**: what delegating saved, what the subagents cost and what they would have cost on the main model, steps and plans by tier, since the first use or the last reset. Remembered across chats as a handful of numbers.
  Every view moves together: cost is counted per model response as it arrives, not when a step finishes. Saved also shows as a share of what the same work would have cost without routing (the main chat plus the subagents' tokens at the main model's prices).
  All amounts are estimates from list prices (`hooks/tiers.ts`) and the token counts the API reports; savings compare each step with the main chat's model doing the same tokens.
- **Steps**: a card per step with pickers for where, tier, model and thinking level (buttons on mobile), its cost and tokens, and a warning when a step was mostly subagent start-up cost. A "here" step is done by this chat on its own model; its tier is only a label until you send it to a subagent, and its card says so.
- **Rerun one rung up**: a finished step that came back weak can be redone on the next rung of the ladder (Haiku low → medium → high → Sonnet medium → high → Opus high → xhigh → Fable). The main agent is asked to delegate it again.
- **What the history says**: runs, reruns and average cost per model and thinking level, remembered across chats. When a tier's steps often need reruns, it suggests raising that tier; when none ever did, it suggests trying a cheaper rung. One click applies it.
- **Settings** (opens right under its button, closes with Done):
  - Always plan and auto-approve.
  - Each tier's model and thinking level.
  - An optional scope note per tier. It adds one line to that tier's briefs: stay on the task, don't start sessions or load extra tools. Off by default.
  - Skills that should run in a subagent on a tier. A skill you've used shows up here; you can also add one by name.
  - Open pane on start: opens the pane in every new chat.
  - Reset statistics clears the all-time numbers; Clear history clears the per-run history behind the tier suggestions.

All settings and the history are remembered across chats.

## Keeping the rules in front of the model

- **In every chat** the mod writes the rules into the conversation as a hidden note at the start of the first turn after it loads. It also adds them to the system prompt, but some hosts (the desktop app among them) supply their own system prompt and drop added sections without a trace, so only the note counts as delivered.
- **After a summarization** of the chat, the next turn gets the rules again (where needed) and the current plan with each step's status, from the router's own record.
- **Always plan** and router notes use the same hidden note, at the start of each turn.
- **Check it**: ask the model to call the plan tool with `status: true`. It reports the version, how the rules are delivered, whether they are in the chat, and counters.
- The plan, costs, history and settings live in the mod, not in the conversation, so a summary never loses them.

## The status line

Always shown under the prompt, so you can see the router is on:

- With no plan: `⇄ Router on · rules sent to opus · /router for the pane`. "Rules sent" appears once the rules are written into the chat; until then (a fresh load, or right after a summary) it says they go out with your next message.
- With a plan: progress dots, the running step and its model, subagent cost and savings.

Limits: the main chat's own model never changes; the pane suggests switching it to Sonnet when a plan has no deep step.

## Install

```
/plugin install model-router --marketplace Horef/claude-plugins
```

Chats that were already open load it after `/reload-plugins`, typed in that chat; new chats load it by themselves.
