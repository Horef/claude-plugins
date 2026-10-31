---
name: model-routing
description: "Plan multi-step work as steps tagged light, standard or deep, get the person's approval, then run each step on the cheapest model that does it well: a cheaper sub-agent where the harness can start one, the main chat where the step needs its context. For agents without the model-router mod (GitHub Copilot, Kiro, Codex, Cursor, claude.ai). Use when a task has several distinct steps, when asked to save tokens or cost, or to pick models for sub-tasks."
---

# Model routing

Most tasks mix easy and hard steps: checking documents against each other, then deciding how to train a model. Every step can run on the most capable model, but the easy ones cost several times more there than they need to. This skill splits a task into steps, labels each by how much judgment it needs, agrees the plan with the person, and runs each step on the cheapest model that does it well. It is the portable form of the **model-router** mod for Claude Code. **If a tool named `mcp__model-router__plan` is available, use that tool and its rules instead of this skill:** the mod enforces the routing and counts the cost. This skill is not for single questions or conversation: planning them costs more than it saves.

## Tiers

| Tier | For | Default model (Claude) | Thinking |
|---|---|---|---|
| light | Mechanical work with a clear rule: cross-checking documents, finding and listing, extracting values, scanning logs or outputs, packaging | Haiku | low |
| standard | Following detailed instructions: code to a spec, figures and slides, summarizing papers, web research | Sonnet | medium |
| deep | Open judgment: research and design decisions, unclear failures, reviewing reasoning | Opus | high |

In a harness with other models, map the tiers to its small, middle and large models. If the person keeps a mapping in `~/.config/model-routing/tiers.md`, use theirs.

**Where** a step runs is separate from its tier:
- **here**: the main chat does it, on whatever model the chat runs. For steps that need the conversation's accumulated context or back-and-forth with the person, and for small steps (under about five tool calls): a sub-agent spends roughly 15-40k tokens just starting and reading its brief. For a "here" step the tier is only a label.
- **sub-agent**: a separate agent on the tier's model. For self-contained steps, above all ones that read a lot.

Don't switch the main chat's model in the middle of a conversation to save money: the new model re-reads the whole conversation without the prompt cache, which usually costs more than it saves. If a plan has no deep step and the chat runs on the most capable model, say once that a cheaper model could run a chat like this, as a suggestion for the next one.

## Steps

1. **Decide whether to plan.** Plan when the request has several distinct steps, or more than a handful of tool calls in all. Otherwise just do it.
2. **Write the plan** as a short table: id (`s1`, `s2`, …), the step in a few words, tier, where, and the model each sub-agent step will use. Keep steps that must share context together.
3. **Ask before running.** Show the table and ask: run it as it is, or change the steps? The person may change tiers, where steps run or models; follow their version. If they have said not to ask (auto-approve), state the plan and start.
4. **Run each step.**
   - *Sub-agent steps:* start a sub-agent on the step's model and thinking level, if the harness can choose them (see Harness notes). Give it a self-contained brief: the goal, the files, what to return. A light brief asks for a findings list, not fixes; spot-check anything surprising before acting on it. If the harness cannot start a sub-agent on a chosen model, run the step here and say so in the plan.
   - *Here steps:* do them in the main chat.
5. **Keep the plan visible.** After each step, show the table again with its status (planned, running, done), or a one-line progress note for long plans. After the conversation is summarized or compacted, restate the current plan and its status from the last table before continuing.
6. **Rerun weak results one rung up.** If a sub-agent's result is not good enough, redo the step one rung up this ladder and note it in the plan: Haiku low → Haiku medium → Haiku high → Sonnet medium → Sonnet high → Opus high → Opus xhigh. If a tier needs reruns often, suggest raising that tier's default.
7. **Report at the end:** which steps ran where and on which model, and any reruns. Give cost figures only if the harness reports usage; never estimate them from guesses.

## Harness notes

- **Claude Code without the mod:** the Agent tool takes `model` (`haiku`, `sonnet`, `opus`) and `effort` (`low` to `max`); start each call's description with `[<step id>]`. A `fork` sub-agent always inherits the parent's model, so never use one for a routed step.
- **Other agents (Copilot, Kiro, Codex, Cursor, claude.ai):** use the harness's own way of starting a sub-agent with a chosen model, if it has one; read its documentation rather than guessing a parameter. Where it has none, every step runs here: the plan, the approval and the tiers still pay off, because they keep easy steps short and show which ones deserve a stronger model in another chat or tool.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer). Typical moments: a light step that needed a rerun, a harness where choosing a sub-agent's model worked or failed (name the harness), a plan the person changed in the same way twice, a sub-agent step that cost more to start than it saved.

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note model-routing <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell), end your reply with a block headed `Observations for model-routing` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
