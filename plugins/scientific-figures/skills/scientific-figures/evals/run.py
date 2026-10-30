"""Scripted evals for scientific-figures: build, lint and render every worked example (exit 0 pass, 1 fail, 2 not run).

Runs `lib/examples/build_all.py`, which builds each example in memory, lints it, checks it is inline-safe SVG,
and renders all figures on one sheet in a temporary folder (so the render path - Playwright, or headless Chrome
on a Mac - is tested too). Nothing is written into the skill folder. `$SCIENCEFIG` points at another library copy.
Missing dependencies (matplotlib, numpy, scipy, Pillow) mean "not run", never a pass.
"""
import os
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
    print(f"scientific-figures evals: {'pass' if p.returncode == 0 else 'FAIL'}")
    return 0 if p.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
