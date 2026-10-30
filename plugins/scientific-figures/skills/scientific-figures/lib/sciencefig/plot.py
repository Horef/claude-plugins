"""Data plots and function curves with matplotlib, exported as inline SVG.

Use for anything with real axes: tuning curves, spectra, psychometric
functions, distributions, ROC, spike rasters, time series, dose-response.

    from sciencefig import plot as P
    fig, ax = P.figure(640, 300, name="fig-cones")
    ax.plot(x, y, color=S.BLUE)
    P.end_label(ax, x[-1], y[-1], "S cone", S.BLUE)
    print(P.lint(fig)); svg = P.export(fig)

Design units: the figure is (w x h) "px"; 1 matplotlib point = 1 SVG unit,
so font sizes here equal font sizes in hand-drawn SVGs.
"""
import io
import re

import logging
import numpy as np
import matplotlib
import matplotlib.collections

logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
logging.getLogger("matplotlib.mathtext").setLevel(logging.ERROR)

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.transforms import Bbox

from . import style as S
from .svg import _rects_overlap, _seg_intersects_rect

RC = {
    "font.family": S.measure_family(),
    "font.size": S.SIZE,
    "axes.labelsize": S.SIZE,
    "axes.titlesize": S.SIZE,
    "axes.titleweight": "normal",
    "axes.titlelocation": "left",
    "xtick.labelsize": S.SIZE_SMALL,
    "ytick.labelsize": S.SIZE_SMALL,
    "legend.fontsize": S.SIZE_SMALL,
    "legend.frameon": False,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 1.0,
    "axes.edgecolor": S.AXIS,
    "axes.labelcolor": S.INK,
    "axes.titlecolor": S.INK,
    "axes.prop_cycle": matplotlib.cycler(color=S.CATEGORICAL),
    "axes.grid": False,
    "grid.color": S.GRID,
    "grid.linewidth": S.LW_HAIR,
    "xtick.color": S.AXIS,
    "ytick.color": S.AXIS,
    "xtick.labelcolor": S.INK2,
    "ytick.labelcolor": S.INK2,
    "xtick.direction": "out",
    "ytick.direction": "out",
    "xtick.major.size": 4,
    "ytick.major.size": 4,
    "xtick.major.width": 1.0,
    "ytick.major.width": 1.0,
    "lines.linewidth": S.LW_DATA,
    "lines.solid_capstyle": "round",
    "lines.markersize": 7,
    "patch.linewidth": 0,
    "figure.dpi": 72,
    "savefig.dpi": 72,
    "figure.facecolor": "#ffffff",
    "axes.facecolor": "none",
    "svg.fonttype": "none",
    "mathtext.fontset": "custom",
    "mathtext.rm": S.measure_family(),
    "mathtext.it": S.measure_family() + ":italic",
    "mathtext.bf": S.measure_family() + ":bold",
    "mathtext.sf": S.measure_family(),
    "mathtext.default": "it",
    "axes.unicode_minus": True,
}


def use_style():
    matplotlib.rcParams.update(RC)


use_style()


def figure(w=S.WIDTH_FULL, h=300, nrows=1, ncols=1, name="fig", layout="constrained",
           **kw):
    """New figure of w x h design px. Returns (fig, ax) or (fig, axes)."""
    use_style()
    fig, ax = plt.subplots(nrows, ncols, figsize=(w / 72, h / 72), layout=layout, **kw)
    if layout == "constrained":
        fig.get_layout_engine().set(w_pad=6 / 72, h_pad=6 / 72, wspace=0.06, hspace=0.08)
    fig._sf_name = re.sub(r"[^A-Za-z0-9_-]", "-", name)
    return fig, ax


# ------------------------------------------------------------------ axes styling
def despine(ax, left=False, bottom=False):
    """Remove top/right (always) and optionally left/bottom spines."""
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    if left:
        ax.spines["left"].set_visible(False)
        ax.tick_params(left=False, labelleft=False)
    if bottom:
        ax.spines["bottom"].set_visible(False)
        ax.tick_params(bottom=False, labelbottom=False)


