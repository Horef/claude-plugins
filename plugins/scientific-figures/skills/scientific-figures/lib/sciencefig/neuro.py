"""Neuroscience schematic components for Canvas (sciencefig.svg).

Conventions (Kandel-like, with redundant coding so colour is never the only
code):
  * excitatory synapse  = filled triangle terminal ("exc")
  * inhibitory synapse  = filled circle terminal   ("inh")  [or "bar" = T-bar]
  * cell shape: relay/projection neuron = star (multipolar) or pyramid;
    local interneuron = small circle; sensory neuron = circle on its axon
  * activity (firing rate) = fill lightness of ONE hue (sequential ramp):
    pale = silent, saturated = most active  (activity_color)

Every function returns a small dict describing the drawn cell (centre,
radius, anchor points) so connections can be computed, never guessed.
"""
import math

from . import style as S


def activity_color(a, hue=S.BLUE, floor=0.10):
    """Map activity a in [0,1] to a fill on a one-hue sequential ramp."""
    a = max(0.0, min(1.0, a))
    return S.tint(hue, floor + (1 - floor) * a)


def _cell(x, y, r, kind):
    return dict(x=x, y=y, r=r, kind=kind,
                top=(x, y - r), bottom=(x, y + r), left=(x - r, y), right=(x + r, y))


def soma(c, x, y, r=11, kind="round", fill="#fff", color=S.INK, width=S.LW_STRUCT,
         label=None, label_pos="left", label_size=S.SIZE_SMALL, points=7):
    """Draw a cell body. kind: 'round' | 'star' | 'pyramid'."""
    if kind == "round":
        c.circle(x, y, r, fill=fill, color=color, width=width, tag="soma")
    elif kind == "star":
        pts = []
        for k in range(2 * points):
            rr = r * (1.0 if k % 2 == 0 else 0.62)
            a = -math.pi / 2 + k * math.pi / points
            pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
        c.polygon(pts, fill=fill, color=color, width=width, tag="soma")
    elif kind == "pyramid":
        h = r * 1.9
        pts = [(x, y - h * 0.62), (x + r * 0.95, y + h * 0.38), (x - r * 0.95, y + h * 0.38)]
        c.polygon(pts, fill=fill, color=color, width=width, tag="soma")
    cell = _cell(x, y, r, kind)
    if label:
        gap = r + 6
        if label_pos == "left":
            c.text(x - gap, y, label, size=label_size, anchor="end", baseline="middle", color=S.INK2)
        elif label_pos == "right":
            c.text(x + gap, y, label, size=label_size, baseline="middle", color=S.INK2)
        elif label_pos == "above":
            c.text(x, y - gap - 2, label, size=label_size, anchor="middle", color=S.INK2)
        else:
            c.text(x, y + gap + label_size * 0.8, label, size=label_size, anchor="middle", color=S.INK2)
    return cell


def edge_point(cell, toward, pad=1.5):
    """Point on the cell outline facing `toward` (x, y)."""
    dx, dy = toward[0] - cell["x"], toward[1] - cell["y"]
    d = math.hypot(dx, dy) or 1
    return (cell["x"] + dx / d * (cell["r"] + pad), cell["y"] + dy / d * (cell["r"] + pad))


def synapse_to(c, start, cell, kind="exc", color=S.INK, width=1.4, via=None, bend=0,
               halo=False, term_size=9, gap=2.5, dash=None):
    """Axon from `start` (x, y) to the outline of `cell`, ending in an
    excitatory triangle or inhibitory dot that touches the cell.
    via: optional list of corner points (orthogonal routing).
    halo: white under-stroke so the axon reads as passing OVER lines it crosses."""
    target = via[-1] if via else start
    tip = edge_point(cell, target, pad=gap)
    head = {"exc": "tri", "inh": "dot", "bar": "bar", None: None}[kind]
    pts = [start] + (via or []) + [tip]
    if halo:
        c.polyline(pts, color="#fff", width=width + 4, lint=False, tag="halo")
    if len(pts) == 2 and not bend:
        c.arrow(*start, *tip, color=color, width=width, head=head, head_size=term_size, tag="axon",
                dash=dash)
    elif len(pts) == 2:
        c.curved_arrow(start, tip, bend=bend, color=color, width=width, head=head, tag="axon",
                       dash=dash)
    else:
        c.elbow_arrow(pts, color=color, width=width, head=head, tag="axon", dash=dash)
    return tip


