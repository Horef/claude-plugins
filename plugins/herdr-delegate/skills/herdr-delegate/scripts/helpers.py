#!/usr/bin/env python3
"""Pick a helper template, render templates from a config, track models and quotas (stdlib only).

  helpers.py pick light|standard|deep|argon|fusion first usable template for a tier (default order)
  helpers.py pick kiro-deep,copilot-deep,...    first usable template from your own order (custom names too)
  helpers.py out <provider> [--until YYYY-MM-DD] mark a provider out of quota (default: 1st of next month)
  helpers.py login <provider>                   mark a provider as needing a fresh login (no expiry)
  helpers.py back <provider>                    clear either mark
  helpers.py status                             providers, quota marks, template drift, models no longer offered
  helpers.py prompt <name> [<name> ...]         print any permission prompt a helper's screen is waiting on
  helpers.py usage <name>                       the helper's session usage as JSON {provider, amount, unit}; run before hc kill

  helpers.py config                             the effective config (default + your overrides) as JSON
  helpers.py render [--check] [--force]         write ~/.config/herdr-core/templates from the config
  helpers.py set <provider> <tier> [model=X] [effort=Y] [--force]   change a tier's model/effort, then render
  helpers.py custom <provider> model=X effort=Y [--force]   render a one-off <provider>-<model>-<effort> template, print its name
  helpers.py custom [--prune]                   list custom templates, or forget them all
  helpers.py models [provider]                  ask the installed CLIs which models they offer; report gaps and newer ones

Config: helpers.default.json (shipped next to SKILL.md) merged under ~/.config/herdr-delegate/helpers.json
(only your overrides). Per provider: cli, command with {model} {effort} {model_id}, efforts, tiers.
A template is usable when its file is in ~/.config/herdr-core/templates, its CLI is on
PATH, and its provider (the name before the first '-') has no quota or login mark in force.
Quota marks expire on their date by themselves; login marks last until `back`, or until
`pick`/`status` find the provider logged in again (Kiro: `kiro-cli whoami`). `pick`
prints the template name, or nothing and exit code 1 when none is usable (then run the step with the harness's own subagent).
`prompt` reads each screen with `hc read` (Copilot reports no status to hc, so a wait cannot
see it blocked) and exits 0 when at least one is waiting on an approval, 1 when none is.
Rendered templates carry a `generated-by: herdr-delegate` line; render never touches a template without it unless --force.
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
MARK = "generated-by: herdr-delegate"


def cfg_home():
    return Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")


def templates_dir():
    return cfg_home() / "herdr-core" / "templates"


def state_file():
    return cfg_home() / "herdr-delegate" / "quota.json"


def user_config_file():
    return cfg_home() / "herdr-delegate" / "helpers.json"


def models_file():
    return cfg_home() / "herdr-delegate" / "models.json"

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
        return json.loads(state_file().read_text())
    except (OSError, ValueError):
        return {}


def save(state):
    write_json(state_file(), state)


def first_of_next_month(today):
    return (today.replace(day=1) + dt.timedelta(days=32)).replace(day=1)


def is_out(state, provider, today):
    until = state.get(provider)
    if until == "login":
        return True
    return bool(until) and today < dt.date.fromisoformat(until)


# Providers whose login can be checked: a login mark clears itself once this succeeds.
LOGIN_CHECK = {"kiro": ["kiro-cli", "whoami"]}


def logged_in(provider):
    cmd = LOGIN_CHECK.get(provider)
    if not cmd or not shutil.which(cmd[0]):
        return False
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return r.returncode == 0 and "not logged in" not in (r.stdout + r.stderr).lower()


def refresh_logins(state):
    """Clear login marks of providers that are logged in again (a mark used to last until `back`)."""
    cleared = [p for p, v in list(state.items()) if v == "login" and logged_in(p)]
    for p in cleared:
        state.pop(p)
        print(f"{p}: logged in again, login mark cleared", file=sys.stderr)
    if cleared:
        save(state)
    return cleared


def command_of(name):
    try:
        for line in (templates_dir() / f"{name}.md").read_text().splitlines():
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


# What a helper used, read from its screen (measured 2026-11-08). Kiro prints a line after
# every turn, the session figure running; Copilot keeps a running total in its status bar and
# prints a summary on exit. The last match on the screen is the current one. agy shows none on
# screen, but `agy -p /usage --output-format json` gives each model group's remaining weekly
# fraction: `pick` saves a snapshot when it picks an agy template and `usage` reports the
# drop since then, in percentage points of that group's weekly limit (measured 2026-11-09).
# Two agy helpers running at once share a group, so their figures overlap.
USAGE = {
    "kiro": (re.compile(r"Credits:\s*turn\s*[\d.]+\s*\S\s*session\s*([\d.]+)"), "credits"),
    "copilot": (re.compile(r"Session:\s*([\d.]+)\s*AIC used|AI Credits\s+([\d.]+)"), "AIC"),
}


def usage_of(provider, screen):
    """{provider, amount, unit} from the last usage line on a helper's screen, or None (none shown, or 0)."""
    known = USAGE.get(provider)
    if not known:
        return None
    pattern, unit = known
    found = [next(g for g in m.groups() if g) for m in pattern.finditer(screen)]
    amount = float(found[-1]) if found else 0.0
    return {"provider": provider, "amount": amount, "unit": unit} if amount > 0 else None


