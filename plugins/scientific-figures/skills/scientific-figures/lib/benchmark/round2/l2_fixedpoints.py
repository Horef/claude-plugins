"""769001 Lecture 2, fig. 13: graphical fixed points of the logistic autapse
(theta = 0, beta = 20, J = 1), now with the 1D flow that shows stability."""
import sys
sys.path.insert(0, __file__.rsplit("/benchmark", 1)[0])
import numpy as np
from scipy.optimize import brentq
from sciencefig import style as S, plot as P, dynamics as Dy

BETA, J = 20.0, 1.0
g = lambda x: 1 / (1 + np.exp(-BETA * x))


def roots(h):
    F = lambda r: -r + g(J * r + h)
    xs = np.linspace(-0.3, 1.3, 3201)
    v = F(xs)
    out = []
    for a, b, fa, fb in zip(xs[:-1], xs[1:], v[:-1], v[1:]):
        if fa == 0:
            out.append(a)
        elif fa * fb < 0:
            out.append(brentq(F, a, b))
    return out


def draw():
    fig, axes = P.figure(640, 270, ncols=3, name="r2-autapse-fp")
    lo, hi = -0.25, 1.2
    for ax, h in zip(axes, (-1.0, -0.5, 0.0)):
        r = np.linspace(lo, hi, 400)
        ax.plot(r, r, color=S.MUTED, lw=1.1, ls=(0, (4, 3)))
        ax.plot(r, g(J * r + h), color=S.BLUE, lw=S.LW_DATA)
        rt = roots(h)
        F = lambda x: -x + g(J * x + h)
        for x in rt:
            ax.plot([x, x], [-0.17, x], color=S.GRID, lw=0.8, zorder=1)
        # 1D phase line under the plot: arrows show dr/dt, dots show stability
        Dy.phase_line(ax, rt, F, y=-0.17, lo=lo, hi=hi, size=10, ms=7)
        for x in rt:
            stable = F(x - 1e-4) > 0 > F(x + 1e-4)
            Dy.fixed_point(ax, (x, x), "stable" if stable else "unstable", size=7)
        ax.set_xlim(lo, hi); ax.set_ylim(-0.27, 1.15)
        ax.axhline(0, color=S.GRID, lw=0.8, zorder=0)
        P.despine(ax)
        ax.set_xticks([0, 1]); ax.set_yticks([0, 1] if h == -1.0 else [])
        if h != -1.0:
            ax.spines["left"].set_visible(False)
        ax.set_xlabel("rate $r$")
        n = len(rt)
        ax.set_title(f"$h_{{\\mathrm{{ext}}}}$ = {h:g}".replace("-", "−") + f": {n} fixed point" + ("s" if n > 1 else ""),
                     size=S.SIZE_SMALL, loc="left")
    P.end_label(axes[0], 0.75, 0.75, "$r$ (identity)", color=S.INK2, dx=-4, dy=6, ha="right", va="bottom")
    P.end_label(axes[0], 0.93, g(0.93 - 1.0), "$g(r + h_\\mathrm{ext})$", color=S.BLUE, dx=-6, ha="right")
    axes[2].text(0.2, -0.085, "flow of $r$", size=S.SIZE_SMALL, color=S.INK2, va="center")
    lint = P.lint(fig)
    return P.export(fig), lint
