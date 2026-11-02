---
name: gui-design
description: "Design GUIs people actually use: tool and mod panels, settings pages, inspection viewers, dashboards and interactive explainers, at the right density (everything needed on screen or one click away, rarer flows behind more steps, more detail on request). Layered disclosure rule, settings and explainer patterns, surface limits, a build-lint-shoot-look loop with screenshots at several widths in light and dark, and a profile for audience and taste. Use when building or reworking any GUI, panel, page, viewer or interactive demo, or when one feels too complex or too thin."
---

# GUI design

Use this skill whenever you build or rework something a person operates or reads on screen: a mod or tool panel, a settings page, a data inspection viewer (Streamlit, single-file HTML, an embedded component), a dashboard, an interactive explainer. It is not for static figures (use scientific-figures), chart styling alone (dataviz) or the prose of a README.

It distils Wathan & Schoger *Refactoring UI*, Tidwell et al. *Designing Interfaces* (3rd ed.), Cooper et al. *About Face* (4th ed.), Few *Information Dashboard Design*, Podmajersky *Strategic Writing for UX*, NN/g and GitLab Pajamas on progressive disclosure, Hohman et al. *Communicating with Interactive Articles* (Distill), Victor *Explorable Explanations* and *Magic Ink*, and the Command Line Interface Guidelines (full list: `references/sources.md`). The details live in `references/`; this file is the procedure and the rules you apply every time.

**The core problem this skill solves.** An agent builds a GUI blind and puts on it everything it knows: every parameter, every status, every caption, a notice for each event. The result is either overwhelming (too many boxes, text running out of them, the same status twice, developer detail on the first screen) or, after a "make it simpler" request, too thin (the interesting options and explanations gone). So: **decide the layers before building, and never call a GUI done until (1) the linter is clean and (2) you have looked at screenshots of it.** Where you cannot take a screenshot, say "not seen".

## 0. Setup (once per task)

1. `SKILL` = this skill's folder: in Claude Code `${CLAUDE_PLUGIN_ROOT}/skills/gui-design`; in a clone of the genome `<genome>/plugins/gui-design/skills/gui-design` (the clone's path is in `~/.config/strange-loop/genome`).
2. Tools in `SKILL/scripts/` need Python 3 (standard library; Pillow optional, it only makes the contact sheet faster) and Google Chrome, Chromium or Edge (`$GUI_CHROME` overrides the search). `shot.py` takes screenshots, `lint_ui.py` reports mechanical faults and a density report. Both take an HTML file or a URL (a Streamlit app on `http://localhost:8501`), and both exit 2 when no browser is available. Exit 2 means not checked: never report it as clean.
3. **Read the person's GUI profile** if there is one: `~/.config/gui-design/profile.md` (format: `profile.example.md` next to this file), or their standing instructions in a chat app. It names the audience, surfaces, density, how much to explain, and apps they like or dislike; each line overrides a default here. Without a profile, assume one expert user (the person asking), balanced density, light and dark, and ask only if the audience or surface changes the build. When the person states a lasting preference, offer to add it to the profile.

## 1. Before building: job, tasks, posture, surfaces

Write these down (in your reply or a comment at the top of the file) before any layout code:

- **The job in one sentence:** "the user picks a run and checks that the replay matches it" or "the user changes how steps are routed". If it needs "and" twice, it is two views.
- **The task inventory.** List what the user does here and how often: *every visit*, *often*, *sometimes*, *rarely*. Include reading tasks ("check the run verified"), not only controls. This list decides the layers (section 2); without it you will put everything on layer 1.
- **Posture** (About Face ch. 9): a *sovereign* view is kept open for long stretches (a viewer, a dashboard): calm palette, small dense controls, status in the margins. A *transient* view is opened, used and closed (a settings panel, a picker, a mod pane): one view, clear labels, nothing nested, remembers its last state.
- **Surfaces** where it runs, each with its limits (section 6). The narrowest surface sets the layer-1 budget.
- **The capability list:** everything the GUI must make reachable. You will check it at the end so that simplifying never drops a feature.