def connect(c, a, b, kind="exc", color=S.INK, width=1.4, bend=0, halo=False, term_size=9,
            dash=None, gap=2.5):
    """Cell-to-cell connection: leaves `a` toward `b`, ends on `b`."""
    start = edge_point(a, (b["x"], b["y"]), pad=0)
    return synapse_to(c, start, b, kind=kind, color=color, width=width, bend=bend, halo=halo,
                      term_size=term_size, dash=dash, gap=gap)


def skin(c, x0, x1, y, depth=26, waves=4, amp=4, fill="#f3e3d3", edge="#b08968",
         label="Skin", label_x=None):
    """Wavy skin band (epidermis) between x0..x1, top at y."""
    n = 80
    top = [(x0 + (x1 - x0) * k / n, y + amp * math.sin(2 * math.pi * waves * k / n)) for k in range(n + 1)]
    bot = [(px, py + depth) for px, py in top[::-1]]
    c.polygon(top + bot, fill=fill, color="none", lint=False, tag="skin")
    c.polyline(top, color=edge, width=1.4, lint=True, tag="skin")
    if label:
        c.text(label_x if label_x is not None else x0 - 8, y + depth / 2, label,
               size=S.SIZE_SMALL, anchor="end", baseline="middle", color=S.INK2)
    return top


def region(c, x, y, w, h, label=None, fill=S.FAINT, label_pos="left", rx=4):
    """A shaded anatomical compartment (nucleus, layer, area)."""
    c.rect(x, y, w, h, fill=fill, color="none", rx=rx, lint=False, tag="region")
    if label:
        if label_pos == "left":
            lines = label if isinstance(label, (list, tuple)) else [label]
            c.lines_of_text(x - 8, y + h / 2 - (len(lines) - 1) * 7 + 4, lines,
                            size=S.SIZE_SMALL, anchor="end", color=S.INK2)
        else:
            c.text(x + 8, y + 8, label, size=S.SIZE_SMALL, baseline="hanging", color=S.INK2)


def stimulus_arrow(c, x, y_from, y_to, label="Stimulus", color=S.INK):
    c.arrow(x, y_from, x, y_to, color=color, width=1.6, head="tri")
    c.text(x, y_from - 6, label, size=S.SIZE_SMALL, anchor="middle", color=S.INK2)


def spikes(c, x0, x1, y, times, height=14, color=S.INK, width=1.3, t_range=(0, 1),
           baseline=False):
    """Schematic spike train: ticks at `times` (in t_range) between x0..x1."""
    for t in times:
        x = x0 + (t - t_range[0]) / (t_range[1] - t_range[0]) * (x1 - x0)
        c.line(x, y - height, x, y, color=color, width=width, tag="spike", lint=False, cap="butt")
    if baseline:
        c.line(x0, y, x1, y, color=S.MUTED, width=S.LW_HAIR, lint=False, tag="spike-base")


def receptive_field(c, cx, cy, r, sign="+", fill_center=None, fill_surround=None):
    """Centre-surround receptive field: inner disc (centre) + annulus."""
    on = sign == "+"
    fc = fill_center or S.tint(S.BLUE if on else S.VERMILION, 0.35)
    fs = fill_surround or S.tint(S.VERMILION if on else S.BLUE, 0.25)
    c.circle(cx, cy, r, fill=fs, color=S.INK2, width=1.0, tag="rf")
    c.circle(cx, cy, r * 0.45, fill=fc, color=S.INK2, width=1.0, tag="rf")
    c.text(cx, cy, "+" if on else "−", size=S.SIZE, anchor="middle", baseline="middle", lint=False)
    c.text(cx + r * 0.72, cy, "−" if on else "+", size=S.SIZE, anchor="middle", baseline="middle", lint=False)
