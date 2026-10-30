"""Network diagram with typeset equations (nets + c.math): Hebbian and anti-Hebbian learning.

Message: feedforward weights learn by a Hebbian (Oja) rule, lateral weights
between outputs by an anti-Hebbian rule that decorrelates the outputs.
Origin: redrawn from the svg-images-test collection."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig.svg import Canvas
from sciencefig import style as S, neuro as N

FFC, LAT = S.BLUE, S.VERMILION


def draw():
    c = Canvas(640, 470, "r2-hebb")
    DY = 26
    # --- equations: rule name | equation, colour-linked to the connections
    rows = [("Linear outputs", r"y_j = \mathbf{w}_j\cdot\mathbf{x} + \sum_{k<j} a_{jk}\,y_k", S.INK),
            ("Hebbian (feedforward)", r"\Delta\mathbf{w}_j = \eta\,(\mathbf{x}\,y_j - y_j^2\,\mathbf{w}_j)", S.shade(FFC, .15)),
            ("Anti-Hebbian (lateral)", r"\Delta a_{jk} = -\eta\,(y_j\,y_k + y_j^2\,a_{jk})", S.shade(LAT, .15))]
    for k, (name, eq, col) in enumerate(rows):
        y = 34 + 40 * k
        c.text(40, y, name, size=S.SIZE, bold=True, color=col)
        c.math(250, y, eq, size=17, color=col)
    # --- nodes
    xi, xo, r = 170, 400, 19
    ys_in = [140 + DY, 196 + DY, 252 + DY, None, 380 + DY]
    ys_out = [150 + DY, 215 + DY, 280 + DY, None, 380 + DY]
    lab_in = ["$x_1$", "$x_2$", "$x_3$", None, "$x_d$"]
    lab_out = ["$y_1$", "$y_2$", "$y_3$", None, "$y_m$"]

    def node(x, y, lab, fill):
        c.circle(x, y, r, fill=fill, color=S.INK2, width=1.3, tag="node")
        c.text(x, y, lab, size=15, anchor="middle", baseline="middle", lint=False)
        return dict(x=x, y=y, r=r, kind="round")

    def vdots(x, y):
        for d in (-9, 0, 9):
            c.circle(x, y + d, 2.4, fill=S.INK2, color="none", lint=False)

    ins, outs = [], []
    for y, l in zip(ys_in, lab_in):
        if y is None:
            vdots(xi, 316 + DY); continue
        ins.append((x := xi, y))
    for y, l in zip(ys_out, lab_out):
        if y is None:
            vdots(xo, 330 + DY); continue
        outs.append((xo, y))
    # feedforward all-to-all: context tint, w_1 highlighted
    for i, (x0, y0) in enumerate(ins):
        for j, (x1, y1) in enumerate(outs):
            hl = j == 0
            ang = math.atan2(y1 - y0, x1 - x0)
            p = (x0 + r * math.cos(ang), y0 + r * math.sin(ang))
            q = (x1 - (r + 2) * math.cos(ang), y1 - (r + 2) * math.sin(ang))
            c.arrow(*p, *q, color=FFC if hl else S.tint(FFC, 0.35), width=1.6 if hl else 1.0,
                    head="tri", head_size=7 if hl else 6, tag="w", lint=False)
    # lateral anti-Hebbian: from earlier outputs to later ones (k < j), arcs on the right
    for k in range(len(outs)):
        for j in range(k + 1, len(outs)):
            a, b = outs[k], outs[j]
            span = b[1] - a[1]
            p0 = (a[0] + r * 0.7, a[1] + r * 0.7)
            p3 = (b[0] + r * 0.75, b[1] - r * 0.66)
            bulge = 0.18 + 0.1 * (j - k)
            c.curved_arrow(p0, p3, bend=bulge, color=LAT, width=1.3, head="dot", tag="a", lint=False)
    # outputs leave to the right
    for (x, y) in outs:
        c.arrow(x + r, y, 610, y, color=S.INK2, width=1.1, head="tri", lint=False)
    # nodes on top
    for (x, y), l in zip(ins, [l for l in lab_in if l]):
        node(x, y, l, "#fff")
    for (x, y), l in zip(outs, [l for l in lab_out if l]):
        node(x, y, l, S.tint(FFC, 0.15))
    # direct labels
    c.math(272, 124 + DY, r"\mathbf{w}_1", size=17, color=S.shade(FFC, .15))
    c.text(536, 300 + DY, "lateral $a_{jk}$", size=S.SIZE_SMALL, color=S.shade(LAT, .15))
    c.text(536, 315 + DY, "(inhibitory, $k<j$)", size=S.SIZE_SMALL, color=S.shade(LAT, .15))
    c.math(40, 260 + DY, r"\mathbb{E}[\mathbf{x}] = 0", size=16, color=S.INK2, baseline="middle")
    c.text(40, 280 + DY, "zero-mean input", size=S.SIZE_SMALL, color=S.INK2)
    c.text(xi, 418 + DY, "inputs", size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    c.text(xo, 418 + DY, "outputs", size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    return c