def agy_snapshot_file():
    return cfg_home() / "herdr-delegate" / "agy-usage.json"


def agy_weekly():
    """{group name: remaining weekly fraction} from agy's /usage, or {} when it can't be read."""
    out = run_text(["agy", "-p", "/usage", "--output-format", "json"], timeout=90)
    try:
        groups = json.loads(out)["command"]["data"]["groups"]
    except (ValueError, KeyError, TypeError):
        return {}
    got = {}
    for g in groups:
        for b in g.get("buckets", []):
            if b.get("window") == "weekly" and "remaining_fraction" in b:
                got[g["name"]] = float(b["remaining_fraction"])
    return got


def agy_group(model_id, groups):
    """The /usage group a model id draws on: Argon has its own, Claude and GPT share one, other Gemini the last."""
    m = model_id.lower()
    want = "argon" if "argon" in m else ("claude" if m.startswith(("claude", "gpt")) else "gemini")
    hits = [g for g in groups if want in g.lower()]
    if want == "gemini":
        hits = [g for g in hits if "argon" not in g.lower()]
    return hits[0] if hits else None


def agy_mark():
    """Save the weekly fractions before an agy helper starts (called by pick)."""
    now = agy_weekly()
    if now:
        write_json(agy_snapshot_file(), {"time": time.time(), "weekly": now})


def agy_usage(name):
    try:
        cmd = (templates_dir() / f"{name}.md").read_text()
    except OSError:
        cmd = ""
    m = re.search(r"--model\s+(\S+)", cmd)
    before = read_json(agy_snapshot_file(), {}).get("weekly", {})
    now = agy_weekly()
    group = agy_group(m.group(1) if m else "", list(now))
    if not m or not group or group not in before:
        return None
    used = round((before[group] - now[group]) * 100, 2)
    return {"provider": "agy", "amount": used, "unit": f"% of {group} weekly"} if used > 0 else None


def usage_cmd(name):
    """Print the helper's usage as JSON, or nothing (exit 1) when it shows none."""
    got = subprocess.run(["hc", "get", name], capture_output=True, text=True)
    try:
        template = json.loads(got.stdout).get("template") or ""
    except ValueError:
        template = ""
    provider = (template or name).split("-")[0]
    if provider == "agy":
        used = agy_usage(template or name)
        if not used:
            return 1
        print(json.dumps(used))
        return 0
    screen = subprocess.run(["hc", "read", name], capture_output=True, text=True)
    if screen.returncode != 0:
        print(f"{name}: hc read failed: {(screen.stderr or screen.stdout).strip()}", file=sys.stderr)
        return 1
    used = usage_of(provider, screen.stdout)
    if not used:
        return 1
    print(json.dumps(used))
    return 0


# ---------------------------------------------------------------- config and rendering

