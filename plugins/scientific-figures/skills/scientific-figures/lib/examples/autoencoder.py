"""ML architecture with nets: an autoencoder whose code feeds a decoder and a classifier.

Message: the encoder squeezes a high-dimensional x into a short code h;
from h one decoder reconstructs x and another predicts the labels y.
Origin: redrawn from the svg-images-test collection."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig.svg import Canvas
from sciencefig import style as S, nets as Nt

XC, HC, YC = S.tint(S.BLUE, 0.3), S.tint(S.VERMILION, 0.35), S.tint(S.GREEN, 0.3)


def draw():
    c = Canvas(640, 340, "r2-ae")
    cy = 120
    x = Nt.vector(c, 36, cy, n=10, cell=15, fill=XC, math=r"\mathbf{x}\in\mathbb{R}^{d}")
    E = Nt.funnel(c, 86, cy, 80, 150, 50, math=r"E")
    h = Nt.vector(c, 200, cy, n=3, cell=15, fill=HC, math=r"\mathbf{h}\in\mathbb{R}^{k}")
    Nt.link(c, x["r"], E["l"]); Nt.link(c, E["r"], h["l"])
    # two heads from h
    top, bot = 62, 200
    G = Nt.funnel(c, 300, top, 80, 50, 120, math=r"G")
    D = Nt.funnel(c, 300, bot, 80, 50, 30, math=r"D")
    xh = Nt.vector(c, 420, top, n=8, cell=15, fill=XC, math=r"\hat{\mathbf{x}}", label_pos="below")
    yh = Nt.vector(c, 420, bot, n=2, cell=15, fill=YC, math=r"\hat{\mathbf{y}}")
    c.elbow_arrow([(h["r"][0] + 4, cy - 8), (262, cy - 8), (262, top), (G["l"][0] - 4, top)],
                  color=S.INK2, width=1.4)
    c.elbow_arrow([(h["r"][0] + 4, cy + 8), (262, cy + 8), (262, bot), (D["l"][0] - 4, bot)],
                  color=S.INK2, width=1.4)
    Nt.link(c, G["r"], xh["l"]); Nt.link(c, D["r"], yh["l"])
    # what each output is
    c.lines_of_text(460, top - 6, ["reconstruction", "of the input"], size=S.SIZE_SMALL,
                    color=S.INK2)
    c.lines_of_text(460, bot - 4, ["predicted labels"], size=S.SIZE_SMALL, color=S.INK2)
    c.text(207, cy - 40, "code", size=S.SIZE_SMALL, anchor="middle", color=S.shade(S.VERMILION, .2))
    c.math(208, cy + 56, r"k \ll d", size=14, anchor="middle", color=S.shade(S.VERMILION, .2),
           baseline="hanging")
    # equations
    rows = [(r"\mathbf{h} = E(\mathbf{x})", "compressed representation of x"),
            (r"\hat{\mathbf{x}} = G(E(\mathbf{x}))", "reconstructed input"),
            (r"\hat{\mathbf{y}} = D(E(\mathbf{x}))", "estimated output labels")]
    for k, (eq, txt) in enumerate(rows):
        y = 262 + 26 * k
        c.math(40, y, eq, size=16)
        c.text(220, y, txt, size=S.SIZE_SMALL, color=S.INK2)
    return c
