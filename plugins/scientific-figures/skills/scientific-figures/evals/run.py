"""Scripted evals for scientific-figures: build, lint and render every worked example (exit 0 pass, 1 fail, 2 not run).

Also runs `evals/lint_cases.py` (known-answer cases for the linter, e.g. a box drawn over a label must be flagged).
Runs `lib/examples/build_all.py`, which builds each example in memory, lints it, checks it is inline-safe SVG,
and renders all figures on one sheet in a temporary folder (so the render path - Playwright, or headless Chrome
on a Mac - is tested too). Nothing is written into the skill folder. `$SCIENCEFIG` points at another library copy.
Missing dependencies (matplotlib, numpy, scipy, Pillow) mean "not run", never a pass. A missing optional module
(e.g. morphio for the reconstruction examples) skips only those figures: they are named as NOT RUN in the summary,
the rest are judged, and the exit is 2 only if no figure could be built.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = Path(os.environ.get("SCIENCEFIG", HERE.parent / "lib")).expanduser()


def main() -> int:
    builder = LIB / "examples" / "build_all.py"
    if not builder.exists():
        print(f"scientific-figures evals: NOT RUN - no examples/build_all.py under {LIB}")
        return 2
    try:
        import matplotlib, numpy, scipy, PIL  # noqa: F401
    except ImportError as e:
        print(f"scientific-figures evals: NOT RUN - missing dependency ({e.name}); see lib/README.md")
        return 2
    with tempfile.TemporaryDirectory() as tmp:
        env = dict(os.environ, MPLBACKEND="Agg", PYTHONDONTWRITEBYTECODE="1")
        p = subprocess.run([sys.executable, str(builder), "--render", str(Path(tmp) / "sheet.png")],
                           env=env, capture_output=True, text=True, timeout=1200)
    print(p.stdout.rstrip())
    if p.returncode != 0 and p.stderr.strip():
        print(p.stderr.strip().splitlines()[-1])
    skipped = [l for l in p.stdout.splitlines() if l.startswith("NOT RUN:")]
    note = f" ({skipped[0]})" if skipped else ""
    if p.returncode == 0 and re.search(r"^0 figure\(s\)", p.stdout, re.M):
        print(f"scientific-figures evals: NOT RUN - no figure could be built{note}")
        return 2
    cases = subprocess.run([sys.executable, str(HERE / "lint_cases.py")], env=env, capture_output=True,
                           text=True, timeout=300)
    print("\n".join(l for l in cases.stdout.splitlines() if not l.startswith("ok  ")))
    if cases.returncode != 0 and cases.stderr.strip():
        print(cases.stderr.strip().splitlines()[-1])
    passed = p.returncode == 0 and cases.returncode == 0
    print(f"scientific-figures evals: {'pass' if passed else 'FAIL'}{note}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
