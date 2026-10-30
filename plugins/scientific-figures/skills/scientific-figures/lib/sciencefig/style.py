"""House style for Sergiy's study-note figures.

One place for every visual decision, so all figures (hand SVG, matplotlib,
Graphviz) share one visual language (Wilke ch. 21, "consistent visual language").

Sources of the rules: Rougier et al. "Ten simple rules" (2014), Rougier
"Scientific Visualization" (2021), Wilke "Fundamentals of Data Visualization"
(2019), Tufte "Visual Display of Quantitative Information" (2001), and the
built-in dataviz skill (palette validation).
"""

# ---------------------------------------------------------------- fonts
# DEVONthink renders with the Mac's Helvetica. In the cloud workspace
# "Helvetica" resolves to TeX Gyre Heros (same metrics), so measured text
# widths match what Sergiy sees.
FONT_STACK = "Helvetica, Arial, sans-serif"
FONT_MEASURE = ["Helvetica", "Helvetica Neue", "TeX Gyre Heros", "Arial",
                "Liberation Sans", "DejaVu Sans"]


def measure_family():
    """First installed font of FONT_MEASURE (Helvetica on the Mac,
    TeX Gyre Heros in the cloud). Cached."""
    global _MF
    try:
        return _MF
    except NameError:
        pass
    from matplotlib import font_manager
    names = {f.name for f in font_manager.fontManager.ttflist}
    _MF = next((n for n in FONT_MEASURE if n in names), "DejaVu Sans")
    return _MF

# Font sizes in SVG user units (= CSS px when the figure is shown at its
# design width). Never below SIZE_MIN (Wilke ch. 24: labels are almost
# always too small).
SIZE = 13          # default label / axis title
SIZE_SMALL = 11.5  # tick labels, secondary annotations
SIZE_MIN = 11
SIZE_PANEL = 13    # panel letters (bold, lowercase, quiet - Wilke ch. 21)

# ---------------------------------------------------------------- widths
# Design widths in px. Content is drawn in a viewBox of this width and
# scales with max-width:100%. Prefer wider-than-tall, ~1.5:1 (Tufte ch. 9).
WIDTH_FULL = 640
WIDTH_MEDIUM = 520
WIDTH_SMALL = 400

# ---------------------------------------------------------------- ink
BG = "#ffffff"
INK = "#1f1f1f"        # primary text, key outlines
INK2 = "#555555"       # secondary text, annotations
MUTED = "#8a8a8a"      # de-emphasised data (context series), axis titles if needed
AXIS = "#444444"       # axis lines, ticks
GRID = "#e6e6e6"       # hairline grid / reference lines
FAINT = "#f2f2f2"      # background bands, facet panels

# ---------------------------------------------------------------- line weights
# Data heavier than structure (Tufte ch. 9: orthogonal lines of different
# weight; heavier = data).
LW_DATA = 2.0
LW_HIGHLIGHT = 2.6
LW_STRUCT = 1.2        # boxes, cell outlines, axes
LW_HAIR = 0.8          # grids, guides, leader lines

# ---------------------------------------------------------------- categorical palette
# Okabe-Ito hues in an order that passes the dataviz validator on white:
# adjacent CVD dE >= 11, normal-vision >= 21; first THREE pass all-pairs.
# Orange is < 3:1 on white -> only with direct labels / never for thin text.
BLUE = "#0072B2"
VERMILION = "#D55E00"
GREEN = "#009E73"
ORANGE = "#E69F00"
PURPLE = "#CC79A7"
SKY = "#56B4E9"
CATEGORICAL = [BLUE, VERMILION, GREEN, ORANGE, PURPLE]


def tint(hex_color, amount=0.15):
    """Light fill of a hue: mix `amount` of the colour with white.
    Use for filled areas; the full-strength hue is for strokes/marks
    (Wilke ch. 20: light fill + dark outline of the same hue)."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    mix = lambda c: round(255 - (255 - c) * amount)
    return "#{:02x}{:02x}{:02x}".format(mix(r), mix(g), mix(b))


def shade(hex_color, amount=0.25):
    """Darker version of a hue (for text that must carry the hue)."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    f = lambda c: round(c * (1 - amount))
    return "#{:02x}{:02x}{:02x}".format(f(r), f(g), f(b))


# ---------------------------------------------------------------- semantic roles
# Neuroscience conventions. Colour is never the only code: excitatory
# synapses are triangles/arrowheads, inhibitory ones are filled circles or
# T-bars (redundant coding, Wilke ch. 20).
EXC = BLUE            # excitatory neurons/synapses
INH = VERMILION       # inhibitory neurons/synapses
MOD = PURPLE          # modulatory
STIM = INK            # stimulus traces (black, like a physical signal)
ACCENT = BLUE         # the one thing the figure is about
ACCENT2 = VERMILION   # a second, contrasting thing
CONTEXT = MUTED       # everything else (emphasis form: highlight one, gray the rest)
UNIT1 = GREEN         # identity of unit/population 1 of a symmetric pair (rivalry,
UNIT2 = PURPLE        #   mutual inhibition): NOT E/I, so not blue/vermilion
CELL = "#4f5d6b"      # neutral slate for neuron morphology (cells as context)
CELL_LIGHT = "#9aa5b1"  # de-emphasised cells

