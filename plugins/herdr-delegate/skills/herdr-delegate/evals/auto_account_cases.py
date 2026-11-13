#!/usr/bin/env python3
"""Scripted evals for automatic discovery of other Claude accounts in helpers.py.

Each scenario builds its own temporary HOME / XDG_CONFIG_HOME with a fake claude binary on PATH, never the real
config. run.py starts this file in its own process. Exit 0 when every check passes.
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
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import helpers  # noqa: E402

failures = 0
ROOT = Path(tempfile.mkdtemp(prefix="herdr-delegate-auto-"))


def check(ok, label, detail=""):
    global failures
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} {label}" + (f": {detail}" if detail and not ok else ""))


def machine(name, dirs=(), session=None, readings=(), claude_cli=True):
    """A fresh machine: HOME with the given config dirs (name -> marker file or None for an empty dir)."""
    base = ROOT / name
    home = base / "home"
    home.mkdir(parents=True)
    bindir = base / "bin"
    bindir.mkdir()
    if claude_cli:
        (bindir / "claude").write_text("#!/bin/sh\nexit 0\n")
        (bindir / "claude").chmod(0o755 | stat.S_IXUSR)
    for d, marker in dict(dirs).items():
        (home / d).mkdir(parents=True, exist_ok=True)
        if marker:
            m = home / d / marker
            m.mkdir() if marker == "projects" else m.write_text("{}")
    os.environ.update(HOME=str(home), XDG_CONFIG_HOME=str(base / "cfg"), PATH=f"{bindir}:/usr/bin:/bin")
    os.environ.pop("CLAUDE_CONFIG_DIR", None)
    if session:
        os.environ["CLAUDE_CONFIG_DIR"] = str(home / session)
    for config_dir, label in readings:
        key = helpers.account_key(config_dir)
        helpers.write_json(base / "cfg" / "claude-accounts" / f"{key}.json",
                           {"version": 1, "key": key, "config_dir": config_dir, "label": label, "time": "2026-11-11T10:00:00Z"})
    return home, base / "cfg"


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = helpers.main(list(argv), dt.date(2026, 11, 11))
    return code, out.getvalue(), err.getvalue()


def claude_providers():
    cfg = json.loads(run("config")[1])
    return {n: p for n, p in cfg["providers"].items() if p["kind"] == "claude"}, cfg


def templates(cfg_dir):
    d = cfg_dir / "herdr-core" / "templates"
    return sorted(p.stem for p in d.glob("claude*.md")) if d.is_dir() else []


# --- one account: nothing
machine("single", {".claude": "settings.json"})
provs, cfg = claude_providers()
check(provs == {}, "one-account machine: no claude providers", str(provs))
check(run("pick", "standard")[0] in (0, 1) and "claudemain" not in run("render")[1], "one-account machine: render writes no claude template")

# --- the dir check: markers, and the home glob
home, cfgdir = machine("marks", {".claude": "projects", ".claude-empty": None, ".claude-backup.json": None, ".claude-uni": ".claude.json",
                                 ".claude_old": ".credentials.json", ".clauderc": "settings.json", ".claude-x": "other.txt"})
check([helpers.looks_like_claude_dir(home / d) for d in (".claude", ".claude-empty", ".claude-uni", ".claude_old", ".claude-x", ".nothere")]
      == [True, False, True, True, False, False], "a config dir holds .claude.json, .credentials.json, settings.json or projects/")
found = sorted(os.path.basename(w) for w, _ in helpers.discover_claude_dirs())
check(found == [".claude", ".claude-uni", ".claude_old"], "home folder: ~/.claude, ~/.claude-*, ~/.claude_* that look real", str(found))

# --- two config dirs: the other appears from each session
for session, other, other_name in ((".claude", ".claude-uni", "claudeuni"), (".claude-uni", ".claude", "claudemain")):
    home, cfgdir = machine("two" + session, {".claude": "settings.json", ".claude-uni": ".claude.json"}, session=session)
    provs, cfg = claude_providers()
    p = provs.get(other_name)
    check(p is not None and p["auto"] is True and p["config_dir"] == str(home / other) and p["cli_found"] is True and p["self"] is False
          and p["label"] == helpers.dir_label(str(home / other)), f"two dirs, session {session}: {other_name} is discovered (auto, label, cli_found)", str(provs))
    own = [n for n, q in provs.items() if q["self"]]
    check(len(provs) == 2 and len(own) == 1 and provs[own[0]]["auto"], f"two dirs, session {session}: the own account is there marked self", str(provs))
    names = {n.split("-")[0] for n in cfg["default_orders"]["standard"]}
    check(other_name in names and own[0] not in names, f"two dirs, session {session}: default orders have the other, not the own", str(cfg["default_orders"]))
    check(templates(cfgdir) == sorted(f"{n}-{t}" for n in provs for t in ("deep", "light", "standard")), f"two dirs, session {session}: config renders the templates", str(templates(cfgdir)))
    check(run("pick", f"{other_name}-light")[1].strip() == f"{other_name}-light", f"two dirs, session {session}: pick takes the other account", run("pick", f"{other_name}-light")[2])
    check(run("pick", f"{own[0]}-light")[0] == 1, f"two dirs, session {session}: pick skips the own account")
    check("(auto)" in run("account", "list")[1], f"two dirs, session {session}: account list marks auto accounts")

# --- readings-file-only discovery (the other dir has no marker, but a readings file and exists)
home, cfgdir = machine("readings", {".claude": "settings.json", "work/cfg": None})
machine_cfg_dir = str(home / "work" / "cfg")
helpers.write_json(cfgdir / "claude-accounts" / f"{helpers.account_key(machine_cfg_dir)}.json",
                   {"version": 1, "key": helpers.account_key(machine_cfg_dir), "config_dir": machine_cfg_dir, "label": "Work", "time": "2026-11-11T10:00:00Z"})
provs, _ = claude_providers()
check(sorted(provs) == ["claudecfg", "claudemain"], "readings file alone: the account is discovered", str(provs))
check(provs["claudecfg"]["label"] == "Work" and provs["claudecfg"]["config_dir"] == machine_cfg_dir, "readings file: its label and config_dir are used", str(provs["claudecfg"]))
shutil.rmtree(home / "work")
provs, _ = claude_providers()
check(provs == {}, "readings file whose dir no longer exists: skipped (and a one-account machine shows none)", str(provs))

# --- rm sticks
home, cfgdir = machine("rm", {".claude": "settings.json", ".claude-uni": ".claude.json"}, session=".claude")
claude_providers()
code, out, _ = run("account", "rm", "claudeuni")
user = json.loads((cfgdir / "herdr-delegate" / "helpers.json").read_text())
check(code == 0 and "removed" in out and user.get("excluded_accounts") == [helpers.account_key(str(home / ".claude-uni"))], "rm of an auto account records the exclusion", out + str(user))
provs, _ = claude_providers()
check(provs == {} and templates(cfgdir) == [], "rm of an auto account: gone, templates removed, not rediscovered", f"{provs} {templates(cfgdir)}")
check(run("account", "rm", "claudeuni")[0] == 1, "rm of a name that is not there fails")
# a manual add brings it back and clears the exclusion
code, out, _ = run("account", "add", "claudeuni", str(home / ".claude-uni"))
user = json.loads((cfgdir / "herdr-delegate" / "helpers.json").read_text())
check(code == 0 and "excluded_accounts" not in user, "account add of an excluded dir clears the exclusion", str(user))

# --- manual add overrides the auto one
home, cfgdir = machine("manual", {".claude": "settings.json", ".claude-uni": ".claude.json"}, session=".claude")
claude_providers()
run("account", "add", "claudeuni", str(home / ".claude-uni"), "--label", "university")
provs, _ = claude_providers()
check(sorted(provs) == ["claudemain", "claudeuni"], "manual add: no duplicate for the same dir", str(sorted(provs)))
check(provs["claudeuni"]["label"] == "university" and not provs["claudeuni"]["auto"], "manual add overrides the auto label and clears auto", str(provs["claudeuni"]))
run("account", "add", "workuni", str(home / ".claude-uni"))
provs, _ = claude_providers()
check(sorted(provs) == ["claudemain", "claudeuni", "workuni"], "a second name for one dir is the user's choice and kept", str(sorted(provs)))
# rm of the manual one: gone and not rediscovered
run("account", "rm", "claudeuni")
run("account", "rm", "workuni")
provs, _ = claude_providers()
check(provs == {}, "rm of manual accounts also sticks", str(provs))

# --- only offered when the claude CLI is on PATH
home, cfgdir = machine("nocli", {".claude": "settings.json", ".claude-uni": ".claude.json"}, session=".claude", claude_cli=False)
provs, cfg = claude_providers()
check(all(p["cli_found"] is False for p in provs.values()) and not any(n.startswith("claude") for t in cfg["default_orders"].values() for n in t)
      and templates(cfgdir) == [], "no claude CLI: not in default orders, no templates", str(cfg["default_orders"]))

print(f"{failures} failure(s)")
sys.exit(1 if failures else 0)
