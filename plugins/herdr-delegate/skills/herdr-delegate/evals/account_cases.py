#!/usr/bin/env python3
"""Scripted evals for Claude-account helpers and Codex quota in helpers.py.

Runs against a temporary HOME / XDG_CONFIG_HOME / CODEX_HOME and fake claude and codex binaries on
PATH, never the real config. run.py starts this file in its own process. Exit 0 when every check passes.
"""
import contextlib
import datetime as dt
import hashlib
import io
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

tmp = Path(tempfile.mkdtemp(prefix="herdr-delegate-accounts-"))
bindir = tmp / "bin"
bindir.mkdir()
for cli in ("claude", "codex"):
    (bindir / cli).write_text("#!/bin/sh\nexit 0\n")
    (bindir / cli).chmod((bindir / cli).stat().st_mode | stat.S_IXUSR)
home = tmp / "home"
(home / ".claude").mkdir(parents=True)
os.environ.update(HOME=str(home), XDG_CONFIG_HOME=str(tmp / "cfg"), CODEX_HOME=str(tmp / "codex"),
                  PATH=f"{bindir}:/usr/bin:/bin")
os.environ.pop("CLAUDE_CONFIG_DIR", None)

import helpers  # noqa: E402

failures = 0


def check(ok, label, detail=""):
    global failures
    failures += not ok
    print(f"{'OK  ' if ok else 'FAIL'} {label}" + (f": {detail}" if detail and not ok else ""))


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = helpers.main(list(argv), dt.date(2026, 11, 11))
    return code, out.getvalue(), err.getvalue()


def readings(key, five, seven, five_reset="2099-01-01T00:00:00Z", seven_reset="2099-01-05T00:00:00Z"):
    path = tmp / "cfg" / "claude-accounts" / f"{key}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"version": 1, "key": key, "at": "2026-11-11T10:00:00Z",
                                "five_hour": {"percent": five, "resets_at": five_reset},
                                "seven_day": {"percent": seven, "resets_at": seven_reset}}))


# --- account key: sha256 of the dir as written, "default" for ~/.claude
check(helpers.account_key("/Users/x/.claude-uni") == "1e01c824", "account key is the first 8 hex of sha256 of the dir as written (test vector)")
check(helpers.account_key("/Users/x/.claude-uni/") == helpers.account_key("/Users/x/.claude-uni"), "a trailing slash does not change the key")
check(helpers.account_key(str(home / ".claude")) == "default" and helpers.account_key("~/.claude") == "default", "~/.claude is the default account")
check(helpers.account_key("~/.claude-uni") == hashlib.sha256(f"{home}/.claude-uni".encode()).hexdigest()[:8], "a tilde is expanded before hashing")
check(helpers.dir_label("~/.claude-uni") == "uni" and helpers.dir_label("~/.claude") == "main", "default labels")

# --- account add / list / rm
code, out, _ = run("account", "add", "claudeuni", "~/.claude-uni")
tpl = tmp / "cfg" / "herdr-core" / "templates" / "claudeuni-deep.md"
check(code == 0 and "wrote  claudeuni-deep" in out and tpl.exists(), "account add renders the three tiers", out)
cmd = next(l for l in tpl.read_text().splitlines() if l.startswith("command: "))
check(cmd == f"command: CLAUDE_CONFIG_DIR={home}/.claude-uni claude --model opus --effort high --permission-mode auto", "account template command", cmd)
check(helpers.command_of("claudeuni-deep") == "claude", "command_of skips the CLAUDE_CONFIG_DIR assignment")
_claude_cmd = "CLAUDE_CONFIG_DIR={config_dir} claude --model {model} --effort {effort} --permission-mode auto"
main_cmd = helpers.command_for("claudemain", {"kind": "claude", "config_dir": "~/.claude", "command": _claude_cmd}, "sonnet", "high")
check(main_cmd == "env -u CLAUDE_CONFIG_DIR claude --model sonnet --effort high --permission-mode auto",
      "the default account (~/.claude) runs with CLAUDE_CONFIG_DIR unset, not set to ~/.claude (O23)", main_cmd)
