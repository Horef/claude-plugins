#!/usr/bin/env python3
"""Scripted evals for the config, render, set, custom and models parts of helpers.py.

Runs against a temporary XDG_CONFIG_HOME and fake kiro-cli / agy / copilot binaries on PATH,
never the real config. run.py starts this file in its own process (so its patches of
helpers.py do not leak in). Exit 0 when every check passes, 1 otherwise.
"""
import contextlib
import datetime as dt
import io
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

KIRO_LIST = """Available models (* = default):

* auto                 1.00x credits      Models chosen by task for optimal usage
  claude-opus-5.5      2.00x credits      Claude Opus 5.5 model with 1M context window
  claude-sonnet-5.5    1.30x credits      Claude Sonnet 5.5 model
  claude-haiku-5.5     0.06x credits      Claude Haiku 5.5 model
  claude-opus-6        2.50x credits      Claude Opus 6 model
  claude-opus-4.8      2.20x credits      Claude Opus 4.8 model
  glm-5                0.50x credits      GLM-5 model
"""
AGY_LIST = (
    "Fetching available models...\n"
    "gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n"
    "gemini-3.8-flash-low\tGemini 3.8 Flash (Low)\n"
    "claude-opus-5-5-high\tClaude Opus 5.5 (High)\n"
    "claude-opus-5-5-medium\tClaude Opus 5.5 (Medium)\n"
    "claude-opus-5-5-low\tClaude Opus 5.5 (Low)\n"
    "claude-opus-5-6-high\tClaude Opus 5.6 (High)\n"
    "claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)\n"
    "claude-sonnet-5-5-low\tClaude Sonnet 5.5 (Low)\n"
)
ACP_MODELS = [
    {"modelId": "auto", "name": "Auto", "_meta": {"copilotEnablement": "enabled"}},
    {"modelId": "claude-sonnet-5.5", "name": "S", "_meta": {"copilotEnablement": "enabled"}},
    {"modelId": "claude-opus-5.5", "name": "O", "_meta": {"copilotEnablement": "enabled"}},
    {"modelId": "gpt-6-luna", "name": "L", "_meta": {"copilotEnablement": "enabled"}},
    {"modelId": "claude-sonnet-5.5", "name": "dup"},
    {"modelId": "gemini-4-argon", "name": "A", "_meta": {"copilotEnablement": "disabled"}},
]
ACP_LINES = [
    json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": 1}}),
    "not json",
    json.dumps({"jsonrpc": "2.0", "id": 2, "result": {"models": {"availableModels": ACP_MODELS}}}),
]

FAKE_COPILOT = f"""#!{sys.executable}
import json, os, sys
if os.environ.get("FAKE_COPILOT_FAIL"):
    sys.exit(3)
models = {ACP_MODELS!r}
for line in sys.stdin:
    msg = json.loads(line)
    result = {{"protocolVersion": 1}} if msg["id"] == 1 else {{"sessionId": "s", "models": {{"availableModels": models}}}}
    print(json.dumps({{"jsonrpc": "2.0", "id": msg["id"], "result": result}}), flush=True)
"""

failures = 0


def check(ok, label, detail=""):
    global failures
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} {label}" + (f": {detail}" if detail and not ok else ""))


def write_exe(path, text):
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


tmp = Path(tempfile.mkdtemp(prefix="herdr-delegate-eval-"))
bindir = tmp / "bin"
bindir.mkdir()
write_exe(bindir / "kiro-cli", f"#!{sys.executable}\nimport sys\nsys.exit(0) if sys.argv[1:2] == ['whoami'] else print({KIRO_LIST!r}, end='')\n")
write_exe(bindir / "agy", f"#!{sys.executable}\nprint({AGY_LIST!r}, end='')\n")
write_exe(bindir / "copilot", FAKE_COPILOT)
os.environ["XDG_CONFIG_HOME"] = str(tmp / "cfg")
os.environ["PATH"] = f"{bindir}:/usr/bin:/bin"
os.environ.pop("FAKE_COPILOT_FAIL", None)

import helpers  # noqa: E402

TEMPLATES = tmp / "cfg" / "herdr-core" / "templates"
USER_CFG = tmp / "cfg" / "herdr-delegate" / "helpers.json"


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = helpers.main(list(argv))
    return code, out.getvalue(), err.getvalue()


def tpl(name):
    return (TEMPLATES / f"{name}.md").read_text()


def command_line(name):
    return next(l for l in tpl(name).splitlines() if l.startswith("command: "))[len("command: "):]


