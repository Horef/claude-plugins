# Changelog: model-router

Newest first. Entries up to 0.9.1 are reconstructed from the commit messages (git log); later entries cite observations (O-ids in LEARNINGS.md) or evals.

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

