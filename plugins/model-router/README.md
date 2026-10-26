# model-router

Routes each step of a multi-step task to the cheapest model tier that does it well.

- **Tiers** live in one file, `hooks/tiers.ts`: light (haiku, low effort), standard (sonnet, medium), deep (opus, high). Model aliases track the newest release, so a new model version needs no edit.
- **Policy**: the mod adds a short routing section to the system prompt. For a multi-step request the main agent first calls `mcp__model-router__plan` with steps tagged by tier and by where they run (`agent` or `here`).
- **Approval**: a new plan waits for your answer in the chat's question dialog (Approve / Approve, auto from now / Revise, or type a note). Auto-approve can be toggled in the band or the pane and is remembered across sessions.
- **Enforcement**: an Agent call whose description starts with `[<step id>]` gets its model and effort set from the plan, whatever the main agent asked for.
- **Band**: a one-line summary above the prompt in the main window (progress dots coloured by tier, the running step, subagent tokens, Plan and auto-approve buttons).
- **Pane** (`/router` or the band's Plan button): one card per step with dropdowns for tier, where, model and effort (buttons that cycle on mobile); a model or effort other than "(tier)" is an override. It shows tokens per step and for the main conversation (full-rate tokens, plus cache reads billed at about a tenth).

Limits: the main conversation's own model never changes; forks are never rerouted, since they always inherit the parent model.

## Install

```
/plugin install model-router --marketplace Horef/claude-plugins
```
