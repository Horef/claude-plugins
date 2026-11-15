"""Scripted evals for panel-ui: every template keeps text at 12 px or more (section 2)."""
import re
import sys
from pathlib import Path

bad = []
for t in sorted((Path(__file__).resolve().parents[1] / "templates").glob("*.html")):
    for px in re.findall(r"font-size:\s*(\d+)px", t.read_text()):
        if int(px) < 12:
            bad.append(f"{t.name}: font-size {px}px < 12px")
print("\n".join(bad) or "ok: all templates >= 12 px")
sys.exit(1 if bad else 0)
