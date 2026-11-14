# Changelog: herdr-delegate

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.12.1 (2026-11-14)
- Helper template body: a helper works to a brief and must not open a model-router plan or wait for plan approval; scripted check in render_cases.py (O25)

## 0.12.0 (2026-11-14)
- helpers.py usage: account-wide readings (Claude accounts, Codex, agy) now say so on stderr, and step 8 says to report the largest figure once for parallel helpers on one account, never the sum (O24)

## 0.11.0 (2026-11-13)
- Step 5: when the lead's own approvals of helper prompts are refused (auto mode), ask the person and prefer helpers with their own judge (O23)
- The default Claude account (~/.claude) gets 'env -u CLAUDE_CONFIG_DIR claude ...': setting the variable to ~/.claude made Claude Code read another config file and Keychain entry, so helpers showed first-run dialogs and a login screen; command_of and the orphan check follow the new form (O23)

## 0.10.0 (2026-11-13)
- other Claude accounts found automatically (config dirs and readings files); account rm sticks, add overrides

## 0.9.0 (2026-11-11)
- Claude Code accounts (CLAUDE_CONFIG_DIR) and Codex as helper providers: helpers.py account add/rm/list, self-skip, quota from session-status-line's readings files or Codex's usage endpoint, usage as the 7d rise since pick; provider order, login check, usage screen and model source are config (order, tier_order, opt_in, login_check, usage_screen, quota_source); config exposes kind, config_dir, label, unit, order, cli_found, self

## 0.8.0 (2026-11-09)
- agy templates pass a read-only command allowlist (--settings, rendered from the config) since Auto mode is unavailable on the account; helpers.py usage reports agy's drop in weekly limit from /usage, snapshotted at pick (owner request 2026-11-09) (O18)

## 0.7.0 (2026-11-08)
- helpers.py usage reads a helper's Kiro credits or Copilot AIC from its screen before cleanup; nothing (never 0) when none is shown (owner's request 2026-11-08)

## 0.6.2 (2026-11-07)
- helpers.py models stores Kiro's credit multipliers, so model-router can order Kiro models by cost

## 0.6.1 (2026-11-07)
- pick skips a template whose model the last helpers.py models found not offered (owner's request 2026-11-07)

## 0.6.0 (2026-11-07)
- helper models and thinking levels are configuration: helpers.default.json + user overrides, helpers.py render/set/models/config/custom, one shared template body, kiro light is Haiku 5.5 low (owner's request 2026-11-07)

## 0.5.1 (2026-11-07)
- a Kiro login mark clears itself once kiro-cli whoami reports a login (O11)

## 0.5.0 (2026-11-06)
- pick argon prefers agy; check helper model for family; long jobs in own session before hc kill; prefer other-family reviewers (owner's request 2026-11-06) (O7, O9)

## 0.4.0 (2026-11-02)
- Unattended runs use Kiro (Copilot needs a present judge); Copilot waits use --timeout 300 plus hc read; launch with --cwd where the helper must run things; briefs steer quota cost (line ranges, lowest tier, one session per batch, capped look rounds) (O1, O2, O3, O4, O5)

## 0.3.0 (2026-11-01)
- helpers.py prompt finds approvals a Copilot helper waits on; leads check at 60-second check-ins

## 0.2.0 (2026-11-01)
- Copilot Fusion High and Max templates (opt-in, pick fusion); helpers.py and the installer read past VAR=value prefixes

## 0.1.0 (2026-10-31)
- Created with `loop.py new`.
- Templates for Kiro v3 (approve for me), Copilot (assisted) and agy at three tiers, plus Gemini 4 Argon second-opinion templates; `scripts/install_templates.sh` installs only those whose CLI is present.
- `scripts/helpers.py`: picks a template by tier and quota priority (Kiro, then Copilot, then agy at every tier), with out-of-quota marks that expire on the 1st of next month.
- `helpers.py login <provider>`: a no-expiry mark for a stale login; the skill says to ask the person to log in to Kiro, or fall back to the next helper when they're away.
- Procedure, judge role and CLI quirks from live probes of all three CLIs in the setup session.
