"""Phase portrait of a linear saddle, x1' = 3x1 + 2x2, x2' = x1 - x2, with its eigen-directions.

Origin: a linear-dynamics tutorial figure in a course study guide."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from sciencefig import style as S, plot as P, dynamics as Dy

M = np.array([[3.0, 2.0], [1.0, -1.0]])
r6 = np.sqrt(6)
U_GROW, U_DECAY = np.array([2 + r6, 1.0]), np.array([2 - r6, 1.0])


def draw():
    fig, ax = P.figure(640, 390, name="r2-saddle", layout=None)
    W, H = 640, 390
    L = 4.0
    side = 350
    ax.set_position([20 / W, 22 / H, side / W, side / H])
    f = Dy.linear(M)
    Dy.flow_field(ax, f, (-L, L), (-L, L), density=0.9)
    Dy.eigenline(ax, (0, 0), U_GROW, Dy.GROW)
    Dy.eigenline(ax, (0, 0), U_DECAY, Dy.DECAY)
    # two trajectories that start close to the decaying direction
    ud = U_DECAY / np.linalg.norm(U_DECAY); ug = U_GROW / np.linalg.norm(U_GROW)
    for s in (1, -1):
        x0 = s * (3.6 * ud + 0.06 * ug)
        Dy.trajectory(ax, f, x0, 2.0, color=S.INK, lw=1.8, arrows=(0.25, 0.8),
                      clip=((-L, L), (-L, L)))
    Dy.fixed_point(ax, (0, 0), "saddle", size=9)
    ax.set_xlim(-L, L); ax.set_ylim(-L, L); ax.set_aspect("equal")
    ax.axhline(0, color=S.AXIS, lw=0.8, zorder=1.5); ax.axvline(0, color=S.AXIS, lw=0.8, zorder=1.5)
    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.text(L, -0.12, "$x_1$", ha="right", va="top", size=S.SIZE)
    ax.text(0.12, L, "$x_2$", ha="left", va="top", size=S.SIZE)
    # direct labels in the margin, next to where each eigenline leaves the box
    tx = 395 / W
    fig.text(tx, 0.86, "growing direction $\\mathbf{u}_2$ = (2+√6, 1)", color=S.shade(Dy.GROW, .15),
             size=S.SIZE_SMALL)
    fig.text(tx, 0.81, "eigenvalue $\\mu_2$ = 1 + √6 ≈ 3.45", color=S.shade(Dy.GROW, .15),
             size=S.SIZE_SMALL)
    fig.text(tx, 0.70, "decaying direction $\\mathbf{u}_1$ = (2−√6, 1)", color=S.shade(Dy.DECAY, .15),
             size=S.SIZE_SMALL)
    fig.text(tx, 0.65, "eigenvalue $\\mu_1$ = 1 − √6 ≈ −1.45", color=S.shade(Dy.DECAY, .15),
             size=S.SIZE_SMALL)
    fig.text(tx, 0.48, "black: two trajectories that start", color=S.INK, size=S.SIZE_SMALL)
    fig.text(tx, 0.43, "near the blue line - first pulled in", color=S.INK, size=S.SIZE_SMALL)
    fig.text(tx, 0.38, "along $\\mathbf{u}_1$, then pushed out along $\\mathbf{u}_2$", color=S.INK,
             size=S.SIZE_SMALL)
    fig.text(tx, 0.24, "gray: the flow everywhere else", color=S.INK2, size=S.SIZE_SMALL)
    fig.text(tx, 0.19, "half-filled dot: saddle at the origin", color=S.INK2, size=S.SIZE_SMALL)
    lint = P.lint(fig)
    return P.export(fig), lint
