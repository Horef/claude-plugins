#!/usr/bin/env python3
"""Scripted evals for herdr-delegate's model tracking (NEW/GONE, --json, --cached), the `second` tier and its `argon`
alias, and direct mode (`run`, `config` "direct").

Runs against a temporary HOME / XDG_CONFIG_HOME / CODEX_HOME and fake kiro-cli, agy, codex, claude and copilot binaries on
PATH, never the real config. run.py starts this file in its own process. Exit 0 when every check passes, 1 otherwise.
"""
import contextlib
import datetime as dt
import io
import json
import os
import shutil
import stat
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

tmp = Path(tempfile.mkdtemp(prefix="herdr-delegate-direct-")).resolve()
bindir = tmp / "bin"
bindir.mkdir()
home = tmp / "home"
home.mkdir()
cfg_home = tmp / "cfg"
os.environ.update(HOME=str(home), XDG_CONFIG_HOME=str(cfg_home), CODEX_HOME=str(tmp / "codex"), PATH=f"{bindir}:/usr/bin:/bin",
                  FAKE_KIRO_LIST=str(tmp / "kiro.list"), FAKE_AGY_LIST=str(tmp / "agy.list"), FAKE_AGY_STATE=str(tmp / "agy.state"),
                  FAKE_ARGV_OUT=str(tmp / "argv.json"))
for var in ("CLAUDE_CONFIG_DIR", "FAKE_KIRO_FAIL", "FAKE_EXIT", "FAKE_MODE"):
    os.environ.pop(var, None)

PY = sys.executable
FAKE_KIRO = f"""#!{PY}
import os, sys
if sys.argv[1:2] == ['whoami']:
    sys.exit(0)
if os.environ.get('FAKE_KIRO_FAIL'):
    sys.exit(3)
print(open(os.environ['FAKE_KIRO_LIST']).read(), end='')
"""
# agy: `models` lists from a file; `-p /usage` reads a weekly fraction from a state file; any other call is a run (records its
# argv, spends 5 points of the fraction, answers in JSON like `--output-format json`).
FAKE_AGY = f"""#!{PY}
import json, os, sys
a = sys.argv[1:]
state = os.environ['FAKE_AGY_STATE']
if a[:1] == ['models']:
    print('Fetching available models...')
    print(open(os.environ['FAKE_AGY_LIST']).read(), end='')
    sys.exit(0)
frac = json.load(open(state))['g'] if os.path.exists(state) else 1.0
if '/usage' in a:
    print(json.dumps({{'command': {{'data': {{'groups': [{{'name': 'Gemini Models', 'buckets': [{{'window': 'weekly', 'remaining_fraction': frac}}]}}]}}}}}}))
    sys.exit(0)
json.dump({{'g': round(frac - 0.05, 4)}}, open(state, 'w'))
json.dump({{'argv': a, 'cwd': os.getcwd()}}, open(os.environ['FAKE_ARGV_OUT'], 'w'))
print(json.dumps({{'status': 'SUCCESS', 'response': 'agy says hi'}}))
"""
# codex, claude, copilot: record argv, cwd, whether stdin is closed and CLAUDE_CONFIG_DIR; answer in text or JSON.
FAKE_RUNNER = f"""#!{PY}
import json, os, sys, time
if sys.argv[1:2] in (['debug'], ['--acp']):  # the model-list calls of `helpers.py models`: this fake has no list
    sys.exit(1)
sys.stderr.write('some log\\n')
json.dump({{'argv': sys.argv[1:], 'cwd': os.getcwd(), 'stdin': sys.stdin.read(), 'config_dir': os.environ.get('CLAUDE_CONFIG_DIR')}},
          open(os.environ['FAKE_ARGV_OUT'], 'w'))
if os.environ.get('FAKE_MODE') == 'sleep':
    time.sleep(60)
if 'json' in sys.argv:
    print(json.dumps({{'type': 'result', 'result': 'final answer'}}))
else:
    print('final answer')
sys.exit(int(os.environ.get('FAKE_EXIT', '0')))
"""


def write_exe(name, text):
    path = bindir / name
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


for cli, text in (("kiro-cli", FAKE_KIRO), ("agy", FAKE_AGY), ("codex", FAKE_RUNNER), ("claude", FAKE_RUNNER), ("copilot", FAKE_RUNNER)):
    write_exe(cli, text)


def kiro_list(*ids):
    Path(os.environ["FAKE_KIRO_LIST"]).write_text("Available models (* = default):\n\n" + "".join(f"  {i}   1.00x credits   x\n" for i in ids))


