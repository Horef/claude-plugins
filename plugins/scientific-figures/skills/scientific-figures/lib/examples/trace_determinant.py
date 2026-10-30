"""The trace-determinant plane with a small phase portrait in every region.

Origin: a linear-dynamics tutorial figure in a course study guide."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from sciencefig import style as S, plot as P, dynamics as Dy

ICONS = [  # (centre tr, det), matrix, label, label offset (dx, dy) in data units, ha
    ((-3.4, 6.6), [[-0.35, -2.2], [2.2, -0.35]], "stable spiral", (0, -1.7), "center"),
    ((3.4, 6.6), [[0.35, -2.2], [2.2, 0.35]], "unstable spiral", (0, -1.7), "center"),
    ((-4.5, 1.55), [[-1.0, 0.4], [0, -2.6]], "stable\nnode", (0.55, 0), "left"),
    ((4.5, 1.55), [[1.0, 0.0], [0, 2.4]], "unstable\nnode", (-0.55, 0), "right"),
    ((-3.6, -3.9), [[1.2, 0.3], [0.3, -1.2]], "saddle (any trace)", (0, -1.7), "center"),
    ((0.0, 6.4), [[0, -2.2], [2.2, 0]], None, None, None),
]
POINTS = [((2, -5), "A  (2, −5): tutorial M", (8, 0)), ((-2, 0.75), "B  (−2, 0.75)", (-8, -7)),
          ((-2, -1.25), "C  (−2, −1.25)", (8, 0)), ((-2, 5), "D  (−2, 5)", (8, 0))]


def draw():
    fig, ax = P.figure(640, 420, name="r2-trdet", layout=None)
    ax.set_position([30 / 640, 34 / 420, 590 / 640, 370 / 420])
    TR, DET = (-5.2, 5.2), (-6.2, 8.4)
    Dy.trace_det_regions(ax, TR, DET)
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.set_xticks([]); ax.set_yticks([])
    for v in (-4, -2, 2, 4):
        ax.text(v, -0.25, f"{v}".replace("-", "−"), ha="center", va="top", size=S.SIZE_SMALL, color=S.INK2)
    for v in (-4, 4):
        ax.text(0.12, v, f"{v}".replace("-", "−"), ha="left", va="center", size=S.SIZE_SMALL, color=S.INK2)
    ax.text(TR[1], -0.25, "trace", ha="right", va="top", size=S.SIZE)
    ax.text(-0.15, DET[1], "determinant", ha="right", va="top", size=S.SIZE)
    ax.text(2.25, 0.5, "det = tr²/4", ha="left", va="center", size=S.SIZE_SMALL, color=S.INK2)
    for (c, M, lab, off, ha) in ICONS:
        small = abs(c[1] - 1.55) < 0.01
        Dy.mini_portrait(ax, c, np.array(M), 0.8 if small else 0.95, 1.8 if small else 2.1,
                         color=S.INK2)
        if lab:
            ax.text(c[0] + off[0], c[1] + off[1], lab, ha=ha, va="center", size=S.SIZE_SMALL,
                    color=S.INK)
    ax.text(0.62, 6.4, "centres (tr = 0)", ha="left", va="center", size=S.SIZE_SMALL, color=S.INK)
    ax.text(-5.05, -1.3, "stable only in the shaded region:", ha="left", va="top",
            size=S.SIZE_SMALL, color=S.shade(S.GREEN, .3))
    ax.text(-5.05, -1.9, "tr < 0 and det > 0", ha="left", va="top", size=S.SIZE_SMALL,
            color=S.shade(S.GREEN, .3))
    for (p, lab, off) in POINTS:
        ax.plot(*p, "o", ms=6, color=S.VERMILION, zorder=8)
        ax.annotate(lab, p, xytext=off, textcoords="offset points",
                    ha="left" if off[0] > 0 else "right", va="center", size=S.SIZE_SMALL,
                    color=S.shade(S.VERMILION, .25), zorder=8)
    lint = P.lint(fig)
    return P.export(fig), lint
