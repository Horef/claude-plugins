---
name: "scientific-figures"
description: "Draw figures for Sergiy's study notes and papers: circuits, anatomy (brain, eye, retina, cochlea), data plots, flows, phase portraits, geometry, 3D surfaces. Lint-render-look loop, DEVONthink-safe SVG."
---

# Scientific figures

Use this skill whenever a figure goes into Sergiy's notes (course-lecture-notes, paper notes, any DEVONthink Markdown), into a paper or slides of his, or he asks for a scientific diagram or plot. It distils Rougier et al. "Ten simple rules for better figures" (2014), Rougier "Scientific Visualization: Python + Matplotlib" (2021), Wilke "Fundamentals of Data Visualization" (2019) and Tufte "The Visual Display of Quantitative Information" (2001). It also builds on the built-in `dataviz` skill (colour validation) and `artifact-diagramming` skill (draw the mechanism).

**The core problem this skill solves:** Claude draws blind, typing coordinates. So never trust a figure until (1) the linter says it is clean and (2) you have rendered it and *looked at it*.

## 0. Setup (once per chat)

The library lives on Sergiy's Mac at `~/Scripts/ScientificFigures` (package `sciencefig`, plus `README.md` and `benchmark/` with worked examples).
1. Request access to `~/Scripts` if it is not connected. On the Mac (`device_bash`), `tar czf sciencefig.tgz sciencefig README.md morphologies/swc assets benchmark/*.py benchmark/round2/*.py benchmark/round3/*.py benchmark/round4/*.py` inside the folder, stage that one archive, unpack it into `/home/claude/ScientificFigures/`, and move the archive on the Mac into `_to_delete/` (deleting needs permission).
2. `import sys; sys.path.insert(0, "/home/claude/ScientificFigures")`, then `from sciencefig import Canvas, style as S, plot as P, geom as G, flow as F, neuro as N, morph as M, nets as Nt, dynamics as Dy, surf as Sf, anatomy as An, assets as A, check as C, devonthink as D, topng as T`.
**Working on the Mac itself** (Claude Code, Kiro or Copilot in a local repo): skip the archive. `sys.path.insert(0, os.path.expanduser("~/Scripts/ScientificFigures"))` (or the path in `$SCIENCEFIG`) and import as in step 2. `C.render` and the `topng` exporters use Playwright when node has it and otherwise headless Chrome (`C.find_chrome()`: `$SF_CHROME`, the macOS app bundles, then PATH). `C.cvd_png` and `C.cvd_sheet` need no browser at all.
3. If you improve the library, commit the changed files back to the Mac folder (`device_commit_files` overwrites single files; for many files commit one archive and unpack it on the Mac with a short Python `tarfile` loop that writes each file in place, because `tar` cannot replace files without delete permission) and say so. Give every committed archive a NEW file name: re-committing the same staged path can deliver the earlier copy.

## 1. Before drawing: message, audience, form

- **One figure, one message.** Write the message as one sentence first (e.g. "lateral inhibition makes the relay profile narrower than the receptor profile"). The design follows from it. If a sentence or a small table says it faster, don't draw it (Tufte: under ~20 numbers, use a table).
- **Audience = a student learning alone** from the note (Rougier rule 1): label more than you would for experts, and spell words out (no cryptic abbreviations).
- **Draw the mechanism, not its name**: show the path, the connection, the difference. For a comparison, draw the same layout several times and change only what differs, emphasised (small multiples; Kandel 17‑11C benchmark).
- **Pick the form by the job** (Wilke ch. 5; dataviz `choosing-a-form`): amounts → bars/dots; distributions → density, violin, strip; x–y → scatter; change over an ordered variable → line; part of a whole → stacked bar or pie (simple fractions only); uncertainty → error bars or bands, saying which (SD, SE, CI).
- **Prefer wider than tall, about 1.5:1** (Tufte ch. 9), unless the content has its own shape. Same units on both axes → equal aspect (geometry, ROC, x = y comparisons).

## 2. Tool choice

