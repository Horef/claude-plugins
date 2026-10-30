"""Build and lint every worked example; optionally save the SVGs and render one check sheet.

Each example module exposes draw() (one figure: a Canvas, or (svg, problems) from P.finish) or build()
(several: {name: (svg, problems)}). A figure passes when its lint and the inline-SVG check are clean.

  python examples/build_all.py                      build + lint all, print one line per figure
  python examples/build_all.py --out DIR            also write DIR/<name>.svg
  python examples/build_all.py --render SHEET.png   also render all figures on one sheet (Playwright or Chrome)
  python examples/build_all.py saddle_portrait eye  only these modules
Exit status 1 if any figure has problems or a module fails. Nothing is written into the library folder.
"""
import argparse
import importlib.util
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from sciencefig import check as C  # noqa: E402


def modules(only=None):
    names = sorted(f[:-3] for f in os.listdir(HERE) if f.endswith(".py") and f != "build_all.py")
    return [n for n in names if not only or n in only]


def figures(name):
    """{figure name: (svg, problems)} for one example module."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    if hasattr(m, "build"):
        return m.build()
    r = m.draw()
    return {name: r if isinstance(r, tuple) else (r.svg(), r.lint())}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("only", nargs="*")
    ap.add_argument("--out")
    ap.add_argument("--render")
    args = ap.parse_args(argv)
    svgs, failed = {}, 0
    for mod in modules(args.only):
        try:
            figs = figures(mod)
        except Exception:
            failed += 1
            print(f"{mod:26s} FAILED\n{traceback.format_exc(limit=3)}")
            continue
        for name, (svg, probs) in figs.items():
            probs = list(probs) + C.check_inline(svg)
            failed += bool(probs)
            print(f"{name:26s} {len(svg) // 1000:4d} kB  {'OK' if not probs else probs}")
            svgs[name] = svg
            if args.out:
                os.makedirs(args.out, exist_ok=True)
                with open(os.path.join(args.out, name + ".svg"), "w", encoding="utf-8") as f:
                    f.write(svg)
    if args.render and svgs:
        C.render(list(svgs.values()), args.render, names=list(svgs))
        print(f"rendered {len(svgs)} figure(s) to {args.render}")
    print(f"{len(svgs)} figure(s), {failed} with problems")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