def read_json(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def deep_merge(base, over):
    out = dict(base)
    for key, val in over.items():
        out[key] = deep_merge(base[key], val) if isinstance(val, dict) and isinstance(base.get(key), dict) else val
    return out


def load_user_config():
    path = user_config_file()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except ValueError as err:
        print(f"warning: {path} is not valid JSON ({err}); ignored", file=sys.stderr)
        return {}
    return data if isinstance(data, dict) else {}


def effective_config():
    return deep_merge(json.loads((SKILL / "helpers.default.json").read_text()), load_user_config())


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fill(pattern, **values):
    for key, val in values.items():
        pattern = pattern.replace("{" + key + "}", val)
    return pattern


def settings_file(pname):
    """Where render writes a provider's per-session settings (agy: the command allowlist)."""
    return cfg_home() / "herdr-delegate" / f"{pname}-settings.json"


def command_for(pname, prov, model, effort):
    return fill(prov["command"], model=model, effort=effort, model_id=full_model_id(prov, model, effort),
                settings=str(settings_file(pname)))


def write_settings(cfg):
    """Write each provider's `settings` block to its file (agy reads it via --settings)."""
    for pname, prov in cfg.get("providers", {}).items():
        if "settings" in prov:
            write_json(settings_file(pname), prov["settings"])


def full_model_id(prov, model, effort):
    """The id the CLI is given: for agy the level is part of it (rule `model_id`)."""
    return fill(prov.get("model_id", "{model}"), model=model, effort=effort)


def template_specs(cfg):
    """name -> spec for every tier of every provider, plus the user's custom entries."""
    specs = {}
    texts = cfg.get("tier_text", {})
    for pname, prov in cfg.get("providers", {}).items():
        for tier, entry in prov.get("tiers", {}).items():
            name = f"{pname}-{tier}"
            model, effort = entry.get("model", ""), entry.get("effort", "")
            if "command" in entry:
                command = entry["command"]
                fixed = True
            else:
                command = command_for(pname, prov, model, effort)
                fixed = False
            text = f": {texts[tier]}" if tier in texts else ""
            desc = entry.get("description") or f"{prov.get('label', pname)} helper, {tier} tier ({model} {effort}){text}. {prov.get('note', '')}".strip()
            specs[name] = dict(provider=pname, tier=tier, model=model, effort=effort, command=command,
                               description=desc, custom=False, fixed=fixed)
    for entry in cfg.get("custom", []):
        pname, model, effort = entry.get("provider"), entry.get("model", ""), entry.get("effort", "")
        prov = cfg.get("providers", {}).get(pname)
        name = f"{pname}-{slug(model)}-{effort}"
        if not prov or name in specs:
            continue
        command = command_for(pname, prov, model, effort)
        desc = f"{prov.get('label', pname)} helper, custom ({model} {effort}). {prov.get('note', '')}".strip()
        specs[name] = dict(provider=pname, tier=None, model=model, effort=effort, command=command,
                           description=desc, custom=True, fixed=False)
    return specs


def body_text():
    return (SKILL / "templates" / "_body.md").read_text()


def render_text(name, spec):
    return f"---\nname: {name}\ndescription: {spec['description']}\ncommand: {spec['command']}\n{MARK}\n---\n{body_text()}"


def is_generated(text):
    lines = text.split("\n")
    if not lines or lines[0] != "---":
        return False
    for line in lines[1:]:
        if line == "---":
            return False
        if line == MARK:
            return True
    return False


def compute(cfg, force=False, only=None, orphans=None):
    """Plan a render: list of (kind, name). Kinds: new, update, same, handmade, overwrite, orphan, skip."""
    specs = template_specs(cfg)
    if orphans is None:
        orphans = only is None
    out = []
    for name in sorted(specs):
        if only is not None and name not in only:
            continue
        spec = specs[name]
        prov = cfg["providers"][spec["provider"]]
        if not shutil.which(prov.get("cli", "")):
            out.append(("skip", name))
            continue
        path = templates_dir() / f"{name}.md"
        want = render_text(name, spec)
        if not path.exists():
            out.append(("new", name))
            continue
        have = path.read_text()
        if not is_generated(have):
            out.append(("overwrite" if force else "handmade", name))
        else:
            out.append(("same" if have == want else "update", name))
    if orphans and templates_dir().is_dir():
        for path in sorted(templates_dir().glob("*.md")):
            if path.stem not in specs and is_generated(path.read_text()):
                out.append(("orphan", path.stem))
    return out


def apply_plan(cfg, plan):
    specs = template_specs(cfg)
    write_settings(cfg)
    templates_dir().mkdir(parents=True, exist_ok=True)
    for kind, name in plan:
        if kind in ("new", "update", "overwrite"):
            (templates_dir() / f"{name}.md").write_text(render_text(name, specs[name]))
        elif kind == "orphan":
            (templates_dir() / f"{name}.md").unlink()


LABEL_WRITE = dict(new="wrote  {n}", update="wrote  {n} (updated)", overwrite="wrote  {n} (replaced a hand-made file)",
                   same="same   {n}", handmade="kept   {n} (hand-made, no generated-by line; --force replaces it)",
                   orphan="removed {n} (generated, no longer in the config)", skip="skip   {n} (CLI not installed)")
LABEL_CHECK = dict(new="missing  {n}", update="differs  {n}", overwrite="hand-made {n}", same="same     {n}",
                   handmade="hand-made {n} (no generated-by line)", orphan="orphan   {n} (generated, no longer in the config)",
                   skip="skip     {n} (CLI not installed)")
DRIFT = {"new", "update", "handmade", "overwrite", "orphan"}


def render_cmd(args):
    check, force = "--check" in args, "--force" in args
    cfg = effective_config()
    plan = compute(cfg, force=force and not check)
    labels = LABEL_CHECK if check else LABEL_WRITE
    for kind, name in plan:
        print(labels[kind].format(n=name))
    if check:
        drift = [n for k, n in plan if k in DRIFT]
        print(f"{len(drift)} template(s) out of line with the config" if drift else "templates match the config")
        return 1 if drift else 0
    apply_plan(cfg, plan)
    return 0


def drift_summary(cfg):
    return [f"{k} {n}" for k, n in compute(cfg) if k in DRIFT]


# ---------------------------------------------------------------- models

def run_text(cmd, timeout=30):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} exited {r.returncode}: {(r.stderr or r.stdout).strip()[:200]}")
    return r.stdout


