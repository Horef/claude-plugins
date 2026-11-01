# Case study: an overloaded replay viewer (Streamlit page + embedded HTML component)

Summary (the three rules this case teaches most):
1. Setup controls and developer detail pushed the real content (the viewer) to the bottom edge of the first screen, and its play button below the fold. Put the content first and its primary control beside it.
2. The same fact was shown 2-4 times (verification banner, run/condition/set/trial, "inspection replay, not a result", "how to select"). One home per fact.
3. Every caption was always visible and cut off by its box. Short titles; the rest on hover, in a "?" popover, or in a details layer.

## The GUI, generically

A research tool for a neuron simulation. One Streamlit page ("Replay a trial") picks a saved simulation run and a trial, makes a "replay bundle" (a background job, about 20 s) if none exists, and shows it in one embedded single-file HTML viewer (canvas + vanilla JS). The viewer plays one trial on one clock in three panels (the cell with its 8 synapse groups, the 2312 input afferents drawn as a mosaic, the stimulus movie), with three stacked trace plots below (soma voltage, dendritic-site voltage, spike raster), group chips, and a transport bar. A second condition can be shown side by side. Visually it is fresh and calm. The problem is quantity.

## 1. Inventory of the first screen (screenshots 4 and 5)

Counts are approximate; the point is the order of magnitude: about 80 separate things compete before the user sees a single data point.

**Streamlit page, above the viewer (about 20 items, roughly 1000 px tall):**
- Title; "About this page" expander (1).
- 6 selectors: run family, run, condition, set, trial, compare-with. Five of them carry a "?" tooltip.
- Recording step: a 3-way radio plus a hidden number input ("other") (1 control, 3 options).
- A "Re-make a_s16 at 1 ms (now 0.1 ms; replaces it)" button. It appears by default because the radio default (1 ms) differs from the existing bundle (0.1 ms). A destructive-sounding action next to the main workflow, produced by a default, not by a user need.
- "Storage" expander whose title already holds four numbers (MB, bundle counts); inside: a table, a caption, a multiselect, 3 buttons, a confirmation checkbox.
- Green verification banner: one sentence with two max |dV| numbers, a sample count and a sampling step.
- Two more controls: stimulus resolution (px) and viewer height (px).
- A caption with four sentences: payload size, the bundle's file path in monospace, "play, scrub and select inside the viewer", "inspection replay, not a new result".
- "Bundle details (JSON sidecar)" expander below the viewer.
- Result: the viewer's own header starts at the very bottom edge of a laptop screen. Everything above it is setup.

**Embedded viewer (about 60 items, about 1000 px tall):**
- Header line: Run, Condition, Set, Trial, plus a trial hash path (5 items).
- Second green verification banner (1, per condition).
- Control bar 1: sites coloured by (5-option select), branches (select), yaw slider, pitch slider, reset view, "RF sigma circles" checkbox, "RF centres on stimulus" checkbox (7).
- Control bar 2: traces window select, a Vm colour-scale legend (2).
- Three panels, each with a title and a subtitle; plus in-canvas text: "soma -75.0 mV", "414 afferents selected, max rate 26.3 Hz", "27 deg across, ON warm, OFF cool", "frame 0, 60 deg field, stimulus off", and 8 group labels on the cell (about 10 text items).
- 10 chips (all, soma, G1..G8, each "G1 ON 72") plus a hint line about click/shift-click (11).
- Traces panel: title, a very long legend sentence, three plot labels, a 3-line caption inside the raster label (about 6).
- Transport bar below the traces: 6 step buttons, speed presets, a free speed number box, scrubber, time label, loop, 3 jump buttons (about 17). **Play is not visible in the screenshot at all**; it is under the 1000 px of panels above it.
- A note paragraph at the bottom: group membership source, afferent storage, downsampling factor, "inspection replay, not a new result".

**Duplicates (same fact, several places):**
| Fact | Shown in |
|---|---|
| Verification result | Streamlit banner; viewer banner; "Bundle details" JSON; "About" text |
| Run, condition, set, trial | 4 Streamlit selectors; viewer header; banner prefix "a_s16:"; re-make button label |
| "Inspection replay, not a new result" | About; payload caption; viewer bottom note |
| How to select / rotate / scrub | About; payload caption; chips hint; cell subtitle "drag to rotate"; button tooltips |
| Sampling step | Radio; banner ("sampled every 0.1 ms"); traces legend; re-make button; trial dropdown suffix |
| Bundle size | Storage title; payload line; storage table |

