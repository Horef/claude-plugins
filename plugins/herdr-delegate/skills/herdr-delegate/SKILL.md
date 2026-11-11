---
name: herdr-delegate
description: "Delegate self-contained steps to helper agents on other subscriptions or accounts (Kiro, Antigravity/agy, GitHub Copilot, Codex, another Claude Code account) through Herdr's herdr-core (hc): pick a helper by tier, launch it with a brief, act as its approval judge, collect its report, review it, clean up. Use when the person asks to offload or delegate work, when Claude's limits are tight, or when a router plan marks a step for herdr. Needs hc on PATH."
---

# Herdr delegate

You (the lead) hand a self-contained step to a helper agent running another CLI (or Claude Code under another account) on another subscription, in a terminal herdr-core keeps alive. The person can watch and type into every helper from the Herdr app. You launch it, approve or escalate its permission prompts, answer its questions, read its report, and review the work before using it. Use it for long, self-contained work: research, code to a spec, trying many options, sweeps. Don't use it for steps that need this conversation's context, for steps under about 5 tool calls (briefing costs more than doing), or for a decision that belongs to the person.

`hc --skill` is the full manual for herdr-core. This skill adds the helper CLIs, their quirks, and the judge role. If `hc` isn't on PATH, say so and use the harness's own subagents instead.

## Helpers

Providers are configuration: each one (a CLI, or a Claude Code account) has a command, models per tier, an `order`, a `unit` for usage, and optional sources for login, quota and usage. Templates in `$XDG_CONFIG_HOME/herdr-core/templates/` (default `~/.config/herdr-core/templates/`; `hc templates` lists them) are **rendered** from that config by `scripts/helpers.py render`, so models and levels change in one place. The shipped defaults are in `helpers.default.json`; your overrides (only what you changed) live in `$XDG_CONFIG_HOME/herdr-delegate/helpers.json`. `scripts/install_templates.sh` is a wrapper around `render`. Names are `<provider>-<tier>`; a provider name is lowercase letters and digits only (the name before the first `-` is the provider). A provider whose CLI is not installed is skipped everywhere.

**Optional setup per CLI: skip what you don't have.** Kiro: `policies: [approve-for-me]` in `~/.kiro/settings/permissions.yaml`. Copilot: `defaultPermissionMode: "assisted"` in `~/.copilot/settings.json`. Codex: nothing (the template passes `--approve-for-me`). agy: nothing (the template passes a read-only allowlist). Another Claude account: `helpers.py account add` (below). Then `helpers.py render`.

