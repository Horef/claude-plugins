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
| `agy-light` / `-standard` / `-deep` | Gemini 3.8 Flash / Gemini 4 Hydrogen / Gemini 4 Neon, high | a read-only command allowlist (`--settings`, rendered to `herdr-delegate/agy-settings.json` under the config home from the config's `settings`: `cat`, `grep`, `sed -n`, `git log/diff/show`, `hc send`, ...); every other shell command asks you. `--mode auto` is passed too but is still a rollout: on accounts without it agy says "--mode auto is not available for this account" and falls back to asking (2026-11-09) |
| `copilot-second` | Gemini 4 Argon (about Sonnet level; named `copilot-argon` before 2026-11-19) | as above |
| `agy-second` | Gemini 4 Neon high (named `agy-argon` before 2026-11-19) | as above |
| `copilot-fusion-high` / `-max` | Copilot Fusion High / Max: a router, not a model (opt-in; see `copilot-fusion.md`) | as Copilot |

## Direct mode (`helpers.py run`, no Herdr)

Each provider has an optional `headless` command (same placeholders as `command`, plus `{prompt}`, the brief with the direct-mode preamble from `templates/_direct.md`). `run` splits it into words and fills them one by one (the prompt is one argument, no shell), leading `VAR=value` words become environment variables, stdin is closed, and the process group is killed on timeout. The CLI's final answer goes to `<brief stem>.out.md` (for `--output-format json`: the JSON's `result`, Claude, or `response`, agy), its stderr to `<out>.log`. Usage: Claude accounts, Codex and agy take the quota mark `pick` takes and report the rise (agy: the drop in its model group's weekly limit); Kiro and Copilot apply `usage_screen.pattern` to the captured output (Copilot prints "AI Credits" on stderr); unknown is null.

| Provider | Headless command | What it may do |
|---|---|---|
| kiro | `kiro-cli chat --no-interactive --v3 --trust-workspace ... --trust-tools=fs_read,fs_write,grep,glob,code {prompt}` | read, write, search; no shell (the read-only shell tool ids of the v3 engine are not known). Not run: the CLI was not logged in on 2026-11-19, so its output and usage line are unchecked |
| copilot | `copilot --prompt={prompt} ... --no-ask-user --allow-tool=read --allow-tool=write --allow-tool='shell(cat)' ...` | read and write in the workspace, a read-only shell allowlist (as agy's); non-interactive mode denies whatever else it would have asked about |
| codex | `codex exec ... --sandbox workspace-write --skip-git-repo-check {prompt}` | the sandbox: workspace writes, no network |
| agy | `agy --model {model_id} --mode accept-edits --settings {settings} --output-format json -p={prompt}` | accept edits; shell commands outside the settings allowlist are not approved. Attach the prompt to `-p=`: `-p` takes the next word as its prompt |
| claude kind | `CLAUDE_CONFIG_DIR={config_dir} claude -p ... --permission-mode auto --permission-prompts none --output-format json {prompt}` | Claude's classifier decides; a prompt nobody can answer is denied. The default account runs with `CLAUDE_CONFIG_DIR` unset |

Checked 2026-11-19 with one trivial call each: Copilot (answer on stdout, stats incl. `AI Credits` on stderr) and agy (JSON with `response`). Codex and Claude were not called; Kiro could not be.

## Checked offline 2026-11-15 (this machine)

- `agy --help` still lists `--mode` (accept-edits, auto, plan); whether an account has `--mode auto` is not visible offline.
- `copilot --help` (CLI 1.0.112) now lists `--assisted-approval` ("equivalent to the `assisted` mode of /permissions"). The table's "the CLI flag is refused in interactive mode" dates from an earlier version and was not re-run interactively; needs a live Copilot session to confirm.
- Not checked: which models each plan offers (`helpers.py models` needs each CLI logged in; run it online).
