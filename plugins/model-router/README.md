# model-router

Routes each step of a multi-step task to the cheapest model tier that does it well, shows what it cost and what it saved, and learns from your reruns.

## How it works

- **Plan**: for a multi-step request the main agent first calls `mcp__model-router__plan` with steps tagged by tier (light, standard, deep) and by where they run (a subagent, or here in the main chat).
- **Parts**: a step may have `parts`, recursively (a part's id extends its parent's: `s3`, `s3.a`, `s3.a.1`), for work that splits into pieces that need different tiers or run side by side. A step with parts is a **group**: its tier only rates it, it is done when all its parts are, and its cost and usage are the sums of its parts. A part with `count: N` is N identical agents running in parallel under one id (N readers, say); it is done when the Nth run ends, and its agents' costs add up. Each part is delegated under its own id (`[s3.a.1]`); delegating the group itself is refused with the list of its parts. Naming a group in `done` marks its unfinished parts done; naming it in `start` starts them. A plan nested deeper than three levels of parts is still taken (the tool's schema spells out three). A repeated id is ignored and the agent is told.
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
- **Steps**: parts sit under their group, indented two cells a level (the indent stops at three levels). A group is a header with its rating, "n/m done" and the cost of its parts; every part is a card of its own with its own pickers, rerun and cost, and a `×N` tag (with the runs finished so far) when it has a count. Only the parts that do the work count as steps in the header, the status line and the Plan heading. A card per step with pickers for where (subagent, here, or helper when Helpers are on), tier, model and thinking level (buttons on mobile), its cost and tokens, and a warning when a step was mostly subagent start-up cost. A "here" step is done by this chat on its own model and thinking level, which no tier can change: its tier is a rating, shown as a label ("rated deep") that becomes a picker again when you send the step to a subagent, the default if you send it to a subagent, and a warning on the card and in the plan the agent gets back when the step is rated above this chat's model (a deep step in a Sonnet chat).
- **Edits after approval**: change a part's (or step's) where, tier, model or thinking level in the pane while the plan runs and the main agent is told at its next turn, as one router note per step or part with the final values (so cycling a picker through several values sends one note, and none if you put it back). Until then the card says "change noted, applies from the next turn". A rerun needs no note: its own message carries the new rung.
- **Rerun one rung up**: a finished step that came back weak can be redone on the next rung of the ladder (Haiku low → medium → high → Sonnet medium → high → Opus high → xhigh → Fable). The main agent is asked to delegate it again.
- **What the history says**: runs, reruns and average cost per model and thinking level, remembered across chats. When a tier's steps often need reruns, it suggests raising that tier; when none ever did, it suggests trying a cheaper rung. One click applies it.
- **Minimal view** (header button, or Settings → Minimal view): the pane draws only what you act on: two lines per step (title, then its pickers with cost and rerun), the cost line, and tier suggestions. No cards, notices or explanatory text, so a long plan fits without scrolling. The setting is remembered across chats.
- **Settings** (opens right under its button, closes with Done, which sits at the top):
  - Always plan, auto-approve and Minimal view. Groups start with a coloured band; in Minimal view their help texts are left out too.
  - Each tier's model and thinking level.
  - An optional scope note per tier. It adds one line to that tier's briefs: stay on the task, don't start sessions or load extra tools. Off by default.
  - Skills that should run in a subagent on a tier. A skill you've used shows up here; you can also add one by name.
  - Open pane on start: opens the pane in every new chat.
  - Reset statistics clears the all-time numbers; Clear history clears the per-run history behind the tier suggestions.
  - A small • marks every value that differs from the default, with a one-line legend, so you can see which of your own values are active.

All settings and the history are remembered across chats, in the mod's store. Settings, auto-approve and always-plan are also mirrored to `~/.config/model-router/settings.json` on every change: when the store is new and empty (re-adding the marketplace creates one), they come back from that file; when the store has settings, it wins and rewrites the file. History and the all-time numbers live only in the store, and nothing is written to the store until it has been read, so a response arriving while a chat loads cannot overwrite them with zeros.

**In the terminal** the pane scrolls with the keyboard: ctrl+x tab (or a click) gives it the keys, ↑↓ scroll, Esc returns to the prompt; the mouse wheel works where the terminal passes it through. A line at the top says so. The layout is compact there: the cost is one line, and while a plan awaits approval the steps come first and the cost after them.

## Helpers (other subscriptions)

Off by default; while off, nothing helper-related in the rules, the plan tool or the pane changes. When on, a plan step can run in a third place, **helper**: an agent on another subscription (Kiro, Copilot, agy) that the main chat starts through a delegation skill.

