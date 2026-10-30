"""Procedural anatomy components in the house style (flat, line-art, quiet
colours, everything returned as named anchor points for labels and overlays).

    from sciencefig import anatomy as An
    eye = An.eye_section(c, cx=260, cy=200, R=120)
    c.callout(40, 60, eye["cornea"], "Cornea")

Components
  eye_section      horizontal section of the eye with light path to the fovea
  retina_layers    the retinal circuit: rods, cones, horizontal, bipolar,
                   amacrine and ganglion cells, with the named layers
  cochlea_unrolled the cochlea as an uncoiled tube with the basilar membrane
                   and travelling-wave envelopes (tonotopy)
  cochlea_spiral   top view of the cochlear spiral with the frequency map
For realistic illustrations (whole brain, ear, organ of Corti) use
`sciencefig.assets` (Servier Medical Art, recoloured) instead.
"""
import math

import numpy as np

from . import style as S

TISSUE = "#efe7e2"      # neutral tissue fill
TISSUE_EDGE = "#9c8f88"
FLUID = "#f4f8fb"


def _arc(cx, cy, r, a0, a1, n=60):
    """Points on a circle from angle a0 to a1 (degrees, 0 = +x, counter-clockwise
    in maths convention; SVG y is down so we negate the sine)."""
    t = np.radians(np.linspace(a0, a1, n))
    return [(cx + r * math.cos(a), cy - r * math.sin(a)) for a in t]


def _ring(c, cx, cy, r_out, r_in, a0, a1, fill, edge=None, width=0.9, n=80):
    pts = _arc(cx, cy, r_out, a0, a1, n) + _arc(cx, cy, r_in, a1, a0, n)
    c.polygon(pts, fill=fill, color=edge or "none", width=width, lint=False, tag="tissue")
    return pts