| Template | Default model, level | Permissions |
|---|---|---|
| `kiro-light` / `-standard` / `-deep` | Haiku 5.5 low / Sonnet 5.5 high / Opus 5.5 high (v3) | approve for me (a judge): `policies: [approve-for-me]` in `~/.kiro/settings/permissions.yaml` |
| `copilot-light` / `-standard` / `-deep` | GPT-6 Luna / Sonnet 5.5 / Opus 5.5, effort high | assisted (a judge): `defaultPermissionMode: "assisted"` in `~/.copilot/settings.json` (the CLI flag is refused in interactive mode) |
| `codex-light` / `-standard` / `-deep` | GPT-6 Luna low / high / xhigh (the models offered depend on the account's plan: `helpers.py models codex`; a plan with a stronger model: `helpers.py set codex deep model=<id>`) | automatic approval review: `--approve-for-me` (a judge) in a workspace-write sandbox; `--no-daemon` is required for hc |
| `<name>-light` / `-standard` / `-deep` for a Claude account you added | Haiku / Sonnet / Opus, effort high, under that account's `CLAUDE_CONFIG_DIR` | `--permission-mode auto`: Claude's own classifier acts as the judge |
| `agy-light` / `-standard` / `-deep` | Gemini 3.8 Flash / Sonnet 5.5 / Opus 5.5, high | a read-only command allowlist (`--settings`, rendered to `herdr-delegate/agy-settings.json` under the config home from the config's `settings`: `cat`, `grep`, `sed -n`, `git log/diff/show`, `hc send`, ...); every other shell command asks you. `--mode auto` is passed too but is still a rollout: on accounts without it agy says "--mode auto is not available for this account" and falls back to asking (2026-11-09) |
| `copilot-argon`, `agy-argon` | Gemini 4 Argon (about Sonnet level) | as above |
| `copilot-fusion-high` / `-max` | Copilot Fusion High / Max: a router, not a model (opt-in) | as Copilot |

### Other Claude accounts

If you run Claude Code under several accounts (each with its own `CLAUDE_CONFIG_DIR`, e.g. a work or university plan beside a personal one), `helpers.py account add <name> <config_dir> [--label L]` adds that account as a helper provider (`<name>` lowercase letters and digits, e.g. `claudework`), writes it to your override and renders `<name>-light/-standard/-deep`; `account list` shows each account, its quota reading and which one is this session's; `account rm <name>` removes it. Nothing ships enabled. The account whose config dir is the current session's own is skipped by `pick` and `status` ("this account"), so one shared config serves every account. Its quota comes from the readings file `$XDG_CONFIG_HOME/claude-accounts/<key>.json` that session-status-line writes in each account's sessions (the key is `default` for `~/.claude`, else the first 8 hex of the sha256 of the dir as written): `pick` treats the account as out when 5h is at 95% or more, or 7d at 98% or more, until that window resets (no reading: usable).

### Changing models

- `helpers.py config` prints the effective config as JSON, each provider with `kind`, `config_dir`, `label`, `unit`, `order`, `cli_found` and `self`, plus `default_orders` (per tier: installed providers other than this account's own). `helpers.py set <provider> <tier> model=X effort=Y` validates (the provider's efforts; the model against the cached list), writes your override and renders. The model-router's Settings can call the same commands.
- `helpers.py models [provider]` asks each installed CLI which models it offers (Kiro `--list-models`, `agy models`, Codex `debug models`, Copilot through its ACP server, since it has no list command), caches that in `herdr-delegate/models.json` under the config home, and reports configured models no longer offered and newer ones in the same family. `status` repeats the first when the cache is over 7 days old, and warns when `render --check` finds a template that differs from the config.
- `render` overwrites only files with a `generated-by: herdr-delegate` line; a hand-made template is kept (`--force` replaces it) and a generated one no longer in the config is removed.
- **One-off model for one step:** `helpers.py custom <provider> model=X effort=Y` renders `<provider>-<model>-<effort>` (same body), prints its name and keeps it in your config's `custom` list; launch it like any template and give it to `pick` in an order. `custom --prune` forgets them all.

Tiers are the model-router's: light = mechanical with a clear rule, standard = following detailed instructions, deep = open judgment. **Argon** is a second opinion from another model family: use it to review a plan or a result, or to answer the same question independently, not as a cheaper standard. `pick argon` tries agy first, and `pick` skips any template whose model the last `helpers.py models` found not offered (Copilot would silently swap it, e.g. Gemini 4 Argon to Sonnet).

**Choosing for model family.** When a step is a review, a read or an independent check, prefer a helper from a different model family than yours if one is available; if none is, use what is available and do not block on it (a Gemini reader via agy caught factual errors that Claude readers missed, three times in research-writing). When a helper is chosen for its model family, check the model it reports at launch (Copilot prints "Model ... not available. Using X instead" and its status bar shows the model) and treat a fallback as the wrong helper: kill it and pick another.

**Copilot Fusion** (GA 2026-10-28; the details below are as researched 2026-11-01 and may be out of date) is opt-in: it is in no default order, and `pick fusion` (Max, then High) or a named template uses it. Per prompt it picks the models (Claude Opus/Sonnet 5.5, GPT-6 Luna/Sol/Astra), their effort, and single, cascade or critique. Researched 2026-11-01:
- Quality: the only independent number is Fusion Max 60 vs Claude Code with Opus 5.5 at *max* effort 61.7 (Artificial Analysis Coding Agent Index) at about half the cost and tokens. High and Standard are unmeasured; "High ≈ Sonnet 5.5 high" has no source. Trivial prompts go to GPT-6 Luna even on Max, and one simple question on Max went to Astra (2.5× Opus's price).
- Cost: no rate of its own; each model it uses is billed at list price (30% off until 2026-11-30). High and Max need Pro+ or above.
- CLI 1.0.105: the documented `--model fusion --fusion-tier` is rejected. The templates use `--model auto --auto-tier hydrafusion` (High) / `hydrafusion-max` (Max) with the `COPILOT_CLI_ENABLED_FEATURE_FLAGS=...` prefix (an unofficial flag workaround that may break on update; without it: "requires dynamic Auto tiers"). `--reasoning-effort` is refused. The status bar shows "Copilot Fusion · High".
- Use it for large, well-scoped coding steps where cost and speed matter more than knowing the model; review its diffs (discarded drafts' edits stay). Keep the pinned templates for anything that must be a known model.

### Which helper: quotas

Run `scripts/helpers.py pick <tier>` (light, standard, deep, argon), or `pick a,b,c` for your own order. It prints the first template whose CLI is installed and whose provider has quota, or exits 1 when there is none: then use the harness's own subagent and say so. The default order comes from each provider's `order` in the config (lowest first; shipped: Kiro 10, Copilot 20, Codex 30, agy 40, a Claude account 50; `tier_order` moves a provider for one tier). Put providers with a big quota early and a provider with a small quota late, so it is used only when the others are out; change an order with `order` in your override. A provider with a quota source (a Claude account's readings, Codex's usage endpoint or latest session file) is skipped while it is out of quota. When a helper hits a quota error ("exceeded your monthly quota", credits used up), run `helpers.py out <provider>`: it marks the provider out until the 1st of next month, and the mark clears by itself. `helpers.py status` shows everything. `back <provider>` clears a mark early.

**When the person is away** (asleep, AFK), prefer a helper whose judge works unattended (Kiro's approve-for-me, Codex's auto review, a Claude account's auto mode): Copilot's assisted judge escalates ordinary read commands every few seconds and cannot find genome skills by `/name`, so it needs a present lead.

**Kiro's login goes stale** after about 8 to 12 hours; that is expected, not a fault. Signs: hc shows the helper `blocked (auth)` and waiting once doesn't clear it, or its screen asks to log in or says the token expired. Then:
- If the person is around, ask them in one line to log in (`! kiro-cli login` at your prompt), wait, then `helpers.py back kiro` if you had marked it and carry on with the same helper.
- If they are away (asleep, or they said they're AFK), don't wait: `hc kill`/`hc rm` the helper, run `helpers.py login kiro` (a mark with no expiry, so `pick` skips Kiro), and relaunch with the next pick. Tell them when they're back. The mark clears itself: `pick` and `status` run `kiro-cli whoami` and drop it once Kiro is logged in again.

## Steps

1. **Check.** `echo $HC_TERMINAL_ID` is your address (the helpers report to it). If it's empty, you're not in an hc terminal and helpers can't reach you: tell the person and use the harness's subagents. Then pick a template (above). For a model-router plan step with where = "helper", pass the order the router's rules give for that tier: `helpers.py pick <a,b,c>`; when it finds none, run the step with the Agent tool as the rules say.
2. **Brief.** Self-contained: goal, exact scope (files and folders it may touch), what to return, and where (a file path for anything over a few lines). Include "Report to the lead (<your address>) with hc send". For code: a branch or worktree of its own, and whether it may commit. The template body already covers the reporting protocol, scope discipline and honesty.
   - **Launch it where it works:** `--cwd` is the helper's workspace, and Kiro cannot start a server or write outside it, so launch in the repo or worktree it must run things in.
   - **Long jobs outlive the helper only in their own session.** If the helper must start a job that keeps running after you kill it (a sweep, a queue), the brief says to launch it with `setsid` or Python `start_new_session=True`, not plain `nohup`: `hc kill` takes down the helper's whole process tree.
   - **Brief for cost:** the helper's quota goes on context it re-reads every turn. Point at files with line ranges or a lookup command instead of "read X"; pick the lowest tier that fits (standard for code to a spec, deep only for open judgment); one session per batch, not one long session for many; say how many screenshot or test rounds are enough.
3. **Launch.** `hc run --json --bg --name <short-name> --cwd <dir> <template> "<brief>"`. Check `first_message.sent`. If false, `hc read <name>`: a first-run dialog is probably showing (see CLI quirks). Answer it, then `hc send <name> "<brief>"`. Never relaunch blindly. Copilot always shows false (see quirks).
4. **Keep working.** Then `hc wait --children any` (or `all`). `reason: message` means a report arrived as your next input. `timeout` is a check-in, so wait again. With a Copilot helper, use `--timeout 300` and `hc read` it on every timeout: it reports no status, so a prompt never wakes you. Never sleep or poll, and never leave the wait running in the background while you sit idle.
   - **A Copilot helper is running:** hc can't see it blocked (no status), so a long wait leaves its prompts to the person. Wait with `--timeout 60`, and after every check-in run `helpers.py prompt <name> ...` for each Copilot helper: exit 0 means one is waiting, and it prints the command and the options. Judge it as in step 5. Example (2026-11-01): a lead in a 15-minute wait left three Copilot shell prompts for the person to approve by hand.
5. **Judge prompts.** Kiro and Copilot run their own judge, so prompts reach you mostly from agy, or when a judge is unsure. Copilot's judge passes up compound shell scripts (heredocs, loops, `rm`, `curl` in one command) and doesn't decide them. When hc says a helper is `blocked (permission)`, or `helpers.py prompt` finds one, read the exact command (`hc read <name> --lines 30`).
   - Navigate options with `hc keys <name> down` before `enter`, and `escape` to decline. For a safe command the helper will repeat (`curl` reads during research), pick Copilot's "don't ask again for … in this directory" or "approve all URLs from …" option, so it asks once.
   - **Approve yourself** (`hc keys <name> enter` on the "Yes" option) when it's inside the brief's scope and reversible: reads, builds, tests, writes inside its scope, `hc send` to you. For `hc send`, pick the "always allow in this conversation" option so it asks once.
   - **Ask the person** when it's outside scope, irreversible or outward-facing (push, delete outside scope, network writes, credentials, installs), or you're unsure. Quote the command in one line.
   - `blocked (auth)` often clears by itself (token refresh): wait once, then read. For Kiro, if it persists, its login has gone stale: see "Kiro's login goes stale" above.
   - Never `hc send --force` past a prompt.
6. **Answer questions.** Questions arrive as `<hc from="tN name">` messages. Answer from what you know with `hc send <name> "..."`. Bring the person only decisions that are theirs.
7. **Review.** A report is a claim. Read the actual files or diff before telling the person it worked, and spot-check light-tier results. Example (2026-10-31): a Kiro helper sent "wc -l prints 3" before running `wc`, then corrected itself. If the result is weak, rerun one tier up.
8. **Clean up.** Once you've accepted the work, first read what the helper used: `helpers.py usage <name>` prints `{"provider", "amount", "unit"}`: Kiro credits and Copilot AIC from its screen; for a Claude account and Codex, the rise of its 7d percent since `pick` chose it (`% of 7d`; nothing when a side is unknown or the rise is not positive); for agy, the drop in its model group's weekly limit since `pick` chose it (from `agy -p /usage`, in percentage points; parallel agy helpers share a group). Nothing is printed when none is known. Hand that JSON on as is (model-router: the `usage` of the step's done item); when it prints nothing, report no usage, never 0 or a guess. Then `hc kill <name>; hc rm <name>`, only for helpers you started. Before `hc kill`, if the helper started a job that must keep running, check it is outside the helper's process tree (`ps -o pid,pgid,sid,command`: its session differs from the helper's) and confirm it is still alive afterwards; otherwise relaunch it yourself.

## CLI quirks (measured 2026-10-31)

- **`hc send` wraps text in an `<hc>` tag**, so slash commands sent that way arrive as plain text. Type them as keys instead: `hc keys <name> / m o d e l` then `hc keys <name> enter`.
- **Dialogs on a fresh folder or install:**
  - agy: "Do you trust the contents of this project?" Answer `enter` (Yes) for a folder named in your brief.
  - Copilot: "Confirm folder trust". Answer `enter` (Yes, this session).
  - Kiro v3: the templates pass `--trust-workspace`, so no dialog.
- **Copilot never reports a status to hc** (status stays null). Its `first_message.sent` is always false, and `hc wait` can't see it finish. After launching: `hc read`, answer the trust dialog, `hc send` the brief, then rely on its `hc send` report, checking for prompts at every 60-second check-in (step 4).
- **Copilot silently swaps an unavailable model** (for example Haiku 5.5 on some plans becomes Sonnet 5.5): check the model line on its screen.
- **Without the template's protocol text, a small model treats `<hc>` messages as prompt injection** and refuses (Kiro on Haiku 4.5). Always launch through a template, or put the protocol paragraph in the brief.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

Only if `~/.config/strange-loop/genome` exists (otherwise skip the command):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note herdr-delegate <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for herdr-delegate` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
