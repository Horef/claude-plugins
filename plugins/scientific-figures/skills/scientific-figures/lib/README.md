# ScientificFigures – `sciencefig`

Python toolkit for the **scientific-figures** skill. It draws figures for study notes, papers and slides (Markdown notes with inline SVG, including DEVONthink; standalone SVG, PNG and PDF), so that every figure:

- shares one house style (`style.py`),
- is **checked before anyone looks at it** (every label is measured, so collisions and cut-off text are found automatically),
- comes out as one-line, inline-safe SVG that Markdown viewers (DEVONthink included) render, or as files for a journal,
- and is then rendered to PNG (normal, grayscale, colour-blind) and looked at.

## Setup

This folder is `lib/` inside the scientific-figures skill, in the genome repository `Horef/claude-plugins`; it travels with the skill (installed plugin, uploaded skill, clone). Point Python at it:

```python
import sys; sys.path.insert(0, LIB)   # LIB = <skill folder>/lib, or $SCIENCEFIG
import sciencefig
```
Requires matplotlib, numpy, scipy and Pillow; MorphIO for real neurons (`pip install morphio`); Graphviz `dot` for `flow.graphviz`; for `check.render` and `topng`, Playwright + Chromium that node can load (`$SF_PLAYWRIGHT`, known folders, or node's own resolution) or a Chrome/Chromium/Edge binary (`$SF_CHROME`). Licences of the reused drawings and reconstructions: `LICENSES.md`.

Change the library only in a clone of the genome, then run `python ../evals/run.py` (builds, lints and renders every worked example) and record the version with strange-loop.

## Modules

| Module | Use it for | Key functions |
|---|---|---|
| `style` | every colour, size and weight | `CATEGORICAL`, `EXC`, `INH`, `ACCENT`, `tint()`, `shade()`, `SIZE`, `LW_*`, `COLOR_NAMES`, `name_of`, `ColorKey` |
| `svg` | hand-drawn schematics | `Canvas` (`text`, `math` (real TeX), `callout`, `arrow`, `curved_arrow`, `elbow_arrow`, `box`, `dimension`, `brace`, `lint`, `svg`), `Area` (small plots aligned with a drawing) |
| `neuro` | neural circuits | `soma` (round/star/pyramid), `connect`, `synapse_to` (exc triangle, inh dot), `skin`, `region`, `spikes`, `receptive_field`, `activity_color` |
| `plot` | data plots and function curves (matplotlib) | `figure`, `end_label`, `label_curves`, `point_label`, `hbracket`/`vbracket`, `drop_lines`, `ref_line`, `range_frame`, `schematic_axes`, `wrap_periodic`, `periodic_xaxis`, `raster`, `poisson_spikes`, `scale_bar`, `decimate`, `lint` (texts, lines and scatter markers under text), `export`, `finish` (lint then export) |
| `morph` | neuron morphology | schematic: `pyramidal`, `stellate`, `tree`, `myelinated_axon`, `terminal_arbor`, `on_dendrite`; real reconstructions: `load` (SWC/ASC/H5/NeuroML), `prune`, `draw_morphology` (ink/slate/compartments/tube, `scale`, `box`), `save_swc` |
| `anatomy` | anatomy components | `eye_section`, `retina_layers`, `cochlea_spiral`, `cochlea_unrolled`, `travelling_wave`, `place_to_freq` |
| `assets` | reuse existing SVG illustrations | `place` (fit, recolour gray/tint, credits), `lib`, `credits`, `CATALOG` |
| `topng` | files for papers and slides (Playwright, else headless Chrome) | `svg_to_png`, `svg_to_pdf`, `export_files` |
| `nets` | networks and ML architectures | `layer`, `vdots`, `vector`, `funnel`, `link` |
| `dynamics` | phase portraits and stability | `portrait` (one call: flow + nullclines + computed fixed points + separatrices + trajectories), `fixed_points` (find + classify), `jacobian`, `classify`, `separatrix` (stable manifold of a saddle), `bifurcation_branches`; low level: `linear`, `flow_field`, `trajectory`, `arrow_on_path`, `fixed_point`, `eigenline` (clipped to the axes), `nullcline`, `phase_line`, `trace_det_regions`, `mini_portrait` |
| `surf` | 3D surfaces on a Canvas | `View3D` (`surface`, `axes`, `box_floor`, `P`) |
| `geom` | math and geometry diagrams | `plane`, `vector`, `point`, `segment`, `angle_arc`, `right_angle`, `projection`, `unit_circle` |
| `flow` | flow diagrams | `pipeline` (straight chain on a Canvas), `graphviz` (automatic layout) |
| `check` | the look step | `render` (PNG sheet, optional `cvd=True`), `render_row`, `cvd_png`, `cvd_sheet`, `find_chrome`, `check_inline`, `hex_to_rgb` |
| `devonthink` | getting figures into notes | `md_figure(svg, caption)`, `substitute(md, figures)` |

## Quick reference

The common calls of every module:

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
N.skin(c, x0, x1, y); N.region(c, x, y, w, h); N.stimulus_arrow(c, x, y0, y1, label="Stimulus")
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

fig, ax = P.figure(640, 280, name="fig-name", ncols=2, paper=False)   # matplotlib; paper=True for journal pt sizes
P.panel_label(ax, "a")
P.end_label(ax, x, y, "S cone", S.BLUE); P.hbracket(ax, x1, x2, y, "JND = 2")
P.drop_lines(ax, x, y); P.point_label(ax, x, y, "threshold"); P.scale_bar(ax, x, y, 0.2, "200 ms")
svg, probs = P.finish(fig)            # lint, then export

fps = Dy.portrait(ax, f, xlim, ylim, trajectories=[((x0, y0), S.BLUE)], labels=("$x$-nullcline", "$y$-nullcline"))   # flow+nullclines+fixed points+separatrices
fps = Dy.fixed_points(f, xlim, ylim)   # [{p, kind, eig, vecs, M}]; Dy.jacobian(f, p); Dy.classify(M)
Dy.separatrix(ax, f, saddle_fp); br = Dy.bifurcation_branches(lambda a: f_of(a), params, xlim, ylim)
f = Dy.linear(M); Dy.flow_field(ax, f, xlim, ylim); Dy.eigenline(ax, (0, 0), v, Dy.GROW)   # clipped to axes
Dy.trajectory(ax, f, x0, t_max, arrows=(0.3, 0.8), clip=(xlim, ylim)); Dy.fixed_point(ax, p, "saddle")
Dy.phase_line(ax, roots, f1d, y=-0.17); Dy.trace_det_regions(ax); Dy.mini_portrait(ax, c, M, w, h)
G.plane(ax, xlim, ylim, xlabel, ylabel); G.vector(ax, tail, v, color, label)
G.angle_arc(ax, center, v1, v2, label="θ"); G.right_angle(ax, at, d1, d2); G.projection(ax, a, b)

F.pipeline(c, x, y, [("Title", ["detail"]), ...], arrow_labels=[...], max_width=W-16)
svg, dot_src = F.graphviz('a [label="A"]; a -> b [label="excites"];', name="fig", rankdir="TB")

C.render([svg], "work/check.png", cvd=True)   # then Read the PNG
C.cvd_sheet("fig.png", "fig_cvd.png")   # PNG figures: original + grayscale/deutan/protan, no browser
x, y = P.wrap_periodic(ori_deg, rates, period=180, center=0); P.periodic_xaxis(ax, 180, 0, label="orientation (deg)")
key = S.ColorKey(); key.add("v2", S.BLUE, marker="D"); ax.plot(x, y, **key.style("v2")); S.name_of(S.BLUE)  # "blue"
md = D.md_figure(svg, "Caption.")
```

## The loop

```python
fig, ax = P.figure(640, 280, name="l2-tuning")    # 1 draw
...
svg, probs = P.finish(fig)                         # 2 lint (must be []) + export
# (P.lint after P.export fails: export closes the figure)
C.render([svg], "/home/claude/work/check.png", cvd=True)   # 3 render
# 4 LOOK at check.png with the Read tool; fix; repeat
md = D.md_figure(svg, "Caption ...")              # 5 into the note
```

## Examples

`examples/` holds general worked examples to copy from, one figure type each; `python examples/build_all.py [names] [--out DIR] [--render sheet.png]` builds, lints and renders them, and is also the skill's scripted eval. Each module exposes `draw()` (one figure) or `build()` (several, as `{name: (svg, problems)}`) and writes nothing. By kind:
- Circuits: `lateral_inhibition_relay` (circuit with aligned activity profiles), `inhibition_types` (small multiples that differ in one edge), `cortical_layers` (layered circuit with pathways).
- Data and model plots: `sensory_basics` (pipeline, adaptation traces, psychometric functions, SDT + ROC, spectra with a spectrum axis, receptive-field sampling, colour vectors), `fi_curve` (simulated traces + f–I curve).
- Dynamics: `saddle_portrait`, `ei_spiral`, `trace_determinant`, `graphical_fixed_points`, `change_of_basis` (commutative diagram), `mutual_inhibition` (`Dy.portrait` small multiples across a parameter, curved separatrices with unequal inputs, a pitchfork from `Dy.bifurcation_branches`, eigen-directions of a linearised flow).
- Networks and ML: `hebbian_net` (network + typeset equations), `autoencoder` (architecture), `activation_surfaces` (3D loss landscapes).
- Anatomy: `neuron_labeled` (schematic neuron with callouts), `brain_areas` (asset + overlays), `eye`, `retina`, `cochlea` (anatomy components); `neuron_styles`, `neuron_illustrated`, `cortical_column` are the real-reconstruction examples (on request only).

A figure drawn for a particular note belongs to that note's project, not here. Add an example only when it shows a figure type or library feature the others don't, name it after what it shows, and keep it free of output paths.

## Data folders

- `morphologies/swc/` - 11 real neuron reconstructions (L2/3, L5, L6 pyramidal; L4 spiny stellate; Martinotti; large and nest basket; L1 HAC; thalamocortical; Purkinje). `README.md` there lists sources and licences.
- `assets/` - reusable SVG illustrations (Servier Medical Art, DBCLS) with licences in `assets/README.md`.

## Real reconstructions (on request only)

Kept for future projects (e.g. drawing the morphology of a NEURON model in a paper); not part of everyday figures, where the simple schematic neurons are preferred.

- Setup: `pip install morphio --break-system-packages` (cloud workspace).
- `m = morph.load(path)` reads SWC, Neurolucida ASC, H5 (MorphIO) or NeuroML `.cell.nml`. A NEURON model's morphology can be exported to SWC (e.g. with NEURON's `h.PlotShape`/`neuron.morphology` tools or by writing the 3D points of each section) and then loaded.
- `morph.draw_morphology(c, m, x, y, scale=px_per_um, rotate=0, style="slate", colors=dict(axon=S.EXC), axon="stub", axon_len=150)`: styles `ink`, `slate`, `compartments`, `tube` (illustrated; use with `morph.prune(m, 60, 5)`, `widths="tips"`, `smooth=3`). Use ONE `scale` for all cells of a figure and add a scale bar; or `box=(x, y, w, h)` to fit.
- Conventions: dendrites gray or ink; axons blue (excitatory) or vermilion (inhibitory).
- Sample cells: `morphologies/swc/` (11 types, sources in its README). Most are Blue Brain Project files under CC BY-NC-SA: fine for notes; for a paper use the NeuroMorpho.Org (CC BY) version and cite the original study.
- Known limitation: where a real dendrite runs along the axon, the axon can be partly hidden even though it is drawn on top.
- Examples: `examples/neuron_styles.py`, `neuron_illustrated.py`, `cortical_column.py`.

`examples/mutual_inhibition.py` shows the dynamics helpers: `Dy.portrait` for three regimes as small multiples, curved separatrices with unequal inputs, a pitchfork diagram from `Dy.bifurcation_branches`, and eigen-directions clipped to the axes.

## Dynamics helpers and lint fixes (October 2026)

- `P.finish(fig)` returns `(svg, problems)` in the right order; `P.lint` raises a clear error when called on an exported figure.
- `P.lint` also reports scatter markers under text.
- `Dy.portrait`, `Dy.fixed_points`, `Dy.jacobian`, `Dy.classify`, `Dy.separatrix`, `Dy.bifurcation_branches` (no more hand-placed fixed points or straight-line guesses for separatrices).
- `Dy.eigenline` clips to the axes by default (no lint false positives against titles); `Dy.arrow_on_path` keeps the arrow tail short on long paths (spirals, limit cycles).
- `Dy.flow_field` defaults are lighter (n=36, density=0.7): about 35 kB per panel instead of about 50 kB.
- Canvas mini markup understands `\mathrm{…}`, `\text{…}` and TeX spaces `\,` inside `$…$`.
- `style.UNIT1` / `style.UNIT2` (green / purple): identity colours for the two units of a symmetric pair, kept separate from E (blue) and I (vermilion).

## Periodic axes, colour meanings, colour-vision check, Chrome fallback (October 2026)

- `P.wrap_periodic(x, y, period=180, center=0, close=True)`: re-maps circular x (orientation, phase, direction) into `[center - period/2, center + period/2)`, sorts, and repeats the lower-edge point at the upper edge so curves span the axis (only if such a point exists; nothing is invented). `y` is `(n,)` or `(n, k)`. `P.periodic_xaxis(ax, period, center, label, unit="deg", ticks=3)` sets limits with a small margin and ticks at the edges and centre. Orientation tuning measured at 0, 45, 90, 135 deg with the preferred orientation at 0 becomes one peak at 0 on -90..+90 instead of a peak split across 0 and 180.
- `S.COLOR_NAMES` (hex -> plain name: blue, vermilion, bluish green, orange, reddish purple, sky blue, slate, grays) and `S.name_of(color)`: use it so captions say the word that matches the drawn colour (raises `KeyError` for an unnamed colour).
- `S.ColorKey({"wiring": S.BLUE, "encoder": (S.VERMILION, "o", "--")})`: one hue = one meaning per document. `key[name]` is the colour, `key.style(name)` a kwargs dict (`color`, `marker`, `linestyle`), `key.items()` for drawing a legend; `key.add(name, color, marker, linestyle)`. A colour already used for another meaning raises `ValueError`.
- `C.cvd_png(png, out_dir=None, kinds=("grayscale", "deuteranopia", "protanopia"))` writes simulated copies (Pillow + numpy, no browser; Machado et al. 2009, severity 1.0, in linear RGB; `tritanopia` also available) into `_cvd/` next to the input and returns the paths. `C.cvd_sheet(png, out_png)` makes one labelled image with the original and the simulated versions (2x2 for wide images, one row otherwise).
- No Playwright (e.g. on the Mac)? `check.render`, `render_row`, `topng.svg_to_png`, `svg_to_pdf` and `export_files` fall back to headless Chrome/Chromium/Edge: `$SF_CHROME`, then the macOS app bundles (`CHROME_PATHS`), then `google-chrome`, `chromium`, `chromium-browser`, `microsoft-edge` on PATH (`C.find_chrome()`). Playwright stays the first choice. A screenshot needs a window height, so the sheet is rendered in a tall window and trailing white is trimmed (the window is doubled if content fills it); `svg_to_png` crops to the exact figure size.
