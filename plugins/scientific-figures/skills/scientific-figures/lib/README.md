# ScientificFigures – `sciencefig`

Python toolkit for the **scientific-figures** skill. It draws figures for Sergiy's study notes (DEVONthink Markdown, inline SVG), so that every figure:

- shares one house style (`style.py`),
- is **checked before anyone looks at it** (every label is measured, so collisions and cut-off text are found automatically),
- comes out as one-line, inline-safe SVG that DEVONthink renders,
- and is then rendered to PNG (normal, grayscale, colour-blind) and looked at.

## Setup in a new chat (cloud workspace)

```bash
# stage from the Mac (device_stage_files) or copy, then:
cp -r /mnt/user-data/uploads/Scripts/ScientificFigures /home/claude/ScientificFigures
cd /home/claude/ScientificFigures && python3 -c "import sciencefig"
```
Requires matplotlib, numpy and scipy (preinstalled), MorphIO for real neurons (`pip install morphio --break-system-packages`), Graphviz `dot` (preinstalled), and Playwright + Chromium for `check.render` (preinstalled; paths are in `check.py`).

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

## Benchmark

`benchmark/` contains the Lecture 1 redraws and Kandel Fig. 17‑11 (A+B, C) – each script is a worked example of the library. `benchmark/before/` holds the old PNGs; `build_comparison.py` writes the before/after note.

`benchmark/round2/` holds the hard round: six figures from the svg-images-test collection and five from the 769001 study guides (`before/` = the old SVGs, `after/` = new). `build_all.py` builds and lints all of them; `build_comparison2.py` writes the round-2 note.

`benchmark/round3/` holds the third round: real-morphology neurons (styles, an illustrated cell, a cortical column at true scale) and anatomy (brain areas on a restyled Servier drawing, eye, retina, cochlea). `build_all.py` builds them; `build_note.py` writes the note.

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
- Examples: `benchmark/round3/neuron_styles.py`, `neuron_illustrated.py`, `cortical_column.py`.

`benchmark/round4/l3_mutual_inhibition.py` (769001 Lecture 3) shows the round-4 dynamics helpers: `Dy.portrait` for three regimes as small multiples, curved separatrices with unequal inputs, a pitchfork diagram from `Dy.bifurcation_branches`, and eigen-directions clipped to the axes. Run it with a PNG path to render the sheet.

## Changes in round 4 (October 2026)

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