def range_frame(ax, x=None, y=None):
    """Tufte's range-frame: axis lines span only the data range."""
    if x is not None:
        ax.spines["bottom"].set_bounds(np.nanmin(x), np.nanmax(x))
    if y is not None:
        ax.spines["left"].set_bounds(np.nanmin(y), np.nanmax(y))


def offset_spines(ax, pts=6):
    """Detach the axes from the data (classic Rougier look)."""
    for s in ("left", "bottom"):
        ax.spines[s].set_position(("outward", pts))


def schematic_axes(ax, xlabel=None, ylabel=None, arrows=True):
    """Conceptual plot: no ticks, axis titles only, arrowheads on the axes.
    Use when only the SHAPE matters (Rougier rule 9)."""
    ax.set_xticks([]); ax.set_yticks([])
    for s in ("left", "bottom"):
        ax.spines[s].set_color(S.AXIS)
    if arrows:
        ax.plot(1, 0, ">", color=S.AXIS, transform=ax.get_yaxis_transform(), clip_on=False, ms=6)
        ax.plot(0, 1, "^", color=S.AXIS, transform=ax.get_xaxis_transform(), clip_on=False, ms=6)
    if xlabel:
        ax.set_xlabel(xlabel, loc="right")
    if ylabel:
        ax.set_ylabel(ylabel, loc="top")


def hgrid(ax, ys=None):
    """Horizontal hairline grid only at given y values (grid perpendicular to
    the variable of interest; Wilke ch. 23)."""
    ys = ax.get_yticks() if ys is None else ys
    for y in ys:
        ax.axhline(y, color=S.GRID, lw=S.LW_HAIR, zorder=0)


def ref_line(ax, y=None, x=None, label=None, color=S.MUTED, ls=(0, (3, 3)), lw=1.0,
             label_pos="right"):
    """A meaningful reference line (chance level, threshold, x=y)."""
    if y is not None:
        ax.axhline(y, color=color, lw=lw, ls=ls, zorder=1)
        if label:
            xl = ax.get_xlim()
            ax.text(xl[1] if label_pos == "right" else xl[0], y, " " + label + " ",
                    color=S.INK2, size=S.SIZE_SMALL, va="bottom",
                    ha="right" if label_pos == "right" else "left")
    if x is not None:
        ax.axvline(x, color=color, lw=lw, ls=ls, zorder=1)
        if label:
            yl = ax.get_ylim()
            ax.text(x, yl[1], label, color=S.INK2, size=S.SIZE_SMALL, ha="center", va="bottom")


# ------------------------------------------------------------------ direct labelling
def end_label(ax, x, y, text, color=S.INK, dx=6, dy=0, ha="left", va="center",
              size=S.SIZE_SMALL, darken=True):
    """Label a curve at its end instead of using a legend (Wilke ch. 20).
    Text takes a darker shade of the series hue so thin text stays legible."""
    c = S.shade(color, 0.15) if (darken and color not in (S.INK, S.INK2)) else color
    return ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points",
                       color=c, size=size, ha=ha, va=va, annotation_clip=False)


def label_curves(ax, items, x_text=None, min_gap=None, size=S.SIZE_SMALL):
    """Direct-label several curves at their right ends, spreading labels
    vertically so they never collide (with thin leader lines when moved).
    items: list of (x_end, y_end, text, color)."""
    fig = ax.figure
    fig.canvas.draw()
    tr = ax.transData
    pts = [(tr.transform((x, y))[1], i) for i, (x, y, t, c) in enumerate(items)]
    pts.sort()
    gap = min_gap or size * 1.25
    placed = []
    for ypix, i in pts:
        yp = ypix if not placed or ypix - placed[-1][0] >= gap else placed[-1][0] + gap
        placed.append((yp, i))
    # shift down if we ran off the top
    out = []
    for yp, i in placed:
        x, y, t, c = items[i]
        xpix, ypix = tr.transform((x, y))
        xt = xpix + 8 if x_text is None else tr.transform((x_text, 0))[0]
        moved = abs(yp - ypix) > 2
        col = S.shade(c, 0.15) if c not in (S.INK, S.INK2) else c
        out.append(ax.annotate(
            t, (x, y), xytext=(xt, yp), textcoords="figure pixels", color=col, size=size,
            va="center", ha="left", annotation_clip=False,
            arrowprops=dict(arrowstyle="-", color=S.MUTED, lw=0.8, shrinkA=2, shrinkB=2) if moved else None))
    return out


