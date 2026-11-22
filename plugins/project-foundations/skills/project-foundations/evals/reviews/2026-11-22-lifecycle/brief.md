# Brief for Neon: review a project-foundations proposal (22 Nov 2026)

You review a proposed release of the `project-foundations` skill (this repository: `plugins/project-foundations/skills/project-foundations/`; read `SKILL.md`, `references/modules.md`, `references/docmap-config.md` and skim `scripts/docmap.py` where the proposal touches it: `lifecycle_docs`, `lifecycle_findings`, the id check, `cmd_docs`, `cmd_rotate`, `cmd_worklog`).

The proposal: `evals/reviews/2026-11-22-lifecycle/proposal.md` in this folder. It rests on evidence from a project that uses the skill: `/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1` (read-only; useful: `docs/` listing, `pyproject.toml` `[tool.docmap]`, `AGENTS.md`, `docs/STATUS.md`; run `python tools/docmap.py docs`, `python tools/docmap.py check`, `python tools/docmap.py stats` there with the interpreter `/Users/sergiyhoref/Programming/Neuroscience/envs/neuro/bin/python`).

Answer the proposal's five questions, then judge each of P1-P6: keep / change / drop, with the reason and, for "change", the concrete change. Check the findings against the project yourself (are they right? anything larger I missed?). Prefer fewer, sharper points. The skill must stay usable for small projects and for every agent (Claude Code, Copilot, Kiro, Codex) with only Markdown and one stdlib script.

Write `evals/reviews/2026-11-22-lifecycle/neon.md` (1-2 pages). Edit no other file. Checks you want to run go into one script under `evals/reviews/2026-11-22-lifecycle/scratch/`, run with `python <file>` (no heredocs, multi-line `python -c` or `$( )`). Report to the lead (t8b) with `hc send` when neon.md is written.
