#!/usr/bin/env python3
"""Scripted evals for herdr-delegate: prompt detection on real Copilot screens (captured 2026-11-01), usage read from Kiro and Copilot screens (2026-11-08).

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
# A login mark clears itself once the provider reports a login (O11); a failed check keeps it.
helpers.save = lambda state: None
helpers.logged_in = lambda p: p == "kiro"
state = {"kiro": "login", "agy": "login", "copilot": "2099-01-01"}
cleared = helpers.refresh_logins(state)
ok = cleared == ["kiro"] and state == {"agy": "login", "copilot": "2099-01-01"}
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} login mark clears when logged in again: {state}")
# Config, render, set, custom and models: own process, temp config dir, fake CLIs (render_cases.py).
import subprocess  # noqa: E402
sub = subprocess.run([sys.executable, str(HERE / "render_cases.py")], capture_output=True, text=True)
tail = sub.stdout.strip().splitlines()[-1] if sub.stdout.strip() else sub.stderr.strip()[-300:]
failures += sub.returncode != 0
print(f"{'OK  ' if sub.returncode == 0 else 'FAIL'} render_cases.py: {tail}")
if sub.returncode != 0:
    print("\n".join(l for l in sub.stdout.splitlines() if l.startswith("FAIL")))
# pick skips a template whose model the cache says is not offered (O7).
helpers.not_offered = lambda: {"agy-argon"}
import io as _io, contextlib as _cl
out = _io.StringIO()
with _cl.redirect_stdout(out), _cl.redirect_stderr(_io.StringIO()):
    rc = helpers.main(["pick", "agy-argon,copilot-argon"], _dt.date(2026, 11, 7))
ok = rc == 0 and out.getvalue().strip() == "copilot-argon"
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} pick skips a template whose model is not offered: {out.getvalue().strip()}")
# Usage read from real helper screens (captured 2026-11-08): the last figure, nothing for none or 0.
USAGE_CASES = [
    ("kiro", "kiro-done.txt", {"provider": "kiro", "amount": 2.13, "unit": "credits"}),
    ("copilot", "copilot-done.txt", {"provider": "copilot", "amount": 0.25, "unit": "AIC"}),
    ("copilot", "copilot-exit.txt", {"provider": "copilot", "amount": 30.04, "unit": "AIC"}),
    ("copilot", "copilot-shell.txt", None),
    ("agy", "kiro-done.txt", None),
]
for provider, name, want in USAGE_CASES:
    got = helpers.usage_of(provider, (HERE / "screens" / name).read_text())
    ok = got == want
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} usage {provider} {name}: {got}")
ok = helpers.usage_of("kiro", "▸ Credits: turn 0.00 • session 0.00 | Time: 1s") is None
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} usage of 0 is not reported")
print(f"{failures} failure(s)")
sys.exit(1 if failures else 0)
