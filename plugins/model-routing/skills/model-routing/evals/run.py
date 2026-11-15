"""Scripted eval for model-routing: the skill's tier table and rerun ladder must match the model-router mod's
defaults (plugins/model-router/hooks/tiers.ts), and its Learning loop block must keep the template's wording.
Exit 2 when the mod's tiers.ts is not next to the skill (a copy outside the genome)."""
import re
import sys
from pathlib import Path

skill_dir = Path(__file__).resolve().parents[1]
skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
tiers_ts = skill_dir.parents[2] / "model-router" / "hooks" / "tiers.ts"
if not tiers_ts.exists():
    print(f"model-routing evals: NOT RUN ({tiers_ts} not found; the skill is outside the genome)")
    sys.exit(2)
ts = tiers_ts.read_text(encoding="utf-8")
failures: list[str] = []

# Tier table: | light | ... | Haiku | low |
want = {m.group(1): (m.group(2), m.group(3))
        for m in re.finditer(r"^\s*(light|standard|deep): \{ model: '(\w+)', effort: '(\w+)'", ts, re.M)}
have = {m.group(1): (m.group(2).lower(), m.group(3).lower())
        for m in re.finditer(r"^\| (light|standard|deep) \|.*\| (\w+) \| (\w+) \|\s*$", skill, re.M)}
if not want or want != have:
    failures.append(f"tier table differs from tiers.ts: skill {have}, tiers.ts {want}")

# Rerun ladder: "Haiku low → Haiku medium → ..." against LADDER
block = re.search(r"LADDER[^=]*=\s*\[(.*?)\n\]", ts, re.S)
want_ladder = re.findall(r"model: '(\w+)', effort: '(\w+)'", block.group(1)) if block else []
line = next((l for l in skill.splitlines() if "Haiku low →" in l), "")
chain = re.search(r"Haiku low(?: → [A-Z]\w+ \w+)+", line)
have_ladder = [tuple(p.lower().split()) for p in chain.group(0).split(" → ")] if chain else []
if not want_ladder or want_ladder != have_ladder:
    failures.append(f"rerun ladder differs from tiers.ts: skill {have_ladder}, tiers.ts {want_ladder}")

# Learning loop block: the template's fallback condition and the note command's shape
loop = skill.split("## Learning loop", 1)[-1]
for needle in ("and the person takes part in improving their skills (their standing instructions say so)",
               "otherwise add nothing about it, except one line when the skill clearly failed",
               'note model-routing <failure|friction|misled|missing|workaround|win|wish> "<section>:'):
    if needle not in loop:
        failures.append(f"Learning loop block lacks the template's wording: {needle!r}")

for f in failures:
    print("FAIL:", f)
print(f"model-routing evals: {'FAIL' if failures else 'pass'}")
sys.exit(1 if failures else 0)
