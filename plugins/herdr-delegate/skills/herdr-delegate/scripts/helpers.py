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

  helpers.py config [--json]                    the effective config (default + your overrides) as JSON, each provider with
                                                kind, config_dir, label, unit, order, cli_found, self, auto; plus default_orders per tier
  helpers.py account list                       the Claude accounts (found by themselves, see below), their quota readings, which is this session's
  helpers.py account add <name> <config_dir> [--label L]   configure one by hand (overrides the auto-discovered one of that dir)
  helpers.py account rm <name>                  remove one; an auto-discovered account stays out (excluded_accounts in your config)
  helpers.py render [--check] [--force]         write ~/.config/herdr-core/templates from the config
  helpers.py set <provider> <tier> [model=X] [effort=Y] [--force]   change a tier's model/effort, then render
  helpers.py custom <provider> model=X effort=Y [--force]   render a one-off <provider>-<model>-<effort> template, print its name
  helpers.py custom [--prune]                   list custom templates, or forget them all
  helpers.py models [provider]                  ask the installed CLIs which models they offer; report gaps and newer ones

Config: helpers.default.json (shipped next to SKILL.md) merged under $XDG_CONFIG_HOME/herdr-delegate/helpers.json
(default ~/.config; only your overrides). Per provider: cli, command with {model} {effort} {model_id} {config_dir},
efforts, tiers, order (default pick order, lowest first; `tier_order` per tier), unit (what `usage` reports), and
optional sources that make a provider plug in: login_check, usage_screen, usage_source, quota_source, models_source.
A provider with kind "claude" and a config_dir is Claude Code under another account (see `account`).
Other Claude accounts are found by themselves (marked "auto": true) when the machine has two or more: from the
claude-accounts readings files (config_dir, label) and from ~/.claude, ~/.claude-*, ~/.claude_* in the home folder
that hold .claude.json, .credentials.json, settings.json or projects/ (plus this session's own dir). `pick`, `status`
and `config` render their templates; no `account add` needed. A one-account machine has none.
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
import hashlib
import json
import os
import re
import shlex
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

NAME_OK = re.compile(r"[a-z][a-z0-9]*")  # a provider is the template name before the first '-'


def provider_order(prov):
    return prov.get("order", 100)


def tier_names(cfg, group):
    """Template names for a tier (or an opt-in group such as fusion), best first.

    Providers sort by their `order` (a provider's `tier_order` can move it for one tier); a tier entry
    with `opt_in: <group>` is in no tier's default order and is reached only by `pick <group>`.
    """
    rows = []
    for pname, prov in cfg.get("providers", {}).items():
        if not NAME_OK.fullmatch(pname):
            continue
        for tier, entry in prov.get("tiers", {}).items():
            opt = entry.get("opt_in")
            if opt and opt == group:
                rows.append(((provider_order(prov), entry.get("rank", 0), pname), f"{pname}-{tier}"))
            elif not opt and tier == group:
                rows.append(((prov.get("tier_order", {}).get(tier, provider_order(prov)), 0, pname), f"{pname}-{tier}"))
    return [name for _, name in sorted(rows)]


class _Orders:
    """ORDER[tier]: the default pick order for a tier, computed from the effective config."""

    def get(self, tier, default=None):
        return tier_names(effective_config(), tier) or default

    def __getitem__(self, tier):
        got = self.get(tier)
        if got is None:
            raise KeyError(tier)
        return got


ORDER = _Orders()


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


def logged_in(provider):
    """True when the provider's `login_check` command (config) succeeds; a login mark clears itself then."""
    cmd = effective_config().get("providers", {}).get(provider, {}).get("login_check")
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
                text = line.split(":", 1)[1]
                try:
                    words = shlex.split(text)
                except ValueError:
                    words = text.split()
                # Skip leading VAR=value assignments (Fusion's feature flags, a Claude account's CLAUDE_CONFIG_DIR) and a
                # leading `env [-u NAME]...` (the default Claude account unsets CLAUDE_CONFIG_DIR).
                words = [w for w in words if not re.match(r"[A-Za-z_]\w*=", w)]
                if words and words[0] == "env":
                    words = words[1:]
                    while len(words) >= 2 and words[0] == "-u":
                        words = words[2:]
                return words[0] if words else None
    except OSError:
        return None
    return None


# ---------------------------------------------------------------- Claude accounts, quota readings

def home():
    return Path(os.path.expanduser("~"))


def written_dir(path):
    """A config dir as Claude Code sees it: tilde expanded, no trailing slash."""
    text = os.path.expanduser(path)
    return text.rstrip("/") or "/"


def account_key(written):
    """"default" for ~/.claude, else the first 8 hex of sha256 of the dir as written (Claude Code's Keychain suffix)."""
    written = written_dir(written)
    if os.path.realpath(written) == os.path.realpath(home() / ".claude"):
        return "default"
    return hashlib.sha256(written.encode()).hexdigest()[:8]


def session_dir():
    """This session's Claude config dir as written ($CLAUDE_CONFIG_DIR, else ~/.claude)."""
    return os.environ.get("CLAUDE_CONFIG_DIR") or str(home() / ".claude")


def is_self(prov):
    """True for a kind=claude provider whose config dir is the current session's own."""
    if prov.get("kind") != "claude" or not prov.get("config_dir"):
        return False
    return os.path.realpath(written_dir(prov["config_dir"])) == os.path.realpath(written_dir(session_dir()))


def accounts_dir():
    return cfg_home() / "claude-accounts"


def dir_label(written):
    """The default label of a config dir: its basename without a leading .claude- / .claude, "main" for ~/.claude."""
    if account_key(written) == "default":
        return "main"
    base = os.path.basename(written_dir(written))
    for lead in (".claude-", ".claude"):
        if base.startswith(lead) and len(base) > len(lead):
            return base[len(lead):]
    return base.lstrip(".") or "account"


# Markers of a real Claude Code config dir: any one of these inside it (the credentials file and
# `.claude.json` exist only after a login; `settings.json` and `projects/` after any use).
CONFIG_DIR_MARKERS = (".claude.json", ".credentials.json", "settings.json", "projects")


def looks_like_claude_dir(path):
    """True for a directory that holds at least one of CONFIG_DIR_MARKERS."""
    p = Path(written_dir(str(path)))
    try:
        return p.is_dir() and any((p / m).exists() for m in CONFIG_DIR_MARKERS)
    except OSError:
        return False


def discover_claude_dirs():
    """Candidate Claude accounts on this machine as [(config_dir as written, readings label or None)].

    Sources: the claude-accounts readings files (their config_dir and label; a reading proves it is a Claude dir),
    this session's own dir, and ~/.claude plus ~/.claude-* / ~/.claude_* in the home folder that look like Claude
    Code config dirs (looks_like_claude_dir). Dirs that no longer exist are skipped; one entry per real path,
    readings first so their label wins.
    """
    found, seen = [], set()

    def add(written, label=None, require_markers=True):
        written = written_dir(str(written))
        real = os.path.realpath(written)
        if real in seen or not os.path.isdir(real):
            return
        if require_markers and not looks_like_claude_dir(written):
            return
        seen.add(real)
        found.append((written, label))

    try:
        files = sorted(accounts_dir().glob("*.json"))
    except OSError:
        files = []
    for f in files:
        data = read_json(f, None)
        if isinstance(data, dict) and isinstance(data.get("config_dir"), str) and data["config_dir"]:
            label = data.get("label")
            add(data["config_dir"], label if isinstance(label, str) and label.strip() else None, require_markers=False)
    add(session_dir(), require_markers=False)
    try:
        names = sorted(n for n in os.listdir(home()) if n == ".claude" or n.startswith((".claude-", ".claude_")))
    except OSError:
        names = []
    for n in names:
        add(home() / n)
    return found


def auto_name(written, taken):
    """A provider name for an auto-discovered account: "claude" + its default label's letters and digits (claudeuni)."""
    base = "claude" + re.sub(r"[^a-z0-9]", "", dir_label(written).lower())
    name = base
    if name in taken:
        name = base + account_key(written)[:4]
    n = 2
    while name in taken:
        name = f"{base}{n}"
        n += 1
    return name


def add_auto_accounts(cfg, user):
    """Add the other Claude accounts found on this machine to cfg["providers"] as kind=claude with "auto": true.

    Nothing is added on a one-account machine. With two or more accounts all appear, this session's own marked
    `self` by is_self (so each session sees the same set and the shared templates stay the same). An account
    already configured by hand (`account add`, same real dir) wins; keys listed in the user config's
    `excluded_accounts` (`account rm` of an auto account) are not offered again.
    """
    providers = cfg.setdefault("providers", {})
    excluded = {str(k) for k in user.get("excluded_accounts", [])} if isinstance(user.get("excluded_accounts"), list) else set()
    manual = {os.path.realpath(written_dir(p["config_dir"])) for p in providers.values()
              if isinstance(p, dict) and p.get("kind") == "claude" and p.get("config_dir")}
    cands = [(w, lab) for w, lab in discover_claude_dirs() if account_key(w) not in excluded]
    autos = [(w, lab) for w, lab in cands if os.path.realpath(w) not in manual]
    if not autos or len(manual | {os.path.realpath(w) for w, _ in autos}) < 2:
        return cfg
    for written, label in autos:
        name = auto_name(written, set(providers))
        providers[name] = {"kind": "claude", "config_dir": written, "label": label or dir_label(written), "auto": True}
    return cfg


def auto_account_templates(cfg):
    """Make the templates of auto-discovered accounts match the config (pick, status and config call this: there is
    no `account add` step for these); returns the lines to report. Hand-made files are left alone; a generated
    claude-account template whose account is gone (or was `rm`-ed) is removed."""
    names = {f"{n}-{t}" for n, p in cfg.get("providers", {}).items() if p.get("auto") for t in p.get("tiers", {})}
    plan = [p for p in compute(cfg, only=names, orphans=False) if p[0] in ("new", "update")]
    specs = template_specs(cfg)
    if templates_dir().is_dir():
        for path in sorted(templates_dir().glob("*.md")):
            try:
                text = path.read_text()
            except OSError:
                continue
            if path.stem not in specs and is_generated(text) and "CLAUDE_CONFIG_DIR" in text:
                plan.append(("orphan", path.stem))
    if plan:
        apply_plan(cfg, plan)
    return [LABEL_WRITE[k].format(n=n) for k, n in plan]


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def iso_epoch(text):
    return dt.datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def read_account(key):
    """A readings file as {five_hour, seven_day: (percent, resets_at epoch)}, or None when absent or unreadable."""
    data = read_json(accounts_dir() / f"{key}.json", None)
    if not isinstance(data, dict):
        return None
    got = {}
    try:
        for win in ("five_hour", "seven_day"):
            w = data.get(win)
            if isinstance(w, dict) and "percent" in w:
                got[win] = (float(w["percent"]), iso_epoch(w["resets_at"]) if w.get("resets_at") else None)
    except (ValueError, TypeError):
        return None
    return got or None


def effective_percent(window, now):
    """A window's percent, or 0 once its reset time has passed."""
    percent, resets = window
    return 0.0 if resets is not None and resets <= now else percent


LIMITS = {"five_hour": 95.0, "seven_day": 98.0}


def reading_blocked(reading, now):
    """When a reading says 5h >= 95 % or 7d >= 98 % (not yet reset): the reset time as text, else None."""
    for win, limit in LIMITS.items():
        w = reading.get(win)
        if w and effective_percent(w, now) >= limit:
            return dt.datetime.fromtimestamp(w[1], dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if w[1] else "its reset"
    return None


def codex_home():
    return Path(os.environ.get("CODEX_HOME") or home() / ".codex")


def codex_windows(items):
    """[(percent, window seconds, resets epoch)] -> {five_hour, seven_day}: a window of 6 h or less is the 5h one, the longest the other."""
    items = sorted((i for i in items if i[0] is not None), key=lambda i: i[1] or 0)
    got = {}
    if items and (items[0][1] or 0) <= 6 * 3600:
        got["five_hour"] = (float(items[0][0]), items[0][2])
        items = items[1:]
    if items:
        got["seven_day"] = (float(items[-1][0]), items[-1][2])
    return got


def parse_wham(data):
    """{five_hour, seven_day} from the usage endpoint's JSON (rate_limit.primary_window / secondary_window)."""
    rl = (data or {}).get("rate_limit") or {}
    items = []
    for key in ("primary_window", "secondary_window"):
        w = rl.get(key)
        if isinstance(w, dict) and w.get("used_percent") is not None:
            items.append((w["used_percent"], w.get("limit_window_seconds"), w.get("reset_at")))
    got = codex_windows(items)
    if rl.get("limit_reached") is True and "seven_day" not in got:
        got["seven_day"] = (100.0, items[-1][2] if items else None)
    return got


def parse_rollout_line(line):
    """{five_hour, seven_day} from a Codex session-file line carrying rate_limits (resets_at in unix seconds)."""
    try:
        rl = (json.loads(line).get("payload") or {}).get("rate_limits") or {}
    except (ValueError, AttributeError):
        return {}
    items = []
    for key in ("primary", "secondary"):
        w = rl.get(key)
        if isinstance(w, dict) and w.get("used_percent") is not None:
            items.append((w["used_percent"], (w.get("window_minutes") or 0) * 60, w.get("resets_at")))
    return codex_windows(items)


def codex_live():
    try:
        tokens = json.loads((codex_home() / "auth.json").read_text())["tokens"]
        import urllib.request
        req = urllib.request.Request("https://chatgpt.com/backend-api/wham/usage", headers={
            "Authorization": "Bearer " + tokens["access_token"], "ChatGPT-Account-Id": tokens["account_id"],
            "User-Agent": "herdr-delegate"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return parse_wham(json.load(r))
    except Exception:  # noqa: BLE001 - no login, offline or a changed endpoint all mean: use the session files
        return {}


def codex_sessions(limit=6):
    """The newest rate-limit figures in the latest few Codex session files (tail of each)."""
    files = sorted((codex_home() / "sessions").glob("**/rollout-*.jsonl"), reverse=True)[:limit]
    for f in files:
        try:
            with open(f, "rb") as fh:
                fh.seek(0, 2)
                fh.seek(max(0, fh.tell() - 1_000_000))
                lines = fh.read().decode("utf-8", "replace").splitlines()
        except OSError:
            continue
        for line in reversed(lines):
            if '"rate_limits"' in line:
                got = parse_rollout_line(line)
                if got:
                    return got
    return {}


# Quota sources a provider names with `quota_source` (kind "claude" implies claude-readings):
# name -> function(provider config) -> {five_hour, seven_day: (percent, resets epoch)} or {}.
QUOTA_SOURCES = {
    "claude-readings": lambda prov: read_account(account_key(prov["config_dir"])) or {},
    "codex": lambda prov: codex_live() or codex_sessions(),
}


def quota_source(prov):
    return prov.get("quota_source") or ("claude-readings" if prov.get("kind") == "claude" and prov.get("config_dir") else None)


def provider_quota(prov):
    fn = QUOTA_SOURCES.get(quota_source(prov) or "")
    return fn(prov) if fn else {}


def unusable_reason(provider, cfg=None, now=None):
    """Why a provider cannot take work, from the config and its quota reading (this account, out), or None."""
    try:
        prov = (cfg or effective_config()).get("providers", {}).get(provider)
        if not prov:
            return None
        if is_self(prov):
            return "this account"
        if quota_source(prov):
            until = reading_blocked(provider_quota(prov), (now or now_utc()).timestamp())
            if until:
                return f"out of quota until {until} (its quota reading)"
    except Exception:  # noqa: BLE001 - a broken reading must never stop pick
        return None
    return None


def usable(name, state, today, check_config=True):
    cli = command_of(name)
    provider = name.split("-")[0]
    return (bool(cli) and shutil.which(cli) is not None and not is_out(state, provider, today)
            and (not check_config or unusable_reason(provider) is None))


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


# What a helper used. A provider's `usage_source` says how: "screen" (default when it has a
# `usage_screen` {pattern, unit} in the config), "agy-weekly" or "quota-delta".
# Screen (measured 2026-11-08): Kiro prints a line after every turn, the session figure running;
# Copilot keeps a running total in its status bar and prints a summary on exit. The last match
# on the screen is the current one.
# agy-weekly: agy shows none on screen, but `agy -p /usage --output-format json` gives each model
# group's remaining weekly fraction: `pick` saves a snapshot when it picks an agy template and
# `usage` reports the drop since then, in percentage points of that group's weekly limit
# (measured 2026-11-09). Two agy helpers running at once share a group, so their figures overlap.
# quota-delta (kind "claude" accounts, Codex): the rise of the provider's 7d percent since the
# snapshot `pick` saved.
# Both differences are the account's, not the helper's: anything else running on the account in that
# time is in them, and `usage` says so on stderr (O24).
def usage_of(provider, screen):
    """{provider, amount, unit} from the last usage line on a helper's screen, or None (none shown, or 0)."""
    known = effective_config().get("providers", {}).get(provider, {}).get("usage_screen")
    if not known:
        return None
    pattern = re.compile(known["pattern"])
    found = [next(g for g in m.groups() if g) for m in pattern.finditer(screen)]
    amount = float(found[-1]) if found else 0.0
    return {"provider": provider, "amount": amount, "unit": known["unit"]} if amount > 0 else None


def usage_source(prov):
    return prov.get("usage_source") or ("quota-delta" if quota_source(prov) else "screen")


def quota_snapshot_file():
    return cfg_home() / "herdr-delegate" / "quota-snapshots.json"


def seven_day_percent(prov, now=None):
    got = provider_quota(prov).get("seven_day")
    return round(effective_percent(got, (now or now_utc()).timestamp()), 2) if got else None


def quota_mark(provider, prov):
    """Save the provider's 7d percent before a helper starts (called by pick)."""
    snaps = read_json(quota_snapshot_file(), {})
    now = seven_day_percent(prov)
    if now is None:
        snaps.pop(provider, None)
    else:
        snaps[provider] = {"time": time.time(), "seven_day": now}
    write_json(quota_snapshot_file(), snaps)


def quota_usage(provider, prov):
    """{provider, amount, unit}: the 7d percent-point rise since the snapshot, or None when unknown or not positive."""
    before = read_json(quota_snapshot_file(), {}).get(provider, {}).get("seven_day")
    now = seven_day_percent(prov)
    if before is None or now is None or now - before <= 0:
        return None
    return {"provider": provider, "amount": round(now - before, 2), "unit": prov.get("unit") or "% of 7d"}


def mark_usage(provider, prov):
    """What `pick` records before a helper of this provider starts, so `usage` can report the difference."""
    source = usage_source(prov)
    if source == "agy-weekly":
        agy_mark()
    elif source == "quota-delta":
        quota_mark(provider, prov)


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
    prov = effective_config().get("providers", {}).get(provider, {})
    source = usage_source(prov)
    if source in ("agy-weekly", "quota-delta"):
        used = agy_usage(template or name) if source == "agy-weekly" else quota_usage(provider, prov)
        if not used:
            return 1
        print(json.dumps(used))
        # O24: three parallel helpers on one account each printed the shared rise; summed, 52 % for a real 19 %.
        print(f"note: this is {provider}'s whole change since the last pick, not this helper's alone: other sessions "
              "and parallel helpers on it are included. For helpers that ran in parallel, report the largest figure "
              "once, not the sum.", file=sys.stderr)
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


def with_kind_defaults(cfg):
    """Fill each provider of a kind (e.g. "claude") from cfg["kind_defaults"][kind]; the provider's own keys win."""
    kinds = cfg.get("kind_defaults", {})
    for pname, prov in cfg.get("providers", {}).items():
        if isinstance(prov, dict) and prov.get("kind") in kinds:
            cfg["providers"][pname] = deep_merge(kinds[prov["kind"]], prov)
    return cfg


def merged_config(user):
    cfg = deep_merge(json.loads((SKILL / "helpers.default.json").read_text()), user)
    return with_kind_defaults(add_auto_accounts(cfg, user))


def effective_config():
    return merged_config(load_user_config())


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
    config_dir = shlex.quote(written_dir(prov["config_dir"])) if prov.get("config_dir") else ""
    pattern = prov["command"]
    if prov.get("config_dir") and account_key(prov["config_dir"]) == "default":
        # The default account (~/.claude) is the one Claude Code uses with CLAUDE_CONFIG_DIR UNSET: setting it, even to
        # ~/.claude, makes Claude Code read ~/.claude/.claude.json and another Keychain entry (first-run dialogs, login).
        pattern = pattern.replace("CLAUDE_CONFIG_DIR={config_dir}", "env -u CLAUDE_CONFIG_DIR")
    return fill(pattern, model=model, effort=effort, model_id=full_model_id(prov, model, effort),
                settings=str(settings_file(pname)), config_dir=config_dir)


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
        if not NAME_OK.fullmatch(pname):
            print(f"warning: provider name {pname!r} ignored: use lowercase letters and digits only, starting with a letter", file=sys.stderr)
            continue
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
            who = f"Claude Code ({prov.get('label', pname)})" if prov.get("kind") == "claude" else f"{prov.get('label', pname)} helper"
            desc = entry.get("description") or f"{who}, {tier} tier ({model} {effort}){text}. {prov.get('note', '')}".strip()
            specs[name] = dict(provider=pname, tier=tier, model=model, effort=effort, command=command,
                               description=desc, custom=False, fixed=fixed)
    for entry in cfg.get("custom", []):
        pname, model, effort = entry.get("provider"), entry.get("model", ""), entry.get("effort", "")
        prov = cfg.get("providers", {}).get(pname)
        name = f"{pname}-{slug(model)}-{effort}"
        if not prov or name in specs or not NAME_OK.fullmatch(pname):
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


def parse_codex(text):
    """`codex debug models`: JSON {"models": [{"slug", "visibility"}]}; keep the ones listed to users."""
    return [m["slug"] for m in json.loads(text).get("models", []) if m.get("visibility") == "list" and m.get("slug")]


# Model sources a provider names with `models_source`: name -> function(cli) -> ids, or (ids, credits).
FETCHERS = {
    "codex-models": lambda cli: parse_codex(run_text([cli, "debug", "models"], timeout=60)),
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
    cfg = merged_config(user)
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
    cfg = merged_config(user)
    plan = compute(cfg, only={name})
    apply_plan(cfg, plan)
    print(name)
    return 0


def provider_view(prov):
    """A provider's config plus the derived fields other tools read: kind, config_dir, label, unit, order, cli_found, self, auto."""
    out = dict(prov)
    out.update(kind=prov.get("kind", "cli"), config_dir=prov.get("config_dir"), label=prov.get("label"),
               unit=prov.get("unit"), order=provider_order(prov),
               cli_found=bool(shutil.which(prov.get("cli", ""))), self=is_self(prov), auto=bool(prov.get("auto")))
    return out


def config_cmd():
    """The effective config with derived provider fields and `default_orders` (per tier: installed providers other than this account's own)."""
    cfg = effective_config()
    views = {name: provider_view(prov) for name, prov in cfg.get("providers", {}).items()}
    cfg["providers"] = views
    groups = {t for prov in views.values() for t, e in prov.get("tiers", {}).items() if not e.get("opt_in")}
    cfg["default_orders"] = {
        t: [n for n in tier_names(cfg, t) if views[n.split("-")[0]]["cli_found"] and not views[n.split("-")[0]]["self"]]
        for t in sorted(groups)}
    cfg["session_account"] = {"config_dir": os.path.realpath(written_dir(session_dir())), "key": account_key(session_dir())}
    print(json.dumps(cfg, indent=2, sort_keys=True))
    return 0


def reading_text(reading):
    now = now_utc().timestamp()
    parts = [f"{label} {effective_percent(reading[win], now):.0f}%" for win, label in (("five_hour", "5h"), ("seven_day", "7d")) if win in reading]
    return " ".join(parts) or "no reading"


def account_cmd(args):
    usage = "usage: helpers.py account add <name> <config_dir> [--label L] | account rm <name> | account list"
    if not args:
        print(usage, file=sys.stderr)
        return 2
    sub, rest = args[0], args[1:]
    user = load_user_config()
    if sub == "list":
        cfg = effective_config()
        found = False
        for name, prov in cfg["providers"].items():
            if prov.get("kind") != "claude":
                continue
            found = True
            mark = ("  (auto)" if prov.get("auto") else "") + ("  (this account)" if is_self(prov) else "")
            print(f"{name:12} {prov.get('label', ''):10} {prov.get('config_dir')}  key {account_key(prov['config_dir'])}  {reading_text(read_account(account_key(prov['config_dir'])) or {})}{mark}")
        if user.get("excluded_accounts"):
            print(f"excluded from auto-discovery (account rm): {', '.join(map(str, user['excluded_accounts']))}; `account add` brings one back")
        if not found:
            print("no other Claude accounts found; accounts are discovered from ~/.claude, ~/.claude-*, ~/.claude_* and the readings files, or add one with: helpers.py account add <name> <config_dir>")
        return 0
    if sub == "add":
        label = None
        if "--label" in rest:
            i = rest.index("--label")
            if i + 1 >= len(rest):
                print(usage, file=sys.stderr)
                return 2
            label = rest[i + 1]
            rest = rest[:i] + rest[i + 2:]
        if len(rest) != 2:
            print(usage, file=sys.stderr)
            return 2
        name, config_dir = rest
        if not NAME_OK.fullmatch(name):
            print(f"error: name {name!r} must be lowercase letters and digits, starting with a letter (no '-': the name before the first '-' is the provider), e.g. claudeuni", file=sys.stderr)
            return 1
        existing = effective_config()["providers"].get(name)
        if existing and existing.get("kind") != "claude":
            print(f"error: {name!r} is already a {existing.get('label', name)} provider; pick another name", file=sys.stderr)
            return 1
        user.setdefault("providers", {})[name] = {"kind": "claude", "config_dir": config_dir.rstrip("/") or "/",
                                                    "label": label or dir_label(config_dir)}
        key = account_key(config_dir)
        if key in map(str, user.get("excluded_accounts", [])):
            user["excluded_accounts"] = [k for k in user["excluded_accounts"] if str(k) != key]
            if not user["excluded_accounts"]:
                del user["excluded_accounts"]
        write_json(user_config_file(), user)
        cfg = merged_config(user)
        names = {f"{name}-{t}" for t in cfg["providers"][name].get("tiers", {})}
        plan = compute(cfg, only=names)
        for kind, n in plan:
            print(LABEL_WRITE[kind].format(n=n))
        apply_plan(cfg, plan)
        for line in auto_account_templates(cfg):  # an auto account of the same dir under another name is now replaced
            print(line)
        if is_self(cfg["providers"][name]):
            print(f"note: {config_dir} is this session's own account; pick skips it here and uses it from the other account")
        return 0
    if sub == "rm" and len(rest) == 1:
        name = rest[0]
        mine = user.get("providers", {}).get(name)
        auto = effective_config()["providers"].get(name)
        if mine and mine.get("kind") == "claude":
            config_dir = mine.get("config_dir")
            del user["providers"][name]
            if not user["providers"]:
                del user["providers"]
        elif auto and auto.get("kind") == "claude" and auto.get("auto"):
            config_dir = auto["config_dir"]
        else:
            print(f"error: {name!r} is not a Claude account in {user_config_file()} or an auto-discovered one", file=sys.stderr)
            return 1
        sticky = ""
        if config_dir and account_key(config_dir) in {account_key(w) for w, _ in discover_claude_dirs()}:
            key = account_key(config_dir)
            if key not in map(str, user.get("excluded_accounts", [])):
                user.setdefault("excluded_accounts", []).append(key)
            sticky = f" (it stays out of auto-discovery: key {key} in excluded_accounts; `account add` brings it back)"
        write_json(user_config_file(), user)
        cfg = merged_config(user)
        plan = [p for p in compute(cfg, only=set(), orphans=True) if p[0] == "orphan" and p[1].startswith(f"{name}-")]
        for kind, n in plan:
            print(LABEL_WRITE[kind].format(n=n))
        apply_plan(cfg, plan)
        print(f"{name} removed{sticky}")
        return 0
    print(usage, file=sys.stderr)
    return 2


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
    if cmd in ("pick", "status", "config"):
        for line in auto_account_templates(effective_config()):
            print(f"auto accounts: {line}", file=sys.stderr)
    if cmd == "pick" and args:
        order = ORDER.get(args[0]) or [s.strip() for s in args[0].split(",") if s.strip()]
        absent = not_offered()
        cfg = effective_config()
        for name in order:
            if name in absent:
                print(f"skipped {name}: its model is not offered (last `helpers.py models`)", file=sys.stderr)
                continue
            provider = name.split("-")[0]
            why = unusable_reason(provider, cfg)
            if why:
                print(f"skipped {name}: {why}", file=sys.stderr)
                continue
            if usable(name, state, today, check_config=False):
                mark_usage(provider, cfg.get("providers", {}).get(provider, {}))
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
            prov = effective_config()["providers"].get(provider, {})
            why = unusable_reason(provider)
            if state.get(provider) == "login":
                quota = "needs login"
            elif is_out(state, provider, today):
                quota = f"out until {state[provider]}"
            elif why:
                quota = why
            elif quota_source(prov):
                quota = "ok, " + reading_text(provider_quota(prov))
            print(f"{provider:10} {where:14} quota {quota:22} {', '.join(mine)}")
        for line in status_warnings(today):
            print(line)
        return 0
    if cmd == "config":
        return config_cmd()
    if cmd == "account":
        return account_cmd(args)
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
