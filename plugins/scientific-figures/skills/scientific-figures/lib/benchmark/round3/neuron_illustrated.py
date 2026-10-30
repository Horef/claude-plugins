"""Round 3: textbook-style labelled pyramidal neuron built from a REAL
reconstruction (pruned, smoothed, tapered by branch structure)."""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, morph as M, neuro as N

LIB = os.path.join(ROOT, "morphologies", "swc")


def draw():
    c = Canvas(640, 430, "r3-illus")
    m = M.prune(M.load(os.path.join(LIB, "L23_pyramidal.swc")), 60, 5)
    body = S.tint(S.PURPLE, 0.55)
    a = M.draw_morphology(c, m, 0, 0, box=(150, 14, 300, 400), rotate=0, style="tube",
                          widths="tips", trunk_width=8, tip_width=1.8, smooth=3, nucleus=True,
                          color=body, colors=dict(axon=S.tint(S.BLUE, .75)), axon="stub",
                          axon_len=140, soma_scale=1.35)
    s = a["soma"]
    tips = a["tips"]
    top_tip = min(tips["apical"], key=lambda p: p[1])
    low_basal = max(tips["basal"], key=lambda p: p[1])
    left_basal = min(tips["basal"], key=lambda p: p[0])
    low_axon = max(tips["axon"], key=lambda p: p[1]) if tips["axon"] else (s["x"], s["y"] + 120)
    c.callout(500, 40, top_tip, "Apical tuft (layer 1)")
    c.callout(500, 140, (s["x"] + 3, s["y"] - 90), "Apical dendrite")
    c.callout(60, s["y"] - 40, (s["x"] - s["r"] * .4, s["y"] - 2), "Soma and nucleus")
    c.callout(60, s["y"] + 40, left_basal, "Basal dendrites")
    c.callout(500, low_axon[1] - 20, low_axon, "Axon (stub)")
    return c
