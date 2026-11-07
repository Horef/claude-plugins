# Changelog: model-router

Newest first. Entries up to 0.9.1 are reconstructed from the commit messages (git log); later entries cite observations (O-ids in LEARNINGS.md) or evals.

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

