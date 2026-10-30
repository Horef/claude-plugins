"""Scripted evals for scientific-figures: lint and build the library's benchmark figures (exit 0 pass, 1 fail, 2 not run).

The library is not part of this skill folder. It is found at $SCIENCEFIG, ~/Scripts/ScientificFigures or
/home/claude/ScientificFigures. Without it the eval reports "not run" (exit 2), never a pass.
"""
import os
import subprocess
import sys
from pathlib import Path

candidates = [os.environ.get("SCIENCEFIG", ""), "~/Scripts/ScientificFigures", "/home/claude/ScientificFigures"]
lib = next((Path(c).expanduser() for c in candidates if c and (Path(c).expanduser() / "sciencefig").is_dir()), None)
if lib is None:
    print("scientific-figures evals: NOT RUN - sciencefig library not found (set $SCIENCEFIG)")
    sys.exit(2)
builders = sorted(lib.glob("benchmark/**/build_all.py"))
if not builders:
    print(f"scientific-figures evals: NOT RUN - no benchmark/**/build_all.py under {lib}")
    sys.exit(2)
env = dict(os.environ, PYTHONPATH=str(lib) + os.pathsep + os.environ.get("PYTHONPATH", ""))
failed = 0
for b in builders:
    print(f"running {b.relative_to(lib)}")
    failed += subprocess.run([sys.executable, str(b)], cwd=str(b.parent), env=env).returncode != 0
print(f"scientific-figures evals: {failed} of {len(builders)} benchmark builder(s) failed")
sys.exit(1 if failed else 0)
