# model-router

Routes each step of a multi-step task to the cheapest model tier that does it well, shows what it cost and what it saved, and learns from your reruns.

## How it works

- **Plan**: for a multi-step request the main agent first calls `mcp__model-router__plan` with steps tagged by tier (light, standard, deep) and by where they run (a subagent, or here in the main chat).
- **Approval**: the plan waits for your answer in the chat's question dialog (Approve / Approve, auto from now / Revise, or type a note). Change any step in the pane before you answer.
- **Routing**: an Agent call whose description starts with `[<step id>]` gets its model and thinking level from the plan, whatever the main agent asked for. Forks are never rerouted, since they always inherit the parent model.
- **Always plan** (Settings): every message you type carries a hidden reminder to plan before using tools.

## The pane (`/router`)

- **Cost**: this chat, the subagents, and what routing saved, estimated from list prices (`hooks/tiers.ts`) and the token counts the API reports. Savings compare each step with the main chat's model doing the same tokens, so they are an estimate.
- **Steps**: a card per step with pickers for tier, where, model and thinking level (buttons on mobile), its cost and tokens, and a warning when a step was mostly subagent start-up cost.
- **Rerun one rung up**: a finished step that came back weak can be redone on the next rung of the ladder (Haiku low → medium → high → Sonnet medium → high → Opus high → xhigh → Fable). The main agent is asked to delegate it again.
- **What the history says**: runs, reruns and average cost per model and thinking level, remembered across chats. When a tier's steps often need reruns, it suggests raising that tier; when none ever did, it suggests trying a cheaper rung. One click applies it.
- **Settings**:
  - Always plan and auto-approve.
  - Each tier's model and thinking level.
  - An optional scope note per tier. It adds one line to that tier's briefs: stay on the task, don't start sessions or load extra tools. Off by default.
  - Skills that should run in a subagent on a tier. A skill you've used shows up here; you can also add one by name.

All settings and the history are remembered across chats. The status line under the prompt shows progress, the running step and the money.

Limits: the main chat's own model never changes; the pane suggests switching it to Sonnet when a plan has no deep step.

## Install

```
/plugin install model-router --marketplace Horef/claude-plugins
```
