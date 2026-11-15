# Configuration and model commands

Read when: you change a helper's model or level, ask which models a CLI offers, render templates, or `status` reports a stale model cache or a template that differs from the config. Moved from SKILL.md "Helpers" (restructure R4, 2026-11-15).

- `helpers.py config` prints the effective config as JSON, each provider with `kind`, `config_dir`, `label`, `unit`, `order`, `cli_found`, `self` and `auto`, plus `default_orders` (per tier: installed providers other than this account's own). `helpers.py set <provider> <tier> model=X effort=Y` validates (the provider's efforts; the model against the cached list), writes your override and renders. The model-router's Settings can call the same commands.
- `helpers.py models [provider]` asks each installed CLI which models it offers (Kiro `--list-models`, `agy models`, Codex `debug models`, Copilot through its ACP server, since it has no list command), caches that in `herdr-delegate/models.json` under the config home, and reports configured models no longer offered and newer ones in the same family. `status` repeats the first when the cache is over 7 days old, and warns when `render --check` finds a template that differs from the config.
- `render` overwrites only files with a `generated-by: herdr-delegate` line; a hand-made template is kept (`--force` replaces it) and a generated one no longer in the config is removed.
- **One-off model for one step:** `helpers.py custom <provider> model=X effort=Y` renders `<provider>-<model>-<effort>` (same body), prints its name and keeps it in your config's `custom` list; launch it like any template and give it to `pick` in an order. `custom --prune` forgets them all.

## Checked offline 2026-11-15 (this machine)

- Copilot CLI 1.0.112: `copilot help` lists no models command, so "it has no list command" still holds; `agy --help` lists `agy models`.
- Not checked: `kiro-cli --list-models` and `codex debug models` need a logged-in account.
