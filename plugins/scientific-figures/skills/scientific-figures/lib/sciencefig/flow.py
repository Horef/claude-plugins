"""Flow diagrams: pipelines, hierarchies, state/decision graphs.

Two tools:
  * pipeline(...)  - a straight chain of boxes on a Canvas (measured, aligned,
                     labelled arrows). Use for <= 6 stages in a line.
  * graphviz(...)  - automatic layout with Graphviz `dot` for branching or
                     many-node graphs, restyled to the house style and
                     returned as inline-safe SVG.
"""
import re
import subprocess

from . import style as S
from .svg import Canvas, measure


def pipeline(c, x, y, stages, gap=34, fill=None, color=S.INK2, arrow_labels=None,
             emphasis=None, size=S.SIZE, small=S.SIZE_SMALL, equal_width=True,
             max_width=None):
    """Draw boxes left->right starting at (x, y) (top-left).
    stages: list of (title, [detail lines]).
    arrow_labels: optional list (len = n-1) of short verbs for the arrows.
    emphasis: index of the stage to highlight (accent outline + tint).
    Returns list of box dicts. Raises if it would not fit in max_width."""
    widths = []
    for t, lines in stages:
        w = max([measure(t, size, True)[0]] + [measure(s, small)[0] for s in lines]) + 20
        widths.append(w)
    if arrow_labels:
        need = [measure(a, small)[0] + 12 for a in arrow_labels]
        gap = max([gap] + need)
    if equal_width:
        widths = [max(widths)] * len(widths)
    heights = []
    for t, lines in stages:
        heights.append(20 + size + (4 if lines else 0) + len(lines) * small * 1.3)
    h = max(heights)
    total = sum(widths) + gap * (len(stages) - 1)
    if max_width and total > max_width:
        raise ValueError(f"pipeline needs {total:.0f}px > {max_width}px: shorten text, "
                         "reduce stages, or stack in two rows")
    boxes = []
    cx = x
    for i, ((t, lines), w) in enumerate(zip(stages, widths)):
        em = emphasis == i
        b = c.box(cx, y, w, h, title=t, lines=lines,
                  fill=S.tint(S.ACCENT, 0.12) if em else (fill or "#fff"),
                  color=S.ACCENT if em else color, width=1.6 if em else S.LW_STRUCT)
        boxes.append(b)
        cx += w + gap
    for i in range(len(boxes) - 1):
        a, b = boxes[i], boxes[i + 1]
        c.arrow(a["r"][0] + 2, a["r"][1], b["l"][0] - 2, b["l"][1], color=S.INK, width=1.4,
                label=arrow_labels[i] if arrow_labels else None)
    return boxes


# ------------------------------------------------------------------ graphviz
DOT_HEADER = """digraph G {{
  graph [rankdir={rankdir}, bgcolor="white", pad="0.15", nodesep="{nodesep}", ranksep="{ranksep}",
         fontname="Helvetica", splines="{splines}"];
  node  [shape=box, style="rounded,filled", fillcolor="white", color="{edge}", penwidth=1.2,
         fontname="Helvetica", fontsize={size}, fontcolor="{ink}", margin="0.14,0.07", height=0.3];
  edge  [color="{ink}", penwidth=1.2, arrowsize=0.7, fontname="Helvetica",
         fontsize={small}, fontcolor="{ink2}"];
"""


def graphviz(body, name="flow", rankdir="LR", nodesep=0.35, ranksep=0.45, splines="spline",
             width=None):
    """Lay out a graph with Graphviz and return inline SVG in house style.

    body: DOT statements, e.g.
        'stim [label="Stimulus"]; tr [label="Transduction"]; stim -> tr [label="energy"];'
    Emphasis: add  [color="#0072B2", fillcolor="#e5f1f7", penwidth=1.8]  to one node.
    Inhibitory edge: [arrowhead=dot]; excitatory: default triangle; feedback: [style=dashed].
    width: optional display width in px (default = natural size)."""
    src = DOT_HEADER.format(rankdir=rankdir, nodesep=nodesep, ranksep=ranksep, splines=splines,
                            edge=S.INK2, ink=S.INK, ink2=S.INK2, size=S.SIZE, small=S.SIZE_SMALL)
    src += body + "\n}\n"
    r = subprocess.run(["dot", "-Tsvg"], input=src, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    s = r.stdout
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<title>.*?</title>", "", s, flags=re.S)
    s = s.replace('font-family="Helvetica,sans-Serif"', f'font-family="{S.FONT_STACK}"')
    s = s.replace('font-family="Helvetica"', f'font-family="{S.FONT_STACK}"')
    s = s.replace('fill="white"', 'fill="#ffffff"').replace('stroke="transparent"', 'stroke="none"')
    ids = set(re.findall(r'id="([^"]+)"', s))
    for i in ids:
        s = s.replace(f'id="{i}"', f'id="{name}-{i}"')
    m = re.search(r"<svg[^>]*>", s)
    vb = re.search(r'viewBox="([^"]+)"', m.group(0)).group(1)
    w = float(vb.split()[2])
    disp = width or round(w)   # 1 graphviz pt = 1 px, so fontsize 13 = 13 px like other figures
    root = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{disp}" '
            f'style="max-width:100%;height:auto" role="img">'
            f'<rect x="{vb.split()[0]}" y="{vb.split()[1]}" width="100%" height="100%" fill="#ffffff"/>')
    s = s.replace(m.group(0), root, 1)
    s = re.sub(r">\s+<", "><", s)
    s = re.sub(r"\s+", " ", s).strip()
    from .check import hex_to_rgb
    return hex_to_rgb(s), src
