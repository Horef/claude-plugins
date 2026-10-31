#!/usr/bin/env python3
"""Pick a helper template by priority and track provider quotas (stdlib only).

  helpers.py pick light|standard|deep|argon     first usable template for a tier (default order)
  helpers.py pick kiro-deep,copilot-deep,...    first usable template from your own order
  helpers.py out <provider> [--until YYYY-MM-DD] mark a provider out of quota (default: 1st of next month)
  helpers.py login <provider>                   mark a provider as needing a fresh login (no expiry)
  helpers.py back <provider>                    clear either mark
  helpers.py status                             providers, installed or not, quota marks

A template is usable when its file is in ~/.config/herdr-core/templates, its CLI is on
PATH, and its provider (the name before the first '-') has no quota or login mark in force.
Quota marks expire on their date by themselves; login marks last until `back`. `pick`
prints the template name, or nothing and exit code 1 when none is usable (then run the step with the harness's own subagent).
"""
import datetime as dt
import json
import os
import shutil
import sys
from pathlib import Path

CFG = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
TEMPLATES = CFG / "herdr-core" / "templates"
STATE = CFG / "herdr-delegate" / "quota.json"

# Kiro, then Copilot (bigger quotas, monthly reset), then agy (a small personal plan),
# at every tier: agy only when both others are out.
ORDER = {
    "light": ["kiro-light", "copilot-light", "agy-light"],
    "standard": ["kiro-standard", "copilot-standard", "agy-standard"],
    "deep": ["kiro-deep", "copilot-deep", "agy-deep"],
    "argon": ["copilot-argon", "agy-argon"],
}


def load():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def first_of_next_month(today):
    return (today.replace(day=1) + dt.timedelta(days=32)).replace(day=1)


def is_out(state, provider, today):
    until = state.get(provider)
    if until == "login":
        return True
    return bool(until) and today < dt.date.fromisoformat(until)


def command_of(name):
    try:
        for line in (TEMPLATES / f"{name}.md").read_text().splitlines():
            if line.startswith("command:"):
                return line.split(":", 1)[1].split()[0]
    except OSError:
        return None
    return None


def usable(name, state, today):
    cli = command_of(name)
    return bool(cli) and shutil.which(cli) is not None and not is_out(state, name.split("-")[0], today)


def main(argv, today=None):
    today = today or dt.date.today()
    if not argv:
        print(__doc__)
        return 2
    cmd, args = argv[0], argv[1:]
    state = load()
    if cmd == "pick" and args:
        order = ORDER.get(args[0]) or [s.strip() for s in args[0].split(",") if s.strip()]
        for name in order:
            if usable(name, state, today):
                print(name)
                return 0
        return 1
    if cmd == "out" and args:
        until = args[2] if len(args) >= 3 and args[1] == "--until" else first_of_next_month(today).isoformat()
        state[args[0]] = until
        save(state)
        print(f"{args[0]} out of quota until {until}")
        return 0
    if cmd == "login" and args:
        state[args[0]] = "login"
        save(state)
        print(f"{args[0]} needs a fresh login; `back {args[0]}` once the person has logged in")
        return 0
    if cmd == "back" and args:
        state.pop(args[0], None)
        save(state)
        print(f"{args[0]} back")
        return 0
    if cmd == "status":
        names = sorted(p.stem for p in TEMPLATES.glob("*.md")) if TEMPLATES.is_dir() else []
        for provider in sorted({n.split("-")[0] for n in names} | set(state)):
            mine = [n for n in names if n.split("-")[0] == provider]
            cli = command_of(mine[0]) if mine else None
            where = "installed" if cli and shutil.which(cli) else "not installed"
            quota = "ok"
            if state.get(provider) == "login":
                quota = "needs login"
            elif is_out(state, provider, today):
                quota = f"out until {state[provider]}"
            print(f"{provider:10} {where:14} quota {quota:22} {', '.join(mine)}")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
