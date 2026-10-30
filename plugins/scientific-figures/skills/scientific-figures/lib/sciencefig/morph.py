"""Neuron morphology for Canvas figures: dendritic trees, pyramidal and
stellate neurons, myelinated axons, axon terminal arbors.

Everything is generated from a seeded random generator (same seed -> same
drawing) and returns anchor points, so synapses and labels are placed on
computed positions, never guessed.

    from sciencefig import morph as M
    n = M.pyramidal(c, x=200, y=300, seed=3, apical_len=170)
    n["tuft"]      # list of tuft tip points (x, y)
    n["basal"]     # basal tips
    n["soma"]      # dict usable as a target for neuro.synapse_to
    n["axon"]      # (x, y) start of axon (base of soma)
    M.on_dendrite(n, "apical", 0.6) -> a point 60% up the apical trunk

Drawing conventions: one neutral cell colour (style.CELL) unless the cell
itself is what the figure is about; dendrites taper (thick near the soma);
axons are thin and uniform; myelin = light sheaths with gaps (nodes).
"""
import math
import random

from . import style as S


# ------------------------------------------------------------------ branching
def _seg(c, p, q, w, color, lint, bend=0.0):
    """Tapered-looking segment: stroke with round caps (joints disappear)."""
    if abs(bend) < 1e-3:
        c.line(p[0], p[1], q[0], q[1], color=color, width=w, tag="dendrite", lint=lint)
        return
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    cx, cy = mx - dy / L * bend * L, my + dx / L * bend * L
    pts = [((1 - t) ** 2 * p[0] + 2 * (1 - t) * t * cx + t * t * q[0],
            (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * cy + t * t * q[1]) for t in (0, .25, .5, .75, 1)]
    from .svg import _fmt
    d = f"M{_fmt(p[0])} {_fmt(p[1])} Q{_fmt(cx)} {_fmt(cy)} {_fmt(q[0])} {_fmt(q[1])}"
    c.path(d, color=color, width=w, sample_pts=pts, tag="dendrite", lint=lint)


def tree(c, root, angle, length, width=3.0, depth=3, seed=0, color=None, spread=0.55,
         shrink=0.72, taper=0.68, jitter=0.18, bias=None, bias_strength=0.25,
         min_width=0.9, lint=True, three_way=0.15, bend=0.12, _rng=None, _out=None):
    """Recursive dendritic (or axonal) tree.

    root: (x, y) start; angle: direction in radians (SVG coords, y down:
    -pi/2 = up); length: first segment length; depth: branching levels.
    bias: preferred direction (radians) children are pulled toward (e.g.
    -pi/2 for an apical tuft that should grow upward).
    Returns dict(tips=[(x, y, angle)], segs=[(p, q, width)])."""
    rng = _rng or random.Random(seed)
    out = _out if _out is not None else {"tips": [], "segs": []}
    color = color or S.CELL
    a = angle + rng.uniform(-jitter, jitter)
    if bias is not None:
        # rotate a fraction of the way toward the bias direction
        da = math.atan2(math.sin(bias - a), math.cos(bias - a))
        a += bias_strength * da
    L = length * rng.uniform(0.85, 1.15)
    q = (root[0] + L * math.cos(a), root[1] + L * math.sin(a))
    _seg(c, root, q, max(width, min_width), color, lint, bend=rng.uniform(-bend, bend))
    out["segs"].append((root, q, width))
    if depth <= 0:
        out["tips"].append((q[0], q[1], a))
        return out
    n = 3 if rng.random() < three_way else 2
    offs = [-spread, spread] if n == 2 else [-spread, 0, spread]
    for o in offs:
        tree(c, q, a + o * rng.uniform(0.7, 1.2), length * shrink, width * taper, depth - 1,
             color=color, spread=spread, shrink=shrink, taper=taper, jitter=jitter, bias=bias,
             bias_strength=bias_strength, min_width=min_width, lint=lint, three_way=three_way,
             bend=bend, _rng=rng, _out=out)
    return out


def _target(x, y, r=3):
    """A point target for neuro.synapse_to (terminal touches the point)."""
    return dict(x=x, y=y, r=r, kind="point", top=(x, y - r), bottom=(x, y + r),
                left=(x - r, y), right=(x + r, y))


# ------------------------------------------------------------------ cells
def pyramidal(c, x, y, size=1.0, apical_len=150, seed=0, color=None, tuft=True,
              tuft_depth=3, obliques=2, basal=4, basal_depth=2, axon_len=40, lint=True,
              axon_angle=math.pi / 2, label=None, label_pos="right"):
    """Pyramidal neuron with soma centre (x, y), apical dendrite pointing up.

    Returns anchors:
      soma   - dict for neuro.synapse_to (somatic synapse)
      apex   - top of soma; trunk_top - end of apical trunk
      tuft   - tuft tip points; basal - basal tip points; obliques - tips
      axon   - axon start (base of soma); axon_end - end of drawn axon stub
      trunk  - ((x, y_bottom), (x, y_top)) for on_dendrite()."""
    rng = random.Random(seed)
    color = color or S.CELL
    s = size
    h = 28 * s           # soma height
    wd = 15 * s          # soma half-width at base
    apex = (x, y - h * 0.62)
    base_y = y + h * 0.38
    # trunk first (drawn under soma)
    top = (x + rng.uniform(-4, 4) * s, y - apical_len * s)
    c.line(apex[0], apex[1] + 2, top[0], top[1], color=color, width=3.2 * s, tag="dendrite", lint=lint)
    res = dict(apex=apex, trunk_top=top, trunk=((x, apex[1]), top), tuft=[], basal=[], obliques=[])
    # oblique dendrites off the trunk
    for k in range(obliques):
        f = 0.35 + 0.4 * k / max(1, obliques - 1) if obliques > 1 else 0.5
        py = apex[1] + (top[1] - apex[1]) * f
        px = apex[0] + (top[0] - apex[0]) * f
        side = -1 if k % 2 == 0 else 1
        t = tree(c, (px, py), -math.pi / 2 + side * 1.05, 26 * s, width=1.8 * s, depth=1,
                 color=color, spread=0.45, _rng=rng, lint=lint)
        res["obliques"] += [(a, b) for a, b, _ in t["tips"]]
    if tuft:
        for side in (-1, 1):
            t = tree(c, top, -math.pi / 2 + side * 0.55, 24 * s, width=2.4 * s, depth=tuft_depth,
                     color=color, spread=0.42, shrink=0.78, bias=-math.pi / 2,
                     bias_strength=0.3, _rng=rng, lint=lint)
            res["tuft"] += [(a, b) for a, b, _ in t["tips"]]
    # basal dendrites from the base corners, fanning out and down
    for k in range(basal):
        fr = k / max(1, basal - 1)
        # fan from down-left to down-right, steeper in the middle
        ang = math.pi * (0.92 - 0.84 * fr) + rng.uniform(-0.08, 0.08)
        start = (x + (fr - 0.5) * 1.5 * wd, base_y - 2)
        t = tree(c, start, ang, 26 * s, width=2.6 * s, depth=basal_depth, color=color,
                 spread=0.45, shrink=0.8, _rng=rng, lint=lint)
        res["basal"] += [(a, b) for a, b, _ in t["tips"]]
    # axon stub
    ax0 = (x, base_y)
    ax1 = (x + axon_len * s * math.cos(axon_angle), base_y + axon_len * s * math.sin(axon_angle))
    if axon_len:
        c.line(*ax0, *ax1, color=color, width=1.4 * s, tag="axon", lint=lint)
    # soma: rounded triangle on top
    pts = [apex, (x + wd, base_y), (x - wd, base_y)]
    _rounded_triangle(c, pts, color, 4 * s)
    res.update(soma=dict(x=x, y=y + 2 * s, r=wd * 0.62, kind="pyramid", top=apex,
                         bottom=(x, base_y), left=(x - wd * .6, y), right=(x + wd * .6, y)),
               axon=ax0, axon_end=ax1)
    if label:
        gap = wd + 8
        if label_pos == "right":
            c.text(x + gap, y + 4, label, size=S.SIZE_SMALL, color=S.INK2)
        else:
            c.text(x - gap, y + 4, label, size=S.SIZE_SMALL, anchor="end", color=S.INK2)
    return res


def _rounded_triangle(c, pts, color, r):
    from .svg import _fmt
    (ax, ay), (bx, by), (cx, cy) = pts
    # quadratic-corner path through edge points near each vertex
    def lerp(p, q, t):
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    P = [pts[0], pts[1], pts[2]]
    segs = []
    for i in range(3):
        a, b, cc = P[i - 1], P[i], P[(i + 1) % 3]
        la, lc = math.dist(a, b), math.dist(b, cc)
        segs.append((lerp(b, a, r / la), b, lerp(b, cc, r / lc)))
    d = f"M{_fmt(segs[0][2][0])} {_fmt(segs[0][2][1])}"
    for s0, v, s1 in segs[1:] + segs[:1]:
        d += f" L{_fmt(s0[0])} {_fmt(s0[1])} Q{_fmt(v[0])} {_fmt(v[1])} {_fmt(s1[0])} {_fmt(s1[1])}"
    d += "Z"
    c.path(d, color=color, width=1, fill=color, sample_pts=list(pts) + [pts[0]], tag="soma")


def stellate(c, x, y, r=8, seed=0, color=None, n=6, depth=1, length=18, lint=True):
    """Star-shaped (spiny stellate / interneuron) cell: round soma with
    dendrites all around. Returns dict(soma=..., tips=[...])."""
    rng = random.Random(seed)
    color = color or S.CELL
    tips = []
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.25, 0.25)
        t = tree(c, (x + r * 0.8 * math.cos(a), y + r * 0.8 * math.sin(a)), a, length, width=2.0,
                 depth=depth, color=color, spread=0.5, _rng=rng, lint=lint)
        tips += [(p, q) for p, q, _ in t["tips"]]
    c.circle(x, y, r, fill=color, color=color, width=1, tag="soma")
    return dict(soma=dict(x=x, y=y, r=r, kind="round", top=(x, y - r), bottom=(x, y + r),
                          left=(x - r, y), right=(x + r, y)), tips=tips)


