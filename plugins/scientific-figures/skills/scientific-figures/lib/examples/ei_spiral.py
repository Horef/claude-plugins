"""Phase portrait of a damped E-I oscillation (a stable spiral), eigenvalues (-1 +- 2i)/tau.

Origin: a linear-dynamics tutorial figure in a course study guide."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from scipy.linalg import expm
from sciencefig import style as S, plot as P, dynamics as Dy

TAU = 10.0
M = np.array([[-1.0, -2.0], [2.0, -1.0]])


def draw():
    fig, (a1, a2) = P.figure(640, 290, ncols=2, name="r2-ei", gridspec_kw=dict(width_ratios=[1.55, 1]))
    t = np.linspace(0, 80, 800)
    R = np.array([expm(M * tk / TAU) @ np.array([1.0, 0.0]) for tk in t])
    env = np.exp(-t / TAU)
    a1.fill_between(t, -env, env, color=S.FAINT, lw=0)
    a1.plot(t, env, color=S.MUTED, lw=1, ls=(0, (3, 3))); a1.plot(t, -env, color=S.MUTED, lw=1, ls=(0, (3, 3)))
    a1.plot(t, R[:, 0], color=S.EXC, lw=S.LW_DATA)
    a1.plot(t, R[:, 1], color=S.INH, lw=S.LW_DATA)
    a1.axhline(0, color=S.AXIS, lw=0.8)
    P.despine(a1)
    a1.set_xlabel("time (ms)"); a1.set_ylabel("deviation from fixed point")
    a1.set_xlim(0, 80); a1.set_ylim(-1.05, 1.1); a1.set_yticks([-1, 0, 1])
    P.end_label(a1, 2.2, 0.97, "$r_E$ (kicked)", color=S.EXC, dx=4)
    k = np.argmax(R[:, 1]); P.end_label(a1, t[k], R[k, 1], "$r_I$", color=S.INH, dx=6, dy=4, va="bottom")
    a1.text(22, 0.36, "envelope $e^{-t/\\tau}$", size=S.SIZE_SMALL, color=S.INK2)
    # period bracket between two successive maxima of r_E
    pk = [i for i in range(1, len(t) - 1) if R[i, 0] > R[i - 1, 0] and R[i, 0] > R[i + 1, 0]][:2]
    if len(pk) == 2:
        P.hbracket(a1, t[pk[0]], t[pk[1]], -0.62, f"period ≈ {t[pk[1]] - t[pk[0]]:.0f} ms", below=True)
    # phase plane
    a2.plot(R[:, 0], R[:, 1], color=S.INK, lw=1.8)
    for at in (0.06, 0.25, 0.5):
        Dy.arrow_on_path(a2, R[:, 0], R[:, 1], at, color=S.INK, size=13)
    Dy.fixed_point(a2, (0, 0), "stable", size=7)
    a2.plot([1], [0], "o", ms=6, mfc="white", mec=S.INK, mew=1.3, zorder=6)
    a2.annotate("start (1, 0)", (1, 0), xytext=(0, -12), textcoords="offset points", ha="center",
                va="top", size=S.SIZE_SMALL, color=S.INK2)
    a2.set_aspect("equal"); a2.set_xlim(-0.55, 1.1); a2.set_ylim(-0.45, 0.75)
    a2.axhline(0, color=S.GRID, lw=0.8, zorder=0); a2.axvline(0, color=S.GRID, lw=0.8, zorder=0)
    P.despine(a2)
    a2.set_xlabel("$r_E$", color=S.shade(S.EXC, .15)); a2.set_ylabel("$r_I$", color=S.shade(S.INH, .15))
    a2.set_xticks([0, 1], ["0", "1"]); a2.set_yticks([0, 0.5], ["0", "0.5"])
    lint = P.lint(fig)
    return P.export(fig), lint