def point_label(ax, x, y, text, dx=8, dy=8, color=S.INK, size=S.SIZE_SMALL, arrow=False,
                ha="left", va="bottom", halo=True):
    """Label a specific point (outlier, threshold, intersection)."""
    import matplotlib.patheffects as pe
    t = ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points", color=color,
                    size=size, ha=ha, va=va, annotation_clip=False,
                    arrowprops=dict(arrowstyle="-", color=S.INK2, lw=0.8, shrinkA=1, shrinkB=3) if arrow else None)
    if halo:
        t.set_path_effects([pe.withStroke(linewidth=3.5, foreground="white")])
    return t


def hbracket(ax, x1, x2, y, label, color=S.INK, size=S.SIZE_SMALL, below=False, tick=0.025):
    """Measured horizontal distance in data coords (JND, d', spacing):
    |<--- label --->|"""
    yl = ax.get_ylim()
    t = tick * (yl[1] - yl[0])
    ax.annotate("", (x1, y), (x2, y), arrowprops=dict(arrowstyle="<->", color=color, lw=1.0,
                                                      shrinkA=0, shrinkB=0, mutation_scale=9))
    for x in (x1, x2):
        ax.plot([x, x], [y - t, y + t], color=color, lw=1.0, solid_capstyle="butt")
    return ax.annotate(label, ((x1 + x2) / 2, y), xytext=(0, -5 if below else 5),
                       textcoords="offset points", ha="center", va="top" if below else "bottom",
                       color=color, size=size)


def vbracket(ax, x, y1, y2, label, color=S.INK, size=S.SIZE_SMALL, left=False, tick=0.012):
    xl = ax.get_xlim()
    t = tick * (xl[1] - xl[0])
    ax.annotate("", (x, y1), (x, y2), arrowprops=dict(arrowstyle="<->", color=color, lw=1.0,
                                                      shrinkA=0, shrinkB=0, mutation_scale=9))
    for y in (y1, y2):
        ax.plot([x - t, x + t], [y, y], color=color, lw=1.0, solid_capstyle="butt")
    return ax.annotate(label, (x, (y1 + y2) / 2), xytext=(-6 if left else 6, 0),
                       textcoords="offset points", ha="right" if left else "left", va="center",
                       color=color, size=size)


def drop_lines(ax, x, y, color=S.MUTED, lw=0.9, ls=(0, (2, 2)), to_x=True, to_y=True):
    """Guide lines from a curve point down to the x axis and/or across to y."""
    if to_x:
        ax.plot([x, x], [ax.get_ylim()[0], y], color=color, lw=lw, ls=ls, zorder=1)
    if to_y:
        ax.plot([ax.get_xlim()[0], x], [y, y], color=color, lw=lw, ls=ls, zorder=1)


