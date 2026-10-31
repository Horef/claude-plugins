# Claude plugins

Sergiy Horef's mods and skills for Claude Code, in one marketplace. Each one lives in its own folder under `plugins/`.

This repository is also the **genome** of the skills: their source copy, which the agents who use them improve from use. While working, an agent notes what misled it or was missing in that skill's `LEARNINGS.md`; when lessons recur, a reflection pass turns them into small, verified, versioned changes. The procedure is itself a skill, [strange-loop](plugins/strange-loop), which improves itself the same way. [Why and how it works](plugins/strange-loop/README.md).

**General**: built to be used by anyone. Personal facts stay outside them (machine facts in a git-ignored `AGENTS.local.md`, conventions in `~/.config/...` defaults files).

| Plugin | What it does |
| --- | --- |
| [strange-loop](plugins/strange-loop) | Makes skills and tools improve themselves from use: one-line observations while working, evidence-gated reflection passes, evals, versions, and a session-start digest of lessons waiting. |
| [project-foundations](plugins/project-foundations) | Sets up, retrofits, upgrades or audits a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md, status, decisions, layered docs, a generated map and `docmap.py` checks. |
| [model-router](plugins/model-router) | Plans multi-step tasks, routes each step to a model tier (Haiku / Sonnet / Opus), asks you to approve the plan, shows cost and savings, reruns weak steps one rung up and learns better tier defaults from history. |
| [scientific-figures](plugins/scientific-figures) | Draws scientific figures for study notes, papers and slides (circuits, anatomy, data plots, flows, phase portraits, 3D surfaces) with a lint-render-look loop; includes its `sciencefig` library. Your audience, output targets (e.g. DEVONthink notes) and preferences go in a personal profile. |
| [model-routing](plugins/model-routing) | The model-router approach as a plain skill, for agents without the mod (GitHub Copilot, Kiro, Codex, Cursor, claude.ai): plans steps by tier, asks for approval, runs each step on the cheapest model that does it well where the harness can choose a sub-agent's model, and reruns weak steps one rung up. |

**Personal**: written for one person's setup (DEVONthink, Anki, particular courses). Shared as working examples; their methods transfer, their specifics need adapting.

| Plugin | What it does |
| --- | --- |
| [course-lecture-notes](plugins/course-lecture-notes) | Turns a lecture or tutorial (slides in DEVONthink) into complete, self-contained, Anki-ready teaching notes with figures; written for one person's courses and setup. |

## Install

At the prompt of a Claude Code session (desktop app or terminal):

```
/plugin install strange-loop --marketplace Horef/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope. Install the others the same way. From a shell instead:

```bash
claude plugin install strange-loop --marketplace Horef/claude-plugins
```

Update later with `/plugin update`.

In claude.ai (web, desktop, mobile) and Cowork: Customize → Plugins → Add → Add marketplace → `Horef/claude-plugins`, then turn on Sync automatically; the skills then also reach Claude Code by sync. Other local agents (Kiro, Copilot, Codex) read the same skill folders (open Agent Skills format) through symlinks. To let agents feed lessons back, keep a writable clone and point strange-loop at it, once per machine. All of it: [strange-loop setup](plugins/strange-loop/README.md#setup).

## For agents working here

Read [AGENTS.md](AGENTS.md). In short: every change to a unit goes through the strange-loop procedure, each changed plugin bumps its version, and `loop.py check` and `docmap.py check` must pass.

## Notes

The mods use Claude Code's function-hooks API, which is in early access and may change between releases; they need a recent Claude Code.
