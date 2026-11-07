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
| `copilot-fusion-high` / `-max` | Copilot Fusion High / Max: a router, not a model (opt-in) | as Copilot |

Tiers are the model-router's: light = mechanical with a clear rule, standard = following detailed instructions, deep = open judgment. **Argon** is a second opinion from another model family: use it to review a plan or a result, or to answer the same question independently, not as a cheaper standard. `pick argon` tries agy first: the owner's Copilot plan lacks Gemini 4 Argon and falls back to Sonnet.

**Choosing for model family.** When a step is a review, a read or an independent check, prefer a helper from a different model family than yours if one is available; if none is, use what is available and do not block on it (a Gemini reader via agy caught factual errors that Claude readers missed, three times in research-writing). When a helper is chosen for its model family, check the model it reports at launch (Copilot prints "Model ... not available. Using X instead" and its status bar shows the model) and treat a fallback as the wrong helper: kill it and pick another.

**Copilot Fusion** (GA 2026-10-28) is opt-in: it is in no default order, and `pick fusion` (Max, then High) or a named template uses it. Per prompt it picks the models (Claude Opus/Sonnet 5.5, GPT-6 Luna/Sol/Astra), their effort, and single, cascade or critique. Researched 2026-11-01:
- Quality: the only independent number is Fusion Max 60 vs Claude Code with Opus 5.5 at *max* effort 61.7 (Artificial Analysis Coding Agent Index) at about half the cost and tokens. High and Standard are unmeasured; "High ≈ Sonnet 5.5 high" has no source. Trivial prompts go to GPT-6 Luna even on Max, and one simple question on Max went to Astra (2.5× Opus's price).
- Cost: no rate of its own; each model it uses is billed at list price (30% off until 2026-11-30). High and Max need Pro+ or above.
- CLI 1.0.105: the documented `--model fusion --fusion-tier` is rejected. The templates use `--model auto --auto-tier hydrafusion` (High) / `hydrafusion-max` (Max) with the `COPILOT_CLI_ENABLED_FEATURE_FLAGS=...` prefix (an unofficial flag workaround that may break on update; without it: "requires dynamic Auto tiers"). `--reasoning-effort` is refused. The status bar shows "Copilot Fusion · High".
- Use it for large, well-scoped coding steps where cost and speed matter more than knowing the model; review its diffs (discarded drafts' edits stay). Keep the pinned templates for anything that must be a known model.

### Which helper: quotas

Run `scripts/helpers.py pick <tier>` (light, standard, deep, argon), or `pick a,b,c` for your own order. It prints the first template whose CLI is installed and whose provider has quota, or exits 1 when there is none: then use the harness's own subagent and say so. The default order at every tier is Kiro, then Copilot, then agy: Kiro and Copilot have bigger monthly quotas that reset on the 1st, and agy is a small personal plan, used only when both others are out. When a helper hits a quota error ("exceeded your monthly quota", credits used up), run `helpers.py out <provider>`: it marks the provider out until the 1st of next month, and the mark clears by itself. `helpers.py status` shows everything. `back <provider>` clears a mark early.

**When the person is away** (asleep, AFK), use Kiro: Copilot's assisted judge escalates ordinary read commands every few seconds and cannot find genome skills by `/name`, so it needs a present lead.

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
8. **Clean up.** Once you've accepted the work: `hc kill <name>; hc rm <name>`, only for helpers you started. Before `hc kill`, if the helper started a job that must keep running, check it is outside the helper's process tree (`ps -o pid,pgid,sid,command`: its session differs from the helper's) and confirm it is still alive afterwards; otherwise relaunch it yourself.

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

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note herdr-delegate <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for herdr-delegate` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