| Figure type | Tool | Why |
|---|---|---|
| Data plots, function curves, spectra, tuning curves, psychometric functions, distributions, ROC, spike rasters, time series | **matplotlib → `P.export()`** | real axes and exact curves; `P.lint()` checks labels |
| Neural circuits (wiring between cells), synapses, receptors | **hand SVG: `Canvas` + `neuro`** | full control; every label is measured and linted |
| Neuron anatomy in schematics: simple dendritic trees, pyramidal/stellate glyphs, myelinated axons, terminals, cortical-layer circuits | **`Canvas` + `morph`** (`pyramidal`, `stellate`, `myelinated_axon`; + `neuro` for synapses, `c.callout` for labels) | seeded branching model; returns anchor points (tuft, basal tips, trunk, axon) |
| Real reconstructed neurons (SWC/ASC/NeuroML, e.g. the morphology of a NEURON model) - only when asked | **`morph.load` + `morph.draw_morphology`** | read "Real reconstructions" in the library README first (usage, sample cells, licences) |
| Anatomy: eye section, retinal layers and cells, cochlea (spiral, uncoiled with travelling waves) | **`Canvas` + `anatomy`** | flat house-style components with named anchors and keep-outs |
| Realistic organs (whole brain views, ear, organ of Corti) | **`Canvas` + `assets.place`** (Servier / Bioicons SVGs, recoloured `"gray"` or `("tint", hue)`) + overlays and callouts | reuse good drawings; overlays carry the colour; `assets.credits(c)` gives the caption credit |
| Network diagrams (layers of nodes, dense/lateral weights) and ML architectures (vectors, encoder/decoder blocks) | **`Canvas` + `nets`** | nodes and blocks return anchors; vectors show dimension by length |
| Phase portraits, flow fields, trajectories, fixed points, nullclines, separatrices, bifurcation diagrams, 1D phase lines, trace–determinant plane | **matplotlib + `dynamics`**: `Dy.portrait` for a whole 2D portrait in one call | computed flows, fixed points found and classified numerically, separatrix = stable manifold of the saddle |
| 3D surfaces (loss landscapes, energy, 2D tuning) - only when the SHAPE is the message | **`Canvas` + `surf.View3D`** | lit surface, painter's order; offer a contour view if values matter |
| Transformations between representations (change of basis, encode/decode) | **`Canvas` boxes + arrows as a commutative diagram** | shows why the recipe works: two routes, same endpoints |
| Schematic curves that must line up with a drawing (activity profile under a circuit) | **`Canvas` + `Area`** | same coordinates as the drawing |
| Linear pipeline, up to ~6 stages | **`F.pipeline()` on a Canvas** | measured equal boxes, labelled arrows |
| Branching flows, hierarchies, state machines, decision trees (more than ~6 nodes) | **`F.graphviz()`** | automatic layout, restyled to the house style |
| Math geometry: vectors, projections, angles, planes, unit circle | **matplotlib + `geom`** | equal aspect, exact angles |
| Equations | **LaTeX in the note text**; inside a drawing **`c.math(x, y, tex)`** | `c.math` typesets real TeX (fractions, sums, bold vectors, hats) as outlines with exact metrics; short symbols can use the mini markup `$V_m$` |

## 3. House style (all values in `sciencefig/style.py`; never hard-code)