def agy_list(*ids):
    Path(os.environ["FAKE_AGY_LIST"]).write_text("".join(f"{i}\tName\n" for i in ids))


import helpers  # noqa: E402

failures = 0


def check(ok, label, detail=""):
    global failures
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} {label}" + (f": {detail}" if detail and not ok else ""))


def run(*argv, today=None):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = helpers.main(list(argv), today) if today else helpers.main(list(argv))
    return code, out.getvalue(), err.getvalue()


MODELS = cfg_home / "herdr-delegate" / "models.json"
USER_CFG = cfg_home / "herdr-delegate" / "helpers.json"
TEMPLATES = cfg_home / "herdr-core" / "templates"
D0 = dt.date(2026, 11, 19)
BASE = ["claude-haiku-5.5", "claude-sonnet-5.5", "claude-opus-5.5", "claude-opus-4.8"]
NEON = ["gemini-4-neon-low", "gemini-4-neon-medium", "gemini-4-neon-high", "gemini-4-neon-xhigh"]

check(shutil.which("hc") is None, "no hc on the eval's PATH (direct mode and pick must work without it)")

# --- NEW and GONE over several refreshes
kiro_list(*BASE)
agy_list(*NEON, "gemini-4-hydrogen-high", "gemini-3.8-flash-high")
code, out, _ = run("models", today=D0)
cache = json.loads(MODELS.read_text())
check(code == 0 and "NEW " not in out and "GONE" not in out and "every configured model is offered" in out, "first refresh reports nothing new", out)
check(cache["kiro"]["seen"] == {m: "2026-11-19" for m in BASE} and cache["kiro"]["gone"] == {}, "first refresh initialises seen from the list", str(cache["kiro"]))
check(cache["agy"]["seen"] == {"gemini-4-neon": "2026-11-19", "gemini-4-hydrogen": "2026-11-19", "gemini-3.8-flash": "2026-11-19"}, "seen holds base ids (level cut off), once each", str(cache["agy"]["seen"]))

kiro_list("claude-haiku-5.5", "claude-sonnet-5.5", "claude-opus-5.5", "claude-sonnet-6")
D1 = D0 + dt.timedelta(days=3)
code, out, _ = run("models", today=D1)
check("NEW          kiro: claude-sonnet-6 (first seen 2026-11-22)" in out, "a new id is reported with its first-seen date", out)
check("GONE         kiro: claude-opus-4.8 (not offered since 2026-11-22)" in out, "a vanished id is reported as gone", out)
check("every configured model is offered" not in out, "the all-clear line is not printed when there is a NEW or GONE line", out)
check(out.index("NEW ") > (out.index("NOT OFFERED") if "NOT OFFERED" in out else 0), "NEW follows the existing lines")
cache = json.loads(MODELS.read_text())
check(cache["kiro"]["gone"] == {"claude-opus-4.8": "2026-11-22"} and "claude-opus-4.8" in cache["kiro"]["seen"], "gone ids stay in seen", str(cache["kiro"]))

D2 = D1 + dt.timedelta(days=2)
os.environ["FAKE_KIRO_FAIL"] = "1"
code, out, _ = run("models", today=D2)
after = json.loads(MODELS.read_text())
check(after["kiro"].get("error") and after["kiro"]["seen"] == cache["kiro"]["seen"] and after["kiro"]["gone"] == cache["kiro"]["gone"],
      "a failed refresh changes neither seen nor gone", str(after["kiro"]))
del os.environ["FAKE_KIRO_FAIL"]

# --cached: the same report without asking any CLI (kiro would fail again)
os.environ["FAKE_KIRO_FAIL"] = "1"
code, out, _ = run("models", "--cached", today=D2)
check(code == 0 and "NEW          kiro: claude-sonnet-6" in out and "GONE         kiro: claude-opus-4.8" in out, "models --cached reports from models.json", out)
code, cached_json, _ = run("models", "--cached", "--json", today=D2)
data = json.loads(cached_json)
del os.environ["FAKE_KIRO_FAIL"]
check(set(data) == {"providers", "not_offered", "newer", "new", "gone"}, "models --cached --json has the documented keys, and only JSON on stdout", str(list(data)))
check(data["new"] == [{"provider": "kiro", "model": "claude-sonnet-6", "first_seen": "2026-11-22"}]
      and data["gone"] == [{"provider": "kiro", "model": "claude-opus-4.8", "since": "2026-11-22"}], "json new/gone rows", str(data))
