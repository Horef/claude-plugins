# Judged cases: scientific-figures

Judge each output against the skill's own §5 "Look" checklist plus the criteria below; render it and look at the PNG (grayscale and deuteranopia copies for colour-coded figures).

## Lateral inhibition sharpens the relay profile
**Task:** For a lecture note on somatosensory receptive fields: draw receptors under the skin, relay neurons with lateral inhibitory interneurons, and aligned activity profiles showing that the relay profile is narrower than the receptor profile (Kandel 17-11 style).
**Good looks like:**
- One message, visible in 5 s; receptor and relay profiles share the drawing's x coordinates (`Area`).
- Excitatory = blue triangles, inhibitory = vermilion dots; relay = star, interneuron = small circle.
- `c.lint()` returns `[]`; no label on a line; nothing below 11 px.
- Caption opens with an assertion and says how to read the colours and shapes.
**Origin:** example `lateral_inhibition_relay.py`; §3 neuroscience semantics.

## Phase portrait with a saddle and separatrix
**Task:** Mutual inhibition between two rate units with equal input: phase portrait with nullclines, fixed points classified numerically, the separatrix, and two trajectories ending in different attractors.
**Good looks like:**
- Fixed points from `Dy.fixed_points`, not placed by eye; stable filled, unstable open, saddle half-filled.
- Separatrix dashed black; units in `S.UNIT1` green and `S.UNIT2` purple; trajectories with arrowheads and open start dots.
- SVG under ~100 kB; no label sitting on the streamlines.
**Origin:** example `mutual_inhibition.py`; §3 dynamics conventions.

## Orientation tuning on a circular axis
**Task:** Plot three orientation tuning curves (preferred 0°, contrast 10/30/100%) from a von Mises model.
**Good looks like:**
- Axis centred on 0° with `P.wrap_periodic` / `P.periodic_xaxis`; the peak is not split across the edges.
- One-hue lightness ramp for contrast (magnitude), direct end labels instead of a legend.
- Axis titles with units; few meaningful ticks.
**Origin:** §4 circular variables.

## No profile: a journal figure
**Task:** A researcher with no figure profile asks for a two-panel figure for a LaTeX paper: firing-rate traces of an E and an I population, and the f-I curve of the E cell.
**Good looks like:**
- Infers the target (a paper) without asking; does not apply DEVONthink rules or flashcard prose.
- Designs at the journal column width with text >= 7 pt at that size, and delivers `T.export_files` (SVG, PNG, PDF).
- E population blue, I vermilion, each with a second channel (line style or marker); lint clean; rendered and looked at.
**Origin:** generalisation to people other than the owner (scientific-figures 7.0.0).

## Profile with a DEVONthink target
**Task:** The profile says `targets: devonthink-markdown` and `flashcards: yes`. Add a phase-portrait figure to a study note.
**Good looks like:**
- Reads `references/devonthink.md` before delivering.
- One-line inline SVG with `rgb()` colours via `D.substitute`, blank line before the italic caption.
- The note's prose describes everything the figure shows.
**Origin:** the owner's workflow, kept after the DEVONthink rules moved out of SKILL.md (7.0.0).

## Trigger: should fire
**Task:** "Add a figure of the retina layers to this note." / "Plot the psychometric function from these numbers for my paper."
**Good looks like:** scientific-figures is loaded.

## Trigger: should not fire
**Task:** "Make a revenue dashboard for the team." / "Summarise this paper."
**Good looks like:** scientific-figures is not loaded (dataviz or nothing is).
