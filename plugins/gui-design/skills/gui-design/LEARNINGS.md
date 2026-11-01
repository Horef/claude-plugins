# Learnings: gui-design

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-11-01 [friction] 7 Shoot: Pillow is not in the owner's default python3, so shot.py prints single PNGs and no contact sheet; looking costs one image per width x theme. A stdlib PNG tiler (or a note to pip install pillow at setup) would help. (claude-code, first release smoke test)
- O2 2026-11-01 [missing] 6 Surfaces: shot.py/lint_ui.py were never run against a live Streamlit app (settle and --full on Streamlit's inner scroll container untested); first real use on a Streamlit page should confirm or fix. (claude-code, first release)
- O3 2026-11-01 [wish] 6 Surfaces: Claude Code mod panes (terminal, desktop) cannot be rendered by the agent; a text dump of the drawn pane from the mod test harness would close the look loop for mods. (claude-code, first release; model-router 0.8-0.11 reworks)

## Resolved