# Fake agy output sanity (the shell quoting above is fiddly): it must list tab-separated rows.
agy_rows = helpers.parse_agy(helpers.run_text([str(bindir / "agy"), "models"]))
check("claude-opus-5-5-high" in agy_rows and len(agy_rows) == 8, "fake agy prints the canned list", str(agy_rows))

# --- render: expected commands, marker, check
code, out, _ = run("render", "--check")
check(code == 1 and "missing  kiro-light" in out, "render --check on an empty dir reports missing templates", out)
code, out, _ = run("render")
check(code == 0 and "wrote  kiro-light" in out, "render writes the templates", out)
check(command_line("kiro-light") == "kiro-cli chat --v3 --trust-workspace --model claude-haiku-5.5 --effort low", "kiro light is haiku 5.5 low", command_line("kiro-light"))
check(command_line("kiro-deep") == "kiro-cli chat --v3 --trust-workspace --model claude-opus-5.5 --effort high", "kiro deep", command_line("kiro-deep"))
check(command_line("copilot-light") == "copilot --no-ask-user --model gpt-6-luna --reasoning-effort high", "copilot light", command_line("copilot-light"))
check(command_line("agy-standard").startswith("agy --model claude-sonnet-5-5-high --mode auto"), "agy puts the level in the model id", command_line("agy-standard"))
_agy_settings = Path(os.environ["XDG_CONFIG_HOME"]) / "herdr-delegate" / "agy-settings.json"
check(_agy_settings.exists() and "command(git log)" in _agy_settings.read_text() and "command(hc send)" in _agy_settings.read_text()
      and command_line("agy-standard").endswith(f"--settings {_agy_settings}"), "render writes agy's allowlist and passes it with --settings")
check(command_line("agy-light").startswith("agy --model gemini-3.8-flash-high --mode auto"), "agy light", command_line("agy-light"))
check(command_line("copilot-fusion-max").endswith("copilot --no-ask-user --model auto --auto-tier hydrafusion-max")
      and command_line("copilot-fusion-max").startswith("COPILOT_CLI_ENABLED_FEATURE_FLAGS="), "fusion keeps its fixed command", command_line("copilot-fusion-max"))
check(all("generated-by: herdr-delegate" in tpl(p.stem) for p in TEMPLATES.glob("*.md")), "every rendered template carries the marker")
check(tpl("kiro-light").endswith(helpers.body_text()) and "name: kiro-light\n" in tpl("kiro-light"), "template = front matter + shared body")
# O25: a Claude-account helper with model-router installed must not open its own router plan.
check("model-router plan" in tpl("kiro-light") and "plan approval" in tpl("kiro-light"), "template body tells a helper not to open a model-router plan or wait for plan approval (O25)")
code, out, _ = run("render", "--check")
check(code == 0, "render --check is clean after render", out)
(TEMPLATES / "kiro-deep.md").write_text(tpl("kiro-deep").replace("--effort high", "--effort max"))
code, out, _ = run("render", "--check")
check(code == 1 and "differs  kiro-deep" in out, "render --check finds a changed generated file", out)
code, out, _ = run("render")
check("--effort high" in command_line("kiro-deep"), "render repairs a changed generated file")

# --- hand-made templates and orphans
(TEMPLATES / "kiro-standard.md").write_text("---\nname: kiro-standard\ncommand: mine\n---\nhand-made\n")
code, out, _ = run("render")
check("kept   kiro-standard" in out and "hand-made" in tpl("kiro-standard"), "render keeps a hand-made template", out)
code, out, _ = run("render", "--check")
check(code == 1 and "hand-made kiro-standard" in out, "render --check lists a hand-made template as drift", out)
code, out, _ = run("render", "--force")
check("--model claude-sonnet-5.5 --effort high" in command_line("kiro-standard"), "render --force replaces it")
(TEMPLATES / "reviewer.md").write_text("---\nname: reviewer\ncommand: x\n---\nmine\n")
(TEMPLATES / "kiro-old.md").write_text(tpl("kiro-deep").replace("name: kiro-deep", "name: kiro-old"))
code, out, _ = run("render")
check(not (TEMPLATES / "kiro-old.md").exists() and (TEMPLATES / "reviewer.md").exists(), "render removes a generated orphan, never a template it did not generate", out)

