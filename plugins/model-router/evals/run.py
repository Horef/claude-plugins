"""Scripted eval for model-router: runs the mod's engine tests (claude plugin test); exit 2 when the claude CLI is missing."""
import shutil
import subprocess
import sys
from pathlib import Path

if not shutil.which("claude"):
    print("model-router evals: NOT RUN (no claude CLI on PATH)")
    sys.exit(2)
plugin = Path(__file__).resolve().parents[1]
r = subprocess.run(["claude", "plugin", "test", str(plugin)], capture_output=True, text=True)
print("\n".join((r.stdout + r.stderr).strip().splitlines()[-3:]))
print(f"model-router evals: {'pass' if r.returncode == 0 else 'FAIL'}")
sys.exit(0 if r.returncode == 0 else 1)