check(data["providers"]["kiro"]["count"] == 4 and data["providers"]["kiro"]["date"] == "2026-11-22" and "error" in data["providers"]["kiro"]
      and set(data["providers"]["agy"]) == {"date", "checked", "count"}, "json providers: date, checked, count, error when failing", str(data["providers"]))
check(data["not_offered"] == [] and data["newer"] == [{"template": "kiro-standard", "model": "claude-sonnet-5.5", "candidates": ["claude-sonnet-6"]}],
      "json not_offered / newer rows", str(data["not_offered"]) + str(data["newer"]))
code, live_json, _ = run("models", "--json", today=D2)
live = json.loads(live_json)
check(live["new"] == data["new"] and live["gone"] == data["gone"] and live["not_offered"] == data["not_offered"], "models --json (live) agrees with --cached", live_json[:300])
code, one, _ = run("models", "kiro", "--json", today=D2)
check(list(json.loads(one)["providers"]) == ["kiro"], "models <provider> --json lists that provider", one[:200])

# a gone id offered again: out of gone, NEW again with the new date; a NEW or GONE older than 14 days is not reported
kiro_list(*BASE)
D3 = D2 + dt.timedelta(days=1)
code, out, _ = run("models", today=D3)
cache = json.loads(MODELS.read_text())
check("NEW          kiro: claude-opus-4.8 (first seen 2026-11-25)" in out and "claude-opus-4.8" not in cache["kiro"]["gone"]
      and cache["kiro"]["seen"]["claude-opus-4.8"] == "2026-11-25", "a gone id offered again is NEW again", out)
check("GONE         kiro: claude-sonnet-6 (not offered since 2026-11-25)" in out, "and the one that left is GONE", out)
code, out, _ = run("models", "--cached", today=D3 + dt.timedelta(days=15))
check("NEW " not in out and "GONE" not in out and "every configured model is offered" in out, "after 14 days nothing is reported any more", out)

# --- the `second` tier and its `argon` alias
agy_list(*NEON, "gemini-4-hydrogen-high", "claude-opus-5-5-high", "gemini-3.8-flash-high")
code, out, err = run("pick", "argon")
check(code == 0 and out.strip() == "agy-second", "pick argon is pick second (agy first), and writes the missing template", out + err)
code, out, _ = run("pick", "second")
check(code == 0 and out.strip() == "agy-second" and (TEMPLATES / "agy-second.md").exists(), "pick second")
code, out, _ = run("pick", "agy-argon,kiro-deep")
check(code == 0 and out.strip() == "agy-second", "a template name written agy-argon is read as agy-second", out)
cfg = helpers.effective_config()
check(cfg["tier_text"].get("second") and "argon" not in cfg["tier_text"] and "argon" not in cfg["providers"]["agy"]["tiers"], "the shipped tier is `second`")
check(cfg["providers"]["agy"]["tiers"]["second"] == {"model": "gemini-4-neon", "effort": "high"} and cfg["providers"]["agy"]["tiers"]["deep"] == {"model": "gemini-4-neon", "effort": "high"}
      and "xhigh" in cfg["providers"]["agy"]["efforts"] and cfg["providers"]["copilot"]["tiers"]["second"]["model"] == "gemini-4-argon", "Neon defaults for agy deep and second; copilot second stays Argon")
code, out, err = run("set", "agy", "argon", "effort=low")
user = json.loads(USER_CFG.read_text())
check(code == 0 and user == {"providers": {"agy": {"tiers": {"second": {"effort": "low"}}}}}, "set agy argon writes `second` and no `argon`", out + err + str(user))
check("gemini-4-neon-low" in (TEMPLATES / "agy-second.md").read_text(), "and renders agy-second with it")

# an old override with tiers.argon and tier_order.argon is read as second
USER_CFG.write_text(json.dumps({"providers": {"agy": {"tiers": {"argon": {"effort": "medium"}}, "tier_order": {"argon": 99}}}, "tier_text": {"argon": "mine"}}))
code, out, _ = run("config")
agy = json.loads(out)["providers"]["agy"]
check(agy["tiers"]["second"] == {"model": "gemini-4-neon", "effort": "medium"} and "argon" not in agy["tiers"] and agy["tier_order"]["second"] == 99
      and "argon" not in agy["tier_order"] and json.loads(out)["tier_text"]["second"] == "mine", "an old tiers.argon / tier_order.argon / tier_text.argon override reads as second", str(agy))