# ------------------------------------------------------------------ eye
def eye_section(c, cx, cy, R=110, retina_color=None, show_rays=True, ray_color=None,
                nerve_len=None):
    """Horizontal section of a right eye seen from above; light enters from
    the LEFT, the fovea is on the optical axis at the back (right), the
    optic disc is nasal (below the axis in this view).
    Returns anchors: cornea, aqueous, iris, pupil, lens, ciliary, sclera,
    choroid, retina, vitreous, fovea, optic_disc, optic_nerve, axis_front."""
    retina_color = retina_color or S.tint(S.VERMILION, 0.45)
    ray_color = ray_color or S.ORANGE
    A = {}
    gap = 34                     # half-angle of the corneal opening (deg, around 180)
    # sclera (white outer coat) around everything except the cornea
    _ring(c, cx, cy, R, R - 6, -180 + gap, 180 - gap, fill="#ffffff", edge=TISSUE_EDGE)
    # choroid
    _ring(c, cx, cy, R - 6, R - 9, -180 + gap + 6, 180 - gap - 6, fill="#b9a49b")
    # retina: from the ora serrata (about 60 deg from the front) round the back
    ora = 62
    _ring(c, cx, cy, R - 9, R - 16, -180 + ora, 180 - ora, fill=retina_color,
          edge=S.shade(retina_color, .25), width=0.6)
    # vitreous
    c.circle(cx, cy, R - 16, fill=FLUID, color="none", lint=False)
    # cornea: a smaller sphere bulging forward, meeting the sclera at +-gap
    xj = cx + R * math.cos(math.radians(180 - gap)); yj = R * math.sin(math.radians(gap))
    rc = 0.62 * R
    ccx = xj + math.sqrt(rc ** 2 - yj ** 2)              # centre of the corneal sphere
    a_edge = math.degrees(math.asin(yj / rc))
    outer = _arc(ccx, cy, rc, 180 - a_edge, 180 + a_edge, 40)
    inner = _arc(ccx + 3, cy, rc - 3, 180 + a_edge, 180 - a_edge, 40)
    c.polygon(outer + inner, fill="#e9f3f8", color=TISSUE_EDGE, width=0.9, lint=False, tag="cornea")
    # anterior chamber fluid
    ach = _arc(ccx + 3, cy, rc - 3, 180 - a_edge, 180 + a_edge, 30)
    c.polygon(ach, fill=FLUID, color="none", lint=False)
    front = (ccx - rc, cy)
    # lens (biconvex)
    lx = cx - 0.60 * R
    lh = 0.36 * R
    lens = (_arc(lx + 0.55 * lh, cy, 0.75 * lh, 135, 225, 30) +
            _arc(lx - 0.75 * lh, cy, 0.95 * lh, -40, 40, 30))
    c.polygon(lens, fill="#f2f0e2", color=TISSUE_EDGE, width=1.0, lint=False, tag="lens")
    # ciliary body + iris
    iris_x = lx - 0.20 * lh
    for sgn in (1, -1):
        yb = cy - sgn * yj * 0.98
        cil = [(xj + 3, yb), (xj + 16, yb + sgn * 3), (lx + 4, cy - sgn * (lh * 0.95)),
               (xj + 6, yb + sgn * 12)]
        c.polygon(cil, fill="#b9a49b", color="none", lint=False, tag="ciliary")
        # zonule fibres
        for k in range(3):
            c.line(xj + 14 + 2 * k, yb + sgn * (5 + 3 * k), lx + 1, cy - sgn * (lh * (0.8 - 0.07 * k)),
                   color=TISSUE_EDGE, width=0.5, lint=False)
        # iris flap
        iris = [(xj + 2, yb), (iris_x, cy - sgn * 0.16 * R), (iris_x + 3, cy - sgn * 0.16 * R),
                (xj + 8, yb + sgn * 4)]
        c.polygon(iris, fill="#6f5a4f", color="none", lint=False, tag="iris")
    # optic nerve: leaves nasally (below the axis), 15 deg from the back pole
    a_on = -15
    ox, oy = cx + R * math.cos(math.radians(a_on)), cy - R * math.sin(math.radians(a_on))
    nl = nerve_len or 0.75 * R
    ang = math.radians(a_on)
    ux, uy = math.cos(ang), -math.sin(ang)
    nx, ny = -uy, ux
    w = 0.13 * R
    nerve = [(ox - nx * w - ux * 10, oy - ny * w - uy * 10), (ox + nx * w - ux * 10, oy + ny * w - uy * 10),
             (ox + nx * w + ux * nl, oy + ny * w + uy * nl), (ox - nx * w + ux * nl, oy - ny * w + uy * nl)]
    c.polygon(nerve, fill="#f3e9c9", color=TISSUE_EDGE, width=0.9, lint=False, tag="nerve")
    # labels may not sit on the drawing: register keep-outs for lint()
    c.keepout(min(p[0] for p in nerve), min(p[1] for p in nerve), max(p[0] for p in nerve),
              max(p[1] for p in nerve))
    c.keepout(cx - R * 0.7, cy - R, cx + R, cy + R)
    # optic disc (the blind spot) where the nerve leaves
    dx_, dy_ = cx + (R - 13) * math.cos(ang), cy - (R - 13) * math.sin(ang)
    c.circle(dx_, dy_, 5, fill="#f3e9c9", color=TISSUE_EDGE, width=0.8, lint=False)
    # fovea: a small pit on the axis at the back
    fx = cx + R - 16
    c.polygon([(fx + 0.5, cy - 7), (fx - 4, cy), (fx + 0.5, cy + 7), (fx + 3, cy)], fill=FLUID,
              color="none", lint=False)
    A.update(fovea=(fx + 1, cy), optic_disc=(dx_, dy_), optic_nerve=(ox + ux * nl * 0.6, oy + uy * nl * 0.6),
             cornea=front, aqueous=(front[0] + 0.12 * R, cy - 0.28 * R), lens=(lx + 0.05 * R, cy - 0.2 * R),
             pupil=(iris_x, cy), iris=(iris_x + 2, cy - 0.24 * R),
             ciliary=(xj + 12, cy - yj * 0.98 + 6),
             sclera=(cx + R * math.cos(math.radians(70)), cy - R * math.sin(math.radians(70)) + 2),
             choroid=(cx + (R - 7.5) * math.cos(math.radians(40)), cy - (R - 7.5) * math.sin(math.radians(40))),
             retina=(cx + (R - 12.5) * math.cos(math.radians(25)), cy - (R - 12.5) * math.sin(math.radians(25))),
             vitreous=(cx + 0.1 * R, cy + 0.35 * R), axis_front=front, center=(cx, cy), R=R)
    if show_rays:
        # parallel rays from a distant point focused on the fovea (schematic optics)
        for h in (-0.11, 0.0, 0.11):
            y0 = cy + h * R
            hit_c = (front[0] + 0.02 * R * abs(h) * 20, y0)            # cornea surface
            hit_l = (lx, cy + h * R * 0.62)
            c.polyline([(front[0] - 0.32 * R, y0), hit_c, hit_l, A["fovea"]], color=ray_color,
                       width=1.3, lint=False, tag="ray")
        c.arrow(front[0] - 0.32 * R, cy - 0.11 * R, front[0] - 0.12 * R, cy - 0.11 * R,
                color=ray_color, width=1.3, head_size=7, lint=False)
        A["light"] = (front[0] - 0.32 * R, cy + 0.11 * R)
    return A


