"""svg-images-test: mcculloch_pitts_sigmoid_activation_surfaces.

Message: with a step activation the loss over the weights is a set of flat
plateaus separated by cliffs (zero gradient almost everywhere); a sigmoid
turns the same landscape into smooth slopes that gradient descent can follow."""
import sys
sys.path.insert(0, __file__.rsplit("/benchmark", 1)[0])
import numpy as np
from sciencefig.svg import Canvas, Area
from sciencefig import style as S, surf as Sf

# a small 2-input classification task (seeded, so the figure is reproducible)
rng = np.random.default_rng(3)
XA = rng.normal([0.8, 0.5], 0.9, (10, 2))       # overlapping classes -> the best
XB = rng.normal([-0.6, -0.6], 0.9, (10, 2))     # weights are finite (a valley)
DATA = np.vstack([XA, XB]); LAB = np.r_[np.ones(10), np.zeros(10)]
B = 0.0


def loss(W1, W2, f):
    u = W1[..., None] * DATA[:, 0] + W2[..., None] * DATA[:, 1] + B
    return np.mean((f(u) - LAB) ** 2, axis=-1)


step = lambda u: (u >= 0).astype(float)
sigm = lambda u: 1 / (1 + np.exp(-u))


def activation_panel(c, x0, title, kind):
    c.text(x0, 22, title, size=S.SIZE, bold=True)
    a = Area(c, x0 + 20, 48, 150, 92, xlim=(-4, 4), ylim=(-0.15, 1.25))
    # axes with arrows
    c.arrow(a.X(-4), a.Y(0), a.X(4), a.Y(0), color=S.AXIS, width=1.0, head_size=7, lint=False)
    c.arrow(a.X(0), a.Y(-0.15), a.X(0), a.Y(1.25), color=S.AXIS, width=1.0, head_size=7, lint=False)
    c.math(a.X(4) + 4, a.Y(0), "x", size=14, baseline="middle")
    c.math(a.X(0) + 6, a.Y(1.25) + 2, "f(x)", size=14, baseline="hanging")
    c.text(a.X(0) - 5, a.Y(1), "1", size=S.SIZE_SMALL, anchor="end", baseline="middle", color=S.INK2)
    c.line(a.X(-0.12), a.Y(1), a.X(0.12), a.Y(1), color=S.AXIS, width=1, lint=False)
    col = S.BLUE
    if kind == "step":
        a.line([-3.8, 0], [0, 0], color=col, width=2.4, lint=False)
        a.line([0, 3.8], [1, 1], color=col, width=2.4, lint=False)
        c.line(a.X(0), a.Y(0.06), a.X(0), a.Y(0.94), color=col, width=1, dash="2 2", lint=False)
        c.circle(a.X(0), a.Y(0), 3.2, fill="#fff", color=col, width=1.6, lint=False)
        c.circle(a.X(0), a.Y(1), 3.4, fill=col, color="none", lint=False)
        c.math(x0 + 190, 70, r"f(x) = 1 \ \ \mathrm{if}\ x \geq 0", size=15)
        c.math(x0 + 190, 98, r"f(x) = 0 \ \ \mathrm{if}\ x < 0", size=15)
    else:
        xs = np.linspace(-3.8, 3.8, 80)
        a.line(xs, sigm(1.6 * xs), color=col, width=2.4, lint=False)
        c.math(x0 + 190, 86, r"f(x) = \dfrac{1}{1 + e^{-x}}", size=17, baseline="middle")


def draw():
    c = Canvas(640, 440, "r2-surf")
    activation_panel(c, 10, "Step (McCulloch–Pitts)", "step")
    activation_panel(c, 330, "Sigmoid", "sigm")
    c.line(320, 14, 320, 150, color=S.GRID, width=1, lint=False)
    w = np.linspace(-6, 6, 26)
    W1, W2 = np.meshgrid(w, w)
    for k, (f, x0, note) in enumerate(((step, 172, "flat plateaus, then cliffs:"),
                                       (sigm, 466, "smooth slopes:"))):
        Z = loss(W1, W2, f)
        v = Sf.View3D(c, cx=x0 - 2, cy=272, size=78, xlim=(-6, 6), ylim=(-6, 6), zlim=(0, 0.9),
                      elev=34, azim=-35, zheight=0.6)
        v.axes(labels=("w_1", "w_2", r"\mathrm{loss}"), as_math=True)
        v.box_floor()
        v.surface(W1, W2, Z, cmap="viridis", clim=(0.05, 0.85))
        if k == 1:
            i = np.unravel_index(Z.argmin(), Z.shape)
            p = v.P(W1[i], W2[i], Z[i])
            c.circle(*p, 3.5, fill="#fff", color=S.INK, width=1.2, lint=False)
            c.callout(p[0] + 40, p[1] + 62, p, "minimum", dot=False)
        sub = "gradient is zero almost everywhere" if k == 0 else "gradient points downhill"
        c.text(x0, 416, note, size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
        c.text(x0, 431, sub, size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
    return c