# ------------------------------------------------------------------ periodic axes
def wrap_periodic(x, y, period=180.0, center=0.0, close=True):
    """Re-map circular x (orientation, phase, direction) into
    [center - period/2, center + period/2), sorted by x, so a peak at the
    preferred value sits in the middle instead of being split across both
    edges. y is (n,) or (n, k). With close=True the point at the lower edge
    is repeated at the upper edge (same angle) so curves span the axis; it is
    only repeated if such a point exists - no value is ever invented.
    Returns (x_wrapped, y_wrapped)."""
    x = np.asarray(x, float)
    y = np.asarray(y)
    if y.shape[0] != x.shape[0]:
        raise ValueError(f"x has {x.shape[0]} points, y has {y.shape[0]}")
    lo = center - period / 2.0
    xw = np.mod(x - lo, period) + lo
    xw[xw >= lo + period] -= period       # float round-off at the upper edge
    order = np.argsort(xw, kind="stable")
    xw, yw = xw[order], y[order]
    if close and len(xw) and abs(xw[0] - lo) <= 1e-9 * period:
        xw = np.append(xw, lo + period)
        yw = np.concatenate([yw, yw[:1]], axis=0)
    return xw, yw


def periodic_xaxis(ax, period=180.0, center=0.0, label=None, unit="deg", ticks=3):
    """Set the x axis of a circular variable: limits with a small margin,
    `ticks` ticks from the lower edge to the upper edge (3 = edges and
    centre), degree labels, optional axis title. Pair with wrap_periodic."""
    lo, hi = center - period / 2.0, center + period / 2.0
    m = 0.03 * period
    ax.set_xlim(lo - m, hi + m)
    ts = np.linspace(lo, hi, max(2, int(ticks)))
    suffix = {"deg": "\u00b0", "": ""}.get(unit, " " + unit)
    sign = "+" if lo < 0 else ""
    def fmt(v):
        t = f"{v:g}"
        if v > 0 and sign:
            t = sign + t
        return t.replace("-", "\u2212") + suffix
    ax.set_xticks(ts)
    ax.set_xticklabels([fmt(v) for v in ts])
    if label:
        ax.set_xlabel(label)


# ------------------------------------------------------------------ big data -> small SVG
def decimate(x, y, n=800):
    """Min/max decimation for long traces (voltage, LFP): keeps every
    peak (spikes!) while cutting points to ~2n. Plot the result instead of
    the raw trace to keep the inline SVG small."""
    x, y = np.asarray(x), np.asarray(y)
    if len(x) <= 2 * n:
        return x, y
    edges = np.linspace(0, len(x), n + 1).astype(int)
    xs, ys = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        seg = y[a:b]
        i, j = a + int(np.argmin(seg)), a + int(np.argmax(seg))
        for k in sorted((i, j)):
            xs.append(x[k]); ys.append(y[k])
    return np.array(xs), np.array(ys)


# ------------------------------------------------------------------ neuro data helpers
def spike_train(ax, times, y=0, height=0.8, color=S.INK, lw=1.3):
    """Vertical ticks at spike times (one trial)."""
    ax.vlines(times, y - height / 2, y + height / 2, color=color, lw=lw)


def raster(ax, trials, color=S.INK, lw=1.0, height=0.75):
    """trials: list of arrays of spike times; trial i drawn at y=i."""
    for i, t in enumerate(trials):
        ax.vlines(t, i - height / 2, i + height / 2, color=color, lw=lw)
    ax.set_ylim(-0.8, len(trials) - 0.2)


def poisson_spikes(rate_fn, t0, t1, seed=0, dt=1e-4):
    """Inhomogeneous Poisson spikes for illustration; rate_fn(t) in Hz.
    Seeded -> repeatable figure (Wilke ch. 28)."""
    rng = np.random.default_rng(seed)
    t = np.arange(t0, t1, dt)
    return t[rng.random(t.size) < np.vectorize(rate_fn)(t) * dt]


def scale_bar(ax, x, y, length, label, vertical=False, color=S.INK, lw=1.6, size=S.SIZE_SMALL):
    """Scale bar instead of an axis (e.g. 100 ms, 20 mV) in data coords."""
    if vertical:
        ax.plot([x, x], [y, y + length], color=color, lw=lw, solid_capstyle="butt", clip_on=False)
        ax.annotate(label, (x, y + length / 2), xytext=(5, 0), textcoords="offset points",
                    va="center", ha="left", size=size, color=color, annotation_clip=False)
    else:
        ax.plot([x, x + length], [y, y], color=color, lw=lw, solid_capstyle="butt", clip_on=False)
        ax.annotate(label, (x + length / 2, y), xytext=(0, -4), textcoords="offset points",
                    va="top", ha="center", size=size, color=color, annotation_clip=False)