# --- config and set
code, out, _ = run("config")
cfg = json.loads(out)
check(cfg["providers"]["kiro"]["tiers"]["light"] == {"model": "claude-haiku-5.5", "effort": "low"}, "config prints the effective config")
code, out, err = run("set", "kiro", "deep", "effort=ultra")
check(code == 1 and "effort" in err and not USER_CFG.exists(), "set refuses an effort the provider does not accept and writes nothing", err)
code, out, err = run("set", "kiro", "deep", "effort=max")
check(code == 0 and "--effort max" in command_line("kiro-deep") and json.loads(USER_CFG.read_text())["providers"]["kiro"]["tiers"]["deep"] == {"effort": "max"},
      "set writes only the override and re-renders", out + err)
code, out, _ = run("config")
check(json.loads(out)["providers"]["kiro"]["tiers"]["deep"] == {"model": "claude-opus-5.5", "effort": "max"}, "overrides merge over the default")
code, out, err = run("set", "copilot", "fusion-max", "effort=high")
check(code == 1 and "fixed command" in err, "set refuses a router tier", err)
code, out, err = run("set", "nope", "deep", "model=a")
check(code == 1 and "unknown provider" in err, "set refuses an unknown provider", err)

# --- models: parsing and isolation
check(helpers.parse_kiro(KIRO_LIST) == ["auto", "claude-opus-5.5", "claude-sonnet-5.5", "claude-haiku-5.5", "claude-opus-6", "claude-opus-4.8", "glm-5"], "parse_kiro", str(helpers.parse_kiro(KIRO_LIST)))
check(helpers.parse_agy(AGY_LIST)[:2] == ["gemini-3.8-flash-high", "gemini-3.8-flash-low"] and len(helpers.parse_agy(AGY_LIST)) == 8, "parse_agy skips the progress line")
check(helpers.parse_acp(ACP_LINES) == ["auto", "claude-sonnet-5.5", "claude-opus-5.5", "gpt-6-luna"], "parse_acp keeps enabled models once", str(helpers.parse_acp(ACP_LINES)))
cr = helpers.parse_kiro_credits(KIRO_LIST)
check(set(cr) == set(helpers.parse_kiro(KIRO_LIST)) and all(isinstance(v, float) for v in cr.values()), "parse_kiro_credits", str(cr))
check(helpers.parse_kiro("garbage") == [] and helpers.parse_agy("") == [] and helpers.parse_acp(["{", "[]"]) == [], "parsers return [] on garbage")
os.environ["FAKE_COPILOT_FAIL"] = "1"
code, out, _ = run("models")
cache = json.loads((tmp / "cfg" / "herdr-delegate" / "models.json").read_text())
check(code == 0 and "error" in cache["copilot"] and "claude-opus-5.5" in cache["kiro"]["models"] and "claude-opus-5-5-high" in cache["agy"]["models"],
      "one CLI failing does not stop the others", out)
del os.environ["FAKE_COPILOT_FAIL"]
code, out, _ = run("models", "copilot")
cache = json.loads((tmp / "cfg" / "herdr-delegate" / "models.json").read_text())
check(cache["copilot"]["models"] == ["auto", "claude-sonnet-5.5", "claude-opus-5.5", "gpt-6-luna"] and "error" not in cache["copilot"], "copilot models come from the ACP session/new answer", out)
check("NOT OFFERED  copilot-argon: gemini-4-argon" in out, "a configured model that is not offered is reported", out)

# --- newer candidates
code, out, _ = run("models")
check("NEWER        kiro-deep: claude-opus-5.5 -> claude-opus-6" in out, "newer model in the same family (kiro)", out)
check("NEWER        agy-deep: claude-opus-5-5 -> claude-opus-5-6" in out, "newer model in the same family (agy, level stripped from the id)", out)
check("kiro-standard: claude-sonnet-5.5 ->" not in out and "kiro-light: claude-haiku-5.5 ->" not in out, "no false candidates", out)
check(helpers.family_version("claude-opus-5.5") == helpers.family_version("claude-opus-5-5") == ("claude-opus", (5, 5))
      and helpers.family_version("gemini-3.8-flash") == ("gemini-flash", (3, 8)), "family_version reads dotted and dashed versions")

# --- set against the cached list
code, out, err = run("set", "kiro", "standard", "model=claude-sonnet-9")
check(code == 1 and "not in kiro's model list" in err, "set refuses a model the cached list lacks", err)
code, out, err = run("set", "kiro", "standard", "model=claude-sonnet-9", "--force")
check(code == 0 and "claude-sonnet-9" in command_line("kiro-standard"), "set --force allows it", err)
code, out, err = run("set", "kiro", "standard", "model=claude-sonnet-5.5")
check(code == 0 and "claude-sonnet-5.5" in command_line("kiro-standard"), "set with a listed model works", err)