check(json.loads(out)["default_orders"]["second"][-1] == "agy-second", "tier_order.second moved agy last", str(json.loads(out)["default_orders"]["second"]))
code, out, err = run("set", "agy", "second", "effort=high")
check(code == 0 and "argon" not in USER_CFG.read_text() and json.loads(USER_CFG.read_text())["providers"]["agy"]["tiers"]["second"] == {"effort": "high"}, "set saves the migrated form (second, no argon)", out + err + USER_CFG.read_text())
USER_CFG.unlink()

# render removes an old generated -argon template, and keeps a hand-made one
(TEMPLATES / "agy-argon.md").write_text("---\nname: agy-argon\ncommand: agy\n" + helpers.MARK + "\n---\nbody\n")
(TEMPLATES / "kiro-argon.md").write_text("---\nname: kiro-argon\ncommand: mine\n---\nhand-made\n")
code, out, _ = run("render")
check(not (TEMPLATES / "agy-argon.md").exists() and "removed agy-argon" in out and (TEMPLATES / "kiro-argon.md").exists(), "render removes the old generated -argon template only", out)
check(sorted(p.stem for p in TEMPLATES.glob("*-argon.md")) == ["kiro-argon"], "so hc templates lists -second only", str(sorted(p.stem for p in TEMPLATES.glob("*.md"))))

# agy usage groups: a Neon model draws on the shared Gemini group unless /usage names a group for it
G = ["Gemini Models", "Claude and GPT models", "Gemini 4 Argon"]
check([helpers.agy_group(m, G) for m in ("gemini-4-neon-xhigh", "gemini-4-hydrogen-high", "gemini-4-argon-high")] == ["Gemini Models", "Gemini Models", "Gemini 4 Argon"],
      "agy_group: Neon and Hydrogen use the shared Gemini group")
G2 = G + ["Gemini 4 Neon"]
check([helpers.agy_group(m, G2) for m in ("gemini-4-neon-xhigh", "gemini-4-hydrogen-high", "gemini-3.8-flash-high")] == ["Gemini 4 Neon", "Gemini Models", "Gemini Models"],
      "agy_group: a Neon group of its own wins, others skip it")

# --- direct mode
code, out, _ = run("config")
views = json.loads(out)["providers"]
check(views["kiro"]["direct"] is True and views["agy"]["direct"] is True and views["codex"]["direct"] is True, "config: direct is true for an installed provider with a headless command", str({k: v["direct"] for k, v in views.items()}))
default = json.loads((HERE.parent / "helpers.default.json").read_text())
every = {**default["providers"], **{"claude": default["kind_defaults"]["claude"]}}
check(all("{prompt}" in p.get("headless", "") for p in every.values()), "every shipped provider and the claude kind have a headless command with {prompt}", str({k: "headless" in v for k, v in every.items()}))
(bindir / "codex").rename(tmp / "codex.off")
views = json.loads(run("config")[1])["providers"]
check(views["codex"]["direct"] is False and views["codex"]["cli_found"] is False, "config: direct is false when the CLI is not installed")
work = tmp / "work"
work.mkdir()
brief = work / "brief.md"
BRIEF_TEXT = 'Goal: say "hi" $(touch /tmp/pwned) `x` ; {model} {prompt}\nSecond line with unicode: é\n'
brief.write_text(BRIEF_TEXT)
code, _, err = run("run", "codex-light", "--brief", str(brief))
check(code == 2 and "not installed" in err, "run fails clearly (exit 2) when the CLI is not installed", err)
code, _, err = run("run", "kiro-light", "--brief", str(tmp / "nope.md"))
check(code == 2 and "cannot read the brief" in err, "run fails clearly (exit 2) when the brief is missing", err)
(tmp / "codex.off").rename(bindir / "codex")


def recorded():
    return json.loads(Path(os.environ["FAKE_ARGV_OUT"]).read_text())


def last_json(out):
    return json.loads(out.strip().splitlines()[-1])


code, out, err = run("run", "codex-standard", "--brief", str(brief), "--cwd", str(work))
res, rec = last_json(out), recorded()
prompt = rec["argv"][-1]
check(code == 0 and res["exit"] == 0 and res["template"] == "codex-standard" and (res["provider"], res["model"], res["effort"]) == ("codex", "gpt-6-luna", "high"),
      "run: result line names template, provider, model, effort and exit", out + err)