# ------------------------------------------------------------------ retina
def _rod(c, x, y_os_top, y_soma, y_term, color):
    w = 5
    c.rect(x - w / 2, y_os_top, w, (y_soma - y_os_top) * 0.45, fill=color, color=S.shade(color, .3),
           width=0.6, rx=2, lint=False)                          # outer segment
    c.line(x, y_os_top + (y_soma - y_os_top) * 0.45, x, y_soma, color=S.shade(color, .2), width=2.2,
           lint=False)
    c.ellipse(x, y_soma, 3.6, 4.6, fill=color, color=S.shade(color, .3), width=0.6, lint=False)
    c.line(x, y_soma + 4, x, y_term, color=S.shade(color, .2), width=1.4, lint=False)
    c.circle(x, y_term, 2.4, fill=S.shade(color, .2), color="none", lint=False)


def _cone(c, x, y_os_top, y_soma, y_term, color):
    h = (y_soma - y_os_top) * 0.38
    c.polygon([(x - 1.5, y_os_top + 4), (x + 1.5, y_os_top + 4), (x + 4.5, y_os_top + 4 + h),
               (x - 4.5, y_os_top + 4 + h)], fill=color, color=S.shade(color, .3), width=0.6, lint=False)
    c.ellipse(x, y_os_top + 4 + h + 6, 4.6, 6, fill=S.tint(color, .7), color=S.shade(color, .3),
              width=0.6, lint=False)                              # inner segment
    c.line(x, y_os_top + 4 + h + 12, x, y_soma, color=S.shade(color, .2), width=2.0, lint=False)
    c.ellipse(x, y_soma, 4, 5, fill=color, color=S.shade(color, .3), width=0.6, lint=False)
    c.line(x, y_soma + 5, x, y_term - 3, color=S.shade(color, .2), width=1.4, lint=False)
    c.polygon([(x - 4, y_term - 3), (x + 4, y_term - 3), (x + 3, y_term + 2), (x - 3, y_term + 2)],
              fill=S.shade(color, .2), color="none", lint=False)  # pedicle


