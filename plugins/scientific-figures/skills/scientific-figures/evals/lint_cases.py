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

    # streamlines (LineCollection) and nullclines (ContourSet) crossing text
    from sciencefig import dynamics as Dy
    f_lin = Dy.linear([[-1.0, 0.2], [0.2, -1.0]])
    fig, ax = P.figure(300, 220, name="flow")
    Dy.flow_field(ax, f_lin, (-1, 1), (-1, 1), n=20, density=0.8)
    ax.text(0.0, 0.0, "on flow", ha="center", va="center")
    probs_flow = P.lint(fig)
    ok_flow = any(p.startswith("LINE CROSSES TEXT") and "'on flow'" in p for p in probs_flow)
    print(f"{'ok  ' if ok_flow else 'FAIL'} matplotlib streamplot over label: {probs_flow or 'clean'}")
    if not ok_flow:
        bad.append("matplotlib streamplot over label")

    fig, ax = P.figure(300, 220, name="flow-halo")
    Dy.flow_field(ax, f_lin, (-1, 1), (-1, 1), n=20, density=0.8)
    P.point_label(ax, 0.0, 0.0, "haloed", dx=0, dy=0, halo=True)
    probs_halo = P.lint(fig)
    ok_halo = not any("LINE CROSSES TEXT" in p for p in probs_halo)
    print(f"{'ok  ' if ok_halo else 'FAIL'} matplotlib haloed label over streamplot: {probs_halo or 'clean'}")
    if not ok_halo:
        bad.append("matplotlib haloed label over streamplot")

    fig, ax = P.figure(300, 220, name="nc")
    Dy.nullcline(ax, f_lin, (-1, 1), (-1, 1), which=0, color=S.BLUE)
    ax.text(0.0, 0.0, "on nullcline", ha="center", va="center")
    probs_nc = P.lint(fig)
    ok_nc = any(p.startswith("LINE CROSSES TEXT") and "'on nullcline'" in p for p in probs_nc)
    print(f"{'ok  ' if ok_nc else 'FAIL'} matplotlib nullcline over label: {probs_nc or 'clean'}")
    if not ok_nc:
        bad.append("matplotlib nullcline over label")

    # paper=True font floor (7 pt) vs note default (11 px)
    fig, ax = P.figure(240, 180, name="paper-ok", paper=True)
    ax.plot([0, 1], [0, 1])
    ax.text(0.5, 0.5, "paper label", size=7.5)
    probs_pok = P.lint(fig)
    ok_pok = not any("TOO SMALL" in p for p in probs_pok)
    print(f"{'ok  ' if ok_pok else 'FAIL'} matplotlib paper=True allows 7.5pt: {probs_pok or 'clean'}")
    if not ok_pok:
        bad.append("matplotlib paper=True allows 7.5pt")

    fig, ax = P.figure(240, 180, name="paper-small", paper=True)
    ax.plot([0, 1], [0, 1])
    ax.text(0.5, 0.5, "tiny label", size=6.5)
    probs_psmall = P.lint(fig)
    ok_psmall = any(p.startswith("TOO SMALL") and "'tiny label'" in p for p in probs_psmall)
    print(f"{'ok  ' if ok_psmall else 'FAIL'} matplotlib paper=True flags 6.5pt: {probs_psmall or 'clean'}")
    if not ok_psmall:
        bad.append("matplotlib paper=True flags 6.5pt")

    c_pap = Canvas(240, 140, "cpap")
    c_pap.text(20, 40, "paper canvas", size=8)
    ok_cpap = not c_pap.lint(min_size=S.PAPER_SIZE_MIN)
    print(f"{'ok  ' if ok_cpap else 'FAIL'} canvas lint min_size=7 allows 8pt")
    if not ok_cpap:
        bad.append("canvas lint min_size=7 allows 8pt")

    print(f"lint_cases: {'FAIL ' + ', '.join(bad) if bad else 'pass'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