**Text overflowing or cut off:**
- Panel title "dLGN INPUT" wraps to two lines because the subtitle ("2312 afferents; selected: rate fill, flash = spike < 10 ms") takes the width; the subtitle is then cut with an ellipsis ("flash = spi...").
- Traces legend is cut at "click or drag to set t". The sentence cannot be read at any width.
- Group labels G5/G8 collide on the cell; "414 afferents selected" is printed over the busiest part of the mosaic.
- The payload caption wraps to two lines around an inline file path.
- A dropdown holds a whole sentence ("0: grating dir 0 deg, 0.08 cpd, 2 Hz, r0 . replayed @ 0.1").

**Developer detail shown to the user:** bundle file path, payload MB, JSON sidecar, `--force` semantics in a button label, "NEURON scratch" folder in a storage table, quantisation notes, pixel sizes for the stimulus, a viewer-height field.

**Instructions shown as permanent captions:** the click/shift-click/soma hint, "drag to rotate", the legend sentence under TRACES, the caption under the viewer, the notes paragraph.

**Visual density in the data itself:** 414 selected afferents with their receptive-field circles (on by default) plus the other 1900 faint dots, over an overlay of the same centres on the stimulus. The mosaic becomes a tangle before the user has chosen anything.

## 2. The user's real jobs

From the page's own help text, the README/design doc and the owner's follow-up requests:

Most frequent (every visit):
1. **Watch one trial play** and see the soma spike, with the stimulus and the input in step. Needs: play/pause, scrub, speed.
2. **Pick which synapse group to look at** (chips or click a site) and see its afferents and its dendritic trace.
3. **Compare with the scrambled control** on the same trial (default on when a control bundle exists).

Occasional (a few times per session):
4. Jump to the next soma spike or dendritic plateau; change the trial or condition; slow to 0.01-0.1x.
5. Glance at "is this replay trustworthy": only a mismatch needs attention.

Rare (once per run, or never in the viewer):
6. Make a missing bundle; re-make at 0.1 ms; clear storage; resolution; viewer height; read sidecar JSON; rotate in 3D; change the colour code of sites/branches.

The page is organised around job 6 (setup and housekeeping come first, the viewer last), the reverse of the frequency.

## 3. Redesign: three layers

Rule used: layer 1 = what the frequent jobs need, always visible; layer 2 = one click (popover, menu, expander) for occasional things; layer 3 = another page or a log, for rare and developer things.

### Streamlit page

**Layer 1 (always visible):**
- Title, with a small "?" popover (the About text, shortened to about 4 lines). No expander box.
- One row of 4 controls: Run (a single select labelled "family / run (date)", with the family as a search prefix, not a separate select) | Condition | Trial (set folded into the label: "ori_design . 0: grating 0 deg, 2 Hz") | "Compare with control" toggle (default on when the control bundle exists, otherwise disabled with a hover reason).
- A one-word status next to the row: "replayed 0.1 ms" or "no replay yet".
- The viewer, directly beneath, starting within about 150 px of the top.
- If the bundle is missing: replace the viewer with one empty state: "No replay for this trial yet. [Make replay, about 20 s]". The job progress replaces the button text ("Making... 12 s"), not a new caption.