def retina_layers(c, x0, y0, w, h, n_cones=4, rods_per_cone=2, light_from="bottom", pathway=True):
    """Schematic retinal circuit in a box. Photoreceptors at the top (outer
    retina), ganglion cells at the bottom; light comes from the bottom
    (through the ganglion cell layer), as in the real retina.
    Returns anchors with the layer bands (y ranges), cell positions and the
    x of the right edge for layer labels."""
    A = {"layers": {}}
    # vertical layout (fractions of h)
    L = dict(OS=(0.00, 0.20), ONL=(0.20, 0.38), OPL=(0.38, 0.46), INL=(0.46, 0.64),
             IPL=(0.64, 0.74), GCL=(0.74, 0.86), NFL=(0.86, 0.94))
    for k, (a, b) in L.items():
        A["layers"][k] = (y0 + a * h, y0 + b * h)
    shades = {"OPL": "#f5f1ee", "IPL": "#f5f1ee", "NFL": "#f2f2f2"}
    for k, (a, b) in A["layers"].items():
        if k in shades:
            c.rect(x0, a, w, b - a, fill=shades[k], color="none", lint=False)
    # pigment epithelium on top
    c.rect(x0, y0 - 10, w, 10, fill="#8a7064", color="none", lint=False)
    A["rpe"] = (x0 + w / 2, y0 - 5)
    ROD, CONE = S.tint(S.INK2, .55), S.tint(S.VERMILION, .75)
    BIP, GC = S.tint(S.BLUE, .7), S.tint(S.GREEN, .7)
    LAT = S.tint(S.PURPLE, .65)
    n = n_cones * (rods_per_cone + 1)
    xs = [x0 + w * (i + 0.5) / n for i in range(n)]
    yOS = A["layers"]["OS"][0] + 4
    y_soma = sum(A["layers"]["ONL"]) / 2
    y_term = A["layers"]["OPL"][0] + 4
    cones, rods = [], []
    for i, x in enumerate(xs):
        if i % (rods_per_cone + 1) == 1:
            _cone(c, x, yOS + 6, y_soma + 4, y_term, CONE); cones.append(x)
        else:
            _rod(c, x, yOS, y_soma - 4, y_term, ROD); rods.append(x)
    A["cones"], A["rods"] = cones, rods
    # horizontal cell (lateral, in the OPL / outer INL)
    yH = A["layers"]["INL"][0] + 8
    hx = x0 + w * 0.3
    c.ellipse(hx, yH, 7, 4.5, fill=LAT, color=S.shade(LAT, .3), width=0.6, lint=False)
    c.line(x0 + w * 0.08, y_term + 3, x0 + w * 0.62, y_term + 3, color=S.shade(LAT, .15), width=1.3,
           lint=False)
    c.line(hx, yH - 4, hx, y_term + 3, color=S.shade(LAT, .15), width=1.3, lint=False)
    A["horizontal"] = (hx, yH)
    # bipolar cells under each cone, plus one rod bipolar
    yB = sum(A["layers"]["INL"]) / 2 + 4
    yIPL = sum(A["layers"]["IPL"]) / 2
    bips = []
    for x in cones:
        c.line(x, y_term + 3, x, yB - 6, color=S.shade(BIP, .2), width=1.6, lint=False)
        c.ellipse(x, yB, 4.5, 6.5, fill=BIP, color=S.shade(BIP, .3), width=0.6, lint=False)
        c.line(x, yB + 6, x, yIPL, color=S.shade(BIP, .2), width=1.6, lint=False)
        c.circle(x, yIPL, 2.4, fill=S.shade(BIP, .2), color="none", lint=False)
        bips.append((x, yB))
    A["bipolar"] = bips
    # amacrine cell (lateral, inner INL / IPL)
    yA = A["layers"]["INL"][1] - 6
    ax_ = x0 + w * 0.72
    c.ellipse(ax_, yA, 6, 4.5, fill=LAT, color=S.shade(LAT, .3), width=0.6, lint=False)
    c.line(x0 + w * 0.45, yIPL + 3, x0 + w * 0.95, yIPL + 3, color=S.shade(LAT, .15), width=1.3,
           lint=False)
    c.line(ax_, yA + 4, ax_, yIPL + 3, color=S.shade(LAT, .15), width=1.3, lint=False)
    A["amacrine"] = (ax_, yA)
    # ganglion cells under pairs of bipolars, axons into the nerve fibre layer
    yG = sum(A["layers"]["GCL"]) / 2
    yN = sum(A["layers"]["NFL"]) / 2
    gcs = []
    for j in range(0, len(cones), 2):
        grp = cones[j:j + 2]
        gx = sum(grp) / len(grp)
        for x in grp:
            c.line(x, yIPL, gx, yG - 7, color=S.shade(GC, .2), width=1.5, lint=False)
        c.circle(gx, yG, 7.5, fill=GC, color=S.shade(GC, .3), width=0.7, lint=False)
        c.line(gx, yG + 7, gx + 8, yN, color=S.shade(GC, .2), width=1.8, lint=False)
        gcs.append((gx, yG))
    c.line(x0 + 6, yN, x0 + w - 4, yN, color=S.shade(GC, .2), width=1.8, lint=False)
    A["ganglion"] = gcs
    A["nerve_fibres"] = (x0 + w - 20, yN)
    A["colors"] = dict(rod=ROD, cone=CONE, bipolar=BIP, ganglion=GC, lateral=LAT)
    A["box"] = (x0, y0, w, h)
    return A


# ------------------------------------------------------------------ cochlea
def travelling_wave(x, cf_pos, width=0.08):
    """Envelope of the basilar-membrane travelling wave for a tone whose
    characteristic place is cf_pos (0 = base, 1 = apex): grows slowly from
    the base, peaks at cf_pos, then dies quickly (schematic)."""
    x = np.asarray(x, float)
    rise = np.exp((x - cf_pos) / (cf_pos + 0.15) * 2.2)
    fall = np.exp(-((x - cf_pos) / width) ** 2)
    env = np.where(x <= cf_pos, rise, fall)
    return env / env.max()


def place_to_freq(x, fmin=20.0, fmax=20000.0):
    """Greenwood-like log map: base (x = 0) = fmax, apex (x = 1) = fmin."""
    return fmax * (fmin / fmax) ** np.asarray(x)


