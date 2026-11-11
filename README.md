# Claude plugins

Sergiy Horef's mods and skills for Claude Code, in one marketplace. Each one lives in its own folder under `plugins/`.

This repository is also the **genome** of the skills: their source copy, which the agents who use them improve from use. While working, an agent notes what misled it or was missing in that skill's `LEARNINGS.md`; when lessons recur, a reflection pass turns them into small, verified, versioned changes. The procedure is itself a skill, [strange-loop](plugins/strange-loop), which improves itself the same way. [Why and how it works](plugins/strange-loop/README.md).

**General**: built to be used by anyone. Personal facts stay outside them (machine facts in a git-ignored `AGENTS.local.md`, conventions in `~/.config/...` defaults files).

| Plugin | What it does |
| --- | --- |
| [strange-loop](plugins/strange-loop) | Makes skills and tools improve themselves from use: one-line observations while working, evidence-gated reflection passes, evals, versions, and a session-start digest of lessons waiting. |
| [project-foundations](plugins/project-foundations) | Sets up, retrofits, upgrades or audits a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md, status, decisions, layered docs, a generated map, `docmap.py` checks and code-graph lookups (who calls what, module dependencies, a ranked repo map). |
| [model-router](plugins/model-router) | Plans multi-step tasks, routes each step to a model tier (Haiku / Sonnet / Opus), asks you to approve the plan, shows cost and savings, reruns weak steps one rung up, nests steps into parts (several agents, subagents or helpers, per step), shows helper usage per subscription, records a verdict per delegated run and learns per kind of work which model does it well (advice with one-click apply, optional auto mode); settings survive reinstalls. |
| [scientific-figures](plugins/scientific-figures) | Draws scientific figures for study notes, papers and slides (circuits, anatomy, data plots, flows, phase portraits, 3D surfaces) with a lint-render-look loop; includes its `sciencefig` library. Your audience, output targets (e.g. DEVONthink notes) and preferences go in a personal profile. |
| [model-routing](plugins/model-routing) | The model-router approach as a plain skill, for agents without the mod (GitHub Copilot, Kiro, Codex, Cursor, claude.ai): plans steps by tier, asks for approval, runs each step on the cheapest model that does it well where the harness can choose a sub-agent's model, and reruns weak steps one rung up. |
| [session-status-line](plugins/session-status-line) | A compact status line above the prompt: model and effort, context fill, 5h and weekly rate limits with reset and pace, Kiro, Copilot and Codex quotas, your other Claude accounts' limits and Claude extra usage, cost, last turn, compactions and files edited; one line, or two when narrow |
| [herdr-delegate](plugins/herdr-delegate) | Delegate self-contained steps to helper agents on other subscriptions (Kiro, Antigravity/agy, GitHub Copilot, Codex, another Claude Code account) through Herdr's herdr-core (hc): pick a helper by tier, launch it with a brief, act as its approval judge, collect its report, review it, clean up. Use when the person asks to offload or delegate work, when Claude's limits are tight, or when a router plan marks a step for herdr. Needs hc on PATH. Helper models and thinking levels are configuration (rendered templates, `helpers.py set`), checked against what each CLI offers. `helpers.py usage` reads what a helper used (Kiro credits, Copilot AIC from its screen; the 7d rise for Codex and other Claude accounts). `helpers.py account add` makes another Claude Code account (its own `CLAUDE_CONFIG_DIR`) a helper; provider order and quota sources are configuration. |
| [gui-design](plugins/gui-design) | Design GUIs people actually use: tool and mod panels, settings pages, inspection viewers, dashboards and interactive explainers, at the right density (everything needed on screen or one click away, rarer flows behind more steps, more detail on request). Layered disclosure rule, settings and explainer patterns, surface limits, a build-lint-shoot-look loop with screenshots at several widths in light and dark, and a profile for audience and taste. Use when building or reworking any GUI, panel, page, viewer or interactive demo, or when one feels too complex or too thin. |
| [research-writing](plugins/research-writing) | Turn a body of research (results, run logs, figures, decisions) into a coherent write-up or paper draft in LaTeX: a one-paragraph message and its reader, a claims ledger tying each claim to its evidence and figure, a skeleton in argument order (not lab-notebook order), figures that each carry one claim, text written around them, then a loop of fresh reader agents whose questions are answered in the text, plus mechanical checks and a look at the rendered pages. Works for a full write-up after many results or incrementally as results arrive. Use when asked to write up results, draft a paper, report or thesis chapter, revise one that reads like a lab report, or add new results to an existing write-up. |
| [local-run-queue](plugins/local-run-queue) | Run many local simulation or analysis jobs in parallel under a private-memory budget: measure each job's whole process tree (macOS footprint, Linux PSS; never RSS), admit jobs by estimates taken from measured peaks, stop and requeue the newest job above a kill line, chain dependent jobs, survive restarts and the launching agent's exit, and change budget, priorities or estimates while it runs. Use when a batch of local runs (sweeps, calibrations, simulations) must fit a machine's memory, when parallel runs need a memory estimate, or when a previous queue over- or under-used memory. |
| [literature-research](plugins/literature-research) | Literature research and claim verification for any research question: frame the question and the decision it serves, search several sources in parallel (PubMed, Semantic Scholar, arXiv, OpenAlex, the web, DEVONthink when on the owner's Mac) with a reproducible search log and citation chasing, record every finding in an evidence ledger (value, units, species, preparation, source, page, verbatim quote, evidence type) before any prose, have fresh checkers re-read each cited passage, then synthesise the answer with conflicts and costed gaps. Use for parameter lookups, mechanism or state-of-the-field reviews, novelty or prior-art checks, verifying a claim or citation, and finding methods; not for writing the final paper (use research-writing). |
| [research-assistant](plugins/research-assistant) | Run a research question through the whole loop with checkpoints: frame it and the decision it serves, review the literature (literature-research), turn findings into competing hypotheses and a costed analysis plan, run the approved analyses (bounded local runs; large compute only on a yes), record results in the project, and write them up (research-writing). Stops for the person at three gates: after framing, after the literature (which hypotheses to test), and before any compute. Starts from a question in a project, a new idea (novelty check first, then a scaffolded project), reviewer questions, or a paper to build on. Use when asked to research, investigate or test an idea end to end, to plan analyses for open questions, or to take a question from literature to results; for a literature question alone use literature-research, for writing alone research-writing. |

**Personal**: written for one person's setup (DEVONthink, Anki, particular courses). Shared as working examples; their methods transfer, their specifics need adapting.

| Plugin | What it does |
| --- | --- |
| [course-lecture-notes](plugins/course-lecture-notes) | Turns a lecture or tutorial (slides in DEVONthink) into complete, self-contained, Anki-ready teaching notes with figures; written for one person's courses and setup. |
| [paper-premark](plugins/paper-premark) | Pre-read a scientific paper in DEVONthink and mark it up in Sergiy's colour scheme (whole logical units, comments, skim-safe markers) plus a linked reading-map note. Works with or without a project. |

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
