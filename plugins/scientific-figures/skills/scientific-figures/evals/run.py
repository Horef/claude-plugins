"""Scripted evals for scientific-figures: build every benchmark figure, lint it, render one sheet (exit 0 pass, 1 fail, 2 not run).

The benchmark scripts run in a temporary copy of `lib/`, so the committed reference renders in
`lib/benchmark/**/after/` stay untouched; the report lists which figures now differ from them (expected across
machines: fonts and matplotlib versions move coordinates slightly) so a reflection pass can look at those.
A figure fails when its script crashes or prints lint problems. `$SCIENCEFIG` points at another library copy.
Missing dependencies (matplotlib, numpy, scipy, Pillow) mean "not run", never a pass.
"""
import filecmp
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = Path(os.environ.get("SCIENCEFIG", HERE.parent / "lib")).expanduser()
SCRIPTS = ["benchmark/lecture1.py", "benchmark/kandel_17_11ab.py", "benchmark/kandel_17_11c.py",
           "benchmark/round2/build_all.py", "benchmark/round3/build_all.py", "benchmark/round4/l3_mutual_inhibition.py"]
GOOD = re.compile(r"(\bOK\s*$|lint:? clean\s*$)")
FIGURE_LINE = re.compile(r"(\d+ kB|lint:? )")


def main() -> int:
    if not (LIB / "sciencefig").is_dir():
        print(f"scientific-figures evals: NOT RUN - no sciencefig library at {LIB}")
        return 2
    try:
        import matplotlib, numpy, scipy, PIL  # noqa: F401
    except ImportError as e:
        print(f"scientific-figures evals: NOT RUN - missing dependency ({e.name}); see lib/README.md")
        return 2
    failures, changed, figures = [], [], 0
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "lib"
        shutil.copytree(LIB, work, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        env = dict(os.environ, MPLBACKEND="Agg")
        for rel in SCRIPTS:
            script = work / rel
            if not script.exists():
                failures.append(f"{rel}: missing")
                continue
            p = subprocess.run([sys.executable, str(script)], cwd=str(script.parent), env=env,
                               capture_output=True, text=True, timeout=900)
            lines = [l for l in p.stdout.splitlines() if FIGURE_LINE.search(l)]
            figures += len(lines)
            bad = [l.strip() for l in lines if not GOOD.search(l)]
            status = "ok" if p.returncode == 0 and not bad else "FAIL"
            print(f"{status:4s} {rel}: {len(lines)} figure(s)")
            if p.returncode != 0:
                failures.append(f"{rel}: exit {p.returncode}: {(p.stderr.strip().splitlines() or ['?'])[-1]}")
            failures += [f"{rel}: {b}" for b in bad]
        for ref in sorted(LIB.glob("benchmark/**/after/*.svg")):
            new = work / ref.relative_to(LIB)
            if new.exists() and not filecmp.cmp(ref, new, shallow=False):
                changed.append(str(ref.relative_to(LIB)))
    for f in failures:
        print(f"  {f}")
    print(f"scientific-figures evals: {figures} figure(s), {len(failures)} failure(s); "
          f"{len(changed)} differ from the committed renders" + (f" (e.g. {changed[0]})" if changed else ""))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
