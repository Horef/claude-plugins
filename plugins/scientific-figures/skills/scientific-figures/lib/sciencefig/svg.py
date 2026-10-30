"""Hand-built SVG figures with measured text and a built-in layout linter.

Why this exists: drawing SVG by typing coordinates is drawing blind. Canvas
records the geometry of everything it draws and measures every label with
Helvetica metrics, so `lint()` can report collisions (label on a curve,
label on label, text spilling out of a box or off the figure) BEFORE the
figure is rendered and looked at.

Coordinates: SVG user units, origin top-left, y down. Absolute coordinates
only (no transforms), which keeps the linter exact.

Label markup (a tiny LaTeX-like subset, rendered with <tspan>):
    "$V_m$ (mV)"   -> italic V, subscript m
    "$Ca^{2+}$"    -> italic Ca, superscript 2+
    "$d'$"         -> italic d with prime
    "**bold**"     -> bold run
Inside $...$ letters are italic, digits/symbols upright. Greek letters can be
typed directly (λ, Δ, θ). Never use '&' - write "and".
"""
import math
import re
from functools import lru_cache

from . import style as S

# ------------------------------------------------------------------ text metrics
_FP_CACHE = {}


def _fontprops(size, bold=False, italic=False):
    from matplotlib.font_manager import FontProperties
    key = (size, bold, italic)
    if key not in _FP_CACHE:
        _FP_CACHE[key] = FontProperties(
            family=S.measure_family(), size=size,
            weight="bold" if bold else "normal",
            style="italic" if italic else "normal")
    return _FP_CACHE[key]


@lru_cache(maxsize=4096)
def text_width(s, size=S.SIZE, bold=False, italic=False):
    """Advance width of plain text `s` at `size` px (Helvetica metrics)."""
    if not s:
        return 0.0
    from matplotlib.textpath import TextToPath
    w, h, d = TextToPath().get_text_width_height_descent(
        s.replace("$", r"\$"), _fontprops(size, bold, italic), ismath=False)
    return float(w)


def _parse(s):
    """Split markup into runs: (text, italic, bold, shift) with shift in
    {0, 'sub', 'sup'}."""
    runs = []
    bold = False
    i = 0
    math_mode = False
    buf = ""

    def flush(it=None):
        nonlocal buf
        if buf:
            runs.append([buf, math_mode if it is None else it, bold, 0])
            buf = ""

    while i < len(s):
        c = s[i]
        m = re.match(r"\\(mathrm|text)\{([^}]*)\}", s[i:]) if math_mode else None
        if math_mode and s.startswith(("\\,", "\\;", "\\ "), i):   # TeX spaces
            buf += "\u2009" if s[i + 1] == "," else " "; i += 2; continue
        if m:  # upright text inside math: $h_E^\mathrm{ext}$ or $\text{ext}$
            flush(); runs.append([m.group(2), False, bold, 0]); i += m.end(); continue
        if s.startswith("**", i):
            flush(); bold = not bold; i += 2; continue
        if c == "$":
            flush(); math_mode = not math_mode; i += 1; continue
        if math_mode and c in "_^":
            flush()
            kind = "sub" if c == "_" else "sup"
            m2 = re.match(r"\\(mathrm|text)\{([^}]*)\}", s[i + 1:])
            if m2:                      # x_\mathrm{ext}: upright script
                runs.append([m2.group(2), False, bold, kind]); i += 1 + m2.end(); continue
            if i + 1 < len(s) and s[i + 1] == "{":
                j = s.index("}", i + 2)
                content = s[i + 2:j]
                i = j + 1
                m3 = re.fullmatch(r"\\(mathrm|text)\{([^}]*)", content)
                if m3:                  # x^{\mathrm{ext}}: skip the outer closing brace too
                    runs.append([m3.group(2), False, bold, kind])
                    if i < len(s) and s[i] == "}":
                        i += 1
                    continue
            else:
                content = s[i + 1]
                i += 2
            runs.append([content, bool(re.match(r"[A-Za-z]", content)), bold, kind])
            continue
        buf += c
        i += 1
    flush()
    # inside math, digits/punctuation upright: split italic runs
    out = []
    for text, it, b, sh in runs:
        if it and sh == 0:
            for part in re.findall(r"[A-Za-zα-ωΑ-Ω]+|[^A-Za-zα-ωΑ-Ω]+", text):
                out.append((part, bool(re.match(r"[A-Za-zα-ωΑ-Ω]", part)), b, 0))
        else:
            out.append((text, it, b, sh))
    return out


def measure(s, size=S.SIZE, bold=False):
    """(width, ascent, descent) of a marked-up label."""
    w = 0.0
    prev = None
    for text, it, b, sh in _parse(s):
        sz = size * (0.72 if sh else 1.0)
        tw = text_width(text, sz, b or bold, it)
        if sh == "sup" and prev and prev[0] == "sub":
            # stacked x_j^2: the superscript sits above the subscript
            w += max(0.0, tw - prev[1])
        else:
            w += tw
        prev = (sh, tw)
    return w, 0.72 * size, 0.22 * size


