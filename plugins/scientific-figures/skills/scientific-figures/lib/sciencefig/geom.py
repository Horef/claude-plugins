"""Math / geometry diagrams on matplotlib axes: vectors, projections,
angles, right-angle marks, coordinate planes, unit circle.

    from sciencefig import plot as P, geom as G, style as S
    fig, ax = P.figure(420, 360, name="fig-proj")
    G.plane(ax, (-0.5, 4), (-0.5, 3), xlabel="$x_1$", ylabel="$x_2$")
    a = G.vector(ax, (0, 0), (3, 2), S.BLUE, r"$\\mathbf{a}$")
    ...
Equal aspect is enforced: a right angle must LOOK right (Wilke ch. 3: same
units on both axes -> same scale).
"""
import math

import numpy as np
import matplotlib.patheffects as pe
from matplotlib.patches import Arc, FancyArrowPatch, Polygon

from . import style as S

HALO = [pe.withStroke(linewidth=3.5, foreground="white")]


def plane(ax, xlim, ylim, xlabel="x", ylabel="y", ticks=None, grid=False, origin_axes=True,
          tick_labels=True):
    """Cartesian plane, equal aspect, axes through the origin with arrows."""
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    if origin_axes:
        ax.spines["left"].set_position(("data", 0))
        ax.spines["bottom"].set_position(("data", 0))
        ax.plot(1, 0, ">", color=S.AXIS, transform=ax.get_yaxis_transform(), clip_on=False, ms=6)
        ax.plot(0, 1, "^", color=S.AXIS, transform=ax.get_xaxis_transform(), clip_on=False, ms=6)
    if ticks is not None:
        ax.set_xticks(ticks[0]); ax.set_yticks(ticks[1])
    else:
        ax.set_xticks([]); ax.set_yticks([])
    if not tick_labels:
        ax.set_xticklabels([]); ax.set_yticklabels([])
    if grid:
        ax.grid(True, color=S.GRID, lw=S.LW_HAIR)
        ax.set_axisbelow(True)
    if xlabel:
        ax.annotate(xlabel, (1, 0), xycoords=("axes fraction", "data"), xytext=(0, -8),
                    textcoords="offset points", ha="right", va="top", size=S.SIZE)
    if ylabel:
        ax.annotate(ylabel, (0, 1), xycoords=("data", "axes fraction"), xytext=(6, 0),
                    textcoords="offset points", ha="left", va="top", size=S.SIZE)


def vector(ax, tail, v, color=S.INK, label=None, label_at=0.55, label_offset=(8, 6), lw=2.0,
           head=9, ha="left", va="bottom", zorder=5):
    """Arrow from tail to tail+v. Label sits beside the shaft (offset in points,
    perpendicular side chosen by label_offset). Returns head point."""
    t = np.asarray(tail, float); h = t + np.asarray(v, float)
    ax.add_patch(FancyArrowPatch(t, h, arrowstyle=f"-|>,head_length={head*0.07:.2f},head_width={head*0.045:.2f}",
                                 mutation_scale=20, color=color, lw=lw, shrinkA=0, shrinkB=0,
                                 zorder=zorder, joinstyle="miter"))
    if label:
        p = t + label_at * (h - t)
        ax.annotate(label, p, xytext=label_offset, textcoords="offset points", color=S.shade(color, .1),
                    size=S.SIZE, ha=ha, va=va, path_effects=HALO, zorder=zorder + 1)
    return h


def point(ax, p, label=None, color=S.INK, offset=(6, 6), ha="left", va="bottom", size=5.5):
    ax.plot(*p, "o", color=color, ms=size, zorder=6, mec="white", mew=1.2)
    if label:
        ax.annotate(label, p, xytext=offset, textcoords="offset points", ha=ha, va=va,
                    size=S.SIZE, color=color, path_effects=HALO, zorder=7)


def segment(ax, p, q, color=S.MUTED, lw=1.0, ls=(0, (3, 3)), zorder=2):
    ax.plot([p[0], q[0]], [p[1], q[1]], color=color, lw=lw, ls=ls, zorder=zorder)


def angle_arc(ax, center, v1, v2, r=0.4, label=None, color=S.INK2, label_r=1.45, lw=1.1):
    """Arc between directions v1 and v2 (counter-clockwise from v1)."""
    a1 = math.degrees(math.atan2(v1[1], v1[0]))
    a2 = math.degrees(math.atan2(v2[1], v2[0]))
    if a2 < a1:
        a2 += 360
    ax.add_patch(Arc(center, 2 * r, 2 * r, theta1=a1, theta2=a2, color=color, lw=lw, zorder=4))
    if label:
        am = math.radians((a1 + a2) / 2)
        ax.text(center[0] + label_r * r * math.cos(am), center[1] + label_r * r * math.sin(am),
                label, ha="center", va="center", size=S.SIZE, color=S.INK, path_effects=HALO)


def right_angle(ax, at, d1, d2, size=0.18, color=S.INK2, lw=1.0):
    """Small square marking a right angle at `at` between directions d1, d2."""
    u = np.asarray(d1, float) / np.linalg.norm(d1) * size
    w = np.asarray(d2, float) / np.linalg.norm(d2) * size
    a = np.asarray(at, float)
    ax.plot(*zip(a + u, a + u + w, a + w), color=color, lw=lw, zorder=4)


def projection(ax, a, b, color=S.VERMILION, label=None, show_perp=True, tail=(0, 0)):
    """Project vector a onto b (both from `tail`): draws the dashed
    perpendicular, the right-angle mark and the projected vector."""
    a = np.asarray(a, float); b = np.asarray(b, float); t = np.asarray(tail, float)
    p = (a @ b) / (b @ b) * b
    if show_perp:
        segment(ax, t + a, t + p)
        if np.linalg.norm(a - p) > 1e-9 and np.linalg.norm(p) > 1e-9:
            right_angle(ax, t + p, -p if (a @ b) > 0 else p, a - p)
    vector(ax, t, p, color=color, label=label, lw=2.6, label_offset=(0, -10), va="top", ha="center")
    return t + p


def unit_circle(ax, color=S.MUTED, lw=1.0):
    th = np.linspace(0, 2 * np.pi, 200)
    ax.plot(np.cos(th), np.sin(th), color=color, lw=lw, zorder=1)


def shade_polygon(ax, pts, color=S.BLUE, alpha=0.15):
    ax.add_patch(Polygon(pts, closed=True, facecolor=color, alpha=alpha, edgecolor="none", zorder=1))
