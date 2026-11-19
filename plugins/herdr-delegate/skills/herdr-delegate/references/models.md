# Configuration and model commands

Read when: you change a helper's model or level, ask which models a CLI offers, render templates, or `status` reports a stale model cache or a template that differs from the config. Moved from SKILL.md "Helpers" (restructure R4, 2026-11-15).

- `helpers.py config` prints the effective config as JSON, each provider with `kind`, `config_dir`, `label`, `unit`, `order`, `cli_found`, `self`, `auto` and `direct` (a headless command and the CLI installed: `helpers.py run` works), plus `default_orders` (per tier: installed providers other than this account's own). `helpers.py set <provider> <tier> model=X effort=Y` validates (the provider's efforts; the model against the cached list), writes your override and renders. The model-router's Settings can call the same commands.
- `helpers.py models [provider]` asks each installed CLI which models it offers (Kiro `--list-models`, `agy models`, Codex `debug models`, Copilot through its ACP server, since it has no list command), caches that in `herdr-delegate/models.json` under the config home, and reports configured models no longer offered (`NOT OFFERED`), newer ones in the same family (`NEWER`), and, from the second refresh on, models first seen in the last 14 days (`NEW <provider>: <base id> (first seen <date>)`) and ones that stopped being offered (`GONE`). Per provider `models.json` keeps `seen` (base id, with the effort level cut off, to the day first seen), `gone` and `baseline` (ids found by the first refresh, which are not reported as NEW); an id offered again after being gone is NEW again, and a failed refresh changes none of it. `models --json` prints one JSON object `{providers, not_offered, newer, new, gone}` and nothing else; `models --cached [--json]` gives the same report from `models.json` without asking any CLI. `status` repeats the first when the cache is over 7 days old, and warns when `render --check` finds a template that differs from the config.
- `render` overwrites only files with a `generated-by: herdr-delegate` line; a hand-made template is kept (`--force` replaces it) and a generated one no longer in the config is removed.
- **One-off model for one step:** `helpers.py custom <provider> model=X effort=Y` renders `<provider>-<model>-<effort>` (same body), prints its name and keeps it in your config's `custom` list; launch it like any template and give it to `pick` in an order. `custom --prune` forgets them all.

## Model notes

- 2026-11-19: Gemini 4 Neon is GA (2026-11-18; levels low, medium, high, xhigh; Antigravity Pro/Ultra/Enterprise and GitHub Copilot), about level with Opus 5.5 on Artificial Analysis's index (vendor-reported benchmarks) but with a higher hallucination rate than Argon (13.9% vs 4.3%). It is agy's `deep` and `second` default (high). Argon is not deprecated (no shutdown date) and stays Copilot's `second`. agy also offers `xhigh` for Neon and Hydrogen.
- The tier once named `argon` is `second`; `argon` still works on the command line and in an old `helpers.json`, which is read as `second`.

## Checked offline 2026-11-15 (this machine)

- Copilot CLI 1.0.112: `copilot help` lists no models command, so "it has no list command" still holds; `agy --help` lists `agy models`.
- Not checked: `kiro-cli --list-models` and `codex debug models` need a logged-in account.
