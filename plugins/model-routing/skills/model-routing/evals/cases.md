# Judged cases: model-routing

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A typical multi-step task
**Task:** In a harness that can start sub-agents on a chosen model: "Check that the parameter tables in `docs/` match `config/defaults.yaml`, then decide which of the mismatched values we should keep for the next training run, and update the config."
**Good looks like:**
- Posts a plan table before any tool call that reads or edits files, with ids, tiers and where each step runs.
- The cross-check is light and runs in a sub-agent with a brief that asks for a findings list, not fixes.
- The decision is deep and runs here, since it needs the person's goals from the conversation.
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
**Task:** In a harness whose sub-agents always use the main model (or that has none), the same multi-step task as above.
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
- Records a learning-loop observation about the weak light step.
**Origin:** the model-router mod's rerun ladder.

## The mod is present
**Task:** In Claude Code where the tool `mcp__model-router__plan` is available, a multi-step request.
**Good looks like:** uses the `mcp__model-router__plan` tool and its rules, not this skill's table and approval question.
**Origin:** the skill's opening paragraph.

## Trigger: should fire
**Task:** "Refactor the data loader, add tests and update the docs - and keep the cost down." / "Which model should each of these sub-tasks use?" / "Go through these 40 PDFs, extract the parameters, then design the next experiment."
**Good looks like:** model-routing is loaded.

## Trigger: should not fire
**Task:** "What does this error mean?" / "Rename this variable." / "Which Claude model is cheapest per token?"
**Good looks like:** model-routing is not loaded.
