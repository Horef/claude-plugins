"""Round 3: one real L2/3 pyramidal cell in the three rendering styles, and an
illustrated (textbook-style) version with labels."""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, morph as M

LIB = os.path.join(ROOT, "morphologies", "swc")


def draw():
    c = Canvas(640, 330, "r3-styles")
    m = M.load(os.path.join(LIB, "L23_pyramidal.swc"))
    W = 640 / 3
    kw = dict(rotate=0, axon="stub", axon_len=120, lint=False)
    M.draw_morphology(c, m, 0, 0, box=(14, 30, W - 28, 250), style="ink", width_gain=1.3, **kw)
    M.draw_morphology(c, m, 0, 0, box=(W + 14, 30, W - 28, 250), style="compartments",
                      colors=dict(apical=S.PURPLE, basal=S.GREEN, axon=S.BLUE), width_gain=1.3, **kw)
    M.draw_morphology(c, M.prune(m, 40, 4), 0, 0, box=(2 * W + 14, 30, W - 28, 250), style="tube",
                      widths="tips", trunk_width=6, tip_width=1.3, smooth=3, nucleus=True,
                      colors=dict(axon=S.tint(S.BLUE, .8)), **kw)
    for i, (t, sub) in enumerate((("ink", "the raw tracing (Golgi look)"),
                                  ("compartments", "apical, basal dendrites, axon"),
                                  ("tube, pruned", "illustration (textbook look)"))):
        c.text(i * W + W / 2, 302, t, size=S.SIZE, anchor="middle", bold=True)
        c.text(i * W + W / 2, 320, sub, size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    return c
