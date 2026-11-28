# Changelog: model-router

Newest first. Entries up to 0.9.1 are reconstructed from the commit messages (git log); later entries cite observations (O-ids in LEARNINGS.md) or evals.

## 0.31.0 (2026-11-28)
- step artifact links, dependsOn, and human approval gates (O13)

## 0.30.4 (2026-11-25)
- After Show all on a short terminal the pane is paged: a fixed top row with Show less, ▲ Up, ▼ Down and n/m, then the pane from one block on (top, plan head, each step, cost, footer) (O12)

## 0.30.3 (2026-11-25)
- The glance has a Show all button (a tap or click; ctrl+x tab still works) and the full pane on a short terminal a Show less button, at its top and end (O10)

## 0.30.2 (2026-11-25)
- On a terminal under 50 rows the inline pane is a glance (plan progress, the step at work) until focused, leaving the band above the prompt its rows (O9)

## 0.30.1 (2026-11-24)
- routed subagents run in auto mode: the Agent call is left as written; model and scope note set at agent.spawn, effort at the subagent's turn.step (O8)

## 0.30.0 (2026-11-23)
- first-use welcome in the empty pane, Guide link in the footer, /router help, and a quiet daily update check (setting Check for updates, CLAUDE_PLUGINS_NO_UPDATE_CHECK=1, never for checkouts) with an update notice under the health line and /router update; versions shown to people come from plugin.json (owner request: his father found the mod too complex at first sight and did not know mods do not update by themselves)

## 0.29.5 (2026-11-23)
- a delegated step finished with no verdict is asked for in the next turn's router note (once per step), not only in the plan tool's result: after the last step of a plan the plan tool is usually not called again (O7: 47 of 130 runs had no verdict)

## 0.29.4 (2026-11-22)
- auto mode leaves runs with no verdict out of its share and can try the rung below a learned one (autoExplore, off by default) (O7)
- review fixes: overkill counts as passing for auto mode; parallel calls of a kind never both try; tries are decided only when an Agent call is routed (no false "user changed" notes, partial picks never inherit a try); no tries for counted steps; unjudged tries end at 2N; VERSION matches

## 0.29.3 (2026-11-22)
- rules return after a compaction the router never hears of: the chat row that carried them is checked each turn; status names the model without prompt.compose (sec-default on Team accounts) (O6)

## 0.29.2 (2026-11-20)
- Fixes from a Gemini 4 Neon review: a step's details always say what it runs on (a group with nothing run says so); dots count only values that are shown (the experiment's limit, Long/All steps while off); helper advice and proposals use only levels a model is offered at; 'install hc' only when hc is what is missing; checks skipped after a failure say skipped, pending rules are a quiet line, not ✗; an open ▾ list closes with its view; open groups drop their summary; provider names in Order; 'second' in the glossary; cost line in plain words; refused inputs say why.

## 0.29.1 (2026-11-20)
- Settings read calmly in the terminal: a setting's name bold with its control on one line and a short dim why under it; passing helper checks folded into one count; Helper models one line a provider, and another Claude account no longer marked as changed (it is compared with herdr-delegate's defaults for Claude accounts); Order's reset only when an order changed; no blank row between plan steps.

## 0.29.0 (2026-11-19)
- terminal pickers open a list, readable plan rows, helper model button no longer sticks, Herdr view as a right sidebar

## 0.28.0 (2026-11-19)
- strengths: kinds map to the model notes' tags (KIND_TAGS, editable per kind); Try suggestions under the advice for kinds without enough history (Apply sets the kind default or helper choice, Dismiss remembered); a model map in Settings > Learning showing what each kind would run on now

## 0.27.0 (2026-11-19)
- one pane layout on every surface (health, new models, plan, cost, footer; steps as two-line rows with details on click, Expand all replaces Minimal view); Settings as five Basics (Spend presets Thrifty/Balanced/Best quality) and seven closed groups with summaries; plain words (this chat, Claude agent, other subscription, effort) and a glossary; resets confirm

## 0.26.0 (2026-11-19)
- a state file per chat (~/.config/model-router/state) and a read-only Herdr mod (herdr/) that shows the plan, health, cost and new models in a docked right pane with normal scrolling, reading chats on remote machines through Herdr; Show in Herdr setting

## 0.25.0 (2026-11-19)
- new and gone models noticed by themselves (helpers.py models --cached/--json, a weekly background check, new Claude model ids); model notes (seed plus ~/.config/model-router/model-notes.json); the plan tool's models input for notes and proposals; a New models card with Apply and Dismiss; VERSION constant follows the plugin again

## 0.24.0 (2026-11-19)
- helper health line and checks; helper mode Herdr, direct (helpers.py run, herdr-delegate 0.15) or none, never offered when they cannot run; the helper rule reaches a chat when helpers change mid-chat; cut-short verdict left out of advice and auto mode; fallback reasons; empty states; JSONL log and /router report (O3, O4, O5)

## 0.23.0 (2026-11-13)
- helpers only from what is installed: no helpers.py, hc or helper CLI means no helper steps; pane explains how to enable them

## 0.22.0 (2026-11-11)
- Helper default orders, labels and usage units come from helpers.py's config (order, cli_found, self, unit, label), so other Claude accounts and Codex work as helpers: this account shown and skipped, percent units shown and summed per provider, Claude/Codex effort flags read; no helper CLI installed is said in Settings and left out of the rules; the strange-loop note needs a genome file; template and model paths honour XDG_CONFIG_HOME