def on_dendrite(cell, which="apical", f=0.5):
    """A point a fraction f along the apical trunk (0 = soma, 1 = top), as a
    synapse target dict."""
    (x0, y0), (x1, y1) = cell["trunk"]
    return _target(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, r=2.5)


def point_target(x, y, r=3):
    return _target(x, y, r)


# ------------------------------------------------------------------ axons
def myelinated_axon(c, p0, p1, n=6, color=None, sheath=None, width=1.6, thick=7, node=7,
                    lint=True):
    """Straight axon from p0 to p1 with `n` myelin sheaths separated by
    nodes of Ranvier. Returns list of node centres."""
    color = color or S.CELL
    sheath = sheath or S.tint(S.SKY, 0.35)
    c.line(*p0, *p1, color=color, width=width, tag="axon", lint=lint)
    L = math.dist(p0, p1)
    ux, uy = (p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L
    nx, ny = -uy, ux
    seg = (L - node * (n + 1)) / n
    nodes = []
    pos = node
    for k in range(n):
        a = (p0[0] + ux * pos, p0[1] + uy * pos)
        b = (p0[0] + ux * (pos + seg), p0[1] + uy * (pos + seg))
        h = thick / 2
        cap = _capsule(a, b, h)
        c.polygon(cap, fill=sheath, color=S.shade(S.SKY, 0.35), width=0.9, tag="myelin", lint=False)
        nodes.append((p0[0] + ux * (pos - node / 2), p0[1] + uy * (pos - node / 2)))
        pos += seg + node
    return nodes


def _capsule(a, b, h, n=8):
    L = math.dist(a, b)
    ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    nx, ny = -uy, ux
    pts = []
    for k in range(n + 1):          # end cap at b
        t = -math.pi / 2 + math.pi * k / n
        pts.append((b[0] + h * (ux * math.cos(t) + nx * math.sin(t)) - ux * h,
                    b[1] + h * (uy * math.cos(t) + ny * math.sin(t)) - uy * h))
    for k in range(n + 1):          # end cap at a
        t = math.pi / 2 + math.pi * k / n
        pts.append((a[0] + h * (ux * math.cos(t) + nx * math.sin(t)) + ux * h,
                    a[1] + h * (uy * math.cos(t) + ny * math.sin(t)) + uy * h))
    return pts


def terminal_arbor(c, root, angle=0.0, length=26, depth=3, seed=0, color=None, bouton=2.6,
                   lint=True, spread=0.6):
    """Axon terminal arbor ending in boutons. Returns tip points."""
    color = color or S.CELL
    t = tree(c, root, angle, length, width=1.6, depth=depth, seed=seed, color=color,
             spread=spread, shrink=0.75, taper=0.85, min_width=1.0, lint=lint, three_way=0.25)
    for x, y, _ in t["tips"]:
        c.circle(x, y, bouton, fill=color, color="none", tag="bouton", lint=False)
    return [(x, y) for x, y, _ in t["tips"]]


def spine_synapse(c, start, target, kind="exc", color=None, width=1.6):
    """Incoming axon ending on a dendrite point, using the house terminals
    (exc = triangle, inh = dot)."""
    from . import neuro as N
    color = color or (S.EXC if kind == "exc" else S.INH)
    return N.synapse_to(c, start, target, kind=kind, color=color, width=width)


# ------------------------------------------------------------------ real reconstructions
# Book-quality neurons come from REAL reconstructions (SWC / Neurolucida ASC /
# H5), rendered with tapering widths. Sources: NeuroMorpho.Org (mostly CC BY),
# BluePyOpt examples (CC BY-NC-SA), Allen Cell Types. Always credit the source
# in the caption ("Morphology: C060114A7, Blue Brain Project, CC BY-NC-SA").

_TYPE = {1: "soma", 2: "axon", 3: "basal", 4: "apical"}


def load_morphology(path):
    """Read a morphology (SWC, Neurolucida ASC, H5) with MorphIO.
    Returns dict(sections=[dict(id, parent, type, pts(n,3), diam(n))], soma=pts(k,3))."""
    import morphio
    import numpy as np
    try:
        morphio.set_maximum_warnings(0)       # reconstructions often trigger harmless warnings
    except Exception:
        pass
    m = morphio.Morphology(str(path))
    secs = []
    for s_ in m.iter():
        t = _TYPE.get(int(s_.type), "other")
        pts = np.asarray(s_.points, float)
        d = np.asarray(s_.diameters, float)
        par = None if s_.is_root else s_.parent.id
        if par is not None:   # start at the parent's end so branches connect
            pts = np.vstack([s_.parent.points[-1], pts]); d = np.r_[s_.parent.diameters[-1], d]
        secs.append(dict(id=s_.id, parent=par, type=t, pts=pts, diam=d))
    return dict(sections=secs, soma=np.asarray(m.soma.points, float), path=str(path))


def load_neuroml(path):
    """Read the morphology of a NeuroML2 cell (.cell.nml, e.g. Open Source
    Brain / Blue Brain showcase models). Unbranched chains of segments become
    sections; types come from segment or group names (soma/axon/apic/dend)."""
    import xml.etree.ElementTree as ET
    import numpy as np
    root = ET.parse(str(path)).getroot()
    ns = {"n": root.tag.split("}")[0].strip("{")} if root.tag.startswith("{") else {}
    q = (lambda t: f"n:{t}") if ns else (lambda t: t)
    segs = {}
    for sg in root.iter(("{%s}segment" % ns["n"]) if ns else "segment"):
        sid = int(sg.get("id"))
        par = sg.find(q("parent"), ns)
        prox = sg.find(q("proximal"), ns); dist = sg.find(q("distal"), ns)
        f = lambda e: (float(e.get("x")), float(e.get("y")), float(e.get("z")), float(e.get("diameter")))
        segs[sid] = dict(name=(sg.get("name") or "").lower(),
                         parent=int(par.get("segment")) if par is not None else None,
                         prox=f(prox) if prox is not None else None, dist=f(dist))
    # types from group names when segment names are not informative
    gtype = {}
    for grp in root.iter(("{%s}segmentGroup" % ns["n"]) if ns else "segmentGroup"):
        gid = grp.get("id", "").lower()
        t = ("soma" if "soma" in gid else "axon" if "axon" in gid else
             "apical" if "apic" in gid else "basal" if "dend" in gid else None)
        if t:
            for mem in grp.findall(q("member"), ns):
                gtype.setdefault(int(mem.get("segment")), t)

    def stype(i):
        n = segs[i]["name"]
        for key, t in (("soma", "soma"), ("axon", "axon"), ("apic", "apical"), ("dend", "basal")):
            if key in n:
                return t
        return gtype.get(i, "basal")
    for i, sg in segs.items():
        if sg["prox"] is None:
            sg["prox"] = segs[sg["parent"]]["dist"] if sg["parent"] is not None else sg["dist"]
    kids = {}
    for i, sg in segs.items():
        kids.setdefault(sg["parent"], []).append(i)
    soma = [segs[i]["dist"][:3] for i in segs if stype(i) == "soma"]
    soma_d = [segs[i]["dist"][3] for i in segs if stype(i) == "soma"]
    secs, sec_of_end = [], {}
    # start a section at every segment whose parent branches, changes type, or is soma
    starts = [i for i, sg in segs.items() if stype(i) != "soma" and (
        sg["parent"] is None or stype(sg["parent"]) == "soma" or len(kids.get(sg["parent"], [])) > 1
        or stype(sg["parent"]) != stype(i))]
    for st in sorted(starts):
        chain = [st]
        while len(kids.get(chain[-1], [])) == 1 and stype(kids[chain[-1]][0]) == stype(st):
            chain.append(kids[chain[-1]][0])
        pts = [segs[st]["prox"]] + [segs[i]["dist"] for i in chain]
        P = np.array(pts)
        secs.append(dict(id=st, parent_seg=segs[st]["parent"], type=stype(st), pts=P[:, :3],
                         diam=P[:, 3], chain=chain))
        sec_of_end[chain[-1]] = st
    for sc in secs:
        ps = sc.pop("parent_seg")
        sc["parent"] = sec_of_end.get(ps) if ps is not None else None
        sc.pop("chain")
    out = dict(sections=secs, soma=np.array(soma) if soma else np.zeros((0, 3)), path=str(path))
    if soma_d:
        out["soma_r"] = float(max(soma_d)) / 2
    return out


def load(path):
    """Load any morphology: .swc / .asc / .h5 (MorphIO) or .nml (NeuroML2)."""
    return load_neuroml(path) if str(path).endswith(".nml") else load_morphology(path)


def prune(morph, min_terminal=25.0, rounds=3, keep_types=("apical", "basal", "axon")):
    """Simplify for illustration: repeatedly remove terminal branches shorter
    than `min_terminal` um (book drawings show the main architecture, not
    every twig). Returns a new morph dict."""
    import numpy as np
    secs = [dict(sc) for sc in morph["sections"] if sc["type"] in keep_types]
    for _ in range(rounds):
        kids = {}
        for sc in secs:
            kids.setdefault(sc["parent"], []).append(sc["id"])
        L = lambda sc: float(np.sum(np.linalg.norm(np.diff(sc["pts"], axis=0), axis=1)))
        drop = {sc["id"] for sc in secs if sc["id"] not in kids and sc["parent"] is not None
                and L(sc) < min_terminal}
        if not drop:
            break
        secs = [sc for sc in secs if sc["id"] not in drop]
    return dict(morph, sections=secs)


def _rdp(P, eps):
    """Ramer-Douglas-Peucker on an (n,2) array; returns kept indices."""
    import numpy as np
    if len(P) < 3:
        return list(range(len(P)))
    a, b = P[0], P[-1]
    ab = b - a
    L = np.hypot(*ab)
    if L == 0:
        d = np.hypot(*(P - a).T)
    else:
        d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(d))
    if d[i] > eps:
        left = _rdp(P[:i + 1], eps)
        right = _rdp(P[i:], eps)
        return left[:-1] + [i + j for j in right]
    return [0, len(P) - 1]