# ---------------------------------------------------------------- colour names and meanings
# hex -> plain word, so labels and captions say what the drawn colour is
# ("the vermilion curve", not "the red curve").
COLOR_NAMES = {
    BLUE.lower(): "blue",
    VERMILION.lower(): "vermilion",
    GREEN.lower(): "bluish green",
    ORANGE.lower(): "orange",
    PURPLE.lower(): "reddish purple",
    SKY.lower(): "sky blue",
    CELL.lower(): "slate",
    CELL_LIGHT.lower(): "light slate",
    INK.lower(): "ink (near-black)",
    INK2.lower(): "dark gray",
    MUTED.lower(): "gray",
    GRID.lower(): "light gray",
    FAINT.lower(): "very light gray",
    BG.lower(): "white",
}
# Okabe-Ito yellow is not a house constant but is a name authors will meet
COLOR_NAMES.setdefault("#f0e442", "yellow")


def _norm_hex(color):
    """'#RGB', '#RRGGBB', 'rgb(r,g,b)', a matplotlib colour or an RGB tuple
    -> lowercase '#rrggbb'."""
    if isinstance(color, str):
        c = color.strip().lower()
        if c.startswith("rgb(") and c.endswith(")"):
            r, g, b = (int(float(v)) for v in c[4:-1].split(","))
            return "#{:02x}{:02x}{:02x}".format(r, g, b)
        if c.startswith("#") and len(c) == 4:
            return "#" + "".join(ch * 2 for ch in c[1:])
        if c.startswith("#") and len(c) == 7:
            return c
    from matplotlib.colors import to_hex
    return to_hex(color).lower()


def name_of(color):
    """Plain name of a house colour (hex, rgb(...) or matplotlib colour), e.g.
    name_of(S.GREEN) -> 'bluish green'. Raises KeyError for a colour that has
    no name in COLOR_NAMES, so a caption never uses a word that does not match
    the drawn colour."""
    h = _norm_hex(color)
    try:
        return COLOR_NAMES[h]
    except KeyError:
        raise KeyError(f"{color!r} ({h}) has no name in COLOR_NAMES; "
                       "add it there or use a house colour") from None


class ColorKey:
    """One hue = one meaning across a document: build once, use everywhere.

        key = ColorKey({"wiring": BLUE, "encoder": (VERMILION, "o", "--")})
        key.add("decoder", GREEN, marker="s")
        ax.plot(x, y, **key.style("encoder"))      # color, marker, linestyle
        key["wiring"]                              # the colour
        for name, st in key.items(): ...           # draw a key / legend

    A second meaning given a colour already used raises ValueError, and so
    does giving one meaning two different colours."""

    def __init__(self, meanings=None):
        self._d = {}
        for name, v in (meanings or {}).items():
            if isinstance(v, dict):
                self.add(name, **v)
            elif isinstance(v, (tuple, list)) and v and isinstance(v[0], str) and len(v) <= 3:
                self.add(name, *v)
            else:
                self.add(name, v)

    def add(self, name, color, marker=None, linestyle=None):
        """Define a meaning; returns its colour."""
        h = _norm_hex(color)
        for other, st in self._d.items():
            if st["color"] == h and other != name:
                raise ValueError(f"colour {h} ({COLOR_NAMES.get(h, 'unnamed')}) already means "
                                 f"{other!r}; cannot also mean {name!r} (one hue = one meaning)")
        if name in self._d and self._d[name]["color"] != h:
            raise ValueError(f"{name!r} already has colour {self._d[name]['color']}; "
                             f"cannot also be {h}")
        self._d[name] = {"color": h, "marker": marker, "linestyle": linestyle}
        return h

    def __setitem__(self, name, color):
        self.add(name, color)

    def __getitem__(self, name):
        try:
            return self._d[name]["color"]
        except KeyError:
            raise KeyError(f"no meaning {name!r} in this ColorKey; known: {list(self._d)}") from None

    def __contains__(self, name):
        return name in self._d

    def __len__(self):
        return len(self._d)

    def __iter__(self):
        return iter(self._d)

    def style(self, name, **override):
        """kwargs for a plot call: color, plus marker and linestyle if set."""
        self[name]
        st = {k: v for k, v in self._d[name].items() if v is not None}
        st.update(override)
        return st

    def items(self):
        """(name, style dict) pairs in definition order, for keys and legends."""
        return [(n, self.style(n)) for n in self._d]


# Sequential (magnitude) and diverging (polarity) ramps, matplotlib names.
CMAP_SEQ = "Blues"
CMAP_DIV = "RdBu_r"    # blue <-> red with light neutral midpoint
CMAP_PERCEPTUAL = "viridis"
