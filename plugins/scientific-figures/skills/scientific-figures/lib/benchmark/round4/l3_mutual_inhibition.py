"""769001 Lecture 3 worked examples (mutual inhibition, symmetry breaking,
E-I oscillations). Shows the round-4 dynamics helpers:
  Dy.portrait        one call: flow + nullclines + computed fixed points + separatrices
  Dy.fixed_points    root-finding + classification (no hand-placed dots)
  Dy.separatrix      stable manifold of a saddle (correct when it is curved)
  Dy.bifurcation_branches  fixed points vs a parameter (pitchfork diagram)
  P.finish           lint then export in the right order
Model: r1' = -r1 + g(-J r2 + h1), r2' = -r2 + g(-J r1 + h2), logistic g, theta=0, beta=1."""
import sys
sys.path.insert(0, __file__.rsplit("/benchmark", 1)[0])
import numpy as np
from sciencefig import style as S, plot as P, dynamics as Dy

g = lambda x: 1 / (1 + np.exp(-np.clip(x, -50, 50)))
field = lambda J, h1=1.0, h2=1.0: (lambda x, y: (-x + g(-J * y + h1), -y + g(-J * x + h2)))
BOX = (-0.02, 1.02)


def _axes(ax, first):
    ax.set_xticks([0, 0.5, 1], ["0", "0.5", "1"]); ax.set_yticks([0, 0.5, 1], ["0", "0.5", "1"] if first else [])
    ax.set_xlabel("$r_1$")
    if first:
        ax.set_ylabel("$r_2$")
    P.despine(ax)


def draw_phase():
    """Three regimes side by side (small multiples): one parameter changes."""
    fig, axes = P.figure(640, 270, ncols=3, name="l3b-phase")
    for k, (ax, J) in enumerate(zip(axes, (1, 4.35, 10))):
        fps = Dy.portrait(ax, field(J), BOX, BOX, density=0.55, n=30)
        ax.set_title(f"J = {J:g}: {len(fps)} fixed point" + ("s" if len(fps) > 1 else ""), size=S.SIZE_SMALL, loc="left")
        _axes(ax, k == 0)
    P.end_label(axes[0], 0.97, g(-0.97 + 1), "$r_2$-nullcline", color=S.UNIT2, dx=-2, dy=-10, ha="right")
    P.end_label(axes[0], g(-0.97 + 1), 0.97, "$r_1$-nullcline", color=S.UNIT1, dx=5, dy=-3)
    return P.finish(fig)


def draw_bias():
    """Explicit symmetry breaking: the separatrix tilts, then a state vanishes."""
    fig, axes = P.figure(640, 270, ncols=3, name="l3b-bias")
    for k, (ax, h1) in enumerate(zip(axes, (1.0, 2.0, 4.0))):
        fps = Dy.portrait(ax, field(10, h1, 1.0), BOX, BOX, trajectories=[((0.3, 0.38), S.BLUE)],
                          density=0.55, n=30)
        ax.set_title(f"$h_1$ = {h1:g}, $h_2$ = 1: {len(fps)} f.p.", size=S.SIZE_SMALL, loc="left")
        _axes(ax, k == 0)
    return P.finish(fig)


def draw_pitchfork():
    fig, ax = P.figure(420, 260, name="l3b-pitchfork")
    Js = np.linspace(0.3, 12, 80)
    br = Dy.bifurcation_branches(lambda J: field(J), Js, BOX, BOX, coord=0)
    for kind, style in (("stable", dict(color=S.BLUE, s=9)), ("unstable", dict(color=S.MUTED, s=6))):
        if br[kind]:
            a, v = np.array(br[kind]).T
            ax.scatter(a, v, lw=0, zorder=3, **style)
    ax.set_xlabel("inhibition strength $J$"); ax.set_ylabel("fixed-point rate $r_1^*$")
    ax.set_xlim(0, 12); ax.set_ylim(-0.03, 1); P.despine(ax)
    P.end_label(ax, 12, 0.73, "stable", color=S.BLUE, dx=-4, dy=-9, ha="right")
    P.end_label(ax, 12, 0.21, "unstable (symmetric)", color=S.INK2, dx=-4, dy=-13, ha="right")
    return P.finish(fig)


def draw_modes():
    """Linearised flow with eigen-directions clipped to the axes."""
    fig, axes = P.figure(640, 290, ncols=2, name="l3b-modes")
    for k, (ax, a) in enumerate(zip(axes, (0.5, 1.74))):
        M = np.array([[-1, -a], [-a, -1]]); f = Dy.linear(M)
        Dy.flow_field(ax, f, (-1, 1), (-1, 1))
        Dy.eigenline(ax, (0, 0), (1, 1), Dy.DECAY)
        Dy.eigenline(ax, (0, 0), (1, -1), Dy.GROW if a > 1 else Dy.DECAY)
        Dy.fixed_point(ax, (0, 0), Dy.classify(M), size=8)
        ax.set_title(f"a = {a}: μ∥ = {-(1 + a):.2f}, μ⊥ = {-(1 - a):+.2f}".replace("-", "−"), size=S.SIZE_SMALL, loc="left")
        ax.set_aspect("equal"); ax.set_xticks([0]); ax.set_yticks([0] if k == 0 else [])
        ax.set_xlabel("$\\delta r_1$"); P.despine(ax)
        if k == 0:
            ax.set_ylabel("$\\delta r_2$")
    return P.finish(fig)


NAMES = ["draw_phase", "draw_bias", "draw_pitchfork", "draw_modes"]

if __name__ == "__main__":
    from sciencefig import check as C
    svgs = []
    for n in NAMES:
        svg, probs = globals()[n]()
        print(f"{n:16s} {len(svg)//1000:4d} kB  {'OK' if not probs else probs}")
        svgs.append(svg)
    if len(sys.argv) > 1:
        C.render(svgs, sys.argv[1], names=NAMES)
