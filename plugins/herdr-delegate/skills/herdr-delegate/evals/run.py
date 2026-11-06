#!/usr/bin/env python3
"""Scripted evals for herdr-delegate: prompt detection on real Copilot screens (captured 2026-11-01).

Exit 0 when every check passes, 1 otherwise.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import helpers  # noqa: E402

CASES = [
    ("copilot-shell.txt", ["rm -rf ./junk", "Do you want to run this command?", "3. No (Esc)"]),
    ("copilot-url.txt", ["https://httpbin.org/post", "Do you want to allow this access?", "4. No (Esc)"]),
    ("copilot-answered.txt", None),
]

failures = 0
for name, want in CASES:
    got = helpers.pending_prompt((HERE / "screens" / name).read_text())
    if want is None:
        ok = got is None
    else:
        ok = got is not None and all(any(w in line for line in got) for w in want)
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} {name}: {got if not ok else 'detected as expected'}")

# pick order: argon prefers agy over Copilot (Copilot's argon model falls back to Sonnet).
helpers.command_of = lambda name: "sh"
order = helpers.ORDER["argon"]
ok = order[0] == "agy-argon" and order.index("agy-argon") < order.index("copilot-argon")
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} pick argon order: {order}")
import datetime as _dt
picked = [n for n in order if helpers.usable(n, {}, _dt.date(2026, 11, 6))][0]
ok = picked == "agy-argon" and [n for n in order if helpers.usable(n, {"agy": "login"}, _dt.date(2026, 11, 6))] == ["copilot-argon"]
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} pick argon takes agy, falls to copilot when agy is out")
print(f"{failures} failure(s)")
sys.exit(1 if failures else 0)
