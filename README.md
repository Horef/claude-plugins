# Claude plugins

Sergiy Horef's mods and skills for Claude Code, in one marketplace. Each one lives in its own folder under `plugins/`.

This repository is also the **genome** of the skills: their source copy, which the agents who use them improve from use. While working, an agent notes what misled it or was missing in that skill's `LEARNINGS.md`; when lessons recur, a reflection pass turns them into small, verified, versioned changes. The procedure is itself a skill, [strange-loop](plugins/strange-loop), which improves itself the same way. [Why and how it works](plugins/strange-loop/README.md).

| Plugin | What it does |
| --- | --- |
| [strange-loop](plugins/strange-loop) | Makes skills and tools improve themselves from use: one-line observations while working, evidence-gated reflection passes, evals, versions, and a session-start digest of lessons waiting. |
| [project-foundations](plugins/project-foundations) | Sets up, retrofits, upgrades or audits a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md, status, decisions, layered docs, a generated map and `docmap.py` checks. |
| [scientific-figures](plugins/scientific-figures) | Draws figures for study notes and papers (circuits, anatomy, data plots, flows, phase portraits, 3D surfaces) with a lint-render-look loop and DEVONthink-safe SVG. Includes its `sciencefig` library. |
| [course-lecture-notes](plugins/course-lecture-notes) | Turns a lecture or tutorial (slides in DEVONthink) into complete, self-contained, Anki-ready teaching notes with figures; written for one person's courses and setup. |
| [model-router](plugins/model-router) | Plans multi-step tasks, routes each step to a model tier (Haiku / Sonnet / Opus), asks you to approve the plan, shows cost and savings, reruns weak steps one rung up and learns better tier defaults from history. |

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

To let agents feed lessons back, keep a writable clone and point strange-loop at it, once per machine. Other harnesses (claude.ai, Kiro, Copilot, Codex) use the same skill folders (open Agent Skills format), through symlinks or upload zips. Both are in [strange-loop setup](plugins/strange-loop/README.md#setup).

## For agents working here

Read [AGENTS.md](AGENTS.md). In short: every change to a unit goes through the strange-loop procedure, each changed plugin bumps its version, and `loop.py check` and `docmap.py check` must pass.

## Notes

The mods use Claude Code's function-hooks API, which is in early access and may change between releases; they need a recent Claude Code.