def _axon_masks(secs, soma_c, axon_len):
    """For an axon 'stub': keep points whose PATH length from the soma along
    the axon is <= axon_len. Cutting by path length keeps the stub connected
    (cutting by straight-line distance leaves floating collateral pieces)."""
    import numpy as np
    byid = {sc["id"]: sc for sc in secs}
    start = {}
    masks = {}
    for sc in secs:                       # parents come before children
        if sc["type"] != "axon":
            continue
        par = sc["parent"]
        d0 = start.get(("end", par), 0.0) if par in byid and byid[par]["type"] == "axon" else 0.0
        P = sc["pts"]
        cum = d0 + np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
        masks[sc["id"]] = cum <= axon_len
        start[("end", sc["id"])] = float(cum[-1])
    return masks


def _orient(morph, up="apical"):
    import numpy as np
    soma = morph["soma"].mean(0) if len(morph["soma"]) else np.zeros(3)
    pts = [sc["pts"] for sc in morph["sections"] if sc["type"] == up]
    if not pts:
        pts = [sc["pts"] for sc in morph["sections"] if sc["type"] in ("basal", "apical")]
    v = np.vstack(pts).mean(0) - soma
    return np.arctan2(v[0], v[1])


def _rel_path(pts):
    """Compact SVG path: absolute start, then relative 1-decimal steps."""
    from .svg import _fmt
    out = [f"M{_fmt(round(pts[0][0], 1))} {_fmt(round(pts[0][1], 1))}"]
    px, py = round(pts[0][0], 1), round(pts[0][1], 1)
    for x_, y_ in pts[1:]:
        x_, y_ = round(x_, 1), round(y_, 1)
        out.append(f"l{_fmt(round(x_ - px, 1))} {_fmt(round(y_ - py, 1))}")
        px, py = x_, y_
    return "".join(out).replace(" -", "-")