# --- status warning, cache staleness
code, out, _ = run("status")
check("WARNING: copilot-argon uses gemini-4-argon" in out, "status warns about a configured model no longer offered", out)
today = dt.date(2026, 11, 7)
check(helpers.models_stale(None, today) and helpers.models_stale({"date": "2026-10-20", "models": ["a"]}, today)
      and not helpers.models_stale({"date": "2026-11-05", "models": ["a"]}, today)
      and helpers.models_stale({"error": "x", "checked": "2026-11-06"}, today)
      and not helpers.models_stale({"error": "x", "checked": "2026-11-07"}, today), "cache older than 7 days (or a failure from an earlier day) is stale")
(TEMPLATES / "kiro-light.md").write_text(tpl("kiro-light").replace("haiku", "sonnet"))
code, out, _ = run("status")
check("WARNING: templates out of line" in out and "update kiro-light" in out, "status warns about template drift", out)
run("render")

# --- custom templates
code, out, err = run("custom", "copilot", "model=claude-opus-5.5", "effort=medium")
name = out.strip()
check(code == 0 and name == "copilot-claude-opus-5-5-medium" and command_line(name) == "copilot --no-ask-user --model claude-opus-5.5 --reasoning-effort medium"
      and "generated-by: herdr-delegate" in tpl(name), "custom renders <provider>-<model>-<effort> and prints its name", out + err)
code, out2, _ = run("custom", "copilot", "model=claude-opus-5.5", "effort=medium")
check(code == 0 and out2.strip() == name, "custom reuses an existing one")
code, out, _ = run("custom", "agy", "model=claude-opus-5-5", "effort=low")
check(out.strip() == "agy-claude-opus-5-5-low" and command_line("agy-claude-opus-5-5-low").startswith("agy --model claude-opus-5-5-low --mode auto"), "custom for agy puts the level in the id", out)
code, out, _ = run("pick", "copilot-claude-opus-5-5-medium,kiro-deep")
check(code == 0 and out.strip() == "copilot-claude-opus-5-5-medium", "pick accepts a custom name in an order", out)
code, out, err = run("custom", "copilot", "model=claude-opus-5.5", "effort=ultra")
check(code == 1 and "effort" in err, "custom validates the effort", err)
code, out, err = run("custom", "kiro", "model=made-up", "effort=low")
check(code == 1 and "model list" in err, "custom validates the model against the cached list", err)
code, out, _ = run("custom", "kiro", "model=claude-opus-5.5", "effort=high")
check(code == 0 and out.strip() == "kiro-claude-opus-5-5-high", "custom with the same model as a tier still gets its own name")
(TEMPLATES / "agy-claude-opus-5-5-medium.md").write_text("mine\n")
code, out, err = run("custom", "agy", "model=claude-opus-5-5", "effort=medium")
check(code == 1 and "hand-made" in err and (TEMPLATES / "agy-claude-opus-5-5-medium.md").read_text() == "mine\n", "custom never replaces a hand-made file", err)
(TEMPLATES / "agy-claude-opus-5-5-medium.md").unlink()
code, out, _ = run("render")
check((TEMPLATES / f"{name}.md").exists() and "removed" not in out, "render keeps custom templates listed in the config", out)
code, out, _ = run("custom")
check(sorted(out.split()) == ["agy-claude-opus-5-5-low", name, "kiro-claude-opus-5-5-high"], "custom lists them", out)
user = json.loads(USER_CFG.read_text())
user["custom"] = [e for e in user["custom"] if e["provider"] != "agy"]
USER_CFG.write_text(json.dumps(user))
code, out, _ = run("render")
check(not (TEMPLATES / "agy-claude-opus-5-5-low.md").exists() and (TEMPLATES / f"{name}.md").exists(), "render removes a generated custom template once it is not listed", out)
code, out, _ = run("custom", "--prune")
check(code == 0 and not (TEMPLATES / f"{name}.md").exists() and json.loads(USER_CFG.read_text())["custom"] == []
      and (TEMPLATES / "kiro-deep.md").exists() and (TEMPLATES / "reviewer.md").exists(), "custom --prune forgets all custom templates and nothing else", out)

# --- providers whose CLI is missing are skipped
os.environ["PATH"] = "/usr/bin:/bin"
code, out, _ = run("render", "--check")
check("skip     kiro-light (CLI not installed)" in out and code == 0, "render skips providers whose CLI is not installed", out)

print(f"{failures} failure(s)")
sys.exit(1 if failures else 0)
