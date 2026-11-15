"""Unit checks for sciencefig library helpers (exit 0 pass, 1 fail).

Covers Dy.portrait second-channel nullcline styles and outside labels, Dy.nullcline tuple dash
patterns, P.panel_label/panel_labels, N.stimulus_arrow(label=None/""), and P.label_curves
coordinate stability under layout shifts. Run by evals/run.py.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")
LIB = Path(os.environ.get("SCIENCEFIG", Path(__file__).resolve().parent.parent / "lib")).expanduser()
sys.path.insert(0, str(LIB))

import numpy as np  # noqa: E402
from sciencefig import Canvas, dynamics as Dy, neuro as N, plot as P, style as S  # noqa: E402


def main() -> int:
    bad = []

    def check(name, cond, detail=""):
        print(f"{'ok  ' if cond else 'FAIL'} {name}" + (f" ({detail})" if detail and not cond else ""))
        if not cond:
            bad.append(name)

    g = lambda x: 1 / (1 + np.exp(-np.clip(x, -50, 50)))
    f = lambda x, y: (-x + g(-10 * y + 1.0), -y + g(-10 * x + 1.0))

    # 1. Dy.nullcline accepts tuple dash patterns
    fig, ax = P.figure(300, 220, name="nc-dash")
    try:
        cs = Dy.nullcline(ax, f, (-0.02, 1.02), (-0.02, 1.02), which=1, ls=(0, (5, 2, 1.5, 2)))
        check("Dy.nullcline tuple dash", cs is not None)
    except Exception as e:
        check("Dy.nullcline tuple dash", False, repr(e))

    # 2. Dy.portrait draws two distinct nullcline linestyles (second channel) and places labels cleanly
    fig, ax = P.figure(420, 340, name="portrait-lbl")
    try:
        Dy.portrait(ax, f, (-0.02, 1.02), (-0.02, 1.02), labels=("$r_1$-nullcline", "$r_2$-nullcline"))
        ax.set_title("Mutual inhibition", loc="left", size=S.SIZE_SMALL)
        ax.set_xlabel("$r_1$")
        ax.set_ylabel("$r_2$")
        import matplotlib.contour
        ncs = [c for c in ax.findobj(matplotlib.contour.ContourSet)]
        styles = [tuple(c.get_linestyle()[0][1] or ()) if c.get_linestyle() else () for c in ncs]
        check("Dy.portrait distinct nullcline linestyles", len(ncs) == 2 and styles[0] != styles[1], str(styles))
        probs = P.lint(fig)
        check("Dy.portrait labels pass P.lint", not probs, str(probs))
    except Exception as e:
        check("Dy.portrait labels", False, repr(e))

    # 3. P.panel_label and P.panel_labels
    try:
        fig, axes = P.figure(490, 220, ncols=2, name="panels")
        for ax in axes:
            ax.plot([0, 1], [0, 1])
            ax.set_xlabel("x")
            ax.set_ylabel("y")
            ax.set_title("title", loc="left", size=S.SIZE_SMALL)
        lbls = P.panel_labels(axes)
        check("P.panel_labels returns one text per axes", len(lbls) == 2)
        probs = P.lint(fig)
        check("P.panel_labels passes P.lint", not probs, str(probs))
    except Exception as e:
        check("P.panel_labels", False, repr(e))

    # 4. N.stimulus_arrow(label=None / "") emits no text
    c_none = Canvas(200, 120, "stim-none")
    N.stimulus_arrow(c_none, 100, 30, 70, label=None)
    check("N.stimulus_arrow label=None adds no text", len(c_none.texts) == 0, str(c_none.texts))
    c_empty = Canvas(200, 120, "stim-empty")
    N.stimulus_arrow(c_empty, 100, 30, 70, label="")
    check("N.stimulus_arrow label='' adds no text", len(c_empty.texts) == 0, str(c_empty.texts))
    c_def = Canvas(200, 120, "stim-def")
    N.stimulus_arrow(c_def, 100, 30, 70)
    check("N.stimulus_arrow default adds Stimulus", len(c_def.texts) == 1 and c_def.texts[0][1] == "Stimulus")

    # 5. P.label_curves does not freeze in figure pixels when layout shifts later
    fig, ax = P.figure(420, 260, name="lc")
    xs = np.linspace(0, 1, 50)
    ax.plot(xs, xs, color=S.BLUE)
    ax.plot(xs, 0.98 * xs, color=S.VERMILION)
    anns = P.label_curves(ax, [(1.0, 1.0, "A", S.BLUE), (1.0, 0.98, "B", S.VERMILION)])
    check("P.label_curves avoids figure pixels textcoords",
          all(a.textcoords != "figure pixels" for a in anns),
          str([a.textcoords for a in anns]))
    # Shift axes after label_curves by adding a suptitle and re-drawing
    fig.suptitle("Shifted layout", size=S.SIZE)
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    end_x = ax.transData.transform((1.0, 1.0))[0]
    ann_x = anns[0].get_window_extent(r).x0
    check("P.label_curves stays near curve end after layout shift", 2 <= ann_x - end_x <= 30,
          f"dx={ann_x - end_x:.1f}")

    print(f"library_cases: {'FAIL ' + ', '.join(bad) if bad else 'pass'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
