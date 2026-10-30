"""Commutative diagram: solving x' = Mx by changing to the eigenbasis and back.

The hard direct route on top, the easy detour through the eigenbasis below.
Origin: a linear-dynamics tutorial figure in a course study guide."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig.svg import Canvas
from sciencefig import style as S


def mbox(c, cx, cy, tex, sub, w=118, h=50, fill="#fff", color=S.INK2):
    c.rect(cx - w / 2, cy - h / 2, w, h, fill=fill, color=color, width=1.2, rx=6)
    c.math(cx, cy - 6, tex, size=17, anchor="middle", baseline="middle")
    c.text(cx, cy + 14, sub, size=S.SIZE_SMALL, anchor="middle", baseline="middle", color=S.INK2)
    return dict(l=(cx - w / 2, cy), r=(cx + w / 2, cy), t=(cx, cy - h / 2), b=(cx, cy + h / 2))


def draw():
    c = Canvas(640, 262, "r2-diag")
    xl, xr, yt, yb = 205, 545, 46, 182
    c.rect(130, yb - 46, 500, 92, fill=S.tint(S.BLUE, 0.08), color="none", rx=8, lint=False)
    c.lines_of_text(118, yt - 4, ["original", "coordinates"], size=S.SIZE_SMALL, anchor="end",
                    color=S.INK2)
    c.lines_of_text(118, yb - 4, ["eigen-", "coordinates"], size=S.SIZE_SMALL, anchor="end",
                    color=S.shade(S.BLUE, .2))
    A = mbox(c, xl, yt, r"\mathbf{x}(0)", "initial state")
    B = mbox(c, xr, yt, r"\mathbf{x}(t)", "state at time t")
    C = mbox(c, xl, yb, r"\tilde{\mathbf{x}}(0)", "mode amplitudes", fill="#fff")
    D = mbox(c, xr, yb, r"\tilde{\mathbf{x}}(t)", "mode amplitudes", fill="#fff")
    # hard direct route
    c.arrow(A["r"][0] + 4, yt, B["l"][0] - 4, yt, color=S.MUTED, width=1.4, dash="5 4")
    c.math((xl + xr) / 2, yt - 12, r"e^{Mt}", size=15, anchor="middle", color=S.INK2)
    c.text((xl + xr) / 2, yt + 18, "direct: modes coupled", size=S.SIZE_SMALL, anchor="middle",
           color=S.INK2)
    # easy detour
    c.arrow(xl, A["b"][1] + 4, xl, C["t"][1] - 4, color=S.INK, width=1.8)
    c.math(xl + 12, (yt + yb) / 2 - 8, r"U^{-1}", size=15, baseline="middle")
    c.text(xl + 12, (yt + yb) / 2 + 12, "rows = left eigenvectors", size=S.SIZE_SMALL,
           baseline="middle", color=S.INK2)
    c.arrow(C["r"][0] + 4, yb, D["l"][0] - 4, yb, color=S.BLUE, width=2.2)
    c.math((xl + xr) / 2, yb - 14, r"\tilde{x}_k(t) = \tilde{x}_k(0)\,e^{\mu_k t}", size=15,
           anchor="middle", color=S.shade(S.BLUE, .2))
    c.text((xl + xr) / 2, yb + 20, "each mode on its own", size=S.SIZE_SMALL, anchor="middle",
           color=S.shade(S.BLUE, .2))
    c.arrow(xr, D["t"][1] - 4, xr, B["b"][1] + 4, color=S.INK, width=1.8)
    c.math(xr - 12, (yt + yb) / 2 - 8, r"U", size=15, anchor="end", baseline="middle")
    c.text(xr - 12, (yt + yb) / 2 + 12, "columns = right eigenvectors", size=S.SIZE_SMALL,
           anchor="end", baseline="middle", color=S.INK2)
    c.math(380, 252, r"M = U D U^{-1} \quad\Rightarrow\quad e^{Mt} = U\,e^{Dt}\,U^{-1}", size=16,
           anchor="middle")
    return c