KIRO_ROW = re.compile(r"^\s*\*?\s*([A-Za-z0-9][\w.\-]*)\s+([\d.]+)x credits", re.M)


def parse_kiro(text):
    """`kiro-cli chat --list-models`: rows like `* auto   1.00x credits   description`."""
    return [m.group(1) for m in KIRO_ROW.finditer(text)]


def parse_kiro_credits(text):
    """The credit multiplier per model id, from the same rows (model-router orders helper models by it)."""
    return {m.group(1): float(m.group(2)) for m in KIRO_ROW.finditer(text)}


def parse_agy(text):
    """`agy models`: `<id><TAB><name>` rows after a progress line."""
    ids = []
    for line in text.splitlines():
        if "\t" in line:
            first = line.split("\t")[0].strip()
            if re.fullmatch(r"[\w.\-]+", first):
                ids.append(first)
    return ids


def parse_acp(lines):
    """Copilot ACP: the session/new result lists models.availableModels; keep the enabled ones."""
    for line in lines:
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        avail = ((msg.get("result") or {}).get("models") or {}).get("availableModels") if isinstance(msg, dict) else None
        if avail:
            ids = []
            for m in avail:
                enabled = (m.get("_meta") or {}).get("copilotEnablement", "enabled")
                if enabled == "enabled" and m.get("modelId") and m["modelId"] not in ids:
                    ids.append(m["modelId"])
            return ids
    return []