## 0.21.0 (2026-11-08)
- Settings merge on write and refresh per turn, so another session's older copy no longer overwrites them; zero helper usage ignored, unreported runs shown, usage read by helpers.py usage (owner's request 2026-11-08)

## 0.20.0 (2026-11-07)
- Helper models like subagent tiers: Settings > Helpers has model and thinking pickers per provider and tier from herdr-delegate's helpers.py (set), a Check models button with its warnings, and models-checked date; advice per helper tier and kind with Apply (set, or a stored per-kind helper choice); with auto mode on or a kind choice, the router picks a helper model per step and names the template to launch (helpers.py custom) in the plan text, rules and card (owner's request 2026-11-07)

## 0.19.0 (2026-11-07)
- Helper steps show the helper's thinking level (reported by the lead or read from its template), pane edits to a running plan wait in a draft until Send changes (Discard drops them), auto mode's minimum runs and ok-share are settings, 5 runs and 90% by default (owner's request 2026-11-07)

## 0.18.0 (2026-11-07)
- Verdicts and facts per delegated run, kinds of work listed in the rules, learned advice per kind with Apply (kind defaults), auto mode, an open model list with editable prices and a ladder built from it, and a router note asking for a strange-loop observation when a kind's advice first reaches its threshold (owner's request 2026-11-07) (O1)

## 0.17.0 (2026-11-07)
- Nested plan parts (groups, count N parallel agents), helper and reported model shown on helper steps, helper usage and time recorded per step and added up per provider and unit in plan, chat and lifetime views (owner's request 2026-11-07)

## 0.16.0 (2026-11-07)
- Settings mirror to ~/.config/model-router, store writes gated on load with merge-on-write, helper order editor, coalesced mid-run step notes (owner's request 2026-11-07)

## 0.15.0 (2026-11-05)
- Here-step effort may also raise the chat's level: a started here step runs at its tier's effort, lower or higher than the chat's own (owner's request)

## 0.14.0 (2026-11-05)
- Here-step effort, an opt-in experiment (Settings → Experiment): a started here step runs at its tier's thinking level, never above the chat's own, only while the chat is under a context limit; every change of level is logged with the cache tokens the next request wrote and read (owner's request)

## 0.13.1 (2026-11-03)
- A here step's tier is a plain "rated <tier>" label instead of a picker; sending the step to a subagent brings the picker back (owner's request)

## 0.13.0 (2026-11-03)
- A here step's tier is a rating: the rules say no tier changes this chat's model or thinking, its picker reads "rated <tier>", and a here step rated above this chat's model is flagged on its card and in the plan the agent gets back (owner's report)

## 0.12.0 (2026-11-01)
- Copilot Fusion setting under Helpers: off, Max for deep, or High + Max, placed before the pinned Copilot helper

## 0.11.0 (2026-11-01)
- Minimal view (header button or Settings): the pane draws only steps and their pickers, no explanatory text, so a long plan fits without scrolling; settings groups get a coloured band and spacing, Done moves to the top of Settings

## 0.10.1 (2026-10-31)
- Terminal pane: pickers are buttons that cycle on Enter (marked ⇄) instead of Selects, whose list opened inline, shifted the row and could not be closed without picking (owner's report)
- Helper order rows drawn as one aligned line per tier

## 0.10.0 (2026-10-31)
- Helpers (other subscriptions), off by default: a third place a step can run, `helper`, started by a delegation skill (default `herdr-delegate`); rules, plan tool schema and pane are unchanged while off
- Default helper order at every tier: Kiro, then Copilot, then agy
- With helpers off, a `helper` step is stored as `agent`; a helper step run through the Agent tool becomes a subagent step; helper steps are never counted as agent steps or costed
- Fix: a new `steps` call after every step of the old plan is done is a new plan; reused ids no longer arrive already done

## 0.9.3 (2026-10-31)
- Terminal pane: compact cost line, plan first while awaiting approval, scroll hint

## 0.9.2 (2026-10-30)
- settings and cost rows wrap in a narrow pane; purpose headers on code files (O2)

## 0.9.1 (2026-10-28)
- live cost in every view; percentage saved

## 0.9.0 (2026-10-28)
- plan, chat and all-time cost views

## 0.8.4 (2026-10-27)
- explain here-steps; redesigned settings

## 0.8.3 (2026-10-27)
- settings open under their button

## 0.8.2 (2026-10-27)
- clearer plan approval choices

## 0.8.1 (2026-10-26)
- always write the rules into the chat

## 0.8.0 (2026-10-26)
- write rules into the chat at turn start; status check

## 0.7.0 (2026-10-26)
- rules reach desktop chats; plan returns after a summary

## 0.6.0 (2026-10-26)
- always-on status line, rules check, open-pane setting

## 0.5.0 (2026-10-26)
- costs, reruns, history, skill routing, settings pane

## 0.4.0 (2026-10-26)
- Always plan option

## 0.3.0 (2026-10-26)
- status line instead of the above-prompt band

## 0.2.0 (2026-10-26)
- Add model-router mod and marketplace (first version in the marketplace)

