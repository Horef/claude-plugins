# Judged cases: gui-design

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation. Scripted checks of the tools are in `run.py`.

## Rework an overloaded inspection viewer
**Task:** "This replay page is overwhelming: too many boxes, notices and text, and the text runs out of its boxes. Make it usable." Inputs: a Streamlit page that embeds an HTML viewer, as described in `references/case-replay-viewer.md` (run/condition/set/trial pickers, a verification banner shown twice, storage and payload details, recording-step radio, permanent instructions, three panels with long captions, eight group chips, three trace rows).
**Good looks like:**
- Starts with a task inventory and a first-screen inventory with counts, before any code.
- The verification result appears once, quietly (an icon or a word plus detail on click); no fact is shown twice.
- Paths, payload sizes and storage go to layer 3 or a Details expander; re-making a bundle is no longer on layer 1.
- Every feature of the original is still reachable (capability list checked).
- `lint_ui.py` is run on the result with no text-overflow problems, and fewer controls, boxes and notices than before are reported with numbers; before and after shots are shown.
**Origin:** owner's screenshots of the simple_complex_v1 replay viewer, 2026-11-01.

## Settings panel with many options
**Task:** "Add a Settings panel to the router pane" with 14 options: always plan, auto-approve, compact view, three tier models, helper order, fusion on/off, reset tiers, clear history, reset statistics, and three per-tier notes.
**Good looks like:**
- Grouped by task, the most used first; layer 1 holds at most about 7 controls; the rest sits in named, collapsed groups whose handles say what is inside.
- Every row has a one-line help that says what it changes (not its name restated); destructive resets are quiet and confirm with the count.
- No "minimal mode" switch replaces the layer plan, unless the profile asks for one.
- The handover says the terminal layout was not seen, and lists the row count against the pane height.
**Origin:** model-router 0.8.3, 0.8.4, 0.9.2 and 0.11.0 reworks (Settings went from bare toggles, to help under every row, to a second hidden mode).

## Too-thin trap
**Task:** "Make me a minimal settings page for this tool, just the essentials." The tool has 9 options, 3 of which change results in non-obvious ways.
**Good looks like:**
- The 3 non-obvious options keep a one-line why or a `?` popover.
- The options left off layer 1 are still reachable through a labelled "More settings (n)" handle.
- The agent states the layer choices instead of silently dropping options.
**Origin:** the owner's complaint that GUIs come out "too thin, missing the interesting options and explanations".

## Interactive explainer for colleagues
**Task:** "Build an interactive page that shows colleagues how lateral inhibition sharpens a response profile", as single-file HTML.
**Good looks like:**
- One idea; a guided first state that already shows the sharpening; 1-3 controls next to the graphic with value and unit; the readout updates while dragging.
- 2-4 named presets, including one in the interesting regime; reset to the starting state.
- Text and graphic agree (the prose that states the result updates, or does not claim numbers).
- The loop has run: lint clean at 390 and 1280 px in both themes, and the agent read the contact sheet.
**Origin:** the skill's purpose (explainers presented to other people).

## No profile
**Task:** a request for a small dashboard with no `~/.config/gui-design/profile.md` and no standing instructions.
**Good looks like:**
- Assumes one expert user, balanced density, light and dark; asks at most one question, and only if the audience or surface changes the build.
- States the assumptions in the handover and offers to write a profile.
**Origin:** the skill's setup rule (mirrors scientific-figures).

## Honest about what was not seen
**Task:** change the layout of a Claude Code mod pane (terminal surface).
**Good looks like:**
- The handover says "layout not seen", lists what was checked (tests, row count against the pane height, narrow-width test), and asks for a screenshot.
- Nothing is called "verified" about the layout.
**Origin:** model-router 0.11.0 worklog ("not verified: how it looks in the real terminal").

## Pickers that say what they pick
**Task:** "Add a trial picker to this replay page." Inputs: a stimulus set of bar trials that differ in position (−6.25, 0, 6.25, 12.5°) and polarity (ON/OFF), 3 repeats each, with ids `bar/p0/r0` ...; the set is named `alt_s6p25_n2`.
**Good looks like:**
- Each option names the values that differ within the set (position, polarity, repeat), not only kind and orientation; no two options read the same.
- One quiet line next to the set picker decodes the set (2 bars, alternating polarity, 6.25° apart, positions x polarities x repeats).
- The labels are generated from the data, so a grating set gets phase or direction instead, with no per-set code.
**Origin:** owner's screenshots of the simple_complex_v1 replay Trial picker ("bar ori 0°, r0" repeated) and Stimuli table without bar parameters, 2026-11-02.

## Trigger: should fire
**Task:** "Build a settings panel for this mod"; "this Streamlit viewer is too cluttered, clean it up"; "make an interactive demo of momentum in gradient descent for my students".
**Good looks like:** gui-design is loaded.

## Trigger: should not fire
**Task:** "Plot these tuning curves for my notes" (scientific-figures); "pick colours for this chart series" (dataviz); "write the README for this tool".
**Good looks like:** gui-design is not loaded.
