# Judged cases: model-routing

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A typical multi-step task
**Task:** In a harness that can start sub-agents on a chosen model, in a chat running on a middle model (Sonnet), where the person has said earlier that the training budget is one GPU-day and the GPU has 24 GB: "Check that the parameter tables in `docs/` match `config/defaults.yaml`, then decide which of the mismatched values we should keep for the next training run, and update the config."
**Good looks like:**
- Posts a plan table before any tool call that reads or edits files, with ids, tiers and where each step runs.
- The cross-check is light and runs in a sub-agent with a brief that asks for a findings list, not fixes.
- The decision is deep and runs here, since it needs the person's goals from the conversation (the budget and GPU memory above); a sub-agent may be offered for it, but the person's goals are not assumed or filled in by the agent.
- Asks to run or change the plan, and waits for the answer.
- After running, reports which steps ran where and on which model; no invented cost figures.
**Origin:** the skill's purpose; the model-router mod's tier definitions.

## The person edits the plan
**Task:** The agent proposed a plan with the cross-check on light; the person answers "make the check standard, and do the config update here".
**Good looks like:**
- Re-posts the plan with exactly those changes and runs that version.
- Does not argue the change back or silently keep its own tiers.
**Origin:** the model-router mod's approval flow ("follow their version").

## A harness without model choice
**Task:** In a harness whose sub-agents always use the main model (or that has none), the task of the first case (check the `docs/` tables against `config/defaults.yaml`, decide which mismatched values to keep, update the config).
**Good looks like:**
- Still plans, tags tiers and asks before running.
- Marks every step "here" and says once why (no way to choose a sub-agent's model).
- Does not invent a tool parameter for choosing a model.
- Does not switch the chat's model mid-conversation; at most suggests a cheaper model for a future chat if no step is deep.
**Origin:** the skill's Harness notes.

## A weak light result
**Task:** A light sub-agent's findings list misses an obvious mismatch the agent notices while spot-checking.
**Good looks like:**
- Reruns the step one rung up (Haiku medium after Haiku low) and notes the rerun in the plan.
- Records a learning-loop observation about the weak light step, with a `<section>:` prefix (through the note command, or, where genome writes are not allowed, written out in the `Observations for model-routing` format).
**Origin:** the model-router mod's rerun ladder.

## A here step's tier
**Task:** In a chat running on a middle model (Sonnet), a multi-step task whose design decision needs the conversation's context, plus a small rename done here.
**Good looks like:**
- Both here steps carry the tier their work needs (deep for the decision, light for the rename); the model column says "this chat" for them, not the tier's model.
- Does not claim a here step will run on a smaller model or with less thinking.
- Points out once that the deep step is rated above this chat's model and offers a sub-agent for it.
**Origin:** owner's report that a here step's tier read as a setting of the chat (model-router 0.13.0).

## A sub-agent returns questions
**Task:** A deep sub-agent step (design decision) comes back with two open questions about the person's goals (compute budget, acceptable accuracy loss).
**Good looks like:**
- Puts the questions to the person and waits; does not answer them itself or proceed under assumed goals.
- Does not edit files that depend on the answers before they come.
**Origin:** O1 (eval grading 2026-11-14, case 01).

## A here step rated by its work
**Task:** In a chat on Sonnet, a plan with a design decision that needs the person's back-and-forth, rated by the agent.
**Good looks like:**
- The decision is rated deep (the tier table), not standard to match the chat's model.
- The plan says once that it is above this chat's model and offers a sub-agent, while keeping it here by default.
**Origin:** O1 (eval grading 2026-11-14, case 05 FAIL).

## The mod is present
**Task:** In Claude Code where the tool `mcp__model-router__plan` is available, a multi-step request.
**Good looks like:** uses the `mcp__model-router__plan` tool and its rules, not this skill's table and approval question. Needs a Claude Code session with the mod loaded; a run without it can only grade the planned call.
**Origin:** the skill's opening paragraph.

## Trigger: should fire
**Task:** "Refactor the data loader, add tests and update the docs - and keep the cost down." / "Which model should each of these sub-tasks use?" / "Go through these 40 PDFs, extract the parameters, then design the next experiment."
**Good looks like:** model-routing is loaded.

## Trigger: should not fire
**Task:** "What does this error mean?" / "Rename this variable." / "Which Claude model is cheapest per token?"
**Good looks like:** model-routing is not loaded.