check(rec["argv"][:7] == ["exec", "--model", "gpt-6-luna", "-c", "model_reasoning_effort=high", "--sandbox", "workspace-write"]
      and prompt.endswith(BRIEF_TEXT) and (HERE.parent / "templates" / "_direct.md").read_text().strip() in prompt and len([a for a in rec["argv"] if BRIEF_TEXT in a]) == 1,
      "run: the prompt (direct-mode preamble + brief, quotes and $() intact) is ONE argv element", str(rec["argv"])[:300])
check(os.path.realpath(rec["cwd"]) == str(work) and rec["stdin"] == "", "run: cwd is --cwd and stdin is closed", str(rec))
check(Path(res["out"]) == work / "brief.out.md" and Path(res["out"]).read_text() == "final answer\n" and Path(res["log"]) == work / "brief.out.md.log"
      and "some log" in Path(res["log"]).read_text(), "run: the answer goes to <brief stem>.out.md, stderr to <out>.log", str(res))
check(res["usage"] is None and "timeout" not in res and isinstance(res["seconds"], float) and not Path("/tmp/pwned").exists(), "run: unknown usage is null; nothing went through a shell", str(res))

os.environ["FAKE_EXIT"] = "3"
custom_out = work / "x" / "answer.md"
code, out, _ = run("run", "codex-light", "--brief", str(brief), "--cwd", str(work), "--out", str(custom_out))
check(code == 3 and last_json(out)["exit"] == 3 and custom_out.exists(), "run: exit code is the CLI's, --out is honoured", out)
del os.environ["FAKE_EXIT"]

os.environ["FAKE_MODE"] = "sleep"
started = time.time()
code, out, _ = run("run", "codex-light", "--brief", str(brief), "--cwd", str(work), "--timeout", "0.02")
res = last_json(out)
check(code == 124 and res["exit"] == 124 and res["timeout"] is True and time.time() - started < 20, "run: a timeout kills the run and exits 124 with timeout true", out)
del os.environ["FAKE_MODE"]

# agy: `-p=<prompt>`, JSON answer extracted, usage from the group's drop in the weekly fraction
Path(os.environ["FAKE_AGY_STATE"]).write_text(json.dumps({"g": 0.9}))
code, out, err = run("run", "agy-argon", "--brief", str(brief), "--cwd", str(work))
res, rec = last_json(out), recorded()
check(code == 0 and res["template"] == "agy-second" and rec["argv"][:2] == ["--model", "gemini-4-neon-high"] and any(a.startswith("-p=") and a.endswith(BRIEF_TEXT) for a in rec["argv"])
      and "--output-format" in rec["argv"] and "--settings" in rec["argv"], "run agy-argon (alias): agy's flags, the prompt attached to -p=", str(rec["argv"])[:300] + err)
check(Path(res["out"]).read_text() == "agy says hi" and res["usage"] == {"provider": "agy", "amount": 5.0, "unit": "% of Gemini Models weekly"}, "run agy: the JSON `response` is the answer, usage is the group's drop", str(res))

# a Claude account: CLAUDE_CONFIG_DIR from the config, JSON `result`; usage unknown without a quota reading
(home / ".claude").mkdir()
(home / ".claude-uni").mkdir()
USER_CFG.write_text(json.dumps({"providers": {"claudeuni": {"kind": "claude", "config_dir": "~/.claude-uni", "label": "uni"}}}))
code, out, err = run("run", "claudeuni-deep", "--brief", str(brief), "--cwd", str(work))
res, rec = last_json(out), recorded()
check(code == 0 and rec["config_dir"] == str(home / ".claude-uni") and rec["argv"][0] == "-p" and rec["argv"][-1].endswith(BRIEF_TEXT)
      and rec["argv"][rec["argv"].index("--model") + 1] == "opus" and Path(res["out"]).read_text() == "final answer" and res["usage"] is None,
      "run claudeuni-deep: config dir in the environment, `result` as the answer, usage null", str(rec["argv"])[:200] + str(res))
USER_CFG.unlink()

code, _, err = run("run", "copilot-fusion-max", "--brief", str(brief))
check(code == 2 and "no headless command" in err, "run: a Fusion tier has no headless command (exit 2)", err)
code, _, err = run("run", "nope-deep", "--brief", str(brief))
check(code == 2 and "no template named" in err, "run: an unknown template is refused (exit 2)", err)
code, _, err = run("run", "codex-light")
check(code == 2 and "usage" in err, "run without --brief prints usage (exit 2)", err)

print(f"{failures} failure(s)")
sys.exit(1 if failures else 0)
