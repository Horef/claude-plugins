"""Dynamical-systems figures (matplotlib): phase portraits, flow fields,
trajectories with direction arrows, fixed points, eigen-directions,
nullclines, 1D phase lines, and the trace-determinant plane.

Conventions (Strogatz-style, used in every figure of the notes):
  * stable fixed point   = filled black dot
  * unstable fixed point = open (white) dot with black edge
  * saddle               = half-filled dot
  * flow field           = light gray streamlines (context)
  * highlighted trajectories = coloured, with arrowheads in the direction
    of time; growing direction = VERMILION, decaying = BLUE
"""
import numpy as np

from . import style as S

FLOW = "#c9c9c9"
GROW, DECAY = S.VERMILION, S.BLUE


def linear(M):
    """f(x) for x' = M x, vectorised for meshgrids."""
    M = np.asarray(M, float)
    return lambda x, y: (M[0, 0] * x + M[0, 1] * y, M[1, 0] * x + M[1, 1] * y)


def flow_field(ax, f, xlim, ylim, density=0.7, color=FLOW, lw=0.7, arrowsize=0.7, n=36,
               zorder=1):
    """Light streamlines of the vector field f(x, y) -> (dx, dy).
    Defaults (n=36, density=0.7) keep a panel near 35 kB of SVG; the old
    n=60, density=1 cost ~50 kB per panel for no visible gain."""
    xs = np.linspace(*xlim, n); ys = np.linspace(*ylim, n)
    X, Y = np.meshgrid(xs, ys)
    U, V = f(X, Y)
    sp = ax.streamplot(X, Y, U, V, density=density, color=color, linewidth=lw,
                       arrowsize=arrowsize, broken_streamlines=True, zorder=zorder)
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    return sp


def integrate(f, x0, t_max, n=600, backward=False):
    from scipy.integrate import solve_ivp
    sgn = -1 if backward else 1
    sol = solve_ivp(lambda t, z: sgn * np.array(f(z[0], z[1])), (0, t_max), x0,
                    t_eval=np.linspace(0, t_max, n), rtol=1e-8, atol=1e-10)
    return sol.y[0], sol.y[1]


