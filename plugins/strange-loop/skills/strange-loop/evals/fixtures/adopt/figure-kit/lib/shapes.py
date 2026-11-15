"""SVG parts for neuron schematics."""
from neuro101_style import EXC, INH


def neuron(x, y, kind="exc"):
    return f'<circle cx="{x}" cy="{y}" r="8" fill="{EXC if kind == "exc" else INH}"/>'


def synapse(a, b):
    return f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="black"/>'


def svg(parts, w=200, h=100):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">' + "".join(parts) + "</svg>\n"
