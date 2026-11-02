# Learnings: gui-design

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O3 2026-11-01 [wish] 6 Surfaces: Claude Code mod panes (terminal, desktop) cannot be rendered by the agent; a text dump of the drawn pane from the mod test harness would close the look loop for mods. (claude-code, first release; model-router 0.8-0.11 reworks)

## Resolved
- O2 2026-11-01 [missing] 6 Surfaces: shot.py/lint_ui.py were never run against a live Streamlit app (settle and --full on Streamlit's inner scroll container untested); first real use on a Streamlit page should confirm or fix. (claude-code, first release) (confirmed by O4 and the 14-page Streamlit pass: lint and shots on every page) → 0.3.0
- O4 2026-11-01 [win] 6 Surfaces: shot.py --full on a live Streamlit app (1.64, port 8599, replay page with an embedded components.html viewer) worked first time, iframe content included; answers half of O2. (claude-code, simple_complex_v1 replay rework, baseline) (answers O2) → 0.3.0
- O8 2026-11-01 [win] 8 Rework: shared parts first, then pages in parallel on worktree branches (one helper per batch, a shared common brief with the Replay lessons) reworked 14 pages overnight; lint problems fell e.g. 63->6 (Cell), 23->4 (System); merge conflicts only in generated docmap blocks, healed by docmap update. (claude-code, simple_complex_v1 GUI-wide pass) → 0.3.0
- O7 2026-11-01 [missing] 7 Shoot: headless Chrome renders no WebGL, so Plotly 3D figures show 'WebGL is not supported' in shots (Cell 1542 page); try --use-angle=swiftshader / --enable-unsafe-swiftshader in browser.py and say 'not seen' when WebGL is unavailable. (claude-code, simple_complex_v1 GUI-wide pass) → 0.3.0
- O6 2026-11-01 [friction] 7 Lint: the density control count includes the app's navigation (Streamlit sidebar: 14 page links + popovers), so making the nav fully visible raised every page's count by ~6 and hid real page changes; report navigation/sidebar controls separately (or count only the main region) so --max-controls judges the page. (claude-code, simple_complex_v1 GUI-wide pass, 14 pages) → 0.3.0
- O1 2026-11-01 [friction] 7 Shoot: Pillow is not in the owner's default python3, so shot.py prints single PNGs and no contact sheet; looking costs one image per width x theme. A stdlib PNG tiler (or a note to pip install pillow at setup) would help. (claude-code, first release smoke test) → 0.3.0
- O5 2026-11-01 [missing] 7 Lint: lint_ui.py checks only the top document; a Streamlit components.html iframe (the whole replay viewer) is skipped, so density and overflow of embedded components go unreported. Workaround: build the component HTML standalone and lint that file. Fix: evaluate the checks in every same-origin frame (CDP frame tree / execution contexts) and report per frame. (claude-code, simple_complex_v1 replay rework, baseline) → 0.2.0