- **Font**: Helvetica (stack "Helvetica, Arial, sans-serif"). Sizes: 13 px for labels and axis titles, 11.5 px for ticks and annotations, **never below 11 px**. Labels are usually too small (Wilke ch. 24), so check at the real display size. Use sentence case, never ALL CAPS, and keep text horizontal (no vertical text except a matplotlib y-axis title).
- **Ink**: text `INK` #1f1f1f, secondary `INK2` #555, context data `MUTED` #8a8a8a, axes `AXIS` #444, grid `GRID` #e6e6e6, faint background `FAINT` #f2f2f2. White background.
- **Line weights**: data 2 px (2.6 for a highlight), structure 1.2 px, hairlines 0.8. Data is heavier than structure (Tufte).
- **Categorical colours** (Okabe-Ito, in this order, which passes the dataviz validator): blue #0072B2, vermilion #D55E00, green #009E73, orange #E69F00, purple #CC79A7. Up to 3 series anywhere; 4–5 only with direct labels; more than ~5 → small multiples or labels instead of colour.
- **Fills**: `S.tint(hue, 0.15–0.35)` for areas, with the full hue for outlines and marks. Labels in a hue use `S.shade(hue)` (Wilke's two-shade rule). Avoid large saturated areas.
- **Magnitude** = one-hue lightness ramp (`N.activity_color`, `Blues`, `viridis`). **Polarity** = blue↔red with a light neutral midpoint (`RdBu_r`). Never rainbow or jet.
- **Emphasis form** (the most useful one): the subject in `ACCENT` blue, everything else in `MUTED` gray (Rougier rule 6: "is there a reason this is blue and not black?").
- **Neuroscience semantics** (consistent across all notes):
  - Excitatory = blue + **triangle** terminal; inhibitory = vermilion + **filled dot** (or T-bar).
  - Relay or projection neuron = star or pyramid; interneuron = small circle; stimulus trace = black.
  - Firing rate = fill lightness.
  - In rate/time plots too: the E population is blue, the I population vermilion.
  - The two units of a symmetric pair that are not E/I (mutual inhibition, rivalry, two choices) = `S.UNIT1` green and `S.UNIT2` purple, in circuits, nullclines and traces alike.
  - Anatomy: cells in the neutral `S.CELL` slate; colour goes to what the figure is about (synapses, pathways).
  - Pathways: feedforward, recurrent and feedback get different hues AND feedback is dashed (top-down = dashed, as in every pipeline figure).
  - Shape always duplicates colour, so the figure works in grayscale and for colour-blind readers (Wilke ch. 20, redundant coding).
- **Neuron style - Sergiy's preference: simple.** Use the schematic glyphs (`morph.pyramidal`, `morph.stellate`, `neuro.soma`); real-looking neurons only when he asks.
- **Anatomy**: tissue in quiet neutrals; only what the figure is about gets a hue; label with `c.callout_column` (labels keep the order of their targets, so leaders never cross).
- **Dynamics conventions**: stable fixed point = filled dot, unstable = open dot, saddle = half-filled; flow field = light gray streamlines; highlighted trajectories carry arrowheads in the direction of time and an open dot at their start; separatrix = dashed black; growing eigen-direction vermilion, decaying blue. Compute fixed points (`Dy.fixed_points`), never place them by eye.
- **Panel letters**: lowercase bold a, b, c, small and quiet (Wilke ch. 21). Consistent visual language across panels and across the figures of one note: the same entity keeps the same colour and order everywhere.
- **One hue, one meaning, across the whole document.** A hue that means "wiring draw a" in one panel must not mean "encoder v2" in the next, or "ON afferents" in another figure. Declare the meanings once, in a small module every figure script of the document imports: `key = S.ColorKey(); key.add("v2", S.BLUE, marker="D")`. `key[name]` gives the colour, `key.style(name)` the plot kwargs, and a second meaning for a used colour raises. Repeated instances of one thing (draws, seeds, trials) get *one* neutral ink and differ by line style and marker, not by hue.
- **Every categorical colour has a second channel** (marker or line style, via `key.style`). Figures that relied on hue alone failed the grayscale check (three of eight in the cell 1542 write-up).
- **Colour words must match the drawn colour.** Prefer direct labels to colour words. When a caption or label must name a colour, take it from `S.name_of(colour)` ("orange" printed next to an olive line misleads).

## 4. Design rules checklist (apply while drawing)

**Integrity (Tufte ch. 2; Wilke ch. 17)**
- Bars and filled areas start at 0 (bars on a log scale start at 1, and only for ratios).
- Area is proportional to value (size discs by area, not radius).
- No fake perspective or decorative 3D, no varying scales within one figure. Real 3D (`surf`) only when the shape of z(x, y) is the message (plateaus vs slopes, a valley, a saddle); add a contour view if values must be read.
- Small multiples share axes; if they don't, say so in the caption.

**Labels instead of legends**
- Label curves at their ends or peaks (`P.end_label`, `P.label_curves`).
- Label groups and regions directly.
- If a legend is unavoidable, its order matches the visual order of the lines.
- Words go on the graphic: label important points and events (Tufte: "graphics are paragraphs about data").

**Data-ink, within reason**
- No frames, boxes around legends, heavy grids, hatching, shadows or decoration.
- Grid only where values must be read, in hairline gray and perpendicular to the variable of interest.
- But don't strip so far that elements float: keep a baseline or one meaningful reference line (chance level, x = y, threshold).

**Measured quantities**
- Show distances (d′, JND, RF width, spacing) with `hbracket`, `vbracket` or `Canvas.dimension`. Never use a floating "←" label.

**Axes**
- Axis titles say the variable *and units*.
- Use few ticks, at meaningful values (0, 50%, 100%; π/2).
- For conceptual plots where only the shape matters, use `P.schematic_axes()` (no ticks).
- Show spike data with a scale bar instead of a time axis.
- **Circular variables** (orientation, period 180°; direction and phase, 360°): centre the axis on the preferred or design value, `x, y = P.wrap_periodic(x, y, period=180, center=0)`, then `P.periodic_xaxis(ax, 180, 0, label=…)`. The edge point is repeated at the other edge (same angle; no data invented). A 0–180 axis with the peak at 0 splits one peak across both edges and reads as a U.
- **Rows of panels share one axis title** (say it once under the row, or only on the middle panel) instead of a long title under every panel; long per-panel titles collide.

**Reproducibility**
- Seed all randomness (`P.poisson_spikes(seed=…)`).
- Generate every figure from a script, with no manual edits (Wilke ch. 28).
- Prefer physically correct curves (e.g. a pigment template rather than Gaussians) when the true shape is cheap to compute. Simulate rather than draw: voltage traces from a model (e.g. exponential integrate-and-fire), flows by integration, loss surfaces from a real toy dataset. Then all panels agree with each other and with the numbers in the text.
- **Figure inputs live in the project**, never in an agent's scratch folder: analysis files a script reads (JSON summaries, saved runs) go in a declared folder (e.g. `outputs/<document>_inputs/`). The script takes the path as an argument and its docstring names the command that regenerates the input.
- For a note with several figures of one model, put the model (equations, parameters, solvers) in one `model.py` that every figure script and the worked-example calculation import.

## 5. The loop: draw → lint → render → look → fix

1. **Draw** with the library. Compute geometry (cell positions, edge points, label positions) from variables; never eyeball offsets. Use `neuro.edge_point`, `box()['r']` and similar anchors.
2. **Lint**: `c.lint()` (Canvas) or `svg, probs = P.finish(fig)` (matplotlib: lint, then export; `P.lint` after `P.export` fails because export closes the figure) must give `[]`. It reports text outside the figure, text overlapping text, lines and scatter markers under text, curves or branches that run off the canvas (clipped), fonts below 11 px, and `&`. Streamlines are not checked, so look for labels sitting on the flow field yourself (put such labels in titles or outside the axes). It does not see filled patches (icon boxes, bands) covering text: check those when you look. Fix the layout. Do not silence a warning with `lint=False` or a halo unless the overlap is intended (e.g. a label inside a shaded area).
3. **Render**: `C.render([svg,...], "/home/claude/work/check.png", names=[...])` (Chromium via Playwright, or headless Chrome on a Mac; 2×). For figures saved as PNG (e.g. matplotlib straight to file), `C.cvd_sheet(png, out_png)` puts the original beside grayscale, deuteranopia and protanopia versions (Machado et al. 2009, linear RGB) for one look. Batch 4–6 figures per sheet while iterating, re-render only the figures you changed, and add `cvd=True` (grayscale and deuteranopia copies) in one final pass for colour-coded figures: each sheet image costs context.
4. **Look**: open the PNG with Read and check, figure by figure:
   - [ ] The message is visible within 5 seconds; the subject stands out.
   - [ ] No collisions, clipping or crowding; spacing is even; elements are aligned to a grid.
   - [ ] Every arrow has a head, a clear target and, where needed, a label.
   - [ ] Text is legible at display size; nothing is smaller than the tick labels.
   - [ ] Grayscale and deuteranopia versions still separate everything that matters.
   - [ ] The content is scientifically correct (signs, units, peak positions, numbers match the note's worked examples).
   - [ ] No empty bands of whitespace (trim the Canvas height: `c.h = …`).
   - [ ] Circular axes are centred on the preferred value; no peak is split across the edges.
   - [ ] Each hue has one meaning across the document; every colour-coded series also has a marker or line style.
   - [ ] **At delivery size:** look at the figure where the reader will see it (on the PDF page or in the note column), not only as a standalone PNG.
   - [ ] **For readers outside the project** (a PI, collaborators): the caption names every panel, axis, unit and style, and states the take-home; every abbreviation is defined in the caption or a linked glossary.
5. **Fix and repeat.** Usually 2–3 rounds. Report the residual compromises honestly.

## 6. DEVONthink and Anki constraints

**DEVONthink inline-SVG rules** (`D.md_figure` and `C.check_inline` enforce them):
- Each `<svg>` is ONE line with no blank lines inside.
- White background rect; explicit colours (no `currentColor`).
- **No `#rrggbb` hex colours: DEVONthink turns them into tags when a Markdown file is imported.** The library converts them to `rgb()`.
- After `import_file`, reset the record's tags (`set_record_tags`): imported files also bring their macOS Finder tags and DEVONthink may auto-tag.
- No raw `&`.
- No `<style>` blocks (they leak into the whole note); unique ids per figure (the library prefixes them with the figure name).

**Placing figures in a note**
- Use a BLANK line between `</svg>` and the italic caption, otherwise the asterisks show literally.
- Keep a `{{FIG:name}}` placeholder in the draft and substitute with `D.substitute(md, {name: (svg, caption)})`.
- DEVONthink WikiLinks must be set to "Square Brackets" only. If links appear inside figures, check that setting.

**Captions** (Rougier rule 4; Wilke ch. 22)
- Open with a title-like assertion ("Lateral inhibition sharpens the relay profile"), not "This figure shows".
- Then say how to read the figure: what the colours, shapes and shading mean.
- State what error bars are (SD, SE or CI) and whether lines are "a guide to the eye".

**Anki**
- The note text must describe in prose everything the figure shows, because Anki cards cannot say "see figure".
- If Sergiy wants figures on cards, export PNGs via `C.render` of single figures; see course-lecture-notes for the import steps.

**Size**
- Keep each SVG under ~100 kB (a 3D surface or a three-panel phase portrait may need ~120 kB): reduce sample points, round coordinates (export does this), use fewer trials. Streamplots are the main cost: the `Dy.flow_field` defaults (n=36, density=0.7) give ~35 kB per panel; use n=30, density=0.55 for three panels in a row.
- Long traces (voltage, LFP): plot `P.decimate(t, v, 700)`, which keeps every spike peak (2 MB → 22 kB).
- `c.math` equations cost 3–10 kB each; use them for real equations, plain markup for symbols.

**Licences of reused material** (assets)
- CC0: free. CC BY (Servier Medical Art, Bioicons CC-BY): credit in the caption, write "adapted from" if recoloured; `assets.credits(c)` builds the line. Never use NC material in a paper without checking.

**Papers and slides**
- `T.export_files(svg, "/path/fig3")` writes fig3.svg (standalone), fig3.png (3×) and fig3.pdf (vector, fonts embedded). Design at the journal column width (one column ≈ 85 mm ≈ 240 px, two columns ≈ 174 mm ≈ 490 px, at 1 px = 1 pt; check the journal) and keep text ≥ 7 pt at that size.

**Replacing a figure in an existing DEVONthink note**
- `update_record_content` needs the exact old text in a patch, so a large inline SVG is costly to swap. Render the new figure with `T.svg_to_png`, import the PNG into the course's Figures group (reset its tags), and patch the old `<svg …>` line into `![…](x-devonthink-item://UUID)`. New notes keep inline SVG.

**Math and markup**
- Math belongs in the note as LaTeX (`$...$`, `$$...$$`).
- Inside Canvas labels use the mini markup: `$V_m$`, `$Ca^{2+}$`, `$h_E^\mathrm{ext}$`, `$J_{EE}$`, `**bold**` (`\mathrm{…}`, `\text{…}` and `\,` are understood).
- In matplotlib labels write primes as Unicode `d′`, not `$d'$`, and roots as `√6`, not `$\sqrt{6}$`: with text-as-text SVG, mathtext radicals, fractions and primes break. For real equations in a matplotlib figure, put them in a Canvas around it or in the caption.
- Text subscripts are upright: `$h_\mathrm{ext}$`, not `$h_{ext}$`.
- The mini markup stacks `$y_j^2$` (superscript above subscript).
- Avoid glyphs Helvetica may lack (∝ ≫) in text labels; inside `c.math` they are fine (`\ll`, `\propto`).

## 7. Library quick reference

```python
c = Canvas(640, 300, "fig-name")          # hand SVG
c.text(x, y, "label", anchor="middle", baseline="middle", size=S.SIZE_SMALL, color=S.INK2)
c.arrow(x1, y1, x2, y2, head="tri"|"dot"|"bar"|"open", label="verb")
c.curved_arrow(p0, p3, bend=0.3); c.elbow_arrow([p0, p1, p2])
b = c.box(x, y, title="Encoding", lines=["spike train"])   # returns anchors l, r, t, b, cx, cy
c.dimension(x1, y1, x2, y2, "d′"); c.brace(x1, x2, y, "label"); c.panel_label(8, 6, "a")
a = Area(c, x, y, w, h, xlim, ylim); a.line(xs, ys); a.fill(xs, ys, pos=..., neg=...)
cell = N.soma(c, x, y, r=12, kind="star", fill=N.activity_color(0.8), color=S.EXC)
N.connect(c, cell_a, cell_b, kind="exc"|"inh"); N.synapse_to(c, (x, y), cell, "exc", via=[corners])
N.skin(c, x0, x1, y); N.region(c, x, y, w, h); N.stimulus_arrow(c, x, y0, y1)
c.math(x, y, r"\Delta\mathbf{w}_j = \eta\,(\mathbf{x}\,y_j - y_j^2\,\mathbf{w}_j)", size=17, color=...)
c.callout(tx, ty, (x, y), "Node of Ranvier")   # label + leader line + dot
c.lint(); svg = c.svg()

n = M.pyramidal(c, x, y, size=1.0, apical_len=150, seed=3)   # anchors: soma, tuft, basal, trunk, axon
M.stellate(c, x, y, seed=1); M.myelinated_axon(c, p0, p1, n=6); M.terminal_arbor(c, p, seed=4)
N.synapse_to(c, start, M.on_dendrite(n, "apical", 0.6), kind="exc", color=S.EXC)
v = Nt.vector(c, x, cy, n=8, math=r"\mathbf{x}"); f = Nt.funnel(c, x, cy, w, h_in, h_out, math="E")
nodes = Nt.layer(c, x, ys, labels=["$x_1$", ...]); Nt.vdots(c, x, y); Nt.link(c, a["r"], b["l"])
view = Sf.View3D(c, cx, cy, size, xlim, ylim, zlim, elev=34, azim=-35)
view.axes(("w_1", "w_2", r"\mathrm{loss}"), as_math=True); view.box_floor(); view.surface(X, Y, Z)
c.callout_column([(target_xy, "Label"), ...], x, y0, y1, anchor="end")   # ordered, non-crossing

e = An.eye_section(c, cx, cy, R=120); r = An.retina_layers(c, x, y, w, h)
An.cochlea_spiral(c, cx, cy); An.cochlea_unrolled(c, x, y, w, h, tones=((0.15, S.BLUE), (0.65, S.VERMILION)))
b = A.place(c, A.lib("brain_lateral"), (x, y, w, h), recolor="gray", flip=True); p = b["at"](0.5, 0.3)
T.export_files(svg, "/home/claude/work/fig1")              # svg + png + pdf for a paper

fig, ax = P.figure(640, 280, name="fig-name", ncols=2)   # matplotlib; 1 pt = 1 px
P.end_label(ax, x, y, "S cone", S.BLUE); P.hbracket(ax, x1, x2, y, "JND = 2")
P.drop_lines(ax, x, y); P.point_label(ax, x, y, "threshold"); P.scale_bar(ax, x, y, 0.2, "200 ms")
svg, probs = P.finish(fig)            # lint, then export

fps = Dy.portrait(ax, f, xlim, ylim, trajectories=[((x0, y0), S.BLUE)])   # flow+nullclines+fixed points+separatrices
fps = Dy.fixed_points(f, xlim, ylim)   # [{p, kind, eig, vecs, M}]; Dy.jacobian(f, p); Dy.classify(M)
Dy.separatrix(ax, f, saddle_fp); br = Dy.bifurcation_branches(lambda a: f_of(a), params, xlim, ylim)
f = Dy.linear(M); Dy.flow_field(ax, f, xlim, ylim); Dy.eigenline(ax, (0, 0), v, Dy.GROW)   # clipped to axes
Dy.trajectory(ax, f, x0, t_max, arrows=(0.3, 0.8), clip=(xlim, ylim)); Dy.fixed_point(ax, p, "saddle")
Dy.phase_line(ax, roots, f1d, y=-0.17); Dy.trace_det_regions(ax); Dy.mini_portrait(ax, c, M, w, h)
G.plane(ax, xlim, ylim, xlabel, ylabel); G.vector(ax, tail, v, color, label)
G.angle_arc(ax, center, v1, v2, label="θ"); G.right_angle(ax, at, d1, d2); G.projection(ax, a, b)

F.pipeline(c, x, y, [("Title", ["detail"]), ...], arrow_labels=[...], max_width=W-16)
svg, dot_src = F.graphviz('a [label="A"]; a -> b [label="excites"];', name="fig", rankdir="TB")

C.render([svg], "/home/claude/work/check.png", cvd=True)   # then Read the PNG
C.cvd_sheet("fig.png", "fig_cvd.png")   # PNG figures: original + grayscale/deutan/protan, no browser
x, y = P.wrap_periodic(ori_deg, rates, period=180, center=0); P.periodic_xaxis(ax, 180, 0, label="orientation (deg)")
key = S.ColorKey(); key.add("v2", S.BLUE, marker="D"); ax.plot(x, y, **key.style("v2")); S.name_of(S.BLUE)  # "blue"
md = D.md_figure(svg, "Caption.")
```

Worked examples to copy from:
- `benchmark/lecture1.py`: pipeline, spike rasters, psychometric functions, SDT + ROC, spectra with a spectrum axis, receptive-field sampling, colour vectors.
- `benchmark/kandel_17_11ab.py`: circuit with aligned activity profiles; `kandel_17_11c.py`: three circuits that differ in one edge.
- `benchmark/round2/`: `neuron_labeled` (anatomy with callouts), `cortical_layers` (layered circuit with pathways), `hebbian_net` (network + typeset equations), `fi_curve` (simulated traces + f–I curve), `autoencoder` (architecture), `activation_surfaces` (3D loss landscapes), `t1_saddle`, `t1_tracedet`, `t1_ei_spiral`, `l2_fixedpoints` (dynamics), `t1_diagonalise` (commutative diagram). `build_all.py` lints and builds them all.
- `benchmark/round3/`: `brain_areas` (asset + overlays), `eye`, `retina`, `cochlea` (anatomy components); `neuron_styles`, `neuron_illustrated`, `cortical_column` are the real-reconstruction examples (on request only).
- `benchmark/round4/l3_mutual_inhibition.py`: `Dy.portrait` small multiples across a parameter, curved separatrices with unequal inputs, a pitchfork from `Dy.bifurcation_branches`, eigen-directions of a linearised flow.