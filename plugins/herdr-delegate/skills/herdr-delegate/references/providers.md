# Providers, templates and setup

Read when: you set up a CLI, look up what a template runs (model, level, permissions), or a template or provider is missing. Moved from SKILL.md "Helpers" (restructure R4, 2026-11-15).

Providers are configuration: each one (a CLI, or a Claude Code account) has a command, models per tier, an `order`, a `unit` for usage, and optional sources for login, quota and usage. Templates in `$XDG_CONFIG_HOME/herdr-core/templates/` (default `~/.config/herdr-core/templates/`; `hc templates` lists them) are **rendered** from that config by `scripts/helpers.py render`, so models and levels change in one place. The shipped defaults are in `helpers.default.json`; your overrides (only what you changed) live in `$XDG_CONFIG_HOME/herdr-delegate/helpers.json`. `scripts/install_templates.sh` is a wrapper around `render`. Names are `<provider>-<tier>`; a provider name is lowercase letters and digits only (the name before the first `-` is the provider). A provider whose CLI is not installed is skipped everywhere.

**Optional setup per CLI: skip what you don't have.** Kiro: `policies: [approve-for-me]` in `~/.kiro/settings/permissions.yaml`. Copilot: `defaultPermissionMode: "assisted"` in `~/.copilot/settings.json`. Codex: nothing (the template passes `--approve-for-me`). agy: nothing (the template passes a read-only allowlist). Another Claude account: nothing (found by itself, see `accounts.md`). Then `helpers.py render`.

| Template | Default model, level | Permissions |
|---|---|---|
| `kiro-light` / `-standard` / `-deep` | Haiku 5.5 low / Sonnet 5.5 high / Opus 5.5 high (v3) | approve for me (a judge): `policies: [approve-for-me]` in `~/.kiro/settings/permissions.yaml` |
| `copilot-light` / `-standard` / `-deep` | GPT-6 Luna / Sonnet 5.5 / Opus 5.5, effort high | assisted (a judge): `defaultPermissionMode: "assisted"` in `~/.copilot/settings.json` (the CLI flag is refused in interactive mode) |
| `codex-light` / `-standard` / `-deep` | GPT-6 Luna low / high / xhigh (the models offered depend on the account's plan: `helpers.py models codex`; a plan with a stronger model: `helpers.py set codex deep model=<id>`) | automatic approval review: `--approve-for-me` (a judge) in a workspace-write sandbox; `--no-daemon` is required for hc |
| `claude<label>-light` / `-standard` / `-deep` for another Claude account (found by itself, or one you added) | Haiku / Sonnet / Opus, effort high, under that account's `CLAUDE_CONFIG_DIR` | `--permission-mode auto`: Claude's own classifier acts as the judge |
| `agy-light` / `-standard` / `-deep` | Gemini 3.8 Flash / Gemini 4 Hydrogen / Opus 5.5, high | a read-only command allowlist (`--settings`, rendered to `herdr-delegate/agy-settings.json` under the config home from the config's `settings`: `cat`, `grep`, `sed -n`, `git log/diff/show`, `hc send`, ...); every other shell command asks you. `--mode auto` is passed too but is still a rollout: on accounts without it agy says "--mode auto is not available for this account" and falls back to asking (2026-11-09) |
| `copilot-argon`, `agy-argon` | Gemini 4 Argon (about Sonnet level) | as above |
| `copilot-fusion-high` / `-max` | Copilot Fusion High / Max: a router, not a model (opt-in; see `copilot-fusion.md`) | as Copilot |

## Checked offline 2026-11-15 (this machine)

- `agy --help` still lists `--mode` (accept-edits, auto, plan); whether an account has `--mode auto` is not visible offline.
- `copilot --help` (CLI 1.0.112) now lists `--assisted-approval` ("equivalent to the `assisted` mode of /permissions"). The table's "the CLI flag is refused in interactive mode" dates from an earlier version and was not re-run interactively; needs a live Copilot session to confirm.
- Not checked: which models each plan offers (`helpers.py models` needs each CLI logged in; run it online).
