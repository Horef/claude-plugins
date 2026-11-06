#!/usr/bin/env python3
"""Pick a helper template by priority and track provider quotas (stdlib only).

  helpers.py pick light|standard|deep|argon|fusion first usable template for a tier (default order)
  helpers.py pick kiro-deep,copilot-deep,...    first usable template from your own order
  helpers.py out <provider> [--until YYYY-MM-DD] mark a provider out of quota (default: 1st of next month)
  helpers.py login <provider>                   mark a provider as needing a fresh login (no expiry)
  helpers.py back <provider>                    clear either mark
  helpers.py status                             providers, installed or not, quota marks
  helpers.py prompt <name> [<name> ...]         print any permission prompt a helper's screen is waiting on

A template is usable when its file is in ~/.config/herdr-core/templates, its CLI is on
PATH, and its provider (the name before the first '-') has no quota or login mark in force.
Quota marks expire on their date by themselves; login marks last until `back`. `pick`
prints the template name, or nothing and exit code 1 when none is usable (then run the step with the harness's own subagent).
`prompt` reads each screen with `hc read` (Copilot reports no status to hc, so a wait cannot
see it blocked) and exits 0 when at least one is waiting on an approval, 1 when none is.
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
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
    # agy first: the owner's Copilot plan lacks gemini-4-argon and silently falls back to
    # Sonnet (O7), which defeats the point of a second model family.
    "argon": ["agy-argon", "copilot-argon"],
    # Opt-in only (the owner's choice, 2026-11-01): Copilot Fusion is a router, not a
    # pinned model, and its quality per tier is unmeasured; never in the tier orders above.
    "fusion": ["copilot-fusion-max", "copilot-fusion-high"],
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
                # Skip leading VAR=value assignments (the Fusion templates set feature flags).
                words = [w for w in line.split(":", 1)[1].split() if "=" not in w]
                return words[0] if words else None
    except OSError:
        return None
    return None


def usable(name, state, today):
    cli = command_of(name)
    return bool(cli) and shutil.which(cli) is not None and not is_out(state, name.split("-")[0], today)


# A pending approval box: a question, then a numbered option list and the key help line.
QUESTION = re.compile(r"Do you want to |Allow this |Do you trust ")
KEYS = re.compile(r"enter to select|esc to cancel")
BOX = str.maketrans("", "", "│╭╮╰╯─")


def pending_prompt(screen):
    """The prompt's lines (command, checks, question, options) if the screen is waiting on one."""
    lines = screen.splitlines()
    ask = max((i for i, l in enumerate(lines) if QUESTION.search(l)), default=None)
    if ask is None or not any(KEYS.search(l) for l in lines[ask:]):
        return None
    start = max(0, ask - 14)
    for i in range(ask, start - 1, -1):  # from the tool header (Copilot: "$ Shell ...") if near
        if lines[i].lstrip().startswith(("$ ", "Approval checks")):
            start = i
    out = [l.translate(BOX).strip() for l in lines[start:] if not KEYS.search(l)]
    return [l for l in out if l and not set(l) <= set("▄▀ ")]


def prompts(names):
    found = False
    for name in names:
        r = subprocess.run(["hc", "read", name], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"{name}: hc read failed: {(r.stderr or r.stdout).strip()}")
            continue
        got = pending_prompt(r.stdout)
        if got:
            found = True
            print(f"{name}: waiting on approval\n  " + "\n  ".join(got))
        else:
            print(f"{name}: no prompt")
    return 0 if found else 1


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
    if cmd == "prompt" and args:
        return prompts(args)
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