def fetch_acp(cli, timeout=30):
    """Copilot has no list command: ask its ACP server (initialize, then session/new) and read the model list."""
    import select
    import tempfile
    proc = subprocess.Popen([cli, "--acp"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    buf = b""
    seen = []
    deadline = time.time() + timeout

    def reply(want):
        nonlocal buf
        while time.time() < deadline:
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                text = line.decode("utf-8", "replace")
                seen.append(text)
                try:
                    if json.loads(text).get("id") == want:
                        return text
                except (ValueError, AttributeError):
                    pass
            ready, _, _ = select.select([proc.stdout], [], [], 1)
            if ready:
                chunk = os.read(proc.stdout.fileno(), 65536)
                if not chunk:
                    break
                buf += chunk
        raise RuntimeError("copilot --acp gave no answer in time")

    def send(obj):
        proc.stdin.write((json.dumps(obj) + "\n").encode())
        proc.stdin.flush()

    try:
        send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": 1, "clientCapabilities": {}}})
        reply(1)
        send({"jsonrpc": "2.0", "id": 2, "method": "session/new", "params": {"cwd": tempfile.gettempdir(), "mcpServers": []}})
        last = reply(2)
        return parse_acp([last])
    finally:
        proc.kill()
        proc.wait()


def fetch_kiro(cli):
    text = run_text([cli, "chat", "--list-models"])
    return parse_kiro(text), parse_kiro_credits(text)


FETCHERS = {
    "kiro-list": fetch_kiro,
    "agy-list": lambda cli: parse_agy(run_text([cli, "models"])),
    "copilot-acp": fetch_acp,
}


def family_version(model_id):
    """('claude-opus', (5, 5)) for claude-opus-5.5 and for claude-opus-5-5."""
    fam, ver = [], []
    for tok in model_id.lower().split("-"):
        if re.fullmatch(r"\d{1,5}(\.\d+)*", tok):
            ver += [int(x) for x in tok.split(".")]
        elif not re.fullmatch(r"\d{6,}", tok):
            fam.append(tok)
    return "-".join(fam), tuple(ver)


def base_of(prov, offered_id):
    """Strip the level from an offered id when the provider's ids carry it (agy)."""
    if prov.get("model_id", "{model}").endswith("-{effort}"):
        m = re.fullmatch(r"(.*)-(%s)" % "|".join(map(re.escape, prov.get("efforts", []))), offered_id)
        if m:
            return m.group(1)
    return offered_id


def load_models():
    return read_json(models_file(), {})


def not_offered():
    """Templates whose model the cached model lists say is not offered (a CLI would silently swap it, O7)."""
    try:
        return {name for name, _ in models_report(effective_config(), load_models())[0]}
    except Exception:  # a broken cache must never stop pick
        return set()


def refresh_models(cfg, providers=None, today=None):
    """Ask the installed CLIs for their models and cache the answer. One CLI failing does not stop the others."""
    today = (today or dt.date.today()).isoformat()
    cache = load_models()
    for pname, prov in cfg.get("providers", {}).items():
        if providers and pname not in providers:
            continue
        if not shutil.which(prov.get("cli", "")):
            continue
        old = cache.get(pname, {})
        fetch = FETCHERS.get(prov.get("models_source", ""))
        if not fetch:
            cache[pname] = dict(old, checked=today, error="no way to list models; relying on the configured ones")
            continue
        try:
            got = fetch(prov["cli"])
            ids, credits = got if isinstance(got, tuple) else (got, None)
            if not ids:
                raise RuntimeError("no models found in the output")
            cache[pname] = {"date": today, "checked": today, "models": ids}
            if credits:
                cache[pname]["credits"] = credits
        except Exception as err:  # noqa: BLE001 - any failure must leave the other providers alone
            cache[pname] = dict(old, checked=today, error=str(err)[:200])
    write_json(models_file(), cache)
    return cache


def models_stale(entry, today):
    if not entry:
        return True
    if entry.get("error") and entry.get("checked") != today.isoformat():
        return True
    if not entry.get("date"):
        return False  # a provider that cannot be listed: not worth retrying every week
    return (today - dt.date.fromisoformat(entry["date"])).days > 7


def models_report(cfg, cache):
    """(not offered, newer): lists of (template name, configured id[, candidate ids])."""
    missing, newer = [], []
    specs = template_specs(cfg)
    for name, spec in sorted(specs.items()):
        prov = cfg["providers"][spec["provider"]]
        offered = (cache.get(spec["provider"]) or {}).get("models")
        if spec["fixed"] or not offered or not spec["model"]:
            continue
        wanted = full_model_id(prov, spec["model"], spec["effort"])
        if wanted not in offered:
            missing.append((name, wanted))
        fam, ver = family_version(spec["model"])
        found = {}
        for oid in offered:
            base = base_of(prov, oid)
            f2, v2 = family_version(base)
            if f2 == fam and v2 > ver:
                found[base] = v2
        if found:
            newer.append((name, spec["model"], sorted(found, key=lambda b: found[b], reverse=True)))
    return missing, newer


def models_cmd(args, today=None):
    today = today or dt.date.today()
    cfg = effective_config()
    wanted = [a for a in args if not a.startswith("-")]
    cache = refresh_models(cfg, wanted or None, today)
    for pname in cfg["providers"]:
        if wanted and pname not in wanted:
            continue
        e = cache.get(pname)
        if not e:
            print(f"{pname:8} CLI not installed")
            continue
        n = len(e.get("models") or [])
        print(f"{pname:8} {n} models ({e.get('date', 'never listed')})" + (f"  ERROR: {e['error']}" if e.get("error") else ""))
    missing, newer = models_report(cfg, cache)
    for name, wid in missing:
        print(f"NOT OFFERED  {name}: {wid} (provider {name.split('-')[0]}); change it with: helpers.py set")
    for name, model, cands in newer:
        print(f"NEWER        {name}: {model} -> {', '.join(cands)}")
    if not missing and not newer:
        print("every configured model is offered; nothing newer in the same family")
    return 0


# ---------------------------------------------------------------- set and custom

def parse_kv(args):
    kv, rest = {}, []
    for a in args:
        if "=" in a and not a.startswith("-"):
            k, v = a.split("=", 1)
            kv[k] = v
        else:
            rest.append(a)
    return kv, rest


def validate_choice(cfg, provider, model, effort, force):
    """Error strings for a provider/model/effort choice (model checked against the cached list when known)."""
    prov = cfg.get("providers", {}).get(provider)
    if not prov:
        return [f"unknown provider {provider!r} (have: {', '.join(cfg.get('providers', {}))})"]
    errors = []
    if effort not in prov.get("efforts", []):
        errors.append(f"effort {effort!r} is not one of {prov.get('efforts')} for {provider} (edit 'efforts' in {user_config_file()} if the CLI gained a level)")
    offered = (load_models().get(provider) or {}).get("models")
    wid = full_model_id(prov, model, effort)
    if offered and wid not in offered and not force:
        errors.append(f"{wid!r} is not in {provider}'s model list (cached {load_models()[provider].get('date')}; helpers.py models lists them; --force to use it anyway)")
    return errors


def set_cmd(args):
    kv, rest = parse_kv(args)
    force = "--force" in rest
    rest = [a for a in rest if a != "--force"]
    if len(rest) != 2 or not set(kv) <= {"model", "effort"} or not kv:
        print("usage: helpers.py set <provider> <tier> [model=X] [effort=Y] [--force]", file=sys.stderr)
        return 2
    provider, tier = rest
    if provider not in effective_config()["providers"]:
        print(f"error: unknown provider {provider!r} (have: {', '.join(effective_config()['providers'])})", file=sys.stderr)
        return 1
    user = load_user_config()
    entry = user.setdefault("providers", {}).setdefault(provider, {}).setdefault("tiers", {}).setdefault(tier, {})
    entry.update(kv)
    cfg = deep_merge(json.loads((SKILL / "helpers.default.json").read_text()), user)
    got = cfg["providers"][provider].get("tiers", {}).get(tier, {})
    if "command" in got:
        errors = [f"{provider}-{tier} has a fixed command (a router); edit its command in {user_config_file()} instead"]
    elif not got.get("model") or not got.get("effort"):
        errors = ["a new tier needs both model= and effort="]
    else:
        errors = validate_choice(cfg, provider, got["model"], got["effort"], force)
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        return 1
    write_json(user_config_file(), user)
    print(f"{provider}-{tier}: {got['model']} {got['effort']} (saved to {user_config_file()})")
    plan = compute(cfg, only={f"{provider}-{tier}"})
    for kind, name in plan:
        print(LABEL_WRITE[kind].format(n=name))
    apply_plan(cfg, plan)
    return 0


def custom_cmd(args):
    kv, rest = parse_kv(args)
    if "--prune" in rest:
        user = load_user_config()
        user["custom"] = []
        write_json(user_config_file(), user)
        cfg = effective_config()
        plan = [p for p in compute(cfg, only=set(), orphans=True) if p[0] == "orphan"]
        for kind, name in plan:
            print(LABEL_WRITE[kind].format(n=name))
        apply_plan(cfg, plan)
        return 0
    cfg = effective_config()
    if not rest and not kv:
        for name, spec in sorted(template_specs(cfg).items()):
            if spec["custom"]:
                print(name)
        return 0
    force = "--force" in rest
    rest = [a for a in rest if a != "--force"]
    if len(rest) != 1 or set(kv) != {"model", "effort"}:
        print("usage: helpers.py custom <provider> model=X effort=Y [--force] | custom --prune | custom", file=sys.stderr)
        return 2
    provider, model, effort = rest[0], kv["model"], kv["effort"]
    errors = validate_choice(cfg, provider, model, effort, force)
    if not errors and not shutil.which(cfg["providers"][provider].get("cli", "")):
        errors = [f"{cfg['providers'][provider].get('cli')} is not installed"]
    name = f"{provider}-{slug(model)}-{effort}"
    if not errors and name in template_specs(dict(cfg, custom=[])):
        errors = [f"{name} is already a tier template; use that name"]
    path = templates_dir() / f"{name}.md"
    if not errors and path.exists() and not is_generated(path.read_text()):
        errors = [f"{path} exists and is hand-made; not replacing it"]
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        return 1
    user = load_user_config()
    entry = {"provider": provider, "model": model, "effort": effort}
    if entry not in user.setdefault("custom", []):
        user["custom"].append(entry)
        write_json(user_config_file(), user)
    cfg = deep_merge(json.loads((SKILL / "helpers.default.json").read_text()), user)
    plan = compute(cfg, only={name})
    apply_plan(cfg, plan)
    print(name)
    return 0


def config_cmd():
    print(json.dumps(effective_config(), indent=2, sort_keys=True))
    return 0


def status_warnings(today):
    """Drift and models-no-longer-offered lines for `status`."""
    cfg = effective_config()
    lines = []
    drift = drift_summary(cfg)
    if drift:
        lines.append(f"WARNING: templates out of line with the config ({', '.join(drift)}); run helpers.py render --check")
    cache = load_models()
    stale = [p for p, prov in cfg["providers"].items() if shutil.which(prov.get("cli", "")) and models_stale(cache.get(p), today)]
    if stale:
        cache = refresh_models(cfg, stale, today)
    for name, wid in models_report(cfg, cache)[0]:
        lines.append(f"WARNING: {name} uses {wid}, which {name.split('-')[0]} no longer offers; change it with helpers.py set")
    return lines


def main(argv, today=None):
    today = today or dt.date.today()
    if not argv:
        print(__doc__)
        return 2
    cmd, args = argv[0], argv[1:]
    state = load()
    if cmd in ("pick", "status"):
        refresh_logins(state)
    if cmd == "pick" and args:
        order = ORDER.get(args[0]) or [s.strip() for s in args[0].split(",") if s.strip()]
        absent = not_offered()
        for name in order:
            if name in absent:
                print(f"skipped {name}: its model is not offered (last `helpers.py models`)", file=sys.stderr)
                continue
            if usable(name, state, today):
                if name.split("-")[0] == "agy":
                    agy_mark()
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
    if cmd == "usage" and len(args) == 1:
        return usage_cmd(args[0])
    if cmd == "status":
        names = sorted(p.stem for p in templates_dir().glob("*.md")) if templates_dir().is_dir() else []
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
        for line in status_warnings(today):
            print(line)
        return 0
    if cmd == "config":
        return config_cmd()
    if cmd == "render":
        return render_cmd(args)
    if cmd == "set":
        return set_cmd(args)
    if cmd == "custom":
        return custom_cmd(args)
    if cmd == "models":
        return models_cmd(args, today)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