def arrow_on_path(ax, xs, ys, at=0.5, color=S.INK, size=11, reverse=False, zorder=4):
    """Arrowhead on a polyline at fraction `at` of its arc length."""
    xs, ys = np.asarray(xs), np.asarray(ys)
    d = np.r_[0, np.cumsum(np.hypot(np.diff(xs), np.diff(ys)))]
    if d[-1] == 0:
        return
    k = int(np.searchsorted(d, at * d[-1]))
    k = min(max(k, 1), len(xs) - 1)
    # tail a short distance behind the tip, so the head has a direction. Use
    # 3% of the path, but never more than 2% of the axes diagonal: on long
    # paths (spirals, limit cycles) 3% of the path drew a long straight chord.
    back = 0.03 * d[-1]
    try:
        (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
        back = min(back, 0.02 * np.hypot(x1 - x0, y1 - y0))
    except Exception:
        pass
    j = int(np.searchsorted(d, max(0.0, d[k] - back)))
    j = min(j, k - 1)
    a, b = (j, k) if not reverse else (k, j)
    ax.annotate("", xy=(xs[b], ys[b]), xytext=(xs[a], ys[a]),
                arrowprops=dict(arrowstyle="-|>,head_length=0.5,head_width=0.25", fc=color,
                                ec=color, lw=0.8, mutation_scale=size, shrinkA=0, shrinkB=0),
                zorder=zorder)


def trajectory(ax, f, x0, t_max, color=S.INK, lw=S.LW_DATA, arrows=(0.35,), n=600,
               clip=None, zorder=3, **kw):
    """Integrate x' = f from x0 and draw it with arrowheads (direction of
    time). clip=(xlim, ylim) stops the curve when it leaves the box."""
    xs, ys = integrate(f, x0, t_max, n)
    if clip:
        (x0_, x1_), (y0_, y1_) = clip
        inside = (xs >= x0_) & (xs <= x1_) & (ys >= y0_) & (ys <= y1_)
        if inside[0] and not inside.all():
            stop = int(np.argmin(inside))          # first sample outside the box
            xs, ys = xs[:stop + 1], ys[:stop + 1]
    ax.plot(xs, ys, color=color, lw=lw, zorder=zorder, solid_capstyle="round", **kw)
    for a in arrows:
        arrow_on_path(ax, xs, ys, a, color=color, size=10 + 2 * lw)
    return xs, ys


def fixed_point(ax, p, kind="stable", size=8, zorder=6, color=S.INK):
    """Fixed point marker: stable filled, unstable open, saddle half-filled."""
    common = dict(ms=size, mec=color, mew=1.4, zorder=zorder, clip_on=False, ls="none")
    if kind == "stable":
        ax.plot(*p, "o", mfc=color, **common)
    elif kind in ("unstable", "center"):
        ax.plot(*p, "o", mfc="white", **common)
    elif kind == "saddle":
        ax.plot(*p, "o", mfc="white", **common)
        ax.plot(*p, "o", mfc=color, fillstyle="left", markerfacecoloralt="white", **common)


def eigenline(ax, p, v, color, lw=1.8, ls=(0, (6, 3)), extent=None, zorder=2):
    """Line through p along eigenvector v. extent=None: clipped exactly to
    the current axes limits (set the limits first), so P.lint does not see
    a line running through titles outside the axes."""
    v = np.asarray(v, float) / np.linalg.norm(v)
    if extent is None:
        (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
        ts = []
        for lo, hi, pc, vc in ((x0, x1, p[0], v[0]), (y0, y1, p[1], v[1])):
            if abs(vc) > 1e-12:
                ts += sorted([(lo - pc) / vc, (hi - pc) / vc])
            else:
                ts += [-np.inf, np.inf]
        t_lo, t_hi = max(ts[0], ts[2]), min(ts[1], ts[3])
        a, b = np.asarray(p) + t_lo * v, np.asarray(p) + t_hi * v
    else:
        a, b = np.asarray(p) - extent * v, np.asarray(p) + extent * v
    ax.plot([a[0], b[0]], [a[1], b[1]], color=color, lw=lw, ls=ls, zorder=zorder)


def nullcline(ax, f, xlim, ylim, which=0, color=S.INK2, lw=1.4, ls="-", n=300, zorder=2):
    """Curve where the `which` component of f is zero (x-nullcline: which=0)."""
    X, Y = np.meshgrid(np.linspace(*xlim, n), np.linspace(*ylim, n))
    Z = f(X, Y)[which]
    return ax.contour(X, Y, Z, levels=[0], colors=[color], linewidths=lw, linestyles=ls,
                      zorder=zorder)


def phase_line(ax, xs_fixed, f, y=0.0, lo=None, hi=None, color=S.INK, size=11, kinds=None,
               ms=7, zorder=6):
    """1D flow on the x axis at height y: arrows between fixed points show
    the direction of dx/dt = f(x); markers show stability (computed from
    the sign change of f unless `kinds` is given)."""
    lo = ax.get_xlim()[0] if lo is None else lo
    hi = ax.get_xlim()[1] if hi is None else hi
    pts = sorted(xs_fixed)
    edges = [lo] + pts + [hi]
    for a, b in zip(edges[:-1], edges[1:]):
        if b - a < 1e-6:
            continue
        m = (a + b) / 2
        s = np.sign(f(m))
        if s == 0:
            continue
        L = min((b - a) * 0.35, (hi - lo) * 0.06)
        x0, x1 = (m - L / 2, m + L / 2) if s > 0 else (m + L / 2, m - L / 2)
        ax.annotate("", xy=(x1, y), xytext=(x0, y),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.6, mutation_scale=size,
                                    shrinkA=0, shrinkB=0), zorder=zorder, annotation_clip=False)
    eps = 1e-4 * (hi - lo)
    for k, p in enumerate(pts):
        kind = kinds[k] if kinds else ("stable" if f(p - eps) > 0 > f(p + eps) else "unstable")
        fixed_point(ax, (p, y), kind, size=ms, zorder=zorder + 1)


def trace_det_regions(ax, tr=(-4, 4), det=(-6, 7), stable_color=S.GREEN, shade=0.14):
    """Background of the trace-determinant plane: stable quadrant shaded,
    det = tr^2/4 parabola, axes through the origin."""
    t = np.linspace(*tr, 300)
    ax.fill_between([tr[0], 0], 0, det[1], color=S.tint(stable_color, shade), lw=0, zorder=0)
    ax.plot(t, t ** 2 / 4, color=S.INK2, lw=1.4, ls=(0, (5, 3)), zorder=2)
    ax.axhline(0, color=S.AXIS, lw=1.0, zorder=1); ax.axvline(0, color=S.AXIS, lw=1.0, zorder=1)
    ax.set_xlim(*tr); ax.set_ylim(*det)


def mini_portrait(ax_parent, center, M, w, h, color=S.INK, n_traj=6, t_max=3.0, lw=1.0,
                  zorder=5):
    """Tiny phase portrait icon of x' = M x drawn at `center` (data coords
    of ax_parent) inside a w x h box - for trace-det diagrams."""
    from matplotlib.patches import FancyBboxPatch
    cx, cy = center
    f = linear(M)
    ax_parent.add_patch(FancyBboxPatch((cx - w / 2, cy - h / 2), w, h,
                                       boxstyle="round,pad=0,rounding_size=0.15",
                                       fc="white", ec=S.GRID, lw=0.8, zorder=zorder))
    ev = np.linalg.eigvals(M)
    grow = np.max(ev.real) > 1e-9
    saddle = np.min(ev.real) < -1e-9 and grow and np.all(np.abs(ev.imag) < 1e-9)
    if saddle:
        # start near the stable eigen-direction, at the box edge
        lam, V = np.linalg.eig(M)
        vs, vu = V[:, np.argmin(lam.real)].real, V[:, np.argmax(lam.real)].real
        starts = []
        for sg in (1, -1):
            for e in (0.12, -0.12, 0.35, -0.35):
                p0 = sg * vs + e * vu
                starts.append(0.95 * p0 / np.max(np.abs(p0)))
        t_max = 6.0
    else:
        ang = np.linspace(0, 2 * np.pi, n_traj, endpoint=False) + 0.3
        r0 = 0.12 if grow else 1.0
        starts = [np.array([np.cos(a), np.sin(a)]) * r0 for a in ang]
        t_max = max(t_max, 12.0 if grow else t_max)
    for x0 in starts:
        xs, ys = integrate(f, np.asarray(x0, float), t_max, 500)
        r = np.maximum(np.abs(xs), np.abs(ys))
        keep = r <= 1.0
        if not keep.all():
            k = np.argmax(~keep)
            xs, ys = xs[:max(k, 2)], ys[:max(k, 2)]
        X, Y = cx + xs * w * 0.45, cy + ys * h * 0.45
        ax_parent.plot(X, Y, color=color, lw=lw, zorder=zorder + 1)
        if len(X) > 4:
            arrow_on_path(ax_parent, X, Y, 0.5, color=color, size=7, zorder=zorder + 2)


# ------------------------------------------------------------------ 2D analysis helpers
def jacobian(f, p, eps=1e-6):
    """Numerical Jacobian of f(x, y) -> (dx, dy) at p (central differences)."""
    x, y = p
    fx1, fx0 = np.array(f(x + eps, y)), np.array(f(x - eps, y))
    fy1, fy0 = np.array(f(x, y + eps)), np.array(f(x, y - eps))
    return np.column_stack([(fx1 - fx0) / (2 * eps), (fy1 - fy0) / (2 * eps)])


def classify(M, tol=1e-9):
    """'stable' | 'unstable' | 'saddle' | 'center' (zero real part) from a 2x2 Jacobian."""
    ev = np.linalg.eigvals(M)
    re = ev.real
    if np.all(np.abs(re) < tol):
        return "center"
    if re.max() < -tol:
        return "stable"
    if re.min() < -tol and re.max() > tol and np.all(np.abs(ev.imag) < tol):
        return "saddle"
    return "unstable"


def fixed_points(f, xlim, ylim, n=24, tol=1e-9, merge=1e-5):
    """All fixed points of a 2D field inside the box, found by root-finding
    from an n x n grid of seeds. Returns a list of dicts with
    p (x, y), kind (stable/unstable/saddle/center), eig, vecs, M (Jacobian),
    sorted by x. Simulate-don't-sketch: use this instead of placing dots by hand."""
    from scipy.optimize import fsolve
    out = []
    for x0 in np.linspace(*xlim, n):
        for y0 in np.linspace(*ylim, n):
            sol, info, ok, _ = fsolve(lambda z: f(z[0], z[1]), (x0, y0), full_output=True,
                                      xtol=1e-12)
            if ok != 1 or np.max(np.abs(f(*sol))) > 1e-8:
                continue
            if not (xlim[0] - 1e-9 <= sol[0] <= xlim[1] + 1e-9 and ylim[0] - 1e-9 <= sol[1] <= ylim[1] + 1e-9):
                continue
            if any(np.hypot(*(sol - q["p"])) < merge for q in out):
                continue
            M = jacobian(f, sol)
            ev, V = np.linalg.eig(M)
            out.append(dict(p=np.array(sol), kind=classify(M, tol), eig=ev, vecs=V, M=M))
    return sorted(out, key=lambda q: (q["p"][0], q["p"][1]))


def separatrix(ax, f, fp, t_max=30.0, color=S.INK, lw=1.4, ls=(0, (5, 3)), eps=1e-4,
               clip=None, zorder=3):
    """Draw the stable manifold of a saddle `fp` (a dict from fixed_points):
    integrate backward in time from both sides of its stable eigenvector.
    This is the separatrix between two basins of attraction - correct even
    when it is not a straight line (e.g. with unequal inputs)."""
    k = int(np.argmin(fp["eig"].real))
    v = fp["vecs"][:, k].real
    v = v / np.linalg.norm(v)
    if clip is None:
        clip = (ax.get_xlim(), ax.get_ylim())
    (x0, x1), (y0, y1) = clip
    pad = 0.02 * max(x1 - x0, y1 - y0)
    curves = []
    for sgn in (1, -1):
        xs, ys = integrate(f, np.asarray(fp["p"]) + sgn * eps * v, t_max, n=500, backward=True)
        inside = (xs > x0 - pad) & (xs < x1 + pad) & (ys > y0 - pad) & (ys < y1 + pad)
        stop = int(np.argmin(inside)) if not inside.all() else len(xs)
        ax.plot(xs[:stop], ys[:stop], color=color, lw=lw, ls=ls, zorder=zorder)
        curves.append((xs[:stop], ys[:stop]))
    return curves


def portrait(ax, f, xlim, ylim, nullclines=(S.GREEN, S.PURPLE), separatrices=True,
             trajectories=(), t_max=25.0, fp_size=7, flow=True, equal=True, **flow_kw):
    """One-call phase portrait in the house style: gray flow, the two
    nullclines (x-nullcline first colour, y-nullcline second; None to skip),
    fixed points computed and classified (filled/open/half), separatrices of
    every saddle, and highlighted trajectories [(x0, colour), ...] with
    arrowheads. Returns the fixed-point list (for captions and text)."""
    if flow:
        flow_field(ax, f, xlim, ylim, **flow_kw)
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    if nullclines:
        nullcline(ax, f, xlim, ylim, which=0, color=nullclines[0], lw=1.8)
        nullcline(ax, f, xlim, ylim, which=1, color=nullclines[1], lw=1.8)
    fps = fixed_points(f, xlim, ylim)
    if separatrices:
        for fp in fps:
            if fp["kind"] == "saddle":
                separatrix(ax, f, fp)
    for x0, col in trajectories:
        trajectory(ax, f, x0, t_max, color=col, lw=1.8, arrows=(0.3,), clip=(xlim, ylim))
        ax.plot([x0[0]], [x0[1]], "o", ms=5, mfc="white", mec=col, mew=1.3, zorder=7)
    for fp in fps:
        fixed_point(ax, fp["p"], fp["kind"], size=fp_size)
    if equal:
        ax.set_aspect("equal")
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    return fps


def bifurcation_branches(f_of, params, xlim, ylim, coord=0):
    """Fixed points of a 2D field as a parameter varies: f_of(param) -> f.
    Returns {'stable': [(param, value)], 'unstable': [...]} for plotting a
    bifurcation diagram of coordinate `coord` (stable solid, unstable dashed)."""
    out = {"stable": [], "unstable": []}
    for a in params:
        for fp in fixed_points(f_of(a), xlim, ylim, n=10):
            out["stable" if fp["kind"] == "stable" else "unstable"].append((a, fp["p"][coord]))
    return out