## 2. The layer rule (the core of this skill)

Every item (control, number, status, explanation) goes into exactly one layer, by **how often the user needs it**, not by how interesting it is or how easy it was to build (NN/g; Designing Interfaces ch. 2; About Face ch. 10).

| Layer | Reached by | Holds |
|---|---|---|
| **1. On screen** | nothing | the object or result the user came for; the controls used on every visit; state that changes a decision (running, failed, stale, unsaved); one primary action |
| **2. One gesture** | expander, popover, `?`, tab, row click, hover *and* focus; opens in place | the "interesting options": secondary settings, exact values, per-item detail, the one-line why behind a control, definitions, comparisons |
| **3. Further** | a separate page, dialog, docs, log file | rare flows (setup, import, re-make, delete), raw data, paths and sizes, long explanations |

Rules:
- **Content first.** The thing the user came for starts in the top third of the first screen, and its primary control (Play, Run, Save) sits next to it, visible without scrolling. Setup goes in one slim row above it, not a page of selectors.
- **Two levels inside the view at most.** Layer 3 leaves the view and does not count. No expander inside an expander. If you need a third level, cut or regroup (`references/disclosure.md`).
- **Hide nothing silently.** Every layer-2 or layer-3 item has a visible, labelled handle that says what is inside: "Advanced: scale, order, range", "Storage (19.7 MB)", "3 more". If a hidden section holds an error, a running job or a non-default value, its handle shows that with a badge or count.
- **Never remove capability, only move it.** "Simpler" means fewer things on layer 1, not fewer features. Check the capability list at the end.
- **Every non-obvious control gets its why, in one line or one click.** A label that only restates the name ("Recording step: the recording step") is missing its why. Instructions ("click a site to select; shift-click adds") go in a `?` popover or appear the first time, never as a permanent caption.
- **Say each fact once.** A status, an identifier or a verification result appears in one place. If two parts of the page show it (the page header and an embedded viewer's header), delete one.
- **Notices are for events that need action.** Normal state is shown quietly: an icon or one word next to the thing it is about, with detail one click away. One banner on a screen at most, and only for something the user must act on now (About Face; Few).
- **Developer detail is layer 3:** file paths, bundle names, hashes, payload sizes, sampling internals. It belongs in a "Details" expander or a log, unless the job is debugging.
- **Defaults make the first screen useful.** Open on the last used or most likely state, never an empty form; remember choices instead of asking again (About Face ch. 8; Magic Ink). The default drawing is the least that means something (the selected group bright, the rest faint, overlays off), and a default must never make a destructive button appear.
- **Budgets for layer 1** (working defaults; the profile can change them): at most about 7 controls outside a deliberate form, one primary action, at most one notice, at most three text colours and two font weights, and everything fits the first screen of the narrowest surface without the text overflowing.

When you cannot tell how often something is used, ask the person once, or put it on layer 2 with a clear handle. Something buried is easy to promote later. Something crowding the screen trains the user to ignore everything.

## 3. Pick the pattern by the job

| Job | Pattern | Reference |
|---|---|---|
| Configure a tool (settings page or panel) | grouped rows by task, most used first, one-line help per row, defaults shown, live apply, reset per group, rare groups collapsed | `settings-and-defaults.md`, `layout-patterns.md` §4 |
| Act on a list of items (steps, runs, jobs) | list with the state per row; actions on hover/focus or row selection; detail in an inlay or side panel | `layout-patterns.md` §3 |
| Inspect one object in depth (a viewer) | center stage for the main view; one compact selector row; secondary views as tabs or small multiples; legends and instructions on demand | `layout-patterns.md` §1, §6; `references/case-replay-viewer.md` |
| Monitor (a dashboard or status) | one screen, the 3-9 numbers that say whether all is well, each with its comparison, alerts only for exceptions | `dashboards.md` |
| Explain a mechanism to other people | one idea per view, 1-3 controls next to the graphic, live readout, a guided first state, presets that reach the interesting regime | `explainers.md` |
| A rare multi-step task | a short wizard or staged form, with a way back | `disclosure.md` §2 |
| A terminal pane or band | status and next action in the first rows, detail behind a key, no assumed scroll | `terminal.md`, section 6 |

## 4. Visual calm (apply while building)

The model is a calm, dense native app (DEVONthink, the Claude desktop app): plenty of information, yet quiet, because hierarchy comes from alignment, grey and space rather than boxes and colour. Details: `references/visual-hierarchy.md`.

- **One focal point per view.** Rank every element primary, secondary or tertiary before styling. To make something stand out, quieten its neighbours instead of making it louder.
- **Separate with space first, then a background tint, and only last a border.** Never put a box inside a box. A border around every panel and every chip is the most common source of clutter.
- **Fixed scales.** Spacing 4, 8, 12, 16, 24, 32, 48 px; type 12, 14, 16, 18, 20, 24, 30 px. These are adapted values, built from Refactoring UI's rule that neighbouring steps differ by about 25% or more. Define them once (CSS custom properties or a style module) and never write a magic number inline.
- **Text:** one sans-serif family (the system stack), 16 px body, 12 px minimum, line length 45-75 characters, numbers right-aligned in tabular digits. Section titles are small labels, not headlines.
- **Colour:** neutral greys for structure, one accent for the primary action and selection, and status colours only for status. One hue means one thing on the whole page. Colour is never the only signal (add an icon, a word or position). Text contrast is at least 4.5:1 (3:1 for large text) in both themes.
- **Text never leaves its box.** Give containers room or let them grow. Truncate deliberately with an ellipsis and the full text on hover or focus, and test at the narrowest width.
- **Label and value:** grey label, dark value (the DEVONthink inspector). Leave the label out when the value explains itself ("72 sites", "26.3 Hz").
- **Actions ranked:** one solid primary button; secondary actions outlined; rare and destructive actions as quiet links, made loud only on their confirmation step.

## 5. Words

Every string tells the user what they can do or what just happened, in their own words, as short as the meaning allows. Details and before/after examples: `references/ux-writing.md`.
- Buttons: a verb and its object, 1-3 words ("Load run", "Re-make at 1 ms"). Put the number on the button when it matters ("Delete 3 runs").
- Labels: a noun phrase. Help text: what the control *changes*, in one line of about 40-50 characters, with the unit and an example if the input is ambiguous.
- Status: one short clause in the present tense ("Verified: replay matches the run"), the detail one click away.
- Pickers and IDs: every option says what it is. No bare codes (`r0`, `alt_s6p25_n2`, "trial 4") without the values that tell the options apart: generate the label from what varies across the list ("bar 0°, pos −6.25°, ON, r1"), and put one line describing the chosen item next to the picker. A table of items shows the fields that differ between them, not one fixed set of columns.
- Errors and empty states: what to do next ("No replays yet. Choose a trial and press Replay."), with no blame and no internal jargon.

## 6. Surfaces

| Surface | Can you see it? | Limits to design for |
|---|---|---|
| Single-file HTML, embedded HTML component | yes: `shot.py`, `lint_ui.py` on the file | narrow embeds; iframes have a fixed height: cap it at the viewport so the component's own controls stay visible; an embedded component does not repeat context its host page already shows; light and dark via `prefers-color-scheme` |
| Streamlit and other local web apps | yes, on the running URL (`--wait-for` a selector of the main view) | the default widgets are large: keep layer 1 short and put the rest in `st.expander`/`st.popover`, using `help=` for one-line whys; expanders cannot nest (check the installed version); the app reruns top to bottom, so keep state in `st.session_state` |
| Claude Code mod pane or band (terminal, desktop app, VS Code) | **no**: the test harness asserts presence, not layout | terminal: fixed height, and no scroll while a question is open; a Select opens inline and shifts rows (use cycling buttons); rows must wrap; glyph widths differ in proportional fonts; colours need 3:1 contrast on white, off-white and dark. Plan for the smallest pane: put the plan and status first and the detail behind a toggle. Details: `references/terminal.md` |

For a surface you cannot see, check what you can (tests, widths in the harness, counting rows against the pane height) and write "layout not seen" in the handover. When the person sends a screenshot, treat it as your render: run the section 7 checklist on it.

## 7. The loop: build, lint, shoot, look, fix

1. **Build** from the layer plan (section 2), with the pattern from section 3 and the style scales from section 4.
2. **Lint:** `python SKILL/scripts/lint_ui.py PAGE --max-controls 7 --max-notices 1` (add `--wait-for CSS` for a JS app; widths default to 390, 800 and 1280, both themes). It must report no problems: no text overflowing or clipped, no horizontal scroll, no text under 12 px, contrast passing, every control named, targets at least 24 px, no console errors. Read the density report too: controls (navigation, such as a sidebar of pages, is counted apart and not judged by `--max-controls`), words, boxes, notices, text sizes and colours on the first screen. A box count in the teens or more than 4 text sizes means the screen is not calm yet, even when nothing is flagged.
   Same-origin and `srcdoc` iframes (a Streamlit `components.html` viewer) are linted too, with the frame named before each selector and its own density line; a cross-origin frame is only a `frame-skipped` note, so lint its URL on its own.
3. **Shoot:** `python SKILL/scripts/shot.py PAGE --out DIR` takes the first screen at each width in light and dark, plus `sheet.png`. Add `--click 'text=Advanced'` (or a CSS selector) to capture a layer-2 state, and `--full` for the whole page. Each image costs context: read the sheet first, then single images only where you need detail. WebGL (Plotly 3D, maps) renders in software; a canvas that still says WebGL is unavailable is "not seen".
4. **Look** at the sheet with this checklist, answering each item:
   - In 5 seconds, can you say what this view is for, and is that the most prominent thing?
   - Does layer 1 hold only the every-visit items, and does it fit the narrowest first screen?
   - Is anything said twice? Is any notice not asking for action? Is any developer detail on layer 1?
   - Does every hidden handle say what is behind it? Is the capability list fully reachable within its layers?
   - Squint: is there one focal point, or do equal boxes compete? Could a border become space?
   - Is every text inside its box at every width, readable in both themes, with colour never the only signal?
   - Does every non-obvious control have its one-line why (or a `?`)? Does the first state show something useful?
5. **Fix**, then re-lint and re-shoot only what changed. Two or three rounds is normal. If a problem survives three rounds, the layer plan is wrong: go back to section 2.

## 8. Reworking an existing GUI

When the person says a GUI is too much (or too thin), do not restyle it first.
1. **Inventory the first screen:** every control, box, notice, caption and repeated fact, with counts (`lint_ui.py` gives the numbers). `references/case-replay-viewer.md` is a worked example: a replay viewer with a duplicated verification banner, repeated run identifiers, permanent instructions, developer paths and captions overflowing their panels.
2. **Map each item to the task inventory** (section 1): delete what no task needs, merge duplicates, move rare items down a layer, and replace permanent captions with `?` popovers.
3. **Rebuild layer 1**, then run the loop (section 7). Show the person before and after shots side by side, with the counts.
4. **Many pages:** do the shared parts first (theme, navigation, page header), then the pages in parallel batches, one branch or worktree per batch with one common brief that carries the lessons of the first page. Expect merge conflicts only in generated files; regenerate them.
5. **Record what was wrong** as an observation (learning loop below), citing the screenshot, before you fix it: UI lessons that live only in commit messages are lost.

## 9. Delivery

The handover note says: the job sentence; what is on layers 1, 2 and 3; the surfaces seen (with the lint result and the shots' location) and the surfaces not seen; the budgets you exceeded on purpose and why; and how to regenerate the shots. Never write "verified" for a layout you have not looked at.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note gui-design <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

A GUI the person asks you to rework is always worth a note (kind `failure` if this skill was followed, `missing` if it had no rule for the problem). It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for gui-design` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
