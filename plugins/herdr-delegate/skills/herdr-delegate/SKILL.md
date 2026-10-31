---
name: herdr-delegate
description: "Delegate self-contained steps to helper agents on other subscriptions (Kiro, Antigravity/agy, GitHub Copilot) through Herdr's herdr-core (hc): pick a helper by tier, launch it with a brief, act as its approval judge, collect its report, review it, clean up. Use when the person asks to offload or delegate work, when Claude's limits are tight, or when a router plan marks a step for herdr. Needs hc on PATH."
---

# Herdr delegate

You (the lead) hand a self-contained step to a helper agent running another CLI on another subscription, in a terminal herdr-core keeps alive. The person can watch and type into every helper from the Herdr app. You launch it, approve or escalate its permission prompts, answer its questions, read its report, and review the work before using it. Use it for long, self-contained work: research, code to a spec, trying many options, sweeps. Don't use it for steps that need this conversation's context, for steps under about 5 tool calls (briefing costs more than doing), or for a decision that belongs to the person.

`hc --skill` is the full manual for herdr-core. This skill adds the helper CLIs, their quirks, and the judge role. If `hc` isn't on PATH, say so and use the harness's own subagents instead.

## Helpers

Templates live in `~/.config/herdr-core/templates/` (`hc templates` lists them). This skill ships them in `templates/`. `scripts/install_templates.sh` installs the ones whose CLI is on PATH and never overwrites without `--force`.

| Template | Model | Permissions |
|---|---|---|
| `kiro-light` / `-standard` / `-deep` | Sonnet 5.5 low / Sonnet 5.5 high / Opus 5.5 high (v3) | approve for me (a judge): `policies: [approve-for-me]` in `~/.kiro/settings/permissions.yaml` |
| `copilot-light` / `-standard` / `-deep` | GPT-6 Luna / Sonnet 5.5 / Opus 5.5, effort high | assisted (a judge): `defaultPermissionMode: "assisted"` in `~/.copilot/settings.json` (the CLI flag is refused in interactive mode) |
| `agy-light` / `-standard` / `-deep` | Gemini 3.8 Flash / Sonnet 5.5 / Opus 5.5, high | `--mode auto`: edits run, every shell command asks you |
| `copilot-argon`, `agy-argon` | Gemini 4 Argon (about Sonnet level) | as above |

Tiers are the model-router's: light = mechanical with a clear rule, standard = following detailed instructions, deep = open judgment. **Argon** is a second opinion from another model family: use it to review a plan or a result, or to answer the same question independently, not as a cheaper standard.

### Which helper: quotas

Run `scripts/helpers.py pick <tier>` (light, standard, deep, argon), or `pick a,b,c` for your own order. It prints the first template whose CLI is installed and whose provider has quota, or exits 1 when there is none: then use the harness's own subagent and say so. The default order puts Kiro and Copilot first, since they have bigger monthly quotas that reset on the 1st. agy is a small personal plan, so it comes last, except for light, where its Flash model is cheap. When a helper hits a quota error ("exceeded your monthly quota", credits used up), run `helpers.py out <provider>`: it marks the provider out until the 1st of next month, and the mark clears by itself. `helpers.py status` shows everything. `back <provider>` clears a mark early.

## Steps

1. **Check.** `echo $HC_TERMINAL_ID` is your address (the helpers report to it). If it's empty, you're not in an hc terminal and helpers can't reach you: tell the person and use the harness's subagents. Then pick a template (above).
2. **Brief.** Self-contained: goal, exact scope (files and folders it may touch), what to return, and where (a file path for anything over a few lines). Include "Report to the lead (<your address>) with hc send". For code: a branch or worktree of its own, and whether it may commit. The template body already covers the reporting protocol, scope discipline and honesty.
3. **Launch.** `hc run --json --bg --name <short-name> --cwd <dir> <template> "<brief>"`. Check `first_message.sent`. If false, `hc read <name>`: a first-run dialog is probably showing (see CLI quirks). Answer it, then `hc send <name> "<brief>"`. Never relaunch blindly. Copilot always shows false (see quirks).
4. **Keep working.** Then `hc wait --children any` (or `all`). `reason: message` means a report arrived as your next input. `timeout` is a check-in, so wait again. Never sleep or poll.
5. **Judge prompts.** Kiro and Copilot run their own judge, so prompts reach you mostly from agy, or when a judge is unsure. When hc says a helper is `blocked (permission)`, `hc read <name> --lines 30` and read the exact command.
   - **Approve yourself** (`hc keys <name> enter` on the "Yes" option) when it's inside the brief's scope and reversible: reads, builds, tests, writes inside its scope, `hc send` to you. For `hc send`, pick the "always allow in this conversation" option so it asks once.
   - **Ask the person** when it's outside scope, irreversible or outward-facing (push, delete outside scope, network writes, credentials, installs), or you're unsure. Quote the command in one line.
   - `blocked (auth)` often clears by itself (token refresh): wait once, then read.
   - Never `hc send --force` past a prompt.
6. **Answer questions.** Questions arrive as `<hc from="tN name">` messages. Answer from what you know with `hc send <name> "..."`. Bring the person only decisions that are theirs.
7. **Review.** A report is a claim. Read the actual files or diff before telling the person it worked, and spot-check light-tier results. Example (2026-10-31): a Kiro helper sent "wc -l prints 3" before running `wc`, then corrected itself. If the result is weak, rerun one tier up.
8. **Clean up.** Once you've accepted the work: `hc kill <name>; hc rm <name>`, only for helpers you started.

## CLI quirks (measured 2026-10-31)

- **`hc send` wraps text in an `<hc>` tag**, so slash commands sent that way arrive as plain text. Type them as keys instead: `hc keys <name> / m o d e l` then `hc keys <name> enter`.
- **Dialogs on a fresh folder or install:**
  - agy: "Do you trust the contents of this project?" Answer `enter` (Yes) for a folder named in your brief.
  - Copilot: "Confirm folder trust". Answer `enter` (Yes, this session).
  - Kiro v3: the templates pass `--trust-workspace`, so no dialog.
- **Copilot never reports a status to hc** (status stays null). Its `first_message.sent` is always false, and `hc wait` can't see it finish. After launching: `hc read`, answer the trust dialog, `hc send` the brief, then rely on its `hc send` report. If a wait times out, `hc read` its screen.
- **Copilot silently swaps an unavailable model** (for example Haiku 5.5 on some plans becomes Sonnet 5.5): check the model line on its screen.
- **Without the template's protocol text, a small model treats `<hc>` messages as prompt injection** and refuses (Kiro on Haiku 4.5). Always launch through a template, or put the protocol paragraph in the brief.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note herdr-delegate <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for herdr-delegate` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
