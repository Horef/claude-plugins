"""Network and architecture diagrams on a Canvas: layers of nodes,
dense connections, vectors as stacked cells, encoder/decoder funnels.

    from sciencefig import nets as Nt
    col = Nt.vector(c, x, y, n=8, label="$\\mathbf{x}$")   # tall vector
    f = Nt.funnel(c, x, cy, w=60, h_in=120, h_out=40, label="E")
    Nt.link(c, col["r"], f["l"])
Every helper returns anchors (l, r, t, b, cx, cy) for arrows.
"""
from . import style as S


def _anchors(x, y, w, h):
    return dict(x=x, y=y, w=w, h=h, cx=x + w / 2, cy=y + h / 2, l=(x, y + h / 2),
                r=(x + w, y + h / 2), t=(x + w / 2, y), b=(x + w / 2, y + h))


def vector(c, x, cy, n=6, cell=13, width=16, fill=None, color=S.INK2, label=None,
           label_pos="below", math=None, size=S.SIZE):
    """A vector drawn as a column of n cells, vertically centred on cy."""
    fill = fill or S.tint(S.BLUE, 0.25)
    h = n * cell
    y = cy - h / 2
    for k in range(n):
        c.rect(x, y + k * cell, width, cell, fill=fill, color=color, width=0.9, tag="vector",
               lint=False)
    c.rect(x, y, width, h, fill="none", color=color, width=1.2, tag="vector")
    a = _anchors(x, y, width, h)
    if label or math:
        ly = y + h + 6 if label_pos == "below" else y - 6
        bl = "hanging" if label_pos == "below" else "alphabetic"
        if math:
            c.math(x + width / 2, ly, math, size=size + 2, anchor="middle", baseline=bl)
        else:
            c.text(x + width / 2, ly, label, size=size, anchor="middle", baseline=bl)
    return a


def funnel(c, x, cy, w, h_in, h_out, label=None, fill=None, color=S.INK2, size=S.SIZE + 2,
           math=None):
    """Trapezoid block: left edge h_in tall, right edge h_out tall. Narrowing
    = encoder (compresses), widening = decoder/generator."""
    fill = fill or S.FAINT
    pts = [(x, cy - h_in / 2), (x + w, cy - h_out / 2), (x + w, cy + h_out / 2), (x, cy + h_in / 2)]
    c.polygon(pts, fill=fill, color=color, width=1.3, tag="funnel")
    if math:
        c.math(x + w / 2, cy, math, size=size, anchor="middle", baseline="middle")
    elif label:
        c.text(x + w / 2, cy, label, size=size, anchor="middle", baseline="middle", bold=True)
    a = _anchors(x, cy - max(h_in, h_out) / 2, w, max(h_in, h_out))
    a["l"], a["r"] = (x, cy), (x + w, cy)
    return a


def link(c, p, q, color=S.INK2, width=1.4, gap=4, label=None, **kw):
    """Arrow between two anchors with a small gap at both ends."""
    return c.arrow(p[0], p[1], q[0], q[1], color=color, width=width, shrink=gap, label=label, **kw)


def layer(c, x, ys, r=16, labels=None, fill="#fff", color=S.INK2, size=15):
    """A column of round nodes. ys may contain None for a vertical ellipsis."""
    nodes = []
    for k, y in enumerate(ys):
        if y is None:
            continue
        c.circle(x, y, r, fill=fill, color=color, width=1.3, tag="node")
        if labels and labels[k]:
            c.text(x, y, labels[k], size=size, anchor="middle", baseline="middle", lint=False)
        nodes.append(dict(x=x, y=y, r=r, kind="round", top=(x, y - r), bottom=(x, y + r),
                          left=(x - r, y), right=(x + r, y)))
    return nodes


def vdots(c, x, y, color=S.INK2, gap=9, r=2.4):
    for d in (-gap, 0, gap):
        c.circle(x, y + d, r, fill=color, color="none", lint=False)