def _esc(t):
    return (t.replace("&", "and").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def _fmt(v):
    """Compact number formatting (keeps the SVG small)."""
    if isinstance(v, str):
        return v
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)


# ------------------------------------------------------------------ geometry helpers
def _seg_intersects_rect(p, q, r):
    """Liang-Barsky clip test: does segment pq touch rect r=(x0,y0,x1,y1)?"""
    x0, y0, x1, y1 = r
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return False
        else:
            t = qq / pp
            if pp < 0:
                if t > t1:
                    return False
                t0 = max(t0, t)
            else:
                if t < t0:
                    return False
                t1 = min(t1, t)
    return True


def _rects_overlap(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def _bezier(p0, p1, p2, p3, n=24):
    pts = []
    for k in range(n + 1):
        t = k / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


# ------------------------------------------------------------------ canvas
class Canvas:
    """A figure under construction.

    c = Canvas(640, 260, "fig-pipeline")
    c.text(20, 30, "Stimulus")
    c.arrow(100, 50, 160, 50, label="transduces")
    print(c.lint()); svg = c.svg()
    """

    def __init__(self, width=S.WIDTH_FULL, height=300, name="fig", bg=S.BG):
        self.w, self.h = width, height
        self.name = re.sub(r"[^A-Za-z0-9_-]", "-", name)
        self.bg = bg
        self.items = []        # svg strings
        self.texts = []        # (bbox, label, flags)
        self.geoms = []        # (polyline points, tag, lint flag)
        self.keepouts = []     # rects where no text may go (e.g. data area of an inset)
        self._uid = 0

    # ---------------- ids
    def uid(self, stem="id"):
        self._uid += 1
        return f"{self.name}-{stem}{self._uid}"

    # ---------------- low-level emitters
    def _attrs(self, **kw):
        out = []
        for k, v in kw.items():
            if v is None:
                continue
            k = k.rstrip("_").replace("_", "-")
            out.append(f'{k}="{_fmt(v) if not isinstance(v, str) else v}"')
        return " ".join(out)

    def raw(self, svg_fragment):
        """Append raw SVG (not linted - avoid when possible)."""
        self.items.append(svg_fragment)

    def _geom(self, pts, tag, lint=True):
        self.geoms.append((list(pts), tag, lint))

    # ---------------- primitives
    def line(self, x1, y1, x2, y2, color=S.INK, width=S.LW_STRUCT, dash=None,
             tag="line", lint=True, cap="round", opacity=None):
        self.items.append("<line " + self._attrs(
            x1=x1, y1=y1, x2=x2, y2=y2, stroke=color, stroke_width=width,
            stroke_dasharray=dash, stroke_linecap=cap, stroke_opacity=opacity) + "/>")
        self._geom([(x1, y1), (x2, y2)], tag, lint)

    def polyline(self, pts, color=S.INK, width=S.LW_DATA, fill="none", dash=None,
                 tag="curve", lint=True, closed=False, opacity=None, fill_opacity=None):
        p = " ".join(f"{_fmt(x)},{_fmt(y)}" for x, y in pts)
        el = "polygon" if closed else "polyline"
        self.items.append(f"<{el} " + self._attrs(
            points=p, fill=fill, stroke=color, stroke_width=width,
            stroke_dasharray=dash, stroke_linejoin="round", stroke_linecap="round",
            stroke_opacity=opacity, fill_opacity=fill_opacity) + "/>")
        self._geom(list(pts) + ([pts[0]] if closed else []), tag, lint)

    def polygon(self, pts, fill=S.INK, color="none", width=0, tag="shape", lint=True,
                fill_opacity=None):
        self.polyline(pts, color=color, width=width, fill=fill, tag=tag, lint=lint,
                      closed=True, fill_opacity=fill_opacity)

    def rect(self, x, y, w, h, fill="none", color=S.INK, width=S.LW_STRUCT, rx=0,
             dash=None, tag="rect", lint=True, fill_opacity=None):
        self.items.append("<rect " + self._attrs(
            x=x, y=y, width=w, height=h, rx=rx or None, fill=fill,
            stroke=color if color != "none" else None,
            stroke_width=width if color != "none" else None,
            stroke_dasharray=dash, fill_opacity=fill_opacity) + "/>")
        if color != "none":
            self._geom([(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)], tag, lint)

    def circle(self, cx, cy, r, fill="none", color=S.INK, width=S.LW_STRUCT,
               tag="circle", lint=True, dash=None, fill_opacity=None):
        self.items.append("<circle " + self._attrs(
            cx=cx, cy=cy, r=r, fill=fill,
            stroke=color if color != "none" else None,
            stroke_width=width if color != "none" else None,
            stroke_dasharray=dash, fill_opacity=fill_opacity) + "/>")
        n = 24
        self._geom([(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n))
                    for k in range(n + 1)], tag, lint)

    def ellipse(self, cx, cy, rx, ry, fill="none", color=S.INK, width=S.LW_STRUCT,
                tag="ellipse", lint=True, dash=None, fill_opacity=None):
        self.items.append("<ellipse " + self._attrs(
            cx=cx, cy=cy, rx=rx, ry=ry, fill=fill,
            stroke=color if color != "none" else None,
            stroke_width=width if color != "none" else None,
            stroke_dasharray=dash, fill_opacity=fill_opacity) + "/>")
        n = 32
        self._geom([(cx + rx * math.cos(2 * math.pi * k / n), cy + ry * math.sin(2 * math.pi * k / n))
                    for k in range(n + 1)], tag, lint)

    def bezier(self, p0, p1, p2, p3, color=S.INK, width=S.LW_STRUCT, dash=None,
               tag="curve", lint=True, fill="none"):
        d = (f"M{_fmt(p0[0])} {_fmt(p0[1])} C{_fmt(p1[0])} {_fmt(p1[1])} "
             f"{_fmt(p2[0])} {_fmt(p2[1])} {_fmt(p3[0])} {_fmt(p3[1])}")
        self.items.append("<path " + self._attrs(
            d=d, fill=fill, stroke=color, stroke_width=width, stroke_dasharray=dash,
            stroke_linecap="round") + "/>")
        self._geom(_bezier(p0, p1, p2, p3), tag, lint)

    def path(self, d, color=S.INK, width=S.LW_STRUCT, fill="none", sample_pts=None,
             tag="path", lint=True, dash=None, fill_opacity=None):
        """Arbitrary path. Pass `sample_pts` (polyline approximation) so the
        linter knows where it is; otherwise it is invisible to lint()."""
        self.items.append("<path " + self._attrs(
            d=d, fill=fill, stroke=color, stroke_width=width, stroke_dasharray=dash,
            stroke_linejoin="round", stroke_linecap="round", fill_opacity=fill_opacity) + "/>")
        if sample_pts:
            self._geom(sample_pts, tag, lint)

    # ---------------- text
    def text(self, x, y, s, size=S.SIZE, anchor="start", color=S.INK, bold=False,
             baseline="alphabetic", lint=True, halo=False, tag="text"):
        """Draw a marked-up label. `baseline`: 'alphabetic' (y is the baseline),
        'middle' (y is the visual centre), 'hanging' (y is the top).
        `halo`: white outline behind the text so it stays legible on lines
        (Rougier ch. 4/9). Returns the bbox (x0, y0, x1, y1)."""
        w, asc, desc = measure(s, size, bold)
        if baseline == "middle":
            y_base = y + asc / 2 - 0.5
        elif baseline == "hanging":
            y_base = y + asc
        else:
            y_base = y
        x0 = {"start": x, "middle": x - w / 2, "end": x - w}[anchor]
        parts = []
        prev = None
        for text, it, b, sh in _parse(s):
            attrs = []
            tw = text_width(text, size * (0.72 if sh else 1.0), b or bold, it)
            if sh == "sup" and prev and prev[0] == "sub":
                attrs.append(f'dx="{_fmt(-prev[1])}"')
            prev = (sh, tw)
            if it:
                attrs.append('font-style="italic"')
            if b and not bold:
                attrs.append('font-weight="bold"')
            if sh == "sub":
                attrs.append(f'baseline-shift="sub" font-size="{_fmt(size * 0.72)}"')
            elif sh == "sup":
                attrs.append(f'baseline-shift="super" font-size="{_fmt(size * 0.72)}"')
            t = _esc(text)
            parts.append(f"<tspan {' '.join(attrs)}>{t}</tspan>" if attrs else t)
        body = "".join(parts)
        common = self._attrs(x=x0, y=y_base, font_size=size,
                             font_weight="bold" if bold else None)
        if halo:
            self.items.append(f'<text {common} fill="none" stroke="#fff" stroke-width="4" '
                              f'stroke-linejoin="round">{body}</text>')
        self.items.append(f'<text {common} fill="{color}">{body}</text>')
        bbox = (x0, y_base - asc, x0 + w, y_base + desc)
        self.texts.append((bbox, s, {"lint": lint, "tag": tag, "size": size, "halo": halo}))
        return bbox

    def math(self, x, y, tex, size=S.SIZE, anchor="start", color=S.INK, baseline="alphabetic",
             fontset="cm", lint=True, tag="math"):
        """Typeset real TeX math (fractions, sums, accents, bold vectors) as
        glyph outlines - exact metrics, no font dependency, looks like the
        MathJax equations in the note. `tex` without the $...$.
        Supports matplotlib mathtext: \\frac, \\sum_{k}, \\mathbf, \\dot, \\hat,
        \\tilde, \\sqrt, Greek. (No \\begin{cases}: draw two lines + brace.)
        Returns bbox (x0, y0, x1, y1)."""
        import matplotlib as mpl
        from matplotlib.textpath import TextPath
        from matplotlib.font_manager import FontProperties
        # 'normal' = letters italic, digits upright (TeX convention). Set it
        # explicitly: sciencefig.plot uses 'it' for its Helvetica labels.
        with mpl.rc_context({"mathtext.fontset": fontset, "mathtext.default": "normal"}):
            tp = TextPath((0, 0), f"${tex}$", size=size,
                          prop=FontProperties(family=S.measure_family()))
        ext = tp.get_extents()
        w, top, bot = ext.x1 - ext.x0, ext.y1, ext.y0
        if baseline == "middle":
            yb = y + (top + bot) / 2
        elif baseline == "hanging":
            yb = y + top
        else:
            yb = y
        x0 = {"start": x, "middle": x - w / 2, "end": x - w}[anchor] - ext.x0
        f = lambda v: _fmt(round(v, 1))
        d = []
        for verts, code in tp.iter_segments(simplify=False, curves=True):
            pts = [(x0 + verts[k], yb - verts[k + 1]) for k in range(0, len(verts), 2)]
            if code == 1:
                d.append(f"M{f(pts[0][0])} {f(pts[0][1])}")
            elif code == 2:
                d.append(f"L{f(pts[0][0])} {f(pts[0][1])}")
            elif code == 3:
                d.append(f"Q{f(pts[0][0])} {f(pts[0][1])} {f(pts[1][0])} {f(pts[1][1])}")
            elif code == 4:
                d.append("C" + " ".join(f"{f(a)} {f(b)}" for a, b in pts))
            elif code == 79:
                d.append("Z")
        self.items.append(f'<path d="{"".join(d)}" fill="{color}"/>')
        bbox = (float(x0 + ext.x0), float(yb - top), float(x0 + ext.x1), float(yb - bot))
        self.texts.append((bbox, tex, {"lint": lint, "tag": tag, "size": size, "halo": False}))
        return bbox

    def lines_of_text(self, x, y, lines, size=S.SIZE, gap=1.25, **kw):
        """Several lines; y is the first baseline. Returns overall bbox."""
        bbs = [self.text(x, y + i * size * gap, s, size=size, **kw) for i, s in enumerate(lines)]
        return (min(b[0] for b in bbs), min(b[1] for b in bbs),
                max(b[2] for b in bbs), max(b[3] for b in bbs))

    # ---------------- arrows
    def _head(self, tip, angle, kind, color, width, size):
        """Draw an arrowhead/terminal at `tip` pointing along `angle` (radians)."""
        ca, sa = math.cos(angle), math.sin(angle)
        L = size
        Wd = size * 0.75
        if kind in ("tri", "exc"):
            base = (tip[0] - L * ca, tip[1] - L * sa)
            p1 = (base[0] - Wd / 2 * sa, base[1] + Wd / 2 * ca)
            p2 = (base[0] + Wd / 2 * sa, base[1] - Wd / 2 * ca)
            self.polygon([tip, p1, p2], fill=color, tag="head", lint=False)
        elif kind == "open":
            base = (tip[0] - L * ca, tip[1] - L * sa)
            p1 = (base[0] - Wd / 2 * sa, base[1] + Wd / 2 * ca)
            p2 = (base[0] + Wd / 2 * sa, base[1] - Wd / 2 * ca)
            self.polyline([p1, tip, p2], color=color, width=width, tag="head", lint=False)
        elif kind in ("bar", "inh_bar"):
            h = size * 0.7
            self.line(tip[0] - h * sa, tip[1] + h * ca, tip[0] + h * sa, tip[1] - h * ca,
                      color=color, width=max(width * 1.6, 2.2), tag="head", lint=False, cap="butt")
        elif kind in ("dot", "inh"):
            r = size * 0.42
            self.circle(tip[0] - r * ca, tip[1] - r * sa, r, fill=color, color="none",
                        tag="head", lint=False)

    def arrow(self, x1, y1, x2, y2, color=S.INK, width=S.LW_STRUCT, head="tri",
              tail=None, head_size=None, dash=None, label=None, label_side="above",
              label_size=S.SIZE_SMALL, label_color=None, shrink=0, tag="arrow", lint=True):
        """Straight arrow from (x1,y1) to (x2,y2). The tip lands exactly on
        (x2,y2) (after `shrink` px). head/tail: 'tri','open','bar','dot',None.
        `label`: text placed at the midpoint, offset perpendicular."""
        ang = math.atan2(y2 - y1, x2 - x1)
        if shrink:
            x1 += shrink * math.cos(ang); y1 += shrink * math.sin(ang)
            x2 -= shrink * math.cos(ang); y2 -= shrink * math.sin(ang)
        hs = head_size or max(8, 4 + 3.2 * width)
        # stop the shaft inside the head so the tip stays sharp
        back = hs * 0.8 if head in ("tri", "exc") else 0
        bx, by = x2 - back * math.cos(ang), y2 - back * math.sin(ang)
        tb = hs * 0.8 if tail in ("tri", "exc") else 0
        sx, sy = x1 + tb * math.cos(ang), y1 + tb * math.sin(ang)
        self.line(sx, sy, bx, by, color=color, width=width, dash=dash, tag=tag, lint=lint,
                  cap="butt" if head else "round")
        if head:
            self._head((x2, y2), ang, head, color, width, hs)
        if tail:
            self._head((x1, y1), ang + math.pi, tail, color, width, hs)
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            self.label_near_segment(mx, my, ang, label, side=label_side, size=label_size,
                                    color=label_color or S.INK2)
        return (x2, y2)

    def label_near_segment(self, mx, my, ang, label, side="above", size=S.SIZE_SMALL,
                           color=S.INK2, gap=5):
        w, asc, desc = measure(label, size)
        horizontal = abs(math.cos(ang)) > 0.7
        if horizontal:
            if side == "above":
                return self.text(mx, my - gap - desc, label, size=size, anchor="middle", color=color)
            return self.text(mx, my + gap + asc, label, size=size, anchor="middle", color=color)
        # vertical-ish segment: put label to the right (or left)
        if side in ("above", "right"):
            return self.text(mx + gap + 2, my, label, size=size, baseline="middle", color=color)
        return self.text(mx - gap - 2, my, label, size=size, anchor="end", baseline="middle",
                         color=color)

    def curved_arrow(self, p0, p3, bend=0.3, color=S.INK, width=S.LW_STRUCT, head="tri",
                     dash=None, label=None, label_size=S.SIZE_SMALL, label_color=None,
                     shrink=0, tag="arrow", lint=True, ctrl=None):
        """Cubic arrow from p0 to p3 bulging sideways by `bend` * length
        (positive = to the left of the direction of travel, i.e. up for a
        left-to-right arrow). Or give explicit control points `ctrl`=(p1,p2)."""
        dx, dy = p3[0] - p0[0], p3[1] - p0[1]
        L = math.hypot(dx, dy)
        nx, ny = dy / L, -dx / L
        if ctrl:
            p1, p2 = ctrl
        else:
            off = bend * L
            p1 = (p0[0] + dx / 4 + nx * off, p0[1] + dy / 4 + ny * off)
            p2 = (p0[0] + 3 * dx / 4 + nx * off, p0[1] + 3 * dy / 4 + ny * off)
        pts = _bezier(p0, p1, p2, p3, 40)
        if shrink:
            def cut(pts, d):
                acc = 0
                for k in range(1, len(pts)):
                    acc += math.dist(pts[k - 1], pts[k])
                    if acc >= d:
                        return k
                return len(pts) - 1
            pts = pts[cut(pts, shrink):]
            pts = pts[::-1][cut(pts[::-1], shrink):][::-1]
        hs = max(8, 4 + 3.2 * width)
        tip = pts[-1]
        # find point ~hs back along the curve for head direction
        acc, k = 0, len(pts) - 1
        while k > 0 and acc < hs * 0.8:
            acc += math.dist(pts[k], pts[k - 1]); k -= 1
        ang = math.atan2(tip[1] - pts[k][1], tip[0] - pts[k][0])
        shaft = pts[:k + 1] if head in ("tri", "exc") else pts
        self.polyline(shaft, color=color, width=width, dash=dash, tag=tag, lint=lint)
        if head:
            self._head(tip, ang, head, color, width, hs)
        if label:
            mid = pts[len(pts) // 2]
            a = math.atan2(pts[len(pts) // 2 + 1][1] - mid[1], pts[len(pts) // 2 + 1][0] - mid[0])
            side = "above" if (bend >= 0) == (math.cos(a) >= 0) else "below"
            self.label_near_segment(mid[0], mid[1], a, label, side=side, size=label_size,
                                    color=label_color or S.INK2)
        return tip

    def elbow_arrow(self, pts, color=S.INK, width=S.LW_STRUCT, head="tri", dash=None,
                    radius=8, tag="arrow", lint=True):
        """Orthogonal connector through the given corner points (rounded
        corners). The head sits on the last point."""
        hs = max(8, 4 + 3.2 * width)
        last_ang = math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
        back = hs * 0.8 if head in ("tri", "exc") else 0
        end = (pts[-1][0] - back * math.cos(last_ang), pts[-1][1] - back * math.sin(last_ang))
        P = list(pts[:-1]) + [end]
        d = f"M{_fmt(P[0][0])} {_fmt(P[0][1])}"
        samp = [P[0]]
        for i in range(1, len(P) - 1):
            a, b, c = P[i - 1], P[i], P[i + 1]
            r = min(radius, math.dist(a, b) / 2, math.dist(b, c) / 2)
            ua = ((b[0] - a[0]) / math.dist(a, b), (b[1] - a[1]) / math.dist(a, b))
            uc = ((c[0] - b[0]) / math.dist(b, c), (c[1] - b[1]) / math.dist(b, c))
            s = (b[0] - ua[0] * r, b[1] - ua[1] * r)
            e = (b[0] + uc[0] * r, b[1] + uc[1] * r)
            d += f" L{_fmt(s[0])} {_fmt(s[1])} Q{_fmt(b[0])} {_fmt(b[1])} {_fmt(e[0])} {_fmt(e[1])}"
            samp += [s, e]
        d += f" L{_fmt(P[-1][0])} {_fmt(P[-1][1])}"
        samp.append(P[-1])
        self.path(d, color=color, width=width, dash=dash, sample_pts=samp, tag=tag, lint=lint)
        if head:
            self._head(pts[-1], last_ang, head, color, width, hs)

    # ---------------- composite helpers
    def box(self, x, y, w=None, h=None, title=None, lines=(), fill=None, color=S.INK2,
            text_color=S.INK, pad=10, size=S.SIZE, small=S.SIZE_SMALL, rx=6, align="middle",
            width=S.LW_STRUCT, bold_title=True, min_w=0, tag="box"):
        """A rounded box sized to its text (if w/h None). (x, y) = top-left.
        Returns dict with x, y, w, h, cx, cy and edge midpoints l, r, t, b."""
        tw = [measure(title, size, bold_title)[0]] if title else []
        tw += [measure(s, small)[0] for s in lines]
        need_w = (max(tw) if tw else 0) + 2 * pad
        n_title = 1 if title else 0
        need_h = 2 * pad + n_title * size * 1.0 + len(lines) * small * 1.3 + (4 if title and lines else 0)
        w = max(w or 0, need_w, min_w)
        h = max(h or 0, need_h)
        self.rect(x, y, w, h, fill=fill or "#fff", color=color, width=width, rx=rx, tag=tag)
        # vertical centring of the text block
        block = n_title * size + (4 if title and lines else 0) + len(lines) * small * 1.3
        ty = y + (h - block) / 2
        tx = {"middle": x + w / 2, "start": x + pad}[align]
        if title:
            self.text(tx, ty, title, size=size, anchor=align, bold=bold_title,
                      baseline="hanging", color=text_color)
            ty += size + 4
        for s in lines:
            self.text(tx, ty + 0.1 * small, s, size=small, anchor=align, baseline="hanging",
                      color=S.INK2)
            ty += small * 1.3
        return dict(x=x, y=y, w=w, h=h, cx=x + w / 2, cy=y + h / 2,
                    l=(x, y + h / 2), r=(x + w, y + h / 2), t=(x + w / 2, y), b=(x + w / 2, y + h))

    def dimension(self, x1, y1, x2, y2, label, color=S.INK, offset=0, size=S.SIZE_SMALL,
                  side="above", ticks=True, width=1.0):
        """A measured distance: double-headed line with end ticks and a label
        (e.g. d', RF spacing, Δx). `offset` shifts it perpendicular."""
        ang = math.atan2(y2 - y1, x2 - x1)
        nx, ny = -math.sin(ang) * offset, math.cos(ang) * offset
        a, b = (x1 + nx, y1 + ny), (x2 + nx, y2 + ny)
        self.arrow(*a, *b, color=color, width=width, head="tri", tail="tri", head_size=7,
                   tag="dimension")
        if ticks:
            for p in (a, b):
                t = 5
                self.line(p[0] - t * math.sin(ang) * -1, p[1] - t * math.cos(ang),
                          p[0] + t * math.sin(ang) * -1, p[1] + t * math.cos(ang),
                          color=color, width=width, tag="dimension")
        self.label_near_segment((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ang, label, side=side,
                                size=size, color=color, gap=6)

    def brace(self, x1, x2, y, label, color=S.INK2, depth=7, size=S.SIZE_SMALL, below=True):
        """Horizontal curly brace from x1 to x2 at y, label centred."""
        s = 1 if below else -1
        xm = (x1 + x2) / 2
        d = (f"M{_fmt(x1)} {_fmt(y)} q0 {_fmt(s*depth/2)} {_fmt(depth/2)} {_fmt(s*depth/2)} "
             f"L{_fmt(xm-depth/2)} {_fmt(y+s*depth/2)} q{_fmt(depth/2)} 0 {_fmt(depth/2)} {_fmt(s*depth/2)} "
             f"q0 {_fmt(-s*depth/2)} {_fmt(depth/2)} {_fmt(-s*depth/2)} "
             f"L{_fmt(x2-depth/2)} {_fmt(y+s*depth/2)} q{_fmt(depth/2)} 0 {_fmt(depth/2)} {_fmt(-s*depth/2)}")
        self.path(d, color=color, width=1.1,
                  sample_pts=[(x1, y), (x1 + depth / 2, y + s * depth / 2), (x2 - depth / 2, y + s * depth / 2), (x2, y)],
                  tag="brace", lint=False)
        ty = y + s * depth + (size * 0.85 if below else -4)
        return self.text(xm, ty, label, size=size, anchor="middle", color=color)

    def callout(self, tx, ty, target, label, anchor="start", size=S.SIZE_SMALL, color=S.INK2,
                line_color=None, dot=True, gap=4, bold=False):
        """Label at (tx, ty) (vertical centre) with a thin leader line to
        `target` (x, y), ending in a small dot. The leader leaves from the
        side of the label that faces the target. Use for anatomy labels."""
        lines = label.split("\n")
        if len(lines) == 1:
            bb = self.text(tx, ty, label, size=size, anchor=anchor, baseline="middle", color=color,
                           bold=bold)
        else:   # several lines, block vertically centred on ty
            lg = size * 1.25
            y0 = ty - lg * (len(lines) - 1) / 2
            bbs = [self.text(tx, y0 + i * lg, ln, size=size, anchor=anchor, baseline="middle",
                             color=color, bold=bold) for i, ln in enumerate(lines)]
            bb = (min(b[0] for b in bbs), min(b[1] for b in bbs), max(b[2] for b in bbs),
                  max(b[3] for b in bbs))
        x0, y0, x1, y1 = bb
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        dx, dy = target[0] - cx, target[1] - cy
        # exit point on the bbox edge toward the target
        if abs(dx) * (y1 - y0) >= abs(dy) * (x1 - x0):
            sx = x1 + gap if dx > 0 else x0 - gap
            sy = cy
        else:
            sx = cx
            sy = y1 + gap if dy > 0 else y0 - gap
        lc = line_color or S.INK2
        self.line(sx, sy, target[0], target[1], color=lc, width=S.LW_HAIR + 0.2, tag="leader")
        if dot:
            self.circle(target[0], target[1], 2.2, fill=lc, color="none", tag="leader-dot", lint=False)
        return bb

    def callout_column(self, items, x, y0, y1, anchor="start", size=S.SIZE_SMALL, min_gap=None,
                       **kw):
        """Several callouts stacked in one column at x, between y0 and y1.
        Labels keep the vertical ORDER of their targets, so leader lines never
        cross each other, and are pushed apart to at least `min_gap`.
        items: list of (target_xy, text) or (target_xy, text, colour)."""
        it = sorted(items, key=lambda t: t[0][1])
        hts = [size * 1.25 * (len(t[1].split("\n")) - 1) + size for t in it]
        gap = min_gap or size * 0.6
        ys = [min(max(t[0][1], y0 + h / 2), y1 - h / 2) for t, h in zip(it, hts)]
        for _ in range(200):          # 1-D relaxation: keep order, enforce spacing
            moved = False
            for i in range(1, len(ys)):
                need = (hts[i - 1] + hts[i]) / 2 + gap
                if ys[i] - ys[i - 1] < need:
                    d = (need - (ys[i] - ys[i - 1])) / 2
                    ys[i - 1] -= d; ys[i] += d; moved = True
            lo = y0 + hts[0] / 2
            if ys[0] < lo:
                sh = lo - ys[0]; ys = [y + sh for y in ys]
            hi = y1 - hts[-1] / 2
            if ys[-1] > hi:
                sh = ys[-1] - hi; ys = [y - sh for y in ys]
            if not moved:
                break
        out = []
        for t, y in zip(it, ys):
            col = t[2] if len(t) > 2 else kw.get("color", S.INK2)
            k2 = dict(kw); k2["color"] = col
            out.append(self.callout(x, y, t[0], t[1], anchor=anchor, size=size, **k2))
        return out

    def panel_label(self, x, y, letter):
        """Quiet lowercase panel letter (Wilke ch. 21: like page numbers)."""
        return self.text(x, y, letter, size=S.SIZE_PANEL, bold=True, baseline="hanging")

    def keepout(self, x0, y0, x1, y1):
        """Declare an area where no label may sit (checked by lint)."""
        self.keepouts.append((x0, y0, x1, y1))

    # ---------------- lint
    def lint(self, margin=2):
        """Return a list of layout problems. Empty list == clean.

        Checks: text outside the figure; text overlapping text; text crossed
        by any linted line/curve/shape outline; text in a keep-out; font
        smaller than SIZE_MIN; forbidden '&'."""
        probs = []
        T = [(b, s, f) for b, s, f in self.texts if f["lint"]]
        for b, s, f in T:
            if b[0] < margin or b[1] < margin or b[2] > self.w - margin or b[3] > self.h - margin:
                probs.append(f"OUTSIDE figure: '{s}' bbox={tuple(round(v) for v in b)}")
            if f["size"] < S.SIZE_MIN - 1e-6:
                probs.append(f"TOO SMALL ({f['size']}px < {S.SIZE_MIN}): '{s}'")
            if "&" in s:
                probs.append(f"'&' in label '{s}' (breaks XML) - write 'and'")
            for k in self.keepouts:
                if _rects_overlap(b, k):
                    probs.append(f"IN KEEP-OUT: '{s}'")
        for i in range(len(T)):
            for j in range(i + 1, len(T)):
                a, b = T[i][0], T[j][0]
                if _rects_overlap((a[0] - 1, a[1] - 1, a[2] + 1, a[3] + 1), b):
                    probs.append(f"TEXT OVERLAP: '{T[i][1]}' x '{T[j][1]}'")
        out_tags = set()
        for pts, tag, lint in self.geoms:
            if lint and tag not in out_tags and any(
                    px < -0.5 or py < -0.5 or px > self.w + 0.5 or py > self.h + 0.5 for px, py in pts):
                out_tags.add(tag)
                probs.append(f"GEOMETRY OUTSIDE figure (clipped): {tag}")
        for b, s, f in T:
            if f["halo"]:
                continue
            r = (b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1)
            for pts, tag, lint in self.geoms:
                if not lint:
                    continue
                for p, q in zip(pts, pts[1:]):
                    if _seg_intersects_rect(p, q, r):
                        probs.append(f"LINE CROSSES TEXT: '{s}' x {tag}")
                        break
        return sorted(set(probs))

    # ---------------- output
    def svg(self, width_attr=True):
        """Inline-safe SVG string: ONE line, white background, explicit
        colours, font stack, unique ids. Ready for DEVONthink Markdown."""
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_fmt(self.w)} {_fmt(self.h)}"'
                + (f' width="{_fmt(self.w)}"' if width_attr else "")
                + f' style="max-width:100%;height:auto;font-family:{S.FONT_STACK}" '
                + f'font-family="{S.FONT_STACK}" role="img">')
        body = f'<rect width="100%" height="100%" fill="{self.bg}"/>' + "".join(self.items)
        out = head + body + "</svg>"
        from .check import hex_to_rgb
        return hex_to_rgb(out.replace("\n", " "))


# ------------------------------------------------------------------ mini plots inside a Canvas
class Area:
    """A data-coordinate window inside a Canvas, for schematic plots that
    must align with a drawing (e.g. activity profiles under a circuit).
    For real data plots use sciencefig.plot (matplotlib) instead.

    a = Area(c, x=60, y=300, w=500, h=80, xlim=(0, 1), ylim=(-0.3, 1))
    a.line(xs, ys, color=S.BLUE); a.fill(xs, ys, base=0, pos=S.tint(S.BLUE, .4))
    """

    def __init__(self, canvas, x, y, w, h, xlim=(0, 1), ylim=(0, 1)):
        self.c, self.x, self.y, self.w, self.h = canvas, x, y, w, h
        self.xlim, self.ylim = xlim, ylim

    def X(self, v):
        return self.x + (v - self.xlim[0]) / (self.xlim[1] - self.xlim[0]) * self.w

    def Y(self, v):
        return self.y + self.h - (v - self.ylim[0]) / (self.ylim[1] - self.ylim[0]) * self.h

    def pts(self, xs, ys):
        return [(self.X(a), self.Y(b)) for a, b in zip(xs, ys)]

    def line(self, xs, ys, color=S.INK, width=S.LW_DATA, dash=None, lint=True, tag="data"):
        self.c.polyline(self.pts(xs, ys), color=color, width=width, dash=dash, lint=lint, tag=tag)

    def fill(self, xs, ys, base=0.0, pos=None, neg=None, lint=False):
        """Fill between curve and `base`; positive and negative lobes may
        take different colours (e.g. excitation vs inhibition)."""
        xs, ys = list(xs), list(ys)
        for sign, col in ((1, pos), (-1, neg)):
            if not col:
                continue
            seg = []
            for a, b in zip(xs, ys):
                v = b if (b - base) * sign > 0 else base
                seg.append((a, v))
            poly = self.pts([s[0] for s in seg], [s[1] for s in seg])
            poly += [(self.X(xs[-1]), self.Y(base)), (self.X(xs[0]), self.Y(base))]
            self.c.polygon(poly, fill=col, lint=lint, tag="fill")

    def hline(self, yv, color=S.MUTED, width=S.LW_HAIR, dash="4 3", lint=False):
        self.c.line(self.x, self.Y(yv), self.x + self.w, self.Y(yv), color=color, width=width,
                    dash=dash, lint=lint, tag="ref")

    def axes(self, left=True, bottom=True, color=S.AXIS, width=1.0):
        if bottom:
            self.c.line(self.x, self.y + self.h, self.x + self.w, self.y + self.h, color=color,
                        width=width, tag="axis", lint=False)
        if left:
            self.c.line(self.x, self.y, self.x, self.y + self.h, color=color, width=width,
                        tag="axis", lint=False)