def draw_morphology(c, morph, x, y, height=300, rotate=None, flip=False, style="ink",
                    color=None, colors=None, axon="stub", axon_len=150, width_gain=1.0,
                    width_power=0.8, min_width=0.6, max_width=None, depth_shade=0.0,
                    soma_scale=1.0, tol=0.5, chunk=10, lint=True, tag="neuron",
                    widths="measured", trunk_width=None, tip_width=None, smooth=0,
                    nucleus=False, scale=None, box=None, taper=0.4, highlight=False):
    """Draw a real neuron with its soma at (x, y); the dendrites span
    `height` px vertically (after rotation).

    style:
      'ink'       one dark colour - the Golgi/Cajal look of classic plates
      'slate'     the neutral S.CELL colour (context in schematics)
      'compartments'  apical / basal / axon coloured (`colors` overrides)
      'tube'      illustrated look: dark outline + body colour + light
                  highlight along the centre (pseudo-3D, textbook style).
                  Best with prune() and width_gain 2-3.
    axon: 'none' | 'stub' (within `axon_len` um of the soma) | 'full'.
    rotate: radians; default turns the apical dendrite (or the dendrite
      centroid) straight up.  depth_shade: lighten far (z) parts, 0..1.
    widths: 'measured' -> w = width_gain * k * d**width_power (k = px per um),
      at least min_width; 'tips' -> drawn widths follow the number of
      terminal tips downstream (smooth taper from `trunk_width` at the soma
      to `tip_width` at the tips; the textbook look, ignores noisy diameters).
    scale: px per um - use ONE scale for all cells of a figure (true relative
      sizes, add a scale bar); overrides `height`.
    box: (x0, y0, w, h) - fit everything drawn (incl. the axon stub) into
      this box, centred; (x, y) are then ignored.
    smooth: moving-average passes over the traced points (0 = raw tracing;
      2-4 gives the smooth curves of an illustration).
    nucleus: draw a pale nucleus in the soma (illustration style).
    Returns anchors: soma, to_px (um -> px), tips by type, scale, top, bottom."""
    import numpy as np
    secs = morph["sections"]
    soma_c = morph["soma"].mean(0) if len(morph["soma"]) else secs[0]["pts"][0]
    ang = _orient(morph) if rotate is None else rotate
    ca, sa = np.cos(ang), np.sin(ang)

    def rot(P):
        P = np.asarray(P, float) - soma_c
        X = P[..., 0] * ca - P[..., 1] * sa
        Y = P[..., 0] * sa + P[..., 1] * ca
        return (-X if flip else X), Y, P[..., 2]

    dend = [sc["pts"] for sc in secs if sc["type"] in ("basal", "apical")] or [secs[0]["pts"]]
    _, ally, _ = rot(np.vstack(dend))
    k = height / max(ally.max() - ally.min(), 1e-6)
    if scale:
        k = scale
    amask = _axon_masks(secs, soma_c, axon_len) if axon == "stub" else {}
    if box:
        drawn = []
        for sc in secs:
            P = sc["pts"]
            if sc["type"] == "axon":
                if axon == "none":
                    continue
                if axon == "stub":
                    P = P[amask.get(sc["id"], np.zeros(len(P), bool))]
                    if len(P) == 0:
                        continue
            drawn.append(P)
        X_, Y_, _ = rot(np.vstack(drawn))
        bx, by, bw, bh = box
        if not scale:
            k = min(bw / max(X_.max() - X_.min(), 1e-6), bh / max(Y_.max() - Y_.min(), 1e-6))
        x = bx + bw / 2 - (X_.max() + X_.min()) / 2 * k
        y = by + bh / 2 + (Y_.max() + Y_.min()) / 2 * k
    to_px = lambda P: (x + rot(P)[0] * k, y - rot(P)[1] * k)

    base = {"ink": S.INK, "slate": S.CELL, "tube": S.tint(S.CELL, .7)}.get(style, S.INK)
    cmap = dict(apical=base, basal=base, axon=S.CELL_LIGHT if style == "slate" else base, soma=base)
    if style == "compartments":
        cmap = dict(apical=S.PURPLE, basal=S.GREEN, axon=S.BLUE, soma=S.INK2)
    if color:
        cmap = {kk: color for kk in cmap}
    cmap.update(colors or {})
    zs = np.concatenate([rot(sc["pts"])[2] for sc in secs])
    zlo, zhi = np.percentile(zs, 2), np.percentile(zs, 98)

    def shade_col(col, z):
        if depth_shade <= 0:
            return col
        f = np.clip((z - zlo) / (zhi - zlo + 1e-9), 0, 1)
        return S.tint(col, 1 - depth_shade * (1 - f))

    # downstream tip counts (for widths='tips')
    kids = {}
    for sc in secs:
        kids.setdefault(sc["parent"], []).append(sc["id"])
    byid = {sc["id"]: sc for sc in secs}
    ntips = {}

    def count(i):
        if i in ntips:
            return ntips[i]
        ch = kids.get(i, [])
        ntips[i] = 1 if not ch else sum(count(j) for j in ch)
        return ntips[i]
    import sys as _sys
    _sys.setrecursionlimit(max(10000, _sys.getrecursionlimit()))
    for sc in secs:
        count(sc["id"])
    # each stem (root section) starts with a width set by its size relative
    # to the biggest stem; inside a tree the width follows the tips downstream
    root_of = {}
    for sc in secs:
        r_ = sc["id"]
        while byid.get(r_) is not None and byid[r_]["parent"] in byid:
            r_ = byid[r_]["parent"]
        root_of[sc["id"]] = r_
    big = max((ntips[r_] for r_ in set(root_of.values())), default=1)
    tw = trunk_width if trunk_width is not None else 6.0
    pw = tip_width if tip_width is not None else max(min_width, 0.9)

    def wtips(sc_id, t):
        r_ = root_of.get(sc_id, sc_id)
        w_root = pw + (tw - pw) * (0.45 + 0.55 * (ntips[r_] / big) ** 0.5)
        return pw + (w_root - pw) * (ntips[sc_id] / ntips[r_]) ** taper

    items, tips = [], {"apical": [], "basal": [], "axon": []}
    for sc in secs:
        t, P, D = sc["type"], sc["pts"], sc["diam"]
        if smooth and len(P) > 3:
            P = P.copy()
            for _ in range(smooth):
                P[1:-1] = (P[:-2] + 2 * P[1:-1] + P[2:]) / 4
        if t == "axon" and axon == "none":
            continue
        if t == "axon" and axon == "stub":
            m = amask.get(sc["id"], np.zeros(len(P), bool))
            if m.sum() < 2:
                continue
            P, D = P[m], D[m]
        if t not in cmap:
            continue
        X, Y, Z = rot(P)
        sx, sy = x + X * k, y - Y * k
        if widths == "tips":
            w0 = wtips(sc["id"], t)
            ch = kids.get(sc["id"], [])
            w1 = (np.mean([wtips(j, t) for j in ch]) if ch else pw)
            if t == "axon":
                w0 = w1 = max(min_width, pw * 0.8)
            w = np.linspace(w0, w1, len(P))
        else:
            w = np.clip(width_gain * k * np.power(np.maximum(D, 1e-3), width_power), min_width,
                        max_width or 1e9)
        n = len(sx)
        for a in range(0, n - 1, chunk):
            b = min(n - 1, a + chunk)
            P2 = np.c_[sx[a:b + 1], sy[a:b + 1]]
            keep = _rdp(P2, tol)
            pts = [tuple(P2[i]) for i in keep]
            ww = float(np.mean(w[a:b + 1])); zz = float(np.mean(Z[a:b + 1]))
            col = shade_col(cmap[t], zz)
            d = _rel_path(pts)
            top = 3 if t == "axon" else 0          # axon drawn above the dendrites
            if style == "tube":
                items.append((zz, top + 0, f'<path d="{d}" stroke="{S.shade(col, .35)}" stroke-width="{round(ww + 1.1, 2)}"/>'))
                items.append((zz, top + 1, f'<path d="{d}" stroke="{col}" stroke-width="{round(ww, 2)}"/>'))
                if highlight and ww > 3.2:
                    items.append((zz, top + 2, f'<path d="{d}" stroke="{S.tint(col, .55)}" stroke-width="{round(ww * .3, 2)}"/>'))
            else:
                items.append((zz, top, f'<path d="{d}" stroke="{col}" stroke-width="{round(ww, 2)}"/>'))
            if lint:
                c._geom(pts, tag, True)
        if t in tips:
            tips[t].append((float(sx[-1]), float(sy[-1])))
    # Merge chunks with the same layer, colour and (rounded) width into ONE
    # <path> with many subpaths: ~4x smaller SVG. Groups are drawn by layer
    # (tube: outlines, then bodies, then highlights, so joints merge) and,
    # within a layer, far to near.
    import re as _re
    groups = {}
    for zz, layer, el in items:
        stroke = _re.search(r'stroke="([^"]+)"', el).group(1)
        wv = float(_re.search(r'stroke-width="([^"]+)"', el).group(1))
        wb = round(wv * 4) / 4
        d = _re.search(r' d="([^"]+)"', el).group(1)
        g = groups.setdefault((layer, stroke, wb), [0.0, 0, []])
        g[0] += zz; g[1] += 1; g[2].append(d)
    order = sorted(groups.items(), key=lambda kv: (kv[0][0], kv[1][0] / kv[1][1]))
    body = "".join(f'<path d="{"".join(v[2])}" stroke="{k_[1]}" stroke-width="{k_[2]:g}"/>'
                   for k_, v in order)
    c.items.append('<g fill="none" stroke-linecap="round" stroke-linejoin="round">' + body + "</g>")
    sp = morph["soma"]
    sc_col = cmap["soma"]
    if "soma_r" in morph:
        r = max(2.0, morph["soma_r"] * k * soma_scale)
        poly = [(x + r * np.cos(t_), y + r * np.sin(t_)) for t_ in np.linspace(0, 2 * np.pi, 18)[:-1]]
    elif len(sp) >= 3:
        X, Y, _ = rot(sp)
        poly = [(x + X[i] * k * soma_scale, y - Y[i] * k * soma_scale) for i in range(len(X))]
        r = float(np.max(np.hypot(X, Y)) * k * soma_scale)
    else:
        r = max(3.0, 6 * k * soma_scale)
        poly = [(x + r * np.cos(t_), y + r * np.sin(t_)) for t_ in np.linspace(0, 2 * np.pi, 16)]
    if style == "tube":
        if widths == "tips":   # smooth illustrated soma: rounded triangle/ellipse
            r = max(r, tw * 1.4)
            poly = [(x + r * np.cos(t_) * (1.0 + 0.15 * np.sin(t_)), y + r * 0.85 * np.sin(t_))
                    for t_ in np.linspace(0, 2 * np.pi, 28)[:-1]]
        c.polygon(poly, fill=sc_col, color=S.shade(sc_col, .35), width=1.1, tag="soma", lint=False)
    else:
        c.polygon(poly, fill=sc_col, color=sc_col, width=1.0, tag="soma", lint=False)
    if nucleus:
        c.circle(x, y, r * 0.42, fill=S.tint(sc_col, .45), color=S.shade(sc_col, .25), width=0.8,
                 lint=False)
    return dict(soma=dict(x=x, y=y, r=r, kind="round", top=(x, y - r), bottom=(x, y + r),
                          left=(x - r, y), right=(x + r, y)),
                to_px=to_px, tips=tips, scale=k, top=y - ally.max() * k, bottom=y - ally.min() * k)


