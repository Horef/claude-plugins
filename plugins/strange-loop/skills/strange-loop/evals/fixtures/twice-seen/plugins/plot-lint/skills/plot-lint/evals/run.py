"""Scripted evals for plot-lint: known-answer layouts."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import lint  # noqa: E402

fig = json.loads((HERE / "examples/two_labels.json").read_text())
ok = len(lint.lint(fig)) == 1
print(("ok  " if ok else "FAIL") + " two overlapping labels are reported")
sys.exit(0 if ok else 1)