# ------------------------------------------------------------------ lint
def lint(fig, margin=1):
    """Layout problems in a matplotlib figure: texts overlapping texts,
    texts outside the figure, texts crossed by data lines, tiny fonts.
    Empty list == clean. Call before export(), or use finish(fig)."""
    if not hasattr(fig.canvas, "get_renderer"):
        raise RuntimeError("figure already exported/closed: call P.lint before P.export, or use P.finish(fig)")
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    W, H = fig.bbox.width, fig.bbox.height
    texts = []
    hidden = set()
    for a in fig.axes:
        for axis in (a.xaxis, a.yaxis):
            drawn = set()
            for tk in axis._update_ticks():
                drawn.update({id(tk.label1), id(tk.label2)})
            for tk in axis.get_major_ticks() + axis.get_minor_ticks():
                for lab in (tk.label1, tk.label2):
                    if id(lab) not in drawn or not lab.get_visible():
                        hidden.add(id(lab))
    for t in fig.findobj(matplotlib.text.Text):
        if id(t) in hidden or not t.get_visible() or not t.get_text().strip():
            continue
        try:
            bb = matplotlib.text.Text.get_window_extent(t, r)  # text only, not the arrow
        except Exception:
            continue
        if bb.width < 1:
            continue
        texts.append((t, (bb.x0, bb.y0, bb.x1, bb.y1)))
    probs = []
    for t, b in texts:
        s = t.get_text()
        if b[0] < -margin or b[1] < -margin or b[2] > W + margin or b[3] > H + margin:
            probs.append(f"OUTSIDE figure: '{s}'")
        if t.get_fontsize() < S.SIZE_MIN - 1e-6:
            probs.append(f"TOO SMALL ({t.get_fontsize()}): '{s}'")
        if "&" in s:
            probs.append(f"'&' in '{s}'")
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            if _rects_overlap(texts[i][1], texts[j][1]):
                probs.append(f"TEXT OVERLAP: '{texts[i][0].get_text()}' x '{texts[j][0].get_text()}'")
    lines = [l for l in fig.findobj(matplotlib.lines.Line2D)
             if l.get_visible() and l.get_linestyle() not in ("None", "") and len(l.get_xydata()) > 1
             and not getattr(l, "_sf_nolint", False)]
    for t, b in texts:
        if t.get_path_effects():
            continue  # haloed text is allowed to sit on lines
        rr = (b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1)
        for l in lines:
            if l.axes is None:
                continue
            try:
                pts = l.get_transform().transform(l.get_xydata())
            except Exception:
                continue
            # clip to axes box
            ab = l.axes.bbox
            r2 = rr
            if l.get_clip_on():
                # a clipped line can only touch the part of the label inside the axes
                r2 = (max(rr[0], ab.x0), max(rr[1], ab.y0), min(rr[2], ab.x1), min(rr[3], ab.y1))
                if r2[0] >= r2[2] or r2[1] >= r2[3]:
                    continue
            hit = False
            for p, q in zip(pts, pts[1:]):
                if not (np.isfinite(p).all() and np.isfinite(q).all()):
                    continue
                if _seg_intersects_rect(p, q, r2):
                    hit = True
                    break
            if hit:
                probs.append(f"LINE CROSSES TEXT: '{t.get_text()}' x line '{l.get_label()}'")
    # scatter markers (PathCollection, e.g. a dotted bifurcation branch) under text
    cols = [c for c in fig.findobj(matplotlib.collections.PathCollection)
            if c.get_visible() and not getattr(c, "_sf_nolint", False) and c.axes is not None]
    for t, b in texts:
        if t.get_path_effects():
            continue
        for c in cols:
            off = c.get_offsets()
            if len(off) == 0:
                continue
            pts = c.get_offset_transform().transform(off)
            inside = (pts[:, 0] > b[0]) & (pts[:, 0] < b[2]) & (pts[:, 1] > b[1]) & (pts[:, 1] < b[3])
            if inside.any():
                probs.append(f"MARKERS UNDER TEXT: '{t.get_text()}' x scatter '{c.get_label()}'")
                break
    return sorted(set(probs))


