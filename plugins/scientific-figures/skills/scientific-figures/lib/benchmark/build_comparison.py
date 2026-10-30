"""Assemble the before/after comparison note for DEVONthink."""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.devonthink import md_figure

A = os.path.join(ROOT, "benchmark", "after") + "/"
r = lambda n: open(A + n + ".svg").read()
B = dict(pipeline="5F0B876A-5D38-4B52-8452-8451C55F2911", cones="4BC25F78-B8C8-43DC-8FE7-1A99CB33DC00",
         adapt="2FC373DE-B499-4B0F-9A46-A56542F96F29", rf="EF458230-14B4-4F97-A4D1-09AC62C71A0F",
         psycho="285B6CCF-475A-43D2-B036-6DBE2A128F57", sdt="224B44EE-2157-484D-9C62-BC941DDC511B")
items = [
    ("1. Sensory pathway (flow diagram)", "pipeline", "l1-pipeline",
     "The sensory pathway. A stimulus is transduced into a graded receptor potential, encoded as spikes, relayed through the CNS to cortex, and interpreted as perception. The dashed arrows are top-down influences (feedback, attention, priors) that reach back to the relays and even to the periphery.",
     ["Before: the connectors had no arrowheads, and the dashed feedback line had no head and no clear target.",
      "After: every box is sized to its measured text and all boxes are equal; arrows have heads; the feedback arrow says where it lands (relays and periphery).",
      "Tool: hand SVG with `flow.pipeline()`, which refuses to draw if the chain would not fit the width."]),
    ("2. Photoreceptor absorption spectra (data plot)", "cones", "l1-cones",
     "Absorption spectra of the human photoreceptors, normalised to their peaks: S cones peak at 437 nm, rods at 498 nm, M cones at 533 nm and L cones at 564 nm. The colour strip above the axis shows roughly what each wavelength looks like.",
     ["Before: the curves were symmetric Gaussians (real spectra are skewed and have a short-wavelength tail), the S curve was cut off at the left edge, the labels floated at different heights, the curves used red and green, and there was no y axis.",
      "After: real pigment template (Govardovskii 2000); colour-blind-safe Okabe-Ito hues, with the rod curve also dashed so it reads in grayscale; one row of short direct labels and no legend; a y axis; and the visible spectrum built into the x axis (Wilke ch. 20).",
      "Tool: matplotlib exported to inline SVG with `plot.export()`."]),
    ("3. Slowly vs. rapidly adapting receptors (spikes)", "adapt", "l1-adapt",
     "Spike trains of two touch receptors (four trials each) during the same pressure step. The slowly adapting receptor keeps firing while the pressure is held. The rapidly adapting receptor fires only at onset and offset.",
     ["Before: a single trial, spikes not aligned in time with the stimulus, and no time scale.",
      "After: four trials show the variability; the stimulus sits under the spikes on the same time axis; the onset and offset bursts are labelled; a 200 ms scale bar replaces a cluttered time axis.",
      "Tool: matplotlib with `P.raster`, `P.poisson_spikes` (seeded, so the figure can be repeated exactly) and `P.scale_bar`."]),
    ("4. Receptive-field spacing and the Nyquist criterion", "rf", "l1-rf",
     "Two arrays of receptive fields with the same width. Top: centres 1.5 RF widths apart leave gaps, and a stimulus falling in a gap is missed. Bottom: centres half an RF width apart (the Nyquist spacing) give even coverage. Ticks mark the receptor centres; the shading shows the coverage.",
     ["Before: the curves were clipped at the figure edges and crossed below the baseline, and neither the RF width nor the spacing was shown.",
      "After: a measured RF-width bracket; the spacing written as a ratio in each title; receptor centres marked; shaded coverage that makes the gaps visible; and a concrete missed stimulus."]),
    ("5. Psychometric functions: detection vs. discrimination", "psycho", "l1-psycho",
     "Left: detection. The threshold is the intensity detected on 50% of trials. Right: discrimination against a reference of 10 units. The comparison is judged stronger 50% of the time at 10 and 75% of the time at 12, so the JND is 2 units.",
     ["Before: one curve mixed detection and discrimination, the 'JND' label pointed at nothing, and the y-axis title was ambiguous.",
      "After: two panels, one per task, matching the worked example in the notes (reference 10, JND 2); the JND is a measured bracket between the 50% and 75% points."]),
    ("6. Signal detection theory and ROC (two linked panels)", "sdt", "l1-sdt",
     "Left: the noise and signal-plus-noise distributions, d′ = 2 apart. Responses above the criterion are 'yes': the blue area gives the hits and the orange area the false alarms. Right: ROC curves for d′ = 0, 1 and 2. The dot is the criterion from the left panel.",
     ["Before: the criterion text sat on a curve, the d′ labels crossed lines, and the hit and false-alarm areas were not shown.",
      "After: hits and false alarms are shaded and labelled; d′ is a measured bracket; the criterion is stated in words; the left panel's criterion appears as a dot on the ROC, which links the two panels; d′ = 1 and 0 are drawn in gray because d′ = 2 is the subject (emphasis)."]),
]
md = ["# Figure benchmark – before vs. after", "",
      "Lecture 1 figures redrawn with the new **scientific-figures** skill and its `sciencefig` library (`~/Scripts/ScientificFigures`). Each item shows the old figure (PNG), the new one (inline SVG, exactly as it would appear in a study note), and what changed. Every new figure passed the automatic layout check (no text collisions, nothing cut off) before rendering, and was then checked visually, including in grayscale and with simulated colour blindness.", "", "---", ""]
