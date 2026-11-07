"""Known-answer cases for the linter's "filled patch covers text" check (exit 0 pass, 1 fail).

Each case is a tiny figure with a label and a filled box. The box drawn AFTER the label (on top of it) must
be reported as PATCH COVERS TEXT naming the label; the same box drawn BEFORE it (label inside a box), a box
that is mostly transparent, and a box that does not reach the label must stay clean. Run by evals/run.py;
`$SCIENCEFIG` points at another library copy.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")
LIB = Path(os.environ.get("SCIENCEFIG", Path(__file__).resolve().parent.parent / "lib")).expanduser()
sys.path.insert(0, str(LIB))
from sciencefig import plot as P  # noqa: E402
from sciencefig import style as S  # noqa: E402
from sciencefig.svg import Canvas  # noqa: E402


def covers(probs, label):
    return any(p.startswith("PATCH COVERS TEXT") and f"'{label}'" in p for p in probs)


def canvas_case(box_first, **box):
    c = Canvas(300, 120, "case")
    draw_box = lambda: c.rect(20, 30, 150, 50, fill=S.tint(S.BLUE, 0.3), color="none", **box)
    if box_first:
        draw_box()
    c.text(40, 60, "Receptor field")
    if not box_first:
        draw_box()
    return c.lint()


def mpl_case(box_first, kind="rect", alpha=None, far=False):
    fig, ax = P.figure(300, 160, name="case")
    ax.set_xlim(0, 10); ax.set_ylim(0, 10)
    x0 = 7 if far else 1
    z_box, z_text = (1, 3) if box_first else (3, 1)
    if kind == "rect":
        import matplotlib.patches as mp
        ax.add_patch(mp.Rectangle((x0, 3), 4, 3, fc=S.tint(S.BLUE, 0.3), ec="none", alpha=alpha, zorder=z_box))
    elif kind == "band":
        ax.axvspan(x0, x0 + 4, color=S.tint(S.BLUE, 0.3), alpha=alpha, lw=0, zorder=z_box)
    else:
        ax.fill_between([x0, x0 + 4], 2, 7, color=S.tint(S.BLUE, 0.3), alpha=alpha, lw=0, zorder=z_box)
    ax.text(1.5, 4.5, "Receptor field", zorder=z_text)
    return P.lint(fig)


def main():
    bad = []

    def expect(name, probs, flagged):
        ok = covers(probs, "Receptor field") == flagged
        print(f"{'ok  ' if ok else 'FAIL'} {name}: {'flagged' if flagged else 'clean'} expected, got {probs or 'clean'}")
        if not ok:
            bad.append(name)

    expect("canvas rect over label", canvas_case(False), True)
    expect("canvas rect behind label", canvas_case(True), False)
    expect("canvas rect 15% opaque over label", canvas_case(False, fill_opacity=0.15), False)
    for kind in ("rect", "band", "fill_between"):
        expect(f"matplotlib {kind} over label", mpl_case(False, kind), True)
        expect(f"matplotlib {kind} behind label", mpl_case(True, kind), False)
        expect(f"matplotlib {kind} 15% opaque over label", mpl_case(False, kind, alpha=0.15), False)
    expect("matplotlib rect elsewhere", mpl_case(False, "rect", far=True), False)
    # same zorder: the one added later is drawn later
    import matplotlib.patches as mp
    fig, ax = P.figure(300, 160, name="tie")
    ax.set_xlim(0, 10); ax.set_ylim(0, 10)
    ax.text(1.5, 4.5, "Receptor field")
    ax.add_patch(mp.Rectangle((1, 3), 4, 3, fc=S.tint(S.BLUE, 0.3), ec="none", zorder=3))
    expect("matplotlib same zorder, box added later", P.lint(fig), True)
    print(f"lint_cases: {'FAIL ' + ', '.join(bad) if bad else 'pass'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