def nolint(*artists):
    """Mark lines that may legitimately pass under text (e.g. grid)."""
    for a in artists:
        for l in (a if isinstance(a, (list, tuple)) else [a]):
            l._sf_nolint = True


# ------------------------------------------------------------------ export
def finish(fig, name=None):
    """lint THEN export (export closes the figure, so lint(fig) after
    export(fig) fails). Returns (svg, problems)."""
    probs = lint(fig)
    return export(fig, name=name), probs


def export(fig, name=None, close=True):
    """matplotlib figure -> one-line inline SVG string for DEVONthink."""
    name = name or getattr(fig, "_sf_name", "fig")
    matplotlib.rcParams["svg.hashsalt"] = name
    buf = io.StringIO()
    fig.savefig(buf, format="svg", facecolor="#ffffff")
    if close:
        plt.close(fig)
    s = buf.getvalue()
    s = re.sub(r"<\?xml.*?\?>", "", s, flags=re.S)
    s = re.sub(r"<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r"<metadata>.*?</metadata>", "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # matplotlib's <style>*{...}</style> would leak into the whole note page
    s = re.sub(r"<style.*?</style>", "", s, flags=re.S)
    s = s.replace("<defs></defs>", "")
    # font families -> house stack (matplotlib writes the measuring font)
    s = re.sub(r"font-family:\s*[^;\"]+", "font-family:" + S.FONT_STACK.replace('"', ""), s)
    s = re.sub(r"font:\s*([0-9.]+px)\s*'[^']*'", r"font-size:\1;font-family:" + S.FONT_STACK, s)
    s = re.sub(r"font:\s*(italic|bold|normal)?\s*(italic|bold|normal)?\s*([0-9.]+px)\s*'[^']*'",
               lambda m: ";".join(filter(None, [
                   "font-style:italic" if "italic" in (m.group(1) or "") + (m.group(2) or "") else "",
                   "font-weight:bold" if "bold" in (m.group(1) or "") + (m.group(2) or "") else "",
                   "font-size:" + m.group(3), "font-family:" + S.FONT_STACK])), s)
    # unique ids
    ids = set(re.findall(r'id="([^"]+)"', s))
    for i in sorted(ids, key=len, reverse=True):
        s = s.replace(f'id="{i}"', f'id="{name}-{i}"').replace(f"#{i})", f"#{name}-{i})") \
             .replace(f'href="#{i}"', f'href="#{name}-{i}"')
    # root element: pixel width + responsive style
    m = re.search(r"<svg[^>]*>", s)
    root = m.group(0)
    vb = re.search(r'viewBox="([^"]+)"', root).group(1)
    w = float(vb.split()[2])
    new_root = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'viewBox="{vb}" width="{round(w)}" style="max-width:100%;height:auto" role="img">')
    s = s.replace(root, new_root, 1)
    s = s.replace(new_root, new_root + '<rect width="100%" height="100%" fill="#fff"/>', 1)
    s = re.sub(r">\s+<", "><", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("&#8722;", "−")
    # 1 decimal is plenty at screen scale -> ~3x smaller files
    # round coordinates to 0.1 px - ONLY inside tags (never touch label text:
    # "0.75" in a label must stay "0.75")
    def _r(m):
        v = round(float(m.group(0)), 1)
        return str(int(v)) if v == int(v) else str(v)
    s = re.sub(r"<[^>]*>", lambda t: re.sub(r"(?<![\w#.-])-?\d+\.\d+", _r, t.group(0)), s)
    from .check import hex_to_rgb
    return hex_to_rgb(s)
