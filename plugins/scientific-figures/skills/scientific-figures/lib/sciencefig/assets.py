"""Reuse existing SVG illustrations (Servier Medical Art, Bioicons, SciDraw,
your own drawings) inside a Canvas figure, restyled to the house style.

    from sciencefig import assets as A
    brain = A.place(c, A.lib("brain_lateral"), box=(20, 20, 300, 220), recolor="gray")
    p = brain["at"](0.82, 0.55)          # point at 82% width, 55% height of the drawing
    c.callout(400, 60, p, "Primary visual cortex")
    caption += " " + A.credits(c)       # "Brain outline: Servier Medical Art (CC BY 3.0)."

Licences: CC0 needs nothing; CC BY needs a credit line in the caption (the
library collects it for you); never use NC material in a paper you sell.
Recolouring is a permitted adaptation under CC BY - say "adapted from".
"""
import colorsys
import os
import re
import xml.etree.ElementTree as ET

from . import style as S

ASSET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

# name -> (relative file, credit)
CATALOG = {
    "brain_lateral": ("servier/brain-1.svg", "Servier Medical Art (CC BY 3.0)"),
    "brain_lateral_color": ("servier/brain-2.svg", "Servier Medical Art (CC BY 3.0)"),
    "eye_section": ("servier/eye-crosssection.svg", "Servier Medical Art (CC BY 3.0)"),
    "retina_cells": ("servier/retina-cell.svg", "Servier Medical Art (CC BY 3.0)"),
    "ear": ("servier/ear.svg", "Servier Medical Art (CC BY 3.0)"),
    "organ_of_corti": ("servier/corti-organ.svg", "Servier Medical Art (CC BY 3.0)"),
    "brain_horizontal": ("dbcls/Horizontal_plane_of_the_brain.svg", "DBCLS TogoTV (CC BY 4.0)"),
    "ear_structure": ("dbcls/Ear_structure.svg", "DBCLS TogoTV (CC BY 4.0)"),
}

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def lib(name):
    """Path of a catalogued asset."""
    return os.path.join(ASSET_DIR, CATALOG[name][0])


# ---------------------------------------------------------------- colours
def _hex(c):
    c = c.strip()
    if c.startswith("#") and len(c) == 4:
        c = "#" + "".join(ch * 2 for ch in c[1:])
    m = re.match(r"rgb\((\d+),\s*(\d+),\s*(\d+)\)", c)
    if m:
        return "#{:02x}{:02x}{:02x}".format(*map(int, m.groups()))
    return c.lower() if re.match(r"#[0-9a-fA-F]{6}$", c) else None


def _lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def gray_map(lo=0.35, hi=0.97):
    """Luminance-preserving gray: keeps the shading, removes the colour, so
    the drawing becomes quiet context and your overlays carry the colour."""
    def f(h):
        L = lo + (hi - lo) * _lum(h)
        v = round(255 * L)
        return "#{:02x}{:02x}{:02x}".format(v, v, v)
    return f