_tpl = tmp / "cfg" / "herdr-core" / "templates" / "zz-envtest.md"
_tpl.write_text("---\nname: zz-envtest\ncommand: env -u CLAUDE_CONFIG_DIR claude --model sonnet\n---\n")
check(helpers.command_of("zz-envtest") == "claude", "command_of skips a leading env -u NAME")
_tpl.unlink()
user = json.loads((tmp / "cfg" / "herdr-delegate" / "helpers.json").read_text())
check(user == {"providers": {"claudeuni": {"config_dir": "~/.claude-uni", "kind": "claude", "label": "uni"}}}, "account add stores kind, config_dir, label only", str(user))
code, out, err = run("account", "add", "bad-name", "~/.claude-x")
check(code == 1 and "no '-'" in err, "a provider name with '-' is refused", err)
code, out, err = run("account", "add", "kiro", "~/.claude-x")
check(code == 1, "an account cannot take a built-in provider's name", err)
code, out, _ = run("account", "list")
check(code == 0 and "claudeuni" in out and "uni" in out and "no reading" in out, "account list", out)
cfg = json.loads(run("config")[1])
view = cfg["providers"]["claudeuni"]
check((view["kind"], view["order"], view["unit"], view["label"], view["cli_found"], view["self"]) == ("claude", 50, "% of 7d", "uni", True, False), "config exposes kind, order, unit, label, cli_found, self", str(view))
check(cfg["providers"]["kiro"]["order"] == 10 and cfg["providers"]["codex"]["order"] == 30 and cfg["providers"]["agy"]["order"] == 40, "shipped orders")
check(cfg["default_orders"]["standard"] == ["codex-standard", "claudeuni-standard"], "default orders: installed providers by order", str(cfg["default_orders"]))
check(helpers.ORDER["argon"] == ["agy-argon", "copilot-argon"] and "copilot-fusion-max" not in helpers.ORDER["deep"], "argon puts agy first; fusion is in no tier")
check(helpers.ORDER["fusion"] == ["copilot-fusion-max", "copilot-fusion-high"], "fusion is opt-in by group")

# --- self-skip
os.environ["CLAUDE_CONFIG_DIR"] = f"{home}/.claude-uni"
code, out, err = run("pick", "claudeuni-light,claudeuni-deep")
check(code == 1 and "this account" in err, "pick skips this session's own account", err)
check(json.loads(run("config")[1])["providers"]["claudeuni"]["self"] is True, "config marks the own account as self")
check("claudeuni-standard" not in json.loads(run("config")[1])["default_orders"]["standard"], "default orders exclude the own account")
check("this account" in run("status")[1], "status shows (this account)")
del os.environ["CLAUDE_CONFIG_DIR"]
code, out, _ = run("pick", "claudeuni-light")
check(code == 0 and out.strip() == "claudeuni-light", "another session may use it", out)

# --- readings decide quota
key = helpers.account_key("~/.claude-uni")
readings(key, 96.0, 10.0)
code, out, err = run("pick", "claudeuni-light")
check(code == 1 and "out of quota" in err, "5h >= 95% is out until its reset", err)
readings(key, 94.0, 98.0)
check(run("pick", "claudeuni-light")[0] == 1, "7d >= 98% is out")
readings(key, 99.0, 99.0, "2020-01-01T00:00:00Z", "2020-01-02T00:00:00Z")
check(run("pick", "claudeuni-light")[0] == 0, "a window whose reset has passed counts as 0")
readings(key, 50.0, 60.0)
check(run("pick", "claudeuni-light")[0] == 0, "below the limits is usable")
(tmp / "cfg" / "claude-accounts" / f"{key}.json").unlink()
check(run("pick", "claudeuni-light")[0] == 0, "no reading is usable")