**Layer 2 (one click, "More options" popover):**
- Set (when the user needs another stimulus set), recording step (default = run's bin; options "0.1 ms" or "custom"), re-make at another step (shown only after the user opened this, never as a default button).
- Verification detail (the full sentence and numbers), bundle details.

**Layer 3 (elsewhere):**
- Storage and Trash move to the Tools area ("Replay storage"), where the owner goes to clean up.
- Payload MB, bundle path, JSON sidecar: a "Technical details" expander at the bottom of that popover.

**Delete:** stimulus-resolution select (pick 60 automatically), viewer-height field (size the component to the window: about 760 px, never taller than the viewport), payload caption, the duplicate banner, the repeated "not a new result" caption (keep it once, inside the "?").

### Embedded viewer

**Layer 1:**
- No header line: the host page already shows run/condition/set/trial. (If the viewer is exported standalone, show it once as a single muted line, not 5 bold items.)
- A top strip (2 groups):
  - Left: play/pause, scrubber, time ("0.42 / 1.90 s"), speed select (0.1x, 0.5x, 1x), loop.
  - Right: `Jump v` menu (next soma spike, next plateau, stimulus onset), `View v` button, verification icon.
- Three panels with a one-word title each: CELL, INPUT, STIMULUS. Live readouts (soma mV, frame) stay as small in-canvas text. All other subtitles go to hover or the `?` popover.
- Group chips (all, soma, G1..G8) with colour dots. Chip text "G1 ON" only; the "72" group size moves to the tooltip, since it is the same for all.
- Traces: three stacked plots with short left labels ("soma", "site", "afferents"). Legend entries only when two conditions are shown.

**Layer 2:**
- `View v` popover: sites coloured by, branch colour, yaw/pitch, reset view, RF circles (default **off**), RF centres on stimulus (default off), traces window.
- Single-step buttons (frame back/forward, sample back/forward) become keyboard arrows (listed in the `?` popover); the free speed field is replaced by 3-4 presets plus "custom...".
- Verification icon opens a popover with the full text.

**Layer 3:** group-membership source, afferent-storage note, downsampling factor, quantisation, trial hash. All go to a "Technical details" section in the same popover, or are dropped.

**Verification, quietly:** one small icon at the right end of the top strip.
- OK: grey-green check, no text. Hover or click: "Matches the saved run (max |dV| 0 mV, 1900 samples)". Streamlit side shows nothing at all (no banner).
- Warning (differs, or not verified): amber icon with a short text, "differs from run", visible without clicking; the click shows code revisions. A mismatch must never be hidden, but a pass should not take a full-width green bar.
- Two conditions: one icon, popover lists both lines; the icon turns amber if either is amber.

### Wireframe of the new first screen (about 1000 x 700 px laptop window)

```
Replay a trial  (?)                                         [More options v]
[Run: mel1998_s16_a / matrix_v1 v] [Condition a_s16 v] [Trial ori_design . 0: grating 0 deg v] [x] vs control
------------------------------------------------------------------------
| > ----o---------------------  0.42 / 1.90 s   [1x v] (loop)   [Jump v] [View v] (check) |
| CELL                  | INPUT                   | STIMULUS            |
|  (cell, G1..G8)       |  (selected afferents    |  (movie)            |
|   soma -75.0 mV       |   bright, rest faint)   |   frame 0           |
|                       |                         |                     |
| GROUPS  (all) (soma) (o G1 ON) (o G2 OFF) ... (o G8 OFF)               |
| soma  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| site  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| afferents  . .. . ... . .. . .... . .. . ..                            |
------------------------------------------------------------------------
```

Count on this screen: 4 selectors, 1 toggle, 2 menus on the page (More, trial status); in the viewer: transport (about 5), 3 menu buttons, 10 chips. About 25 items instead of about 80, and play is visible without scrolling.

### What to keep (it works)
- Consistent group colours across cell, chips, and traces. Calm grey panels with thin borders and a white canvas.
- Live in-canvas readouts (soma mV, frame number); linked selection by click on the cell or a chip; the three-panel grid.
- Warnings for mismatch, never silent (the project's rule); keep it, change its form.

## 4. General lessons for the skill (each tied to the evidence)

1. **Content first, setup second.** The viewer started at the bottom of the screen after 10 setup controls; put the thing the user came for in the top third and the setup in one slim row.
2. **The primary control sits next to what it controls and is visible without scrolling.** Play was below 1000 px of panels and traces; a component taller than the viewport hides its own transport bar. Cap embedded height at the viewport.
3. **One home per fact.** Verification (2 banners + JSON), run/condition/set/trial (selectors + header + banner + button) and "not a new result" (3 places) show how repetition multiplies overload. Before adding text, search the screen for the same fact.
4. **Quiet when fine, loud when wrong.** A pass is an icon with a detail popover; a failure is visible text. A green full-width sentence for a success the user rarely doubts is noise.
5. **Developer detail goes in a details layer.** Bundle path, payload MB, JSON, `--force` wording, scratch folders, and pixel sizes are for the developer; the user never needs them to watch a trial.
6. **No permanent instruction captions.** Gesture hints and legend sentences go to a "?" popover, a hover, or an empty state; once learned they are noise on every visit.
7. **A title is one word; if a subtitle truncates, it should not exist.** Flex rows with an ellipsis subtitle hid information ("flash = spi...", "...to set t") and made "dLGN INPUT" wrap. Test at 1000 px width: any cut-off or wrapped label is a bug to fix by shortening, not by truncating.
8. **Remove controls that have a sensible default** (stimulus resolution, viewer height, recording step); keep them in a "More options" popover. An option the user never needs to decide is a tax.
9. **Housekeeping and destructive actions live elsewhere.** Re-make, "replaces it", and move-to-Trash do not belong in the workflow of the main job. A default that differs from reality must not create a prominent button (the re-make button appeared only because the radio default said 1 ms).
10. **The default drawing is the minimum meaningful one.** All 2312 afferents with RF circles and an overlay made a tangle before the user chose anything; default to the selected group bright, the rest faint, extras (circles, overlays) off.
11. **An embedded component does not repeat its host's context.** If the page already shows run/condition/trial, the component shows none of it, or one muted line.