def cochlea_unrolled(c, x0, y0, w, h, tones=((0.18, S.BLUE), (0.62, S.VERMILION)), labels=True):
    """The cochlea uncoiled: base (oval window, stapes) at the left, apex
    (helicotrema) at the right. The basilar membrane widens toward the apex.
    Each tone (characteristic place 0..1, colour) draws its travelling-wave
    envelope. Returns anchors: base, apex, bm(x) mapper, peak points."""
    A = {}
    taper = 0.35
    top = [(x0 + w * t, y0 + h * taper * t * 0.5) for t in np.linspace(0, 1, 30)]
    bot = [(x0 + w * t, y0 + h - h * taper * t * 0.5) for t in np.linspace(0, 1, 30)]
    c.polygon(top + bot[::-1], fill=FLUID, color=TISSUE_EDGE, width=1.0, lint=False, tag="duct")
    ym = y0 + h / 2
    # basilar membrane: narrow at base, wide at apex (drawn as a band)
    bw0, bw1 = 3, 16
    bm_top = [(x0 + w * t, ym - (bw0 + (bw1 - bw0) * t) / 2) for t in np.linspace(0, 1, 40)]
    bm_bot = [(x0 + w * t, ym + (bw0 + (bw1 - bw0) * t) / 2) for t in np.linspace(0, 1, 40)]
    c.polygon(bm_top + bm_bot[::-1], fill=S.tint(S.INK2, .3), color="none", lint=False, tag="bm")
    # oval and round window at the base
    c.ellipse(x0, y0 + h * 0.25, 4, h * 0.12, fill="#ffffff", color=S.INK2, width=1.2, lint=False)
    c.ellipse(x0, y0 + h * 0.75, 4, h * 0.10, fill="#ffffff", color=S.INK2, width=1.2, lint=False,
              dash="3 2")
    A.update(base=(x0, ym), apex=(x0 + w, ym), oval=(x0, y0 + h * 0.25), round=(x0, y0 + h * 0.75))
    xs = np.linspace(0, 1, 300)
    A["peaks"] = []
    for pos, col in tones:
        env = travelling_wave(xs, pos)
        amp = h * 0.32
        up = [(x0 + w * t, ym - amp * e) for t, e in zip(xs, env)]
        dn = [(x0 + w * t, ym + amp * e) for t, e in zip(xs, env)]
        c.polygon(up + dn[::-1], fill=S.tint(col, .25), color="none", lint=False, tag="wave")
        c.polyline(up, color=col, width=1.6, lint=False); c.polyline(dn, color=col, width=1.6, lint=False)
        # instantaneous wave inside the envelope
        k = 1 / (0.012 + 0.05 * xs)
        inst = [(x0 + w * t, ym - amp * e * math.sin(2 * math.pi * np.trapezoid(k[:i + 1], xs[:i + 1]) if i else 0))
                for i, (t, e) in enumerate(zip(xs, env))]
        c.polyline(inst, color=S.shade(col, .2), width=0.9, lint=False)
        A["peaks"].append((x0 + w * pos, ym - amp))
    A["bm"] = lambda t: (x0 + w * t, ym)
    A["box"] = (x0, y0, w, h)
    return A


def cochlea_spiral(c, cx, cy, r0=16, r1=95, turns=2.6, freqs=(20000, 8000, 4000, 2000, 1000, 500, 200),
                   color=None, width=14):
    """Top view of the cochlear spiral (base outside, apex in the centre)
    with tick marks at given frequencies (log place map). Returns anchors:
    base, apex, at(freq) -> point."""
    color = color or S.tint(S.BLUE, .35)
    t = np.linspace(0, 1, 400)
    ang = 2 * np.pi * turns * t
    r = r1 * (r0 / r1) ** t
    pts = [(cx + rr * math.cos(a), cy - rr * math.sin(a)) for rr, a in zip(r, ang)]
    # widen toward the apex? (the duct narrows; draw as a tapered stroke by chunks)
    for i in range(0, len(pts) - 1, 8):
        seg = pts[i:i + 9]
        wv = width * (1 - 0.45 * t[i])
        c.polyline(seg, color=color, width=wv, lint=False, tag="cochlea")
    c.polyline(pts, color=S.shade(color, .35), width=1.0, lint=False)

    def place(f):
        x = math.log(20000 / f) / math.log(20000 / 20)
        i = min(len(t) - 1, int(x * (len(t) - 1)))
        return pts[i], ang[i], r[i]
    A = dict(base=pts[0], apex=pts[-1], at=lambda f: place(f)[0], ticks=[])
    for f in freqs:
        p, a, rr = place(f)
        ox, oy = math.cos(a), -math.sin(a)
        q = (p[0] + ox * (width * 0.55 + 4), p[1] + oy * (width * 0.55 + 4))
        c.line(p[0] + ox * width * 0.3, p[1] + oy * width * 0.3, q[0], q[1], color=S.INK2, width=1,
               lint=False)
        A["ticks"].append((f, q, (ox, oy)))
    return A