# --- usage delta (7d percent-point rise since pick)
prov = helpers.effective_config()["providers"]["claudeuni"]
readings(key, 10.0, 30.0)
run("pick", "claudeuni-light")
readings(key, 12.0, 31.5)
check(helpers.quota_usage("claudeuni", prov) == {"provider": "claudeuni", "amount": 1.5, "unit": "% of 7d"}, "usage is the 7d rise since pick", str(helpers.quota_usage("claudeuni", prov)))
readings(key, 12.0, 30.0)
check(helpers.quota_usage("claudeuni", prov) is None, "no rise: nothing printed")
readings(key, 12.0, 20.0)
check(helpers.quota_usage("claudeuni", prov) is None, "a drop (window reset): nothing printed")
(tmp / "cfg" / "claude-accounts" / f"{key}.json").unlink()
check(helpers.quota_usage("claudeuni", prov) is None, "no reading: nothing printed")

# --- rm
code, out, _ = run("account", "rm", "claudeuni")
check(code == 0 and not tpl.exists() and "providers" not in json.loads((tmp / "cfg" / "herdr-delegate" / "helpers.json").read_text()), "account rm removes the config and the templates", out)
check(run("account", "rm", "claudeuni")[0] == 1, "account rm of an unknown account fails")

# --- Codex quota: sample session line, usage endpoint JSON, session-file fallback
LINE = ('{"timestamp":"2026-10-01T13:51:06.338Z","type":"event_msg","payload":{"type":"token_count","info":{},'
        '"rate_limits":{"limit_id":"codex","primary":{"used_percent":4.0,"window_minutes":300,"resets_at":1790880593},'
        '"secondary":{"used_percent":51.0,"window_minutes":10080,"resets_at":1791103073},"plan_type":"plus"}}}')
check(helpers.parse_rollout_line(LINE) == {"five_hour": (4.0, 1790880593), "seven_day": (51.0, 1791103073)}, "codex session line: primary 5h, secondary weekly", str(helpers.parse_rollout_line(LINE)))
check(helpers.parse_rollout_line("not json") == {} and helpers.parse_rollout_line('{"payload":{}}') == {}, "a line without rate limits gives nothing")
WHAM = {"rate_limit": {"limit_reached": False, "primary_window": {"used_percent": 7, "limit_window_seconds": 18000, "reset_at": 1790880593},
                       "secondary_window": {"used_percent": 40, "limit_window_seconds": 604800, "reset_at": 1791103073}}}
check(helpers.parse_wham(WHAM) == {"five_hour": (7.0, 1790880593), "seven_day": (40.0, 1791103073)}, "usage endpoint: two windows")
ONE = {"rate_limit": {"primary_window": {"used_percent": 3, "limit_window_seconds": 2592000, "reset_at": 1796977371}, "secondary_window": None}}
check(helpers.parse_wham(ONE) == {"seven_day": (3.0, 1796977371)}, "usage endpoint: a single long window is the long one")
sess = tmp / "codex" / "sessions" / "2026" / "11" / "11"
sess.mkdir(parents=True)
(sess / "rollout-2026-11-11T10-00-00-abc.jsonl").write_text('{"type":"x"}\n' + LINE.replace("51.0", "99.0") + "\n{\"type\":\"y\"}\n")
check(helpers.codex_live() == {}, "no auth.json: the live read gives nothing")
check(helpers.codex_sessions()["seven_day"][0] == 99.0, "session-file fallback reads the newest line with rate_limits")
helpers.codex_live = lambda: {}
far = dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc)
check(helpers.unusable_reason("codex", now=far) is not None, "codex is out when its weekly window is at 99% (before its reset)")
check(helpers.unusable_reason("codex", now=dt.datetime(2026, 12, 1, tzinfo=dt.timezone.utc)) is None, "codex is usable once the window has reset")

sys.exit(1 if failures else 0)