- **Needs**: the delegation skill (default `herdr-delegate`; the name is a stored setting under `helpers`; each tier's helper order is edited in the pane), herdr-core `hc`, and at least one helper CLI. The mod runs no shell commands, so it never checks that they exist; it only shapes the plan and the rules.
- **Turn it on**: Settings → Helpers → "Helpers (other subscriptions)". The plan tool offers `helper` from then on: switching registers the tool again, which replaces its schema at once (and costs the chat one prompt-cache refresh).
- **Use for** (Settings): *long steps* sends only long self-contained steps (research, code to a spec, sweeps, over ~15 tool calls) to helpers and leaves shorter ones to subagents; *all steps* sends every self-contained step that would otherwise be a subagent step.
- **Order**: each tier lists the helpers to try, e.g. deep: `kiro-deep → copilot-deep → agy-deep`. The plan and the step cards show it. Settings → Helpers lists each tier's helpers in order with ↑ / ↓ to move one and *off* to drop it (dropped helpers come back with *+ name*), and *Reset to default order*. The order is stored as the comma string under `helpers.tiers.<tier>`. A changed order reaches a chat that already has the rules as one router note (none if it is back to what the chat was told).
- **Copilot Fusion** (Settings, off by default): *Max for deep* adds `copilot-fusion-max` to the deep order; *High + Max* also adds `copilot-fusion-high` to standard. Each goes just before the pinned Copilot helper, since both use Copilot's quota. Fusion is GitHub's router across Claude and GPT-6 models, not a fixed model. Fusion Max scored close to Claude Code with Opus 5.5 at max effort for about half the cost; High has not been measured (herdr-delegate's SKILL.md has the details). Changing it mid-chat sends the new orders to the chat as a router note.
- **Without helpers**: when none is usable (no `hc`, no CLI, nothing the picker finds), the main chat runs the step as a normal subagent and says so. A helper step run that way becomes a subagent step, routed and costed like any other.
- Helper steps have no Claude subagent usage, so they show no cost and are not counted in the subagent totals. The main chat marks them done itself.
- **Which helper, which model**: when the main chat starts a helper step it calls the plan tool with `start: [{id, helper: "copilot-standard", model: "Claude Sonnet 5.5"}]` (plain ids still work): the template it launched and the model the helper reports on its own screen. The card shows "copilot-standard · Claude Sonnet 5.5". The router does not check the model against the template's name; it shows what was reported.
- **Helper usage**: when it marks the step done the main chat passes the usage line the helper's screen ends with: `done: [{id, usage: {provider: "copilot", amount: 30.04, unit: "AIC"}}]` (Copilot: "Session: N AIC used"; Kiro: its credits line, unit "credits"). It is recorded once per step; the card shows it with how long the step ran (from start to done), and nothing is converted to money. Plain ids still work.
- **What moved off Claude**: the cost card (plan, chat and all-time views) adds a line such as `Moved off Claude: 4 helper steps, 38 min; Copilot 30.04 AIC; Kiro 2.1 credits`: finished helper steps, their running time, and the usage added up per provider and unit. The all-time numbers are remembered like the others (merged into the store on write); Reset statistics clears them. A step that reports no usage still counts as a step.
- With helpers off, a `helper` step in a plan is treated as a subagent step.

## Here-step effort (experiment, off by default)

A here step runs on this chat's model, which a plan cannot change mid-chat. This experiment changes the chat's thinking level instead.

- **Turn it on**: Settings → Experiment → "Adjust effort of here steps". The plan tool then takes `start: [<id>]`, and the rules ask the agent to call it before each here step.
- **What it does**: while a started here step runs, each request of this chat goes out at that step's tier's thinking level (light low, standard medium, deep high by default), lower or higher than the chat's own: a deep step in a chat on medium runs at high. Marking the step done returns the chat to its own level. Subagent requests are never touched.
- **Why a limit**: on most setups a change of level makes the API write the whole conversation to the prompt cache again, instead of reading it. So the router switches only while the chat is under a context limit (20k, 40k by default, 80k or 150k tokens). Over the limit the step keeps the chat's level and its card says why.
- **What it measures**: every change of level, and how many tokens the request after it wrote to the cache and read from it, remembered across chats (store key `effortLog`, last 200). Settings shows the totals. Mostly written means the switch cost a cache rewrite; mostly read means it did not. This is how to find out what a switch costs on your plan; the numbers are tokens, not your subscription's usage.
- **Limits**: the router records the level it asked for. Where the model takes effort per message, the engine may hold a change back until your next message, so a step inside one long reply may still run at the old level. Thinking already scales with the work, so the saving is unmeasured.

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
