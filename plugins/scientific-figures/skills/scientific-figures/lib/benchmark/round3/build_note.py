"""Round-3 note: requested fixes, expressive neurons, anatomy components."""
import sys, os, re
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.devonthink import md_figure

HERE = os.path.dirname(os.path.abspath(__file__))
A3 = lambda n: open(os.path.join(HERE, "after", n + ".svg")).read()
A2 = lambda n: open(os.path.join(ROOT, "benchmark", "round2", "after", n + ".svg")).read()

md = ["# Figure benchmark – round 3 (neurons and anatomy)", "",
      "Round 3 of the **scientific-figures** skill: the requested fix to the f–I figure, book-quality neurons drawn from real reconstructions, and reusable anatomy components (brain, eye, retina, cochlea). Every figure passed the layout check before it was looked at.", "",
      "---", "",
      "## 1. f–I figure: current steps under the responses", "",
      md_figure(A2("fi_curve"), "Responses of a simulated exponential integrate-and-fire neuron to 400 ms current steps. Below the rheobase (about 185 pA) the step only depolarises the cell; above it the neuron fires, and the rate grows with the current. Each current step is drawn directly under the voltage it produces; the three dots on the f–I curve are the three steps."), "",
      "- The current step now lives in the same axes as the voltage trace, so it lines up in time and sits right under the response.", "", "---", "",
      "# Part A – neurons from real reconstructions", "",
      "The library now loads real neuron reconstructions (SWC, Neurolucida ASC, NeuroML) and draws them with tapering widths. Eleven cell types are included (`morphologies/swc/`, sources and licences in its README).", "",
      "## A1. One cell, three styles", "",
      md_figure(A3("neuron_styles"), "The same rat layer 2/3 pyramidal cell in the three drawing styles. Ink is the raw tracing, as in Golgi plates. Compartments colours the apical dendrite, the basal dendrites and the axon. Tube is the textbook look: twigs pruned, curves smoothed, widths tapering with the branching structure. Morphology: Blue Brain Project NMC portal."), "",
      "## A2. A textbook neuron from real data", "",
      md_figure(A3("neuron_illustrated"), "A layer 2/3 pyramidal neuron drawn in the illustrated style from a real reconstruction (pruned and smoothed). The apical dendrite climbs to its tuft in layer 1; the basal dendrites spread around the soma; the axon (blue, shortened) leaves downward. Morphology: Blue Brain Project NMC portal."), "",
      "## A3. A cortical column with real cells at one scale", "",
      md_figure(A3("cortical_column"), "Seven cortical cell types placed at their typical depths, all at the same scale (bar: 200 µm), so their real sizes can be compared. Dendrites are gray; axons are blue for excitatory cells and vermilion for inhibitory interneurons (axons shortened). The layer 5 thick-tufted cell spans almost the whole cortex, while the spiny stellate cell stays within layer 4. Morphologies: Blue Brain Project (NMC portal, BluePyOpt)."), "",
      "**What is new**", "",
      "- `morph.load` reads SWC/ASC/H5 (MorphIO) and NeuroML; `morph.prune` simplifies for illustration; `morph.draw_morphology` draws with styles ink, slate, compartments and tube, a common `scale` (px per µm) for true relative sizes, or a `box` to fit.",
      "- Same-style strokes are merged into one path, so a full reconstruction costs 15–90 kB.",
      "- For papers: `topng.export_files(svg, base)` writes SVG, a 3× PNG and a vector PDF.", "", "---", "",
      "# Part B – anatomy components", "",
      "## B1. Brain: an existing drawing restyled", "",
      md_figure(A3("brain_areas"), "Primary sensory and motor areas on the lateral surface of the left hemisphere. The primary motor cortex lies on the precentral gyrus, in front of the central sulcus; the primary somatosensory cortex lies on the postcentral gyrus, behind it. The primary auditory cortex sits on the superior temporal gyrus, mostly inside the lateral sulcus; the primary visual cortex is at the occipital pole, mostly on the medial surface. Brain outline adapted from Servier Medical Art (CC BY 3.0), recoloured gray."), "",
      "- `assets.place` inserts any SVG illustration (Servier Medical Art, Bioicons, SciDraw), recoloured to gray or one hue so the overlays carry the colour, and collects the licence credit for the caption.", "",
      "## B2. The eye", "",
      md_figure(A3("eye"), "Horizontal section of the right eye seen from above. Light (orange) is refracted by the cornea and the lens and focused on the fovea, the pit at the back of the retina. The optic nerve leaves at the optic disc, which has no photoreceptors and is therefore the blind spot."), "",
      "## B3. The retina", "",
      md_figure(A3("retina"), "The retinal circuit. Light enters from below and passes through the whole retina before reaching the rods and cones at the top. The direct pathway runs from photoreceptors to bipolar cells to ganglion cells, whose axons form the optic nerve; horizontal and amacrine cells (purple) make lateral connections in the two plexiform layers."), "",
      "## B4. The cochlea and tonotopy", "",
      md_figure(A3("cochlea"), "Tonotopy of the cochlea. Left: the cochlear spiral seen from above, with the characteristic frequency falling from about 16 kHz at the base to a few hundred hertz near the apex. Right: the cochlea uncoiled. Sound enters at the oval window and starts a travelling wave along the basilar membrane, which is stiff and narrow at the base and floppy and wide at the apex. A high tone (blue) peaks near the base; a low tone (vermilion) travels further and peaks near the apex."), "",
      "**What is new**", "",
      "- `anatomy.eye_section`, `anatomy.retina_layers`, `anatomy.cochlea_spiral`, `anatomy.cochlea_unrolled` and `anatomy.travelling_wave`: flat, house-style components that return named anchor points for labels.",
      "- `Canvas.callout_column` stacks labels in the order of their targets, so leader lines never cross; anatomy parts register keep-out areas so labels stay off the drawing.", ""]
out = "/mnt/user-data/outputs/Figure benchmark - round 3.md"
text = "\n".join(md)
open(out, "w").write(text)
print(out, len(text) // 1000, "kB", "hex:", len(re.findall(r"#[0-9a-fA-F]{6}\b", text)))