def save_swc(morph, path, decimals=2, header=""):
    """Write a (pruned) morphology as a compact SWC (soma as one point)."""
    import numpy as np
    code = {"soma": 1, "axon": 2, "basal": 3, "apical": 4}
    lines = [f"# {ln}" for ln in header.splitlines()]
    sp = morph["soma"]
    c = sp.mean(0) if len(sp) else morph["sections"][0]["pts"][0]
    rs = morph.get("soma_r") or (float(np.max(np.linalg.norm(sp - c, axis=1))) if len(sp) else 5.0)
    f = lambda v: f"{v:.{decimals}f}"
    lines.append(f"1 1 {f(c[0])} {f(c[1])} {f(c[2])} {f(rs)} -1")
    nid = 1
    end_id = {}
    for sc in morph["sections"]:
        par = end_id.get(sc["parent"], 1)
        P, D = sc["pts"], sc["diam"]
        start = 1 if sc["parent"] is not None else 0
        for i in range(start, len(P)):
            nid += 1
            lines.append(f"{nid} {code.get(sc['type'], 3)} {f(P[i,0])} {f(P[i,1])} {f(P[i,2])} {f(D[i]/2)} {par}")
            par = nid
        end_id[sc["id"]] = par
    open(path, "w").write("\n".join(lines) + "\n")
    return path
