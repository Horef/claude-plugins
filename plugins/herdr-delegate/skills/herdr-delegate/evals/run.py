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
# agy usage (2026-11-09): /usage groups, and the drop in the model's weekly fraction since pick's snapshot.
GROUPS = ["Gemini Models", "Claude and GPT models", "Gemini 4 Argon"]
ok = ([helpers.agy_group(m, GROUPS) for m in ("gemini-4-argon-medium", "claude-opus-5-5-high", "gpt-oss-120b-medium",
       "gemini-3.8-flash-high")] == ["Gemini 4 Argon", "Claude and GPT models", "Claude and GPT models", "Gemini Models"])
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} agy model ids map to their /usage group")
import tempfile as _tf
_tmp = Path(_tf.mkdtemp())
_saved = (helpers.agy_weekly, helpers.templates_dir, helpers.agy_snapshot_file)
helpers.templates_dir = lambda: _tmp
helpers.agy_snapshot_file = lambda: _tmp / "agy-usage.json"
(_tmp / "agy-argon.md").write_text("---\nname: agy-argon\ncommand: agy --model gemini-4-argon-high --mode auto\n---\n")
helpers.agy_weekly = lambda: {"Gemini Models": 1.0, "Gemini 4 Argon": 0.64}
helpers.agy_mark()
helpers.agy_weekly = lambda: {"Gemini Models": 0.99, "Gemini 4 Argon": 0.6}
got = helpers.agy_usage("agy-argon")
ok = got == {"provider": "agy", "amount": 4.0, "unit": "% of Gemini 4 Argon weekly"}
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} agy usage is the drop in its group's weekly fraction since pick: {got}")
helpers.agy_weekly = lambda: {}
ok = helpers.agy_usage("agy-argon") is None
failures += not ok
print(f"{'OK  ' if ok else 'FAIL'} agy usage is None when /usage can't be read")
helpers.agy_weekly, helpers.templates_dir, helpers.agy_snapshot_file = _saved
print(f"{failures} failure(s)")
# Claude-account helpers, readings-based quota, usage delta and Codex quota: own process, temp HOME/XDG, fake CLIs.
acc = subprocess.run([sys.executable, str(HERE / "account_cases.py")], capture_output=True, text=True)
tail = acc.stdout.strip().splitlines()[-1] if acc.stdout.strip() else acc.stderr.strip()[-300:]
failures += acc.returncode != 0
print(f"{'OK  ' if acc.returncode == 0 else 'FAIL'} account_cases.py: {tail}")
if acc.returncode != 0:
    print("\n".join(l for l in acc.stdout.splitlines() if l.startswith("FAIL")))
sys.exit(1 if failures else 0)