for title, bk, an, cap, notes in items:
    md += [f"## {title}", "", "**Before**", "", f"![before](x-devonthink-item://{B[bk]})", "", "**After**", "",
           md_figure(r(an), cap), ""]
    md += ["**What changed**", ""] + [f"- {n}" for n in notes] + ["", "---", ""]
md += ["## 7. Colour as a vector (math / geometry diagram – new)", "", md_figure(r("l1-colorvec"),
       "Each light is a vector of cone responses (here only L and M). 600 nm light gives a vector pointing mostly along L; 520 nm points more along M. Dimming the light shortens the vector without turning it: the direction encodes hue and the length encodes brightness. Responses were computed from the same pigment templates as figure 2."), "",
       "**What it shows**", "",
       "- A math diagram with equal axis scaling, vectors, an angle arc, and labels that never sit on lines.",
       "- Tool: matplotlib plus `sciencefig.geom` (vector, angle_arc, right_angle, projection, plane).", "", "---", ""]
md += ["## 8. Hard benchmark: Kandel Fig. 17-11 A + B (neural circuit)", "",
       "Before: [Kandel Fig. 17-11, p. 401](x-devonthink-item://FB899499-08EA-4905-99F9-DE38768447B0?page=447)", "",
       "**After**", "",
       md_figure(r("kandel_17_11ab"), "Lateral inhibition in a relay nucleus. (a) A stimulus on the skin drives five sensory neurons, most strongly the centre one. Each excites one relay neuron. Relay outputs also excite inhibitory interneurons, which inhibit the neighbouring relay neurons. Darker fill means higher firing. (b) Firing across the five positions, drawn directly under the cells in (a). Sensory firing is a broad hump; relay firing is narrower and falls below baseline at the flanks, which sharpens the contrast."), "",
       "**What changed vs. Kandel**", "",
       "- Panel b is aligned column-by-column under the circuit, and the dots on the curves have the same fill as the cells above, so you can read each neuron's firing straight down.",
       "- Synapse type is shown twice: colour (blue excitatory, vermilion inhibitory) and shape (triangle vs. dot), so it survives grayscale.",
       "- Activity uses a single-hue lightness ramp (pale = quiet, dark = active) instead of mixed colours.",
       "- The wiring is computed, not hand-placed; no axon crosses another, and every label is checked for collisions.",
       "", "---", "",
       "## 9. Hard benchmark: Kandel Fig. 17-11 C (draw the difference)", "",
       md_figure(r("kandel_17_11c"), "Three ways to drive the inhibitory interneuron of a relay nucleus. The three circuits are identical except for one connection, drawn in bold blue: in feed-forward inhibition the sensory input excites the interneuron; in feedback inhibition the relay neuron's own output does; in descending inhibition an axon from cortex does. In every case the interneuron then inhibits the relay neuron."), "",
       "**What changed vs. Kandel**", "",
       "- Kandel draws all three types in one tangle. Here they are small multiples with the same layout, and only the edge that differs is coloured; everything else is gray context."]
out = "/mnt/user-data/outputs/Figure benchmark - before vs after.md"
open(out, "w").write("\n".join(md))
print(out, os.path.getsize(out), "#hex left:", sum(1 for _ in __import__("re").finditer(r"#[0-9a-fA-F]{6}\b", "\n".join(md))))
