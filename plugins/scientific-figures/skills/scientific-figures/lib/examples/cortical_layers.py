"""Layered circuit with pathways (morph + neuro): feedforward, recurrent and feedback routes.

Message: thalamic input enters L4, climbs to L2/3 (recurrent there), then
descends to L5; feedback from higher areas lands on apical tufts in L1.
Origin: redrawn from the svg-images-test collection."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig.svg import Canvas
from sciencefig import style as S, morph as M, neuro as N

FF, REC, FB = S.BLUE, S.GREEN, S.PURPLE


def draw():
    c = Canvas(640, 490, "r2-layers")
    X0, X1 = 70, 630
    bands = [("L1", 14, 78), ("L2/3", 78, 196), ("L4", 196, 292), ("L5", 292, 440)]
    for k, (nm, y0, y1) in enumerate(bands):
        if k % 2 == 0:
            c.rect(X0, y0, X1 - X0, y1 - y0, fill=S.FAINT, color="none", lint=False)
        c.text(X0 - 10, (y0 + y1) / 2, nm, size=S.SIZE, anchor="end", baseline="middle", bold=True,
               color=S.INK2)
    # cells (context colour); draw L5 first so L2/3 sits on top of the trunks
    l5 = [M.pyramidal(c, x, 392, size=1.0, apical_len=312, seed=s, tuft_depth=3, obliques=3,
                      basal=5, basal_depth=1, axon_len=34) for x, s in ((455, 5), (545, 8))]
    l23 = [M.pyramidal(c, x, 166, size=0.85, apical_len=120, seed=s, tuft_depth=2, obliques=1,
                       basal=4, basal_depth=1, axon_len=0) for x, s in ((290, 2), (380, 3))]
    l4 = [M.stellate(c, x, y, r=8, seed=s, n=7, depth=1, length=13) for x, y, s in ((175, 230, 1), (232, 262, 4))]

    # --- feedforward: thalamus -> L4 -> L2/3 (blue)
    for k, cell in enumerate(l4):
        for j, dy in enumerate((-4, 4)):
            y = cell["soma"]["y"] + dy
            N.synapse_to(c, (X0 + 2, y), cell["soma"], kind="exc", color=FF, width=1.5)
    c.text(X0 + 6, 284, "thalamic input", size=S.SIZE_SMALL, color=S.shade(FF, .2))
    for cell, tgt in zip(l4, l23):
        s = cell["soma"]
        N.synapse_to(c, (s["x"] + 4, s["y"] - 10), tgt["soma"], kind="exc", color=FF, width=1.8,
                     bend=-0.25)
    c.text(165, 186, "feedforward", size=S.SIZE_SMALL, color=S.shade(FF, .2), anchor="middle")

    # --- recurrent within L2/3 (green), both directions
    a, b = l23[0]["soma"], l23[1]["soma"]
    N.connect(c, a, b, kind="exc", color=REC, width=1.8, bend=0.3)
    N.connect(c, b, a, kind="exc", color=REC, width=1.8, bend=-0.8)
    c.text((a["x"] + b["x"]) / 2, 112, "recurrent", size=S.SIZE_SMALL, anchor="middle",
           color=S.shade(REC, .25))
    # L2/3 -> L5 (green, descending)
    for k, (src, dst) in enumerate(zip(l23, l5)):
        sx = src["soma"]["x"] + 6
        tx = dst["soma"]["x"] - 16
        yy = 336 + 16 * k
        N.synapse_to(c, (sx, src["soma"]["bottom"][1] + 2), dst["soma"], kind="exc", color=REC,
                     width=1.6, via=[(sx, yy), (tx - 22, yy)])
    c.text(sx - 90, 372, "descending to L5", size=S.SIZE_SMALL, color=S.shade(REC, .25))

    # --- feedback from higher areas -> L1 tufts (purple)
    tuft_targets = [l5[1]["tuft"][4], l5[0]["tuft"][5], l23[1]["tuft"][2]]
    for k, tp in enumerate(tuft_targets):
        y = 30 + 13 * k
        N.synapse_to(c, (X1 - 2, y), M.point_target(tp[0], tp[1]), kind="exc", color=FB, width=1.6, dash="5 3",
                     via=[(tp[0] + 30 + 8 * k, y)])
    c.lines_of_text(X1 - 4, 100, ["feedback from", "higher areas"], size=S.SIZE_SMALL,
                    anchor="end", color=S.shade(FB, .2))

    # --- L5 output
    for cell in l5:
        e = cell["axon_end"]
        c.arrow(e[0], e[1] - 2, e[0], 466, color=S.INK2, width=1.4, head="tri")
    c.text((l5[0]["soma"]["x"] + l5[1]["soma"]["x"]) / 2, 482, "output to subcortical targets",
           size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    return c