def tint_map(hue, lo=0.3, hi=0.97):
    """Map luminance onto a light-to-dark ramp of one hue."""
    r0, g0, b0 = (int(hue[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h_, l_, s_ = colorsys.rgb_to_hls(r0, g0, b0)

    def f(h):
        L = lo + (hi - lo) * _lum(h)
        r, g, b = colorsys.hls_to_rgb(h_, L, s_ * 0.6)
        return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))
    return f


# ---------------------------------------------------------------- placing
def _inline_styles(root):
    """Move simple CSS class rules from <style> into attributes."""
    rules = {}
    for st in list(root.iter(f"{{{SVG_NS}}}style")):
        for sel, body in re.findall(r"([^{}]+)\{([^}]*)\}", st.text or ""):
            for cls in re.findall(r"\.([\w-]+)", sel):
                for decl in body.split(";"):
                    if ":" in decl:
                        k, v = decl.split(":", 1)
                        rules.setdefault(cls, {})[k.strip()] = v.strip()
    for el in root.iter():
        for cls in (el.get("class") or "").split():
            for k, v in rules.get(cls, {}).items():
                el.set(k, v)
        if "class" in el.attrib:
            del el.attrib["class"]
        st = el.get("style")
        if st:
            for decl in st.split(";"):
                if ":" in decl:
                    k, v = decl.split(":", 1)
                    el.set(k.strip(), v.strip())
            del el.attrib["style"]
    for parent in root.iter():
        for ch in list(parent):
            if ch.tag in (f"{{{SVG_NS}}}style", f"{{{SVG_NS}}}metadata", f"{{{SVG_NS}}}title",
                          "{http://www.w3.org/2000/svg}desc") or not ch.tag.startswith(f"{{{SVG_NS}}}"):
                parent.remove(ch)


def place(c, path, box, recolor=None, credit=None, opacity=None, flip=False, name=None):
    """Insert the SVG file at `path` into Canvas `c`, fitted into box
    (x, y, w, h), centred, aspect kept.

    recolor: None | 'gray' | ('tint', hue) | callable(hex)->hex | dict{hex: hex}.
    Returns dict(box=(x, y, w, h) actually used, at(fx, fy) -> canvas point
    for fractional coordinates of the drawing, map(u, v) for its own units)."""
    tree = ET.parse(path)
    root = tree.getroot()
    vb = root.get("viewBox")
    if vb:
        vx, vy, vw, vh = map(float, re.split(r"[ ,]+", vb.strip()))
    else:
        vx, vy = 0.0, 0.0
        vw = float(re.sub(r"[a-z]+", "", root.get("width")))
        vh = float(re.sub(r"[a-z]+", "", root.get("height")))
    _inline_styles(root)
    # recolour
    if recolor == "gray":
        fmap = gray_map()
    elif isinstance(recolor, tuple) and recolor[0] == "tint":
        fmap = tint_map(recolor[1])
    elif isinstance(recolor, dict):
        fmap = lambda h: recolor.get(h, h)
    else:
        fmap = recolor
    if fmap:
        for el in root.iter():
            for attr in ("fill", "stroke", "stop-color"):
                v = el.get(attr)
                h = _hex(v) if v else None
                if h:
                    el.set(attr, fmap(h))
    # unique ids
    pre = c.uid("asset") + "-"
    for el in root.iter():
        if el.get("id"):
            el.set("id", pre + el.get("id"))
    body = "".join(ET.tostring(ch, encoding="unicode") for ch in root)
    body = re.sub(r'url\(#([^)]+)\)', lambda m: f"url(#{pre}{m.group(1)})", body)
    body = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{pre}{m.group(1)}"', body)
    body = re.sub(r"\s*xmlns(:\w+)?=\"[^\"]+\"", "", body)
    body = re.sub(r"\bns\d+:", "", body)
    bx, by, bw, bh = box
    s = min(bw / vw, bh / vh)
    ox = bx + (bw - vw * s) / 2 - vx * s
    oy = by + (bh - vh * s) / 2 - vy * s
    if flip:
        tr = f"translate({ox + (vx * 2 + vw) * s:.2f} {oy:.2f}) scale({-s:.5f} {s:.5f})"
    else:
        tr = f"translate({ox:.2f} {oy:.2f}) scale({s:.5f})"
    op = f' opacity="{opacity}"' if opacity is not None else ""
    c.items.append(f'<g transform="{tr}"{op}>{body}</g>')
    used = (bx + (bw - vw * s) / 2, by + (bh - vh * s) / 2, vw * s, vh * s)
    if not hasattr(c, "credits"):
        c.credits = []
    cred = credit
    if cred is None:
        for nm, (rel, cr) in CATALOG.items():
            if os.path.abspath(path).endswith(rel):
                cred = (name or nm.replace("_", " ")) + ": " + cr
    if cred and cred not in c.credits:
        c.credits.append(cred)

    def mp(u, v):
        X = ox + u * s if not flip else ox + (vx * 2 + vw - u) * s
        return (X, oy + v * s)
    at = lambda fx, fy: (used[0] + fx * used[2], used[1] + fy * used[3])
    return dict(box=used, at=at, map=mp, scale=s)


def credits(c, adapted=True):
    """Caption credit line for all assets placed on the canvas."""
    cr = getattr(c, "credits", [])
    if not cr:
        return ""
    return ("Adapted from " if adapted else "") + "; ".join(cr) + "."
