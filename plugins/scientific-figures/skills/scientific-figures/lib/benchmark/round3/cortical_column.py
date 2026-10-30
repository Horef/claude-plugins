"""Round 3: a cortical column drawn with REAL reconstructions at one common
scale (true relative sizes) - the kind of figure used in papers."""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, morph as M

LIB = os.path.join(ROOT, "morphologies", "swc")
# layer boundaries, depth in um from the pia (rat somatosensory cortex, approx.)
LAYERS = [("L1", 0, 130), ("L2/3", 130, 580), ("L4", 580, 800), ("L5", 800, 1380), ("L6", 1380, 2050)]
# (file, label, x px, soma depth um, excitatory?)
CELLS = [("L1_HAC", "L1 horizontal\naxon cell", 136, 70, False),
         ("L23_pyramidal", "L2/3\npyramidal", 215, 400, True),
         ("L23_large_basket", "L2/3 large\nbasket cell", 290, 430, False),
         ("L4_spiny_stellate", "L4 spiny\nstellate", 370, 690, True),
         ("L4_martinotti", "L4 Martinotti\ncell", 455, 720, False),
         ("L5_thick_tufted", "L5 thick-tufted\npyramidal", 535, 1110, True),
         ("L6_tufted_pyramidal", "L6 tufted\npyramidal", 615, 1700, True)]


def draw():
    W, top, k = 680, 18, 0.235        # k = px per um (one scale for all cells)
    H = int(top + 2050 * k + 50)
    c = Canvas(W, H, "r3-column")
    X0 = 64
    for i, (nm, d0, d1) in enumerate(LAYERS):
        y0, y1 = top + d0 * k, top + d1 * k
        if i % 2 == 0:
            c.rect(X0, y0, W - X0 - 4, y1 - y0, fill=S.FAINT, color="none", lint=False)
        c.text(X0 - 10, (y0 + y1) / 2, nm, size=S.SIZE, bold=True, anchor="end", baseline="middle",
               color=S.INK2)
    for f, lab, x, depth, exc in CELLS:
        m = M.load(os.path.join(LIB, f + ".swc"))
        ax_col = S.EXC if exc else S.INH
        M.draw_morphology(c, m, x, top + depth * k, scale=k, rotate=0, style="slate",
                          colors=dict(axon=ax_col), axon="stub", axon_len=180 if exc else 300,
                          width_gain=1.2, min_width=0.55, lint=False, soma_scale=1.3)
    # labels under the column, one per cell, aligned with its x
    yl = top + 2050 * k + 16
    for f, lab, x, depth, exc in CELLS:
        c.lines_of_text(x, yl, lab.split("\n"), size=S.SIZE_SMALL, anchor="middle", color=S.INK2,
                        gap=1.15)
    # scale bar
    c.line(W - 14 - 200 * k, top + 2050 * k - 10, W - 14, top + 2050 * k - 10, color=S.INK, width=2,
           cap="butt", lint=False)
    c.text(W - 14 - 100 * k, top + 2050 * k - 16, "200 µm", size=S.SIZE_SMALL, anchor="middle")
    return c
