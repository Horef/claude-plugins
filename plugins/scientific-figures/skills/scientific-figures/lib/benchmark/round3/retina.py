"""Round 3: the layers and cells of the retina (procedural)."""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, anatomy as An


def draw():
    c = Canvas(640, 400, "r3-retina")
    r = An.retina_layers(c, 150, 36, 330, 330, n_cones=4, rods_per_cone=2)
    names = dict(OS="Outer segments", ONL="Outer nuclear layer", OPL="Outer plexiform layer",
                 INL="Inner nuclear layer", IPL="Inner plexiform layer", GCL="Ganglion cell layer",
                 NFL="Nerve fibre layer")
    for k, (a, b) in r["layers"].items():
        c.text(492, (a + b) / 2, names[k], size=S.SIZE_SMALL, baseline="middle", color=S.INK2)
        c.line(486, a, 486, b - 1, color=S.GRID, width=2, lint=False)
    c.callout_column([
        ((r["rods"][0], sum(r["layers"]["OS"]) / 2), "Rods", S.shade(S.INK2, .2)),
        ((r["cones"][0], sum(r["layers"]["ONL"]) / 2 + 6), "Cones", S.shade(S.VERMILION, .25)),
        (r["horizontal"], "Horizontal cell", S.shade(S.PURPLE, .3)),
        (r["bipolar"][0], "Bipolar cells", S.shade(S.BLUE, .25)),
        (r["amacrine"], "Amacrine cell", S.shade(S.PURPLE, .3)),
        (r["ganglion"][0], "Ganglion cells", S.shade(S.GREEN, .3)),
        ((r["nerve_fibres"][0] - 300, r["nerve_fibres"][1]), "Axons to the\noptic nerve", S.shade(S.GREEN, .3)),
    ], 132, 30, 380, anchor="end")
    c.text(150 + 165, 18, "pigment epithelium", size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    c.arrow(150 + 165, 396, 150 + 165, 372, color=S.ORANGE, width=2, head_size=8)
    c.text(150 + 175, 392, "light", size=S.SIZE_SMALL, color=S.shade(S.ORANGE, .35))
    return c
