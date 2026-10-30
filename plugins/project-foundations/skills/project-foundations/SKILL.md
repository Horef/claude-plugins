---
name: "project-foundations"
description: "Set up, retrofit, upgrade or audit a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md for machine facts, status, decisions, layered docs, generated map, docmap checks, dated doc Status lines and a generated facts table."
---

# Project foundations

Give a repository the scaffolding that lets any agent (Claude Code, Copilot, Kiro, Codex, Cursor) or human pick it up cold, find the right code without reading everything, do one coherent piece of work, and leave the project in a state the next session can trust. Everything here is plain Markdown plus one standard-library Python script (`tools/docmap.py`, source in the appendix) - no plugins, MCP servers or tool-specific hooks - so the project works for other people and other agents too. Tracked files hold only project facts; each machine's interpreter, paths, limits and quirks live in a git-ignored `AGENTS.local.md`, so the repository can be shared without losing its specificity.

Modes - pick one in Step 0:

- **Bootstrap**: empty or near-empty repo. Create everything from the templates.
- **Retrofit**: existing project without this scaffolding. Inventory, consolidate, fill gaps, never lose content.
- **Upgrade**: the core docs exist (AGENTS.md, STATUS, WORKLOG, DECISIONS) but not the map layer (`tools/docmap.py`, folder READMEs, docstrings, CI check). Add the layer (see "Upgrade procedure").
- **Audit**: everything exists. Run the checks, find staleness, contradictions and bloat, propose fixes.

## How the documentation is layered

An agent should be able to go from "nothing loaded" to "the right lines of the right file" by reading a few short things in order, each pointing to the next - the same progressive disclosure that makes skills cheap. Each file and folder describes itself, like a small skill: a one-line description that is read first, and the body only when needed.

1. `AGENTS.md` - rules and commands, loaded automatically every session (short).
2. `docs/MAP.md` - **generated**: every folder and code file with its one-line summary, the most-imported modules, the enforced boundaries.
3. `<folder>/README.md` - **hand-written** purpose paragraph and folder-specific rules, plus a **generated** table of its files and subfolders with their summaries and who imports them.
4. The file's header docstring/comment - **hand-written**: what it is for, how to use it, its contracts.
5. `python tools/docmap.py show PATH | where NAME | uses PATH` - **computed on demand**: symbols with signatures and line numbers, definitions, importers and every reference.

**Write what lasts, generate what changes.** People and agents write purpose, usage and reasons, which change rarely. The script generates lists of files, symbols and "who uses this", which change with every commit and go stale the moment anyone maintains them by hand. CI fails when a generated block is out of date or a description is missing, so forgetting becomes visible instead of silent. The same holds for prose that can go stale: every doc carries a dated Status line, key values live once in a generated `docs/FACTS.md`, and `check` points at docs that are overdue for verification or still cite superseded decisions. "Imported by" also lists the tests that import a module, which tells an agent which tests to run after changing it.

The project-level documents, each with one job and one change rate (mixing change rates is what makes docs rot):

| File                              | Job                                                                                                                             | Changes                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `AGENTS.md`                       | Rules and commands an agent can't infer from the code                                                                           | Rarely; pruned                             |
| `AGENTS.local.md`                 | Git-ignored: this machine's interpreter, absolute paths, limits, quirks (template: tracked `AGENTS.local.example.md`)           | When the machine changes; one per checkout |
| `docs/BRIEF.md`                   | Goal, non-goals, success criteria, open questions for the owner                                                                 | When scope changes                         |
| `docs/STATUS.md`                  | Snapshot: what works (and how it was verified), open problems, next actions, blockers                                           | Overwritten each session                   |
| `docs/WORKLOG.md`                 | Append-only, newest first: what was done, exact commands and results (current month; older months in `docs/worklog/YYYY-MM.md`) | Every session                              |
| `docs/DECISIONS.md`               | Append-only decisions with IDs, alternatives, reasons, evidence; generated index at the top                                     | When a choice is made                      |
| `docs/ARCHITECTURE.md`            | Short: data flow, boundaries, invariants ("core never imports X"), with the checkable ones enforced by docmap                   | A few times a year                         |
| `docs/MAP.md`                     | Generated project map                                                                                                           | `docmap.py update`                         |
| `docs/RESULTS.md`, `docs/RUNS.md` | Research: append-only results with generated index; generated run index                                                         | Per experiment / run                       |
| `docs/FACTS.md`                   | Generated table of the project's key values (defaults, presets, counts), read from configs and code; docs cite it instead of copying values | `docmap.py update`                         |
| `CHANGELOG.md`                    | User-visible changes (Keep a Changelog), if others use the project                                                              | Per release                                |

Guiding principles - explain these if the user asks why:

1. **One source of truth for rules.** `AGENTS.md` is read natively by Claude Code, Copilot, Kiro, Codex, Cursor and others; every other instruction file is a thin pointer. Duplicated rules drift and contradict each other.
2. **Short always-loaded files.** Keep `AGENTS.md` under ~120 lines. For each line ask "would an agent make a mistake without this?" Folder-specific rules go in that folder's README (or a nested `AGENTS.md`, below); procedures go in docs.
3. **Write what lasts, generate what changes** (above).
4. **Evidence over claims.** Status lines say how something was verified (command + result). Never describe planned work as done; never present a mock or synthetic test as real validation.
5. **Enforce mechanically.** Instructions are advisory; `.gitignore`, tests, `docmap.py check` and CI are not. A rule broken twice should become a check.
6. **Append, don't rewrite history.** Decisions are superseded, not edited; worklog and results entries are never deleted (old months are moved, not removed).
7. **Leave things committable.** Each session ends with tests and `docmap.py check` green, docs updated, work committed (and pushed if there is a remote) - or an explicit note of what is not.
8. **Agents maintain it.** Every artifact here is meant to be created and kept current by agents following AGENTS.md, so a person only reads, reviews and answers open questions.
9. **Shareable without losing specificity.** Three places for facts: project facts (rules, boundaries, people and approvals, shared infrastructure such as a lab cluster) are tracked; this machine's facts (absolute paths, interpreter, host name, RAM budget, local checkouts, editor or SSH quirks) go in `AGENTS.local.md`; a person's cross-project conventions go in their defaults file (below). Tracked files name a local key ("the `python` interpreter in AGENTS.local.md"), never its value. A colleague who clones the repo gets every rule and fills in their own machine.
10. **Every document says whether it is still true.** Each doc under `docs/` (except the generated and append-only ones) opens with a Status line: `Status: current (verified YYYY-MM-DD)`, `Status: proposal (YYYY-MM-DD)`, `Status: superseded by <D-id or doc>` or `Status: historical`. `check` warns when a current doc's verification is old, when a proposal stays open, and when a live doc cites a superseded decision. `docmap.py docs` lists the audit queue, oldest verification first. This is what stops design proposals and reviews from turning silently into stale "facts".

## Defaults

Use these unless the project's own rules or the user's defaults file say otherwise; confirm them in the interview instead of asking from scratch. They are generic on purpose, because this skill is meant to be shared.

**User defaults file.** A person's standing conventions (git host and account, commit style, their machines and limits, sensitive-data rules, editor quirks) live outside the skill and outside every repository, in `~/.config/project-foundations/defaults.md` (Windows: `%USERPROFILE%\.config\project-foundations\defaults.md`). Read it in Step 0 if it exists and offer its values as the pre-selected interview answers. If it does not exist and the user states conventions that will recur, offer to create it (template in Step 3). Its machine facts go into each project's `AGENTS.local.md`, never into tracked files.

- Canonical rules in `AGENTS.md`; `CLAUDE.md` is `@AGENTS.md` plus Claude-only notes; `.github/copilot-instructions.md` is a pointer with a top-3 fallback; Kiro reads `AGENTS.md` natively, so steering files hold only Kiro-specific additions.
- Portable tooling only: no plugins, MCP servers or tool-specific hooks in the project setup. Everything must work for Claude Code, Copilot, Kiro and a human with a shell.
- Machine facts in `AGENTS.local.md` (git-ignored, one per checkout), with a tracked `AGENTS.local.example.md` listing the keys; agents create it when missing and keep it current.
- Git: an `origin` remote (the account comes from the user's defaults file or the interview), branch `main`, direct commits unless the project uses PRs.
  - Start with `git status` (and `git pull --rebase` when there is a remote). Never commit, discard or overwrite changes you did not make - ask.
  - One logical, tested change per commit; Conventional Commits unless the project documents another style; summary ≤72 chars, body says why; cite D/R ids.
  - Before a code commit: tests green, `python tools/docmap.py check` green, `git diff --check` clean. Docs-only commits still run `docmap.py check`.
  - Push after committing. If the SSH key prompts for a passphrase, run the push unpiped so the user can type it; never ask for, echo or store it. If you cannot push, say so.
  - Never force-push, rewrite pushed history, amend pushed commits, delete remote branches or change repo settings without an explicit request.
- Never commit: secrets (`.env`, keys, tokens), data, outputs, caches, checkpoints, machine-local config, copies of papers or internal documents, files over ~5 MB without approval. Check `git status` and the staged diff; never `git add -f` an ignored path.
- Internal/sensitive data (e.g. an employer's internal documents): never in commits, docs, docstrings or tests; use short synthetic fixtures.
- Research projects: label claims *established* (cited source or code you read), *plausible* (reasoned, untested) or *unresolved*; append-only results; external code and published models are read-only; units and species/conditions with every number.
- Compute: ask before compute-heavy work; local runs stay within the `memory_budget` in `AGENTS.local.md`.
- Environments: the exact interpreter is the `python` key in `AGENTS.local.md`; never the base interpreter. Give commands that work on macOS, Linux and Windows (`python tools/docmap.py ...` does).
- Parallel agents: only once the user runs several at the same time - then one branch (or git worktree) per agent, and a WORKLOG handoff note before merging.

## Step 0 - Detect the mode and gather facts

Inspect before asking, so questions are only about what can't be inferred:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null && git status -sb && git remote -v && git log --oneline | head -20
ls -la; ls docs tools 2>/dev/null
ls CLAUDE.md CLAUDE.local.md AGENTS.md AGENTS.local.md AGENTS.local.example.md GEMINI.md .cursorrules .windsurfrules \
   .github/copilot-instructions.md .github/instructions .kiro/steering .cursor/rules .claude 2>/dev/null
cat ~/.config/project-foundations/defaults.md 2>/dev/null   # the user's defaults, if any
ls pyproject.toml setup.cfg requirements*.txt environment*.yml package.json Makefile .github/workflows 2>/dev/null
cat .gitignore 2>/dev/null; python3 --version
```

Read every instruction file and doc before changing anything. Note: languages, env manager, test command, layout, data/output dirs, sensitive material, what works, and which facts are machine-specific (absolute paths, interpreter, host, memory limits) - those will move to `AGENTS.local.md`. Run the test suite once for a baseline; if the declared env isn't available, use a scratch env outside the repo and say so wherever you report results. `docmap.py` needs Python ≥ 3.11 to read its config (it runs on 3.10 with defaults).

Mode: no meaningful code → Bootstrap. Code but no core docs → Retrofit. Core docs but no `tools/docmap.py` → Upgrade. Everything present → Audit.

## Step 1 - Interview (short)

Ask only what Step 0 didn't answer; offer the owner defaults as the pre-selected option; use a multiple-choice question tool if available:

1. **Goal and non-goals** (non-goals prevent the most expensive mistakes, e.g. "not a local-learning-rule project").
2. **Project type** - application, library/CLI, research/experiments, data/ML pipeline, scripts. Types combine (a lab analysis package is library + research).
3. **Agents used** - which shims to create.
4. **Git** - remote, branch model, push policy.
5. **Boundaries** - never-commit paths, read-only paths, sensitive data, architectural rules that could be checked (which packages must not import what).
6. **Environment and limits** - interpreter, test command, memory/compute limits, where heavy jobs run. Machine values go to `AGENTS.local.md`; how to build the env and the test command go to `AGENTS.md`.
7. **People** - who approves what.

**If the user is unavailable** (or says "just do it"): don't block. Use the defaults, record assumptions that matter as provisional decisions (`status: provisional - confirm with owner`), write `TBD (owner)` for genuine unknowns in BRIEF → Open questions, and list them in the summary. Never invent a goal, non-goals or a file's purpose: describe only what the code or the user shows. Don't add a git remote the user hasn't confirmed.

**When owner defaults and a project's existing rules disagree**, the project's explicit rule wins unless unsafe; record the resolution in DECISIONS and mention it.

## Step 2 - Choose modules

Core set (always): `AGENTS.md`, `AGENTS.local.example.md` (tracked) and `AGENTS.local.md` (ignored), `CLAUDE.md` shim, `docs/BRIEF.md`, `docs/STATUS.md`, `docs/WORKLOG.md`, `docs/DECISIONS.md`, `.gitignore`, `tools/docmap.py` with `docs/MAP.md`, a README in every folder that contains code, a header docstring/comment in every code file, tests and a CI workflow running tests + `docmap.py check`.

| Add                                                       | When                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/ARCHITECTURE.md` + `[[tool.docmap.forbid]]` rules   | There are boundaries or invariants worth stating (most projects past a few modules)                                                                          |
| `CHANGELOG.md`                                            | Others use the project                                                                                                                                       |
| `docs/RESULTS.md` + `docs/RUNS.md` (`[tool.docmap.runs]`) | Research/experiments with run outputs                                                                                                                        |
| `docs/plans/<slug>.md`                                    | Multi-session work; first line `Status: …`                                                                                                                   |
| `docs/reviews/YYYY-MM-DD-<topic>.md`                      | A review with finding IDs (B bug, Q questionable, M missing) and a resolution log                                                                            |
| `docs/CONTRACTS.md`                                       | Data structures, units or file formats shared across components                                                                                              |
| `docs/archive/`, `backlog/`                               | Finished specs and plans; parked code with restore instructions                                                                                              |
| Nested `AGENTS.md` in a folder                            | That folder has rules an agent must see automatically whenever it works there (agents auto-load nested AGENTS.md; they only read a README if they choose to) |
| Copilot / Kiro shims                                      | Those agents are used                                                                                                                                        |

Git-ignored directories that docs mention (`data/`, `outputs/`) don't exist in a fresh clone: track a short README in each (`/data/*` + `!/data/README.md` in `.gitignore`).

## Step 3 - Write the files

Fill templates with real, specific facts; delete sections that don't apply; no `<placeholder>` may survive (except in `AGENTS.local.example.md`, which is a template); absolute dates (`2026-10-23`). Tracked files must stay machine-independent: where a template needs a path, interpreter or limit, name its `AGENTS.local.md` key.

### `AGENTS.md`

```markdown
# <Project name> - agent instructions

<One or two sentences: what this project is.> It is **not** <the main non-goal>.
Goal, scope and open questions: `docs/BRIEF.md`.

## Start of every session
1. `git status` (and `git pull --rebase` if there is a remote). Do not commit, discard or overwrite changes you did not make; ask.
2. Read `AGENTS.local.md` (git-ignored): this machine's interpreter, paths, limits and quirks. If it is missing, create it from `AGENTS.local.example.md` with `python tools/docmap.py local` and the user's answers.
3. Read `docs/STATUS.md`; skim the latest entry in `docs/WORKLOG.md`.
4. Before changing behavior covered by a decision, read it in `docs/DECISIONS.md` (index at the top).

## Finding your way
1. `docs/MAP.md` (generated): every folder and code file with a one-line summary.
2. The folder's `README.md`: purpose, folder rules, and a generated table of its files and who imports them.
3. The file's header docstring; `python tools/docmap.py show <path>` lists its symbols, signatures and importers.
4. Before changing a function or class: `python tools/docmap.py where <Name>` (definition, importers, every use); run the tests it lists.

## Environment and commands
- `python` means the interpreter named by `python` in `AGENTS.local.md` (<how the env is built, e.g. `conda env create -f env/environment.yml`>); never the base interpreter.
- Install: `<command>`. Tests (offline, fast): `<command>`. Docs check: `python tools/docmap.py check`.
- Limits: stay within `memory_budget` (AGENTS.local.md); ask before <heavy work>; heavy jobs run on <where; access details under `compute` in AGENTS.local.md>.

## Boundaries
- Read-only: <paths in the repo; checkouts outside it by their AGENTS.local.md key>. Never commit: <paths/patterns> (in `.gitignore`; never `git add -f`).
- Tracked files name AGENTS.local.md keys, never their values: no absolute paths, user or host names (`docmap.py check` flags home paths and the local file's paths).
- Import boundaries are enforced by `docmap.py check` (`[tool.docmap.forbid]` in `pyproject.toml`; listed in `docs/MAP.md`).
- <Sensitive-data rule, if any.>

## Conventions
<Only project-wide rules an agent would get wrong. Folder-specific rules live in that folder's README.>

## Keeping the project maintained
Update in the same commit as the change that requires it:

| When you… | Update |
|---|---|
| add a code file | its header docstring/comment: first line = what it is for (shown in the map), then how to use it |
| add a folder with code | its `README.md`: a purpose paragraph whose first sentence stands alone |
| change what a file or folder is for | that first line / paragraph |
| add, move, rename or delete files | run `python tools/docmap.py update` |
| learn a fact about this machine (path, interpreter, limit, quirk) | `AGENTS.local.md` only; if every machine needs that key, add it to `AGENTS.local.example.md` |
| finish a unit of work | `docs/STATUS.md` (overwrite) and a new entry at the top of `docs/WORKLOG.md` with commands and results |
| choose between alternatives, or fill a gap | the next D entry in `docs/DECISIONS.md`; to reverse one, a new entry that supersedes it |
| add or change a module boundary | `docs/ARCHITECTURE.md` and `[tool.docmap.forbid]` |
| change user-visible behavior, CLI or config | `README.md` and `CHANGELOG.md` |
| run an experiment | `python tools/docmap.py runs`; a numbered section in `docs/RESULTS.md` citing the run id |
| start multi-session work | a plan in `docs/plans/` with a Status line |
| write or substantially revise a doc in `docs/` | its Status line: `current (verified <today>)`, `proposal (<today>)`, `superseded by <id>` or `historical`; a decided proposal is superseded by its D entry |
| change a default, preset or key number | its source (config/code); `docmap.py update` regenerates `docs/FACTS.md`. Docs cite FACTS.md rather than copying the value |
| supersede a decision | the old entry's heading says `superseded by D<n>`; fix the live docs that `check` then lists |
| reach a milestone (a result merged, a phase closed) | a docs audit: `python tools/docmap.py docs`, re-read the oldest or affected docs against code, DECISIONS and RESULTS, fix them and re-date their Status lines |

- Before every commit: `python tools/docmap.py update`, then `python tools/docmap.py check` (CI runs it too). When `check` warns about old WORKLOG months, run `python tools/docmap.py rotate`.
- Never describe planned or partial work as done; say how it was verified.
- Keep this file short; add a rule only when an agent got something wrong.

## Git
- One logical, tested change per commit: <commit style>, summary ≤72 chars, body says why; cite D/R ids.
- Before committing: tests and docs check green, `git diff --check` clean, staged diff reviewed for never-commit files.
- After committing: `git push origin <branch>` (run unpiped if the SSH key prompts; never ask for or store the passphrase). If you can't push, say so.
- Never force-push, rewrite pushed history or amend pushed commits. Ask before anything destructive.
```

### Shims

`CLAUDE.md`:

```markdown
@AGENTS.md

<!-- Claude Code-only additions below. Shared rules belong in AGENTS.md. -->
```

`.github/copilot-instructions.md` (if Copilot is used):

```markdown
Follow [AGENTS.md](../AGENTS.md) at the repository root; its rules are mandatory. Read it and `AGENTS.local.md` (this machine), then `docs/STATUS.md` and `docs/MAP.md`, before any change. Most important if it is not loaded:
- <the 3 rules whose violation does the most damage, e.g. never commit data/secrets; run tests and `python tools/docmap.py check` before committing; never force-push>
```

Kiro reads root `AGENTS.md` natively: don't create a steering file just to point at it. Create `.kiro/steering/<topic>.md` only for Kiro-specific additions. Don't restate rules in shims beyond the top-3 fallback.

### `AGENTS.local.example.md` (tracked) and `AGENTS.local.md` (git-ignored)

The example lists every key a machine needs; the local file holds this machine's values in the same `- key: value` form, so `docmap.py check` can warn about missing keys. Agents create the local file when it is missing (`python tools/docmap.py local` prints what it can detect; ask the user for the rest) and update it when a machine fact changes. Add project-specific keys for anything outside the repo (sibling checkouts, data roots, cluster login). No secrets: agents read this file into their context. A machine's quirks the user wants agents to respect (an editor that rewrites tables, a passphrase-protected SSH key) go under `notes`.

```markdown
# AGENTS.local.md template

Copy to `AGENTS.local.md` (git-ignored) and fill it in for this machine; agents create and update it. One `- key: value` line per fact. Tracked files refer to these keys, never to their values. No secrets: agents read this file into their context.

- machine: <host name (OS, arch, CPUs, RAM)> - from `python tools/docmap.py local`
- python: <absolute path of the project interpreter> - what `python` in AGENTS.md means
- memory_budget: <peak RAM that local runs may use, e.g. "6 GB, never above 10 GB">
- compute: <where heavy jobs run and how to reach them, or "none">
- <one key per location outside the repo, e.g. upstream_checkout: <path to the read-only checkout>>
- notes: <quirks agents must respect here, e.g. the SSH key asks for a passphrase, so push unpiped>
```

### User defaults file (outside every repository)

`~/.config/project-foundations/defaults.md` - only if the user wants their conventions reused across projects:

```markdown
# Project-foundations defaults (<name>)
Read by the project-foundations skill in Step 0. Not part of any repository.

## Conventions
- Git: <host and account, e.g. git@github.com:<account>/<repo>.git>; <commit style>; push after committing.
- Never commit: <personal additions, e.g. an employer's internal documents>.
- <research, language or review conventions>

## Machines (copied into each checkout's AGENTS.local.md, never into tracked files)
- <machine>: <OS; agents used; memory budget; where heavy jobs run; quirks>
```

### Folder `README.md` (every folder that contains code)

`docmap.py update` creates a stub with `TODO(docmap)` and keeps the generated table current; `check` fails until the stub is replaced. Write:

```markdown
# <folder>/

<Purpose paragraph. The first sentence must stand alone - it becomes this folder's line in docs/MAP.md and in the parent's table. Then: when to look here, the main entry points, and what does NOT belong here.>

## Rules here
- <Optional: conventions that apply only to this folder. If an agent must see them automatically, use a nested AGENTS.md instead.>

<!-- docmap:begin (generated by tools/docmap.py; do not edit) -->
(generated table)
<!-- docmap:end -->
```

### File headers (every code file)

Python - a module docstring:

```python
"""<One line: what this module is for. Shown in docs/MAP.md and the folder README.>

<How to use it: the main classes/functions and how to call them (or the command line).>
<Contracts: inputs/outputs, units, shapes, side effects, invariants; cite D/R ids for choices.>
"""
```

Other languages: the first comment line (after any shebang) is the summary, followed by usage lines. Do not hand-write "used by" lists: they go stale; the generated tables and `docmap.py uses/where` provide them. Describe only what the code shows; if a file's purpose is unclear, say so in the docstring ("Purpose unclear: …") and add an open question to BRIEF.

### `docs/BRIEF.md`

```markdown
# Brief
Updated <YYYY-MM-DD>.

## Goal
<What success looks like, in 2-5 sentences.>

## Non-goals
- <Explicitly out of scope, and why.>

## Users / stakeholders
<Who uses it, who approves what.>

## Success criteria
- <Observable, checkable.>

## Constraints
<Data sensitivity, compute, deadlines, platforms.>

## Open questions (for the owner)
- [ ] <question> - <why it matters / what it blocks>
```

### `docs/STATUS.md` - snapshot, overwritten each session (≤ ~80 lines)

```markdown
# Status
Updated <YYYY-MM-DD>. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Works (verified)
| Capability | How verified |
|---|---|
| <thing> | `<command>` → <result>, <date> |

## Doesn't work yet / known issues
- <issue> (<D/R/B id>)

## Next actions
1. <smallest next step> - <what it needs>

## Blockers
- <blocker> - <who/what unblocks it>
```

Anything added but not verifiable here (CI without a remote, tests in an env this machine lacks) goes under "Doesn't work yet / unverified", with what was verified instead.

### `docs/WORKLOG.md` - append-only, newest first

```markdown
# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

## <YYYY-MM-DD> - <short title>
Changed: <summary>. Decisions: <D ids, or none>.

| Verification command | Result |
|---|---|
| `<cmd>` | <result> |

Next: <one line>
```

Entry headings must contain a date (`2026-10-23` or `23 October 2026`) so `docmap.py rotate` can move past months into `docs/worklog/`. Migrated entries keep their original wording.

### `docs/DECISIONS.md` - append-only, stable IDs

```markdown
# Decision log
Every choice between alternatives, and every gap the code or sources leave that we filled ourselves. IDs are permanent. To change a decision, add a new entry and set the old one's status to "superseded by" the new ID; do not rewrite it.

## D1. <Decision title> (<YYYY-MM-DD>; status: accepted | provisional - confirm with owner | superseded by D7)
- **Context:** <the problem and constraints>
- **Decision:** <what we do>
- **Alternatives:** <option> - <why not>
- **Consequences:** <what this makes easy/hard; when to revisit>
- **Evidence / source:** <link, paper, benchmark, commit; research: established/plausible/unresolved>
```

`docmap.py update` inserts and refreshes an ID index after the intro paragraph; `check` warns when a doc cites a D-id that doesn't exist. Headings must match `## D<n>. <title>`. For many large independent decisions in a team service, one file per decision (`docs/decisions/NNNN-title.md`, MADR) also works; then set `indexes` in the config accordingly.

### `docs/ARCHITECTURE.md`

```markdown
# Architecture
Updated <YYYY-MM-DD>. Only what rarely changes; the file-level map is generated in docs/MAP.md.

## Overview
<The problem and the main data/control flow, possibly as a small text diagram.>

## Boundaries and invariants
- <"core never imports torch, NEURON or TwinProp at module level"> - enforced by `[tool.docmap.forbid]`
- <"every model output passes validation before it is accepted"> - enforced by tests in <file>

## Cross-cutting concerns
<Config, logging, cache keys, errors, persistence.>
```

A long design reference (rationale per component) can live alongside as `docs/design/*.md` split per component, so agents read one part instead of one huge file.

### Other templates

- `CHANGELOG.md`: Keep a Changelog - `## [Unreleased]` with `### Added / Changed / Fixed / Removed`.
- `docs/RESULTS.md`: numbered sections `## N. <run name> (<date>, run id, commit, config)` - setup, numbers with units, interpretation labelled established/plausible/unresolved, open problems. Corrections are new sections. The generated index lists them.
- `docs/plans/<slug>.md`: `Status: proposed | in progress | done <date> | abandoned (<why>)`; Objective, Non-goals, Steps, Verification, Risks.
- `docs/reviews/…`: findings B/Q/M with severity, evidence, fix; a resolution log at the top.

### `.gitignore`

Always: `.env`, `.env.*` + `!.env.example`, `*.pem`, `*.key`, `*.local.md` (covers `AGENTS.local.md` and `CLAUDE.local.md`, not `AGENTS.local.example.md`), `.claude/settings.local.json`, scratch folders that AI tools write into the repo (e.g. `Claude outputs/`), OS/editor junk, caches, `*.egg-info/`, `.venv/`, plus data/output/cache/checkpoint dirs and machine-local config (with a commented line for sensitive entries). Commit a `*.example` for each ignored config, with variable names taken from the code, never by reading the secret file. A never-commit file already tracked: `git rm --cached`, commit, tell the user it stays in history; purge history only on explicit request.

## Step 4 - Install the map and the checks

1. Write `tools/docmap.py` **verbatim** from the appendix (if another of the owner's repos has a newer copy, use that). Add a `tools/README.md` purpose paragraph if the folder is new.
2. Configure it in `pyproject.toml` (or `docmap.toml` with the same keys at top level for non-Python projects). In globs, `*` also matches `/`.

```toml
[tool.docmap]
exclude = ["references/*"]            # never mapped (vendored copies, large reference material)
readme_exempt = []                    # folders that need no README
docstring_exempt = []                 # files that need no header doc
link_exempt = ["docs/archive/*"]      # markdown whose relative links are historical
lifecycle = ["docs/*.md"]             # docs that must open with a Status line (generated/append-only logs are exempt)
lifecycle_exempt = []                 # e.g. ["docs/briefs/*"] if briefs are throwaway
lifecycle_strict = false              # true: missing/stale Status lines fail CI (switch on once every doc has one)
verify_max_days = 60                  # a "current" doc older than this is due for re-verification
proposal_max_days = 30                # an open proposal older than this: decided? supersede it

[tool.docmap.facts]                   # generated docs/FACTS.md: one row per key value, read from its source
"default cell" = { file = "configs/cell.json", key = "id", note = "D27" }      # key = dotted path in JSON/TOML
"encoder preset" = { file = "src/mypkg/defaults.py", pattern = "^ENCODER = \"(.+)\"" }  # or a regex with one group

[[tool.docmap.forbid]]                # one block per architectural rule
source = "mypkg"
except = ["mypkg.adapters"]           # where the import is allowed
imports = ["torch", "neuron"]
reason = "core runs without heavy backends"

[tool.docmap.runs]                    # research projects: run index from run manifests (JSON)
manifests = "outputs/**/manifest.json"
out = "docs/RUNS.md"
columns = { run = "run_id", created = "created_utc", commit = "project_git.revision", config = "config_hash" }
# columns map a header to a dotted key in the manifest; the second column is the sort key (use the date)
# Also available (see DEFAULTS in the script): agents_max_lines (default 150), indexes (heading patterns for the ID
# indexes), portable / portable_exempt (files scanned for machine-specific paths), portable_allow (paths that are facts
# about other code, e.g. an upstream's hard-coded "/home/someone"), local / local_example (file names)
```

   Only module-level imports count for `forbid`, so deliberate lazy imports inside functions stay allowed. If the project has no run manifests yet, have the run code write one JSON per run (run id, UTC time, git revision and dirty flag, config hash, seeds, runtime) - it is the cheapest reproducibility record there is.
3. `python tools/docmap.py update`, then `python tools/docmap.py check`. docmap reads tracked files plus untracked files that are not ignored (so new files appear before `git add`); ignore scratch folders first or they show up in the map and the checks. Fix every error: replace each `TODO(docmap)` README stub with a real purpose paragraph and give every code file a header (read the file first; describe what it does, not what its name suggests). Work folder by folder and commit per folder or per few folders, so each commit is reviewable. These commits cannot all pass `check` (it turns green with the last README): say so in their messages and make sure the last one is green. If a README's first paragraph is a status note ("Paused since ..."), add a standalone purpose sentence above it, because the first sentence is what the map shows. If a README already has a hand-written file table, move any information it holds that the generated table lacks into the files' docstrings or the purpose paragraph, then delete the duplicate table; if something would be lost, keep it and say so in WORKLOG.
4. CI (`.github/workflows/tests.yml`), Python ≥ 3.11 - add the docmap step once `check` passes locally:

```yaml
      - run: python -m pip install -e '.[dev]'
      - run: python -m pytest -q
      - run: python tools/docmap.py check
```

   `check` fails on: stale generated blocks, missing folder descriptions or file headers, files that don't parse, broken relative links in Markdown, forbidden imports. It warns on: cited decision IDs that don't exist, AGENTS.md over the length limit, old WORKLOG months, STATUS not touched for many commits, docs without a Status line, "current" docs not verified for `verify_max_days`, proposals open longer than `proposal_max_days`, and lines in live docs that cite a superseded decision without saying so (a decision is superseded when its heading, or its `Status:` line, says `superseded by D<n>`). A stale `docs/FACTS.md` (a source value changed) is an error like any stale generated block.
5. For research projects: `python tools/docmap.py runs` after runs; commit `docs/RUNS.md` (rows from other machines, e.g. a cluster, are kept).

## Retrofit procedure

1. **Inventory** every instruction file and doc; build a table *rule or fact → where it appears → conflicts*.
2. **Classify and route** each piece: session rules → `AGENTS.md`; machine facts (absolute paths, interpreter, host, RAM budget, local checkouts, editor or SSH quirks) → `AGENTS.local.md`, with the key in `AGENTS.local.example.md`; a person's cross-project conventions → their defaults file; current state → STATUS; dated history and command/result tables → WORKLOG (verbatim, original dates); choices with reasons → DECISIONS (keep existing IDs and files); folder-specific rules → that folder's README (or nested AGENTS.md); how-to for humans → README or docs; finished specs → `docs/archive/`.
3. **Respect what works**: keep names and formats other docs or commits reference.
4. **Show the migration plan** (create / move / merge / shrink, canonical file named) before moving or deleting anything; wait for approval if the user is present.
5. **Move, don't retype**: `git mv` whole files; move sections verbatim with a script.
6. **Backfill only from evidence**: reconstruct decisions from commits or docs where the reason is recorded, marked `(reconstructed from <source>)`; otherwise open questions.
7. **Check claims against the code**: STATUS or old instructions often describe work that doesn't exist. Correct the snapshot and say so.
8. Then do Step 4.
9. **Commit in reviewable steps**, each leaving the repo consistent (docs before the instruction file that references them).

## Upgrade procedure (core docs exist, map layer missing)

1. Step 4.1–4.2: install and configure `tools/docmap.py`; turn the invariants already written in AGENTS.md/ARCHITECTURE (e.g. "core never imports heavy backends") into `forbid` rules, and check they pass. If a rule fails on a designed exception (e.g. an optional training package that exists to import torch), add it to `except` and record a decision; if it fails on a real violation, ask the owner.
2. `update`, then work through `check` errors folder by folder: README purpose paragraphs, module docstrings. Commit per folder.
3. Shrink `AGENTS.md`: move folder-specific rules into the folder READMEs (or a nested AGENTS.md if they must load automatically), add the "Finding your way" section and the new rows of the maintenance table, keep it under ~120 lines.
3a. Make it shareable: create `AGENTS.local.example.md` and this machine's `AGENTS.local.md`; for every machine-specific path `check` reports (and every host name, user name or machine limit you find), move the value into `AGENTS.local.md` and refer to its key. Use `portable_allow` for paths that are facts about other code. Leave history (WORKLOG, RESULTS, archive) as it is.
4. Split a very long design document into per-component files if agents keep reading all of it; keep `ARCHITECTURE.md` short.
5. `rotate` the WORKLOG; set up `[tool.docmap.runs]` for research repos and run `runs`.
6. Add `python tools/docmap.py check` to CI; update the Copilot shim's fallback rules.
6a. Doc lifecycle: give every doc in `docs/` a Status line (read it against the code, DECISIONS and RESULTS first: current, proposal, superseded or historical; move fully historical docs to `docs/archive/`). Mark superseded decisions in their headings. Configure `[tool.docmap.facts]` with the values docs keep repeating (defaults, presets, counts) and replace copied values with a reference to `docs/FACTS.md`. Keep `lifecycle_strict = false` until every doc has a Status line, then switch it on.
7. Fix what `check` finds in old docs (broken links: fix the link or exempt truly historical folders via `link_exempt`; never delete history to silence a check).
8. WORKLOG entry with the before/after `check` summary; commit; push.

## Step 5 - Verify

```bash
python tools/docmap.py update && python tools/docmap.py check   # expect 0 errors
<test command>                                                  # passes, or record why not in STATUS
wc -l AGENTS.md CLAUDE.md; grep -n '^@AGENTS.md' CLAUDE.md
for p in .env .env.local CLAUDE.local.md AGENTS.local.md <each never-commit path>; do git check-ignore -q "$p" || echo "NOT IGNORED: $p"; done
python tools/docmap.py local                                    # compare with AGENTS.local.md
git ls-files | grep -iE '(^|/)\.env(\.|$)|\.pem$|\.key$|secret' | grep -v '\.example$' || echo "no secrets tracked"
python tools/docmap.py where <a central class>                  # sanity: definition, importers and uses look right
```

Also read: no rule contradicts another across AGENTS.md, shims and nested files; STATUS has a date and every "Works" row a verification; the brief has non-goals (or `TBD (owner)`); a few generated README tables and docstrings read correctly.

## Step 6 - Audit mode

Run Step 5 and `python tools/docmap.py docs` (the audit queue: oldest verification first; docs with no Status line on top), then look for: **staleness** (docs whose Status is current but whose claims no longer match code, configs, FACTS.md or the latest DECISIONS/RESULTS; proposals that were decided; live docs citing superseded decisions; STATUS behind the last commits; ARCHITECTURE naming modules that no longer exist; plans "in progress" with no recent commits; docstrings whose first line no longer matches the code); **bloat** (AGENTS.md over ~120 lines; huge single docs; rules agents follow anyway); **drift** (rules duplicated across files; shims restating rules; decisions contradicted by code without a superseding entry); **portability** (machine facts in tracked files that `check` cannot see: host or user names, a machine's RAM limit, "on my Mac"; keys missing from `AGENTS.local.example.md`); **gaps** (decisions visible in git log - `git log --oneline -i -E --grep='switch|instead|replace|chose|decid'` - with no D entry; boundaries stated in prose but not in `forbid`). Output a short findings list, most important first, with fixes; apply what the user approves.

## Step 7 - Finish

1. WORKLOG entry ("Set up / upgraded project foundations") with the Step 5 output; STATUS reflects the result.
2. Commit (the worklog entry in the same or final commit); push if a remote exists, otherwise say it wasn't pushed.
3. Tell the user briefly: mode, what was created or changed, the `check` summary, what went into `AGENTS.local.md`, anything `TBD (owner)`, and the habit that matters: each session ends with STATUS, WORKLOG, `docmap.py update` + `check`, and a commit - which AGENTS.md tells every agent to do.

## Appendix: `tools/docmap.py`

Write this file verbatim. It uses only the standard library.

````python
#!/usr/bin/env python3
"""Project map, code lookups and doc-health checks for agents and humans (stdlib only, Python >= 3.11).

Installed by the project-foundations skill. Commands (run from the repository root):
  python tools/docmap.py update        regenerate docs/MAP.md, the generated block in every folder
                                       README.md, and the indexes in DECISIONS.md / RESULTS.md
  python tools/docmap.py check         CI gate: exit 1 if anything generated is stale or docs are broken
  python tools/docmap.py where NAME    where a class/function is defined, who imports it, where it is used
  python tools/docmap.py show PATH     a file's docstring, public symbols with signatures, importers
  python tools/docmap.py uses PATH     what a module imports from the repo and what imports it
  python tools/docmap.py rotate        move WORKLOG entries from earlier months to docs/worklog/YYYY-MM.md
  python tools/docmap.py runs          add local run manifests to the run index (docs/RUNS.md; needs [tool.docmap.runs])
  python tools/docmap.py local         print what can be detected about this machine, for AGENTS.local.md
  python tools/docmap.py docs          list every lifecycle doc with its Status line and age (what to verify next)
Configuration: optional [tool.docmap] table in pyproject.toml, or docmap.toml (same keys, top level).
"""
from __future__ import annotations

import ast, fnmatch, os, re, subprocess, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path.cwd()
BEGIN, END = "<!-- docmap:begin (generated by tools/docmap.py; do not edit) -->", "<!-- docmap:end -->"
CODE_EXT = {".py", ".sh", ".js", ".ts", ".tsx", ".jsx", ".r", ".R", ".jl", ".m", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".ps1"}
DEFAULTS = {
    "exclude": [],                      # globs never mapped (e.g. "references/**")
    "readme_exempt": [],                # dirs that need no README (globs)
    "docstring_exempt": [],             # files that need no header doc (globs)
    "link_exempt": ["docs/archive/*"],  # markdown whose relative links are historical
    "map": "docs/MAP.md",
    "agents_max_lines": 150,
    "status": "docs/STATUS.md", "worklog": "docs/WORKLOG.md", "worklog_dir": "docs/worklog",
    "status_max_commits": 8,            # warn if STATUS is older than this many commits
    "indexes": [{"file": "docs/DECISIONS.md", "pattern": r"^## (D\d+)\.\s*(.+)$", "ids": r"\bD[1-9]\d*\b"},
                {"file": "docs/RESULTS.md", "pattern": r"^#{2,3} (\d+[a-z]?)\.(?!\d)\s*(.+)$"}],  # "5.1" is a subsection, not an entry
    "forbid": [],                       # [{source="pkg", except=["pkg.adapters"], imports=["torch"], reason="..."}]
    "local": "AGENTS.local.md", "local_example": "AGENTS.local.example.md",  # machine facts (git-ignored) and their template
    "portable": ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", ".github/instructions/*", ".kiro/steering/*",
                 "*README.md"],          # scanned for machine-specific paths, as is every code file's header
    "portable_exempt": [],              # globs skipped by that scan
    "portable_allow": [],               # paths that are facts about other code, e.g. an upstream hard-coded "/home/someone"
    # doc lifecycle: every doc matching `lifecycle` (minus generated/append-only files) starts with a line
    # "Status: current (verified YYYY-MM-DD) | proposal (YYYY-MM-DD) | superseded by <ref> | historical"
    "lifecycle": ["docs/*.md"],
    "lifecycle_exempt": [],             # globs; the map, STATUS, WORKLOG, run index and the indexed logs are always exempt
    "lifecycle_strict": False,          # True: missing or stale Status lines are errors, not warnings
    "verify_max_days": 60,              # warn when a "current" doc was last verified longer ago
    "proposal_max_days": 30,            # warn when a "proposal" is older (decided since? then supersede or mark current)
    "facts": {},                        # {name = {file, key | pattern, note}} -> generated facts table (single source of values)
    "facts_out": "docs/FACTS.md",
}
STATUS_LINE = re.compile(r"^(?:>\s*)?\**Status\**:?\**:?\s*(current|proposal|superseded|historical)\b(.*)$", re.I)
DATE = re.compile(r"(\d{4}-\d{2}-\d{2})")
HOME_PATH = re.compile(r"(?:/Users/|/home/)[\w.-]+|[A-Za-z]:\\Users\\[\w.-]+")
MONTHS = {m: i for i, m in enumerate("january february march april may june july august september october november december".split(), 1)}


def load_config() -> dict:
    cfg = dict(DEFAULTS)
    try:
        import tomllib
    except ImportError:  # Python < 3.11: defaults only
        if "[tool.docmap" in ((ROOT / "pyproject.toml").read_text(encoding="utf-8") if (ROOT / "pyproject.toml").exists() else ""):
            print("warning: Python < 3.11 cannot read [tool.docmap]; using defaults", file=sys.stderr)
        return cfg
    for name, key in (("pyproject.toml", ("tool", "docmap")), ("docmap.toml", ())):
        p = ROOT / name
        if p.exists():
            data = tomllib.loads(p.read_text(encoding="utf-8"))
            for k in key:
                data = data.get(k, {})
            cfg.update(data)
    return cfg


CFG = load_config()


def tracked_files() -> list[str]:
    try:
        out = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                             capture_output=True, text=True, check=True).stdout.splitlines()
    except (OSError, subprocess.CalledProcessError):
        out = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts]
    files = sorted({f for f in out if (ROOT / f).is_file()})
    return [f for f in files if not any(fnmatch.fnmatch(f, g) for g in CFG["exclude"])]


def matches(path: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, g) or fnmatch.fnmatch(path + "/", g) for g in globs)


# ---------------------------------------------------------------- Python analysis
class Module:
    def __init__(self, path: str):
        self.path, self.name, self.summary, self.doc = path, module_name(path), "", ""
        self.symbols: list[tuple[str, str, int, str]] = []   # (kind, name, line, signature)
        self.imports: list[tuple[str, str | None, int, bool]] = []  # (module, name, line, toplevel)
        self.tree = None
        try:
            self.tree = ast.parse((ROOT / path).read_text(encoding="utf-8"), filename=path)
        except (SyntaxError, UnicodeDecodeError, ValueError):
            return
        self.doc = ast.get_docstring(self.tree) or ""
        self.summary = self.doc.strip().splitlines()[0] if self.doc.strip() else ""
        for node in self.tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                self.symbols.append(("def", node.name, node.lineno, f"{node.name}({ast.unparse(node.args)})"))
            elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                meths = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                         and (not n.name.startswith("_") or n.name == "__init__")]
                self.symbols.append(("class", node.name, node.lineno, f"{node.name}: " + ", ".join(meths)))
        top = set(map(id, self.tree.body))
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    self.imports.append((a.name, None, node.lineno, id(node) in top))
            elif isinstance(node, ast.ImportFrom):
                base = resolve_relative(self.name, node.module, node.level, path.endswith("__init__.py"))
                for a in node.names:
                    self.imports.append((base, a.name, node.lineno, id(node) in top))


def module_name(path: str) -> str:
    p = Path(path)
    parts = [p.stem] if p.name != "__init__.py" else []
    d = p.parent
    while (ROOT / d / "__init__.py").exists() and str(d) not in ("", "."):
        parts.insert(0, d.name)
        d = d.parent
    return ".".join(parts) or p.parent.name


def resolve_relative(mod: str, target: str | None, level: int, is_pkg: bool) -> str:
    if level == 0:
        return target or ""
    base = mod.split(".") if is_pkg else mod.split(".")[:-1]
    base = base[: len(base) - (level - 1)] if level > 1 else base
    return ".".join(base + ([target] if target else []))


def analyse(files: list[str]) -> dict[str, Module]:
    mods: dict[str, Module] = {}
    for f in files:
        if f.endswith(".py"):
            m = Module(f)
            if m.name in mods:  # two loose scripts with the same file name
                m.name = f[:-3].replace("/", ".")
            mods[m.name] = m
    return mods


def internal_edges(mods: dict[str, Module], toplevel_only=False):
    """Yield (importer, imported_module, symbol_or_None) for imports that resolve to repo modules."""
    for m in mods.values():
        for target, name, _, top in m.imports:
            if toplevel_only and not top:
                continue
            if name and f"{target}.{name}" in mods:
                yield m.name, f"{target}.{name}", None
            elif target in mods:
                yield m.name, target, name
            else:  # longest repo prefix, e.g. "pkg.sub.thing" -> "pkg.sub"
                parts = target.split(".")
                for i in range(len(parts) - 1, 0, -1):
                    if ".".join(parts[:i]) in mods:
                        yield m.name, ".".join(parts[:i]), None
                        break


def importers(mods):
    by = defaultdict(set)
    for src, dst, _ in internal_edges(mods):
        if src != dst:
            by[dst].add(src)
    return by


# ---------------------------------------------------------------- summaries
def file_summary(path: str, mods_by_path: dict[str, Module]) -> str:
    if path in mods_by_path:
        return mods_by_path[path].summary
    p = ROOT / path
    try:
        lines = p.read_text(encoding="utf-8").splitlines()[:30]
    except (UnicodeDecodeError, OSError):
        return ""
    if p.suffix == ".md":
        for ln in lines:
            if ln.startswith("#"):
                return ln.lstrip("# ").strip()
    if p.suffix in CODE_EXT or p.suffix in {".toml", ".yml", ".yaml", ".sbatch", ".cfg", ".ini"}:
        for ln in lines:
            s = ln.strip()
            if s.startswith("#!") or not s:
                continue
            m = re.match(r"^(#|//|--|%|;)\s*(.+)", s)
            return m.group(2).strip() if m else ""
    return ""


def readme_description(d: str) -> str:
    p = ROOT / d / "README.md"
    if not p.exists():
        return ""
    text = strip_block(p.read_text(encoding="utf-8"))
    for para in re.split(r"\n\s*\n", text):
        s = " ".join(para.split())
        if s and not s.startswith("#"):
            return "" if "TODO(docmap)" in s else s.split(". ")[0].rstrip(".") + "."
    return ""


def strip_block(text: str) -> str:
    return re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), "", text, flags=re.S)


def replace_block(text: str, body: str, after_first_para=False) -> str:
    block = f"{BEGIN}\n{body.rstrip()}\n{END}"
    if BEGIN in text and END in text:
        return re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda _: block, text, flags=re.S)
    if after_first_para:  # after the title and the first paragraph
        parts = text.split("\n\n", 2)
        head = "\n\n".join(parts[:2]) if len(parts) > 2 else text.rstrip()
        rest = parts[2] if len(parts) > 2 else ""
        return f"{head}\n\n{block}\n\n{rest}".rstrip() + "\n"
    return text.rstrip() + "\n\n" + block + "\n"


# ---------------------------------------------------------------- generation
def code_dirs(files: list[str]) -> list[str]:
    dirs = set()
    for f in files:
        if Path(f).suffix in CODE_EXT:
            d = Path(f).parent
            while str(d) not in ("", "."):
                dirs.add(str(d))
                d = d.parent
    return sorted(d for d in dirs if not matches(d, CFG["readme_exempt"]))


def short(names, limit=4):
    names = sorted(names)
    out = ", ".join(f"`{n.split('.')[-1]}`" for n in names[:limit])
    return out + (f" (+{len(names) - limit})" if len(names) > limit else "")


def folder_table(d: str, files, mods_by_path, imp) -> str:
    entries = set()
    for f in files:
        parent = str(Path(f).parent)
        if parent == d and Path(f).name != "README.md":
            entries.add((Path(f).name, f))
        elif f.startswith(d + "/") and parent != d:
            entries.add((f[len(d) + 1:].split("/")[0] + "/", d + "/" + f[len(d) + 1:].split("/")[0]))
    rows = ["| Entry | What it is | Imported by |", "|---|---|---|"]
    for name, full in sorted(entries, key=lambda e: (not e[0].endswith("/"), e[0].lower())):
        if name.endswith("/"):
            desc, used = readme_description(full), ""
        else:
            desc = file_summary(full, mods_by_path)
            m = mods_by_path.get(full)
            used = short(imp.get(m.name, ())) if m else ""
        rows.append(f"| `{name}` | {desc.replace('|', '/') or '—'} | {used} |")
    return "\n".join(rows)


def build_map(files, mods_by_path, imp, dirs) -> str:
    out = ["# Project map", "",
           "Generated by `python tools/docmap.py update`; do not edit by hand. Read this first, then the folder's",
           "`README.md`, then the file's header docstring. Look code up with `python tools/docmap.py where NAME`.", ""]
    for d in dirs:
        depth = d.count("/")
        out.append(f"{'  ' * depth}- **`{d}/`** — {readme_description(d) or '(no README)'}")
        for f in files:
            if str(Path(f).parent) == d and Path(f).suffix in CODE_EXT:
                m = mods_by_path.get(f)
                n = len(imp.get(m.name, ())) if m else 0
                used = f" · imported by {n}" if n else ""
                out.append(f"{'  ' * (depth + 1)}- `{Path(f).name}` — {file_summary(f, mods_by_path) or '(no docstring)'}{used}")
    hubs = sorted(((len(v), k) for k, v in imp.items()), reverse=True)[:10]
    if hubs:
        out += ["", "## Most imported modules (change with care)", ""]
        out += [f"- `{k}` — imported by {n}" for n, k in hubs]
    if CFG["forbid"]:
        out += ["", "## Enforced import boundaries", ""]
        out += [f"- `{r['source']}` must not import {', '.join(f'`{i}`' for i in r['imports'])} at module level"
                + (f" (except in {', '.join(f'`{e}`' for e in r.get('except', []))})" if r.get("except") else "")
                + (f": {r['reason']}" if r.get("reason") else "") for r in CFG["forbid"]]
    return "\n".join(out) + "\n"


def build_index(path: str, pattern: str) -> str | None:
    p = ROOT / path
    if not p.exists():
        return None
    rows = ["| ID | Entry |", "|---|---|"]
    for ln in strip_block(p.read_text(encoding="utf-8")).splitlines():
        m = re.match(pattern, ln)
        if m:
            rows.append(f"| {m.group(1)} | {m.group(2).replace('|', '/')} |")
    return "\n".join(rows)


def generated(files):
    """Return {path: new_text} for everything `update` writes."""
    mods = analyse(files)
    by_path = {m.path: m for m in mods.values()}
    imp = importers(mods)
    dirs = code_dirs(files)
    out = {CFG["map"]: build_map(files, by_path, imp, dirs)}
    for d in dirs:
        p = ROOT / d / "README.md"
        old = p.read_text(encoding="utf-8") if p.exists() else \
            f"# {d}/\n\nTODO(docmap): one paragraph on what this folder is for and when to look here.\n"
        out[f"{d}/README.md"] = replace_block(old, folder_table(d, files, by_path, imp))
    facts = build_facts()
    if facts:
        out[CFG["facts_out"]] = facts
    for ix in CFG["indexes"]:
        body = build_index(ix["file"], ix["pattern"])
        if body:
            out[ix["file"]] = replace_block((ROOT / ix["file"]).read_text(encoding="utf-8"), body, after_first_para=True)
    return out, mods


def fact_value(spec: dict) -> str:
    """One fact from a source file: `key` = dotted path into JSON/TOML, or `pattern` = regex with one group."""
    p = ROOT / spec["file"]
    if not p.exists():
        return "MISSING FILE"
    text = p.read_text(encoding="utf-8")
    if "key" in spec:
        import json
        if p.suffix == ".json":
            data = json.loads(text)
        elif p.suffix == ".toml":
            import tomllib
            data = tomllib.loads(text)
        else:
            return "UNSUPPORTED FILE (use pattern)"
        v = dig(data, spec["key"])
        return "MISSING KEY" if v is None else str(v)
    m = re.search(spec["pattern"], text, re.M)
    return m.group(1).strip() if m else "NO MATCH"


def build_facts() -> str | None:
    if not CFG["facts"]:
        return None
    rows = ["# Facts", "", "Generated by `tools/docmap.py update` from the files named below; do not edit. Docs cite this file "
            "(or the source) instead of copying these values, so a changed default changes in one place.", "", BEGIN,
            "| Fact | Value | Source | Note |", "|---|---|---|---|"]
    for name, spec in sorted(CFG["facts"].items()):
        src = spec["file"] + (f" `{spec['key']}`" if "key" in spec else "")
        rows.append(f"| {name} | {fact_value(spec).replace('|', '/')} | {src} | {spec.get('note', '')} |")
    return "\n".join(rows + [END, ""])


def lifecycle_docs(files: list[str]) -> list[str]:
    always = {CFG["map"], CFG["status"], CFG["worklog"], CFG["facts_out"]} | {ix["file"] for ix in CFG["indexes"]}
    always |= {f for f in files if f.startswith(CFG["worklog_dir"] + "/")}  # rotated WORKLOG months
    if isinstance(CFG.get("runs"), dict) and CFG["runs"].get("out"):
        always.add(CFG["runs"]["out"])
    return [f for f in files if f.endswith(".md") and matches(f, CFG["lifecycle"]) and f not in always
            and not matches(f, CFG["lifecycle_exempt"] + CFG["link_exempt"])]


def doc_status(path: str):
    """(state, rest of the Status line, date) from the first 15 lines, or None."""
    for ln in (ROOT / path).read_text(encoding="utf-8", errors="replace").splitlines()[:15]:
        m = STATUS_LINE.match(ln.strip())
        if m:
            d = DATE.search(m.group(2))
            return m.group(1).lower(), m.group(2).strip(), d.group(1) if d else None
    return None


def superseded_ids() -> dict[str, str]:
    """{id: replacement} for index entries whose heading or Status line says 'superseded by X'."""
    out = {}
    for ix in CFG["indexes"]:
        p = ROOT / ix["file"]
        if "ids" not in ix or not p.exists():
            continue
        cur = None
        for ln in p.read_text(encoding="utf-8").splitlines():
            m = re.match(ix["pattern"], ln)
            if m:
                cur = m.group(1)
            if cur and (m or re.match(r"^\s*[-*]?\s*\**Status\**", ln)):
                s = re.search(r"superseded by\s+(" + ix["ids"].strip("\\b") + r")", ln, re.I)
                if s:
                    out[cur] = s.group(1)
    return out


def lifecycle_findings(files: list[str]):
    """(problems, notes): Status-line problems and citations of superseded decisions in live docs."""
    import datetime
    today, problems, notes = datetime.date.today(), [], []
    sup = superseded_ids()
    for f in lifecycle_docs(files):
        st = doc_status(f)
        if st is None:
            problems.append(f"{f}: no Status line in its first lines (current (verified DATE) | proposal | superseded by X | historical)")
            continue
        state, rest, date = st
        age = (today - datetime.date.fromisoformat(date)).days if date else None
        if state == "current" and age is None:
            problems.append(f"{f}: Status current without a verified date")
        elif state == "current" and age > CFG["verify_max_days"]:
            problems.append(f"{f}: last verified {age} days ago ({date}); re-check it against the code and decisions")
        elif state == "proposal" and age is not None and age > CFG["proposal_max_days"]:
            problems.append(f"{f}: proposal open for {age} days; if it was decided, supersede it or mark it current")
        if state in ("current", "proposal") and sup:
            text = re.sub(r"`[^`\n]*`", "", re.sub(r"```.*?```", "", (ROOT / f).read_text(encoding="utf-8"), flags=re.S))
            for n, ln in enumerate(text.splitlines(), 1):
                if re.search("supersed", ln, re.I):
                    continue
                for ref in sorted(set(re.findall(r"\b(?:" + "|".join(map(re.escape, sup)) + r")\b", ln))):
                    notes.append(f"{f}:{n}: cites {ref}, superseded by {sup[ref]}; update the claim or say it is superseded")
    return problems, notes


# ---------------------------------------------------------------- commands
def cmd_update(_args):
    written = set()
    for _ in range(3):  # new READMEs feed their parents' tables, so repeat until nothing changes
        files = tracked_files()
        changed = False
        for path, text in generated(files)[0].items():
            p = ROOT / path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(text, encoding="utf-8")
                written.add(path)
                changed = True
        if not changed:
            break
    for path in sorted(written):
        print(f"updated {path}")
    print(f"{len(written)} file(s) updated")


def cmd_check(_args):
    files = tracked_files()
    gen, mods = generated(files)
    errors, warnings = [], []
    for path, text in gen.items():
        p = ROOT / path
        if not p.exists() or p.read_text(encoding="utf-8") != text:
            errors.append(f"{path}: generated content is stale; run `python tools/docmap.py update`")
    for d in code_dirs(files):
        readme = ROOT / d / "README.md"
        if not readme.exists() or "TODO(docmap)" in readme.read_text(encoding="utf-8"):
            errors.append(f"{d}/README.md: missing or has no description (TODO(docmap))")
    for m in mods.values():
        if m.tree is None:
            errors.append(f"{m.path}: does not parse")
        elif not m.summary and not matches(m.path, CFG["docstring_exempt"]):
            errors.append(f"{m.path}: no module docstring (first line = what the file is for)")
    for f in files:  # other code files: want a header comment
        if Path(f).suffix in CODE_EXT - {".py"} and not file_summary(f, {}) and not matches(f, CFG["docstring_exempt"]):
            errors.append(f"{f}: no header comment")
    md_files = [f for f in files if f.endswith(".md")]
    for f in md_files:  # relative links
        text = (ROOT / f).read_text(encoding="utf-8", errors="replace")
        if matches(f, CFG["link_exempt"]):
            continue
        text = re.sub(r"`[^`\n]*`", "", re.sub(r"```.*?```", "", text, flags=re.S))
        for target in re.findall(r"\]\(([^)\s]+)\)", text):
            if re.match(r"^[a-z]+:|^#|^<", target):
                continue
            t = target.split("#")[0]
            if t and not exists_exact(ROOT / Path(f).parent / t):
                errors.append(f"{f}: broken link -> {target}" + (" (letter case differs)" if (ROOT / Path(f).parent / t).exists() else ""))
    for ix in CFG["indexes"]:  # cited ids exist
        if "ids" not in ix or not (ROOT / ix["file"]).exists():
            continue
        defined = {m.group(1) for ln in (ROOT / ix["file"]).read_text(encoding="utf-8").splitlines()
                   if (m := re.match(ix["pattern"], ln))}
        for f in dict.fromkeys(md_files + ["AGENTS.md"]):  # AGENTS.md is usually in md_files already
            if (ROOT / f).exists():
                text = (ROOT / f).read_text(encoding="utf-8", errors="replace")
                # ids inside code (e.g. a `D01` label) or URLs (e.g. aclanthology.org/D19-3044) are not citations
                text = re.sub(r"https?://\S+", "", re.sub(r"`[^`\n]*`", "", re.sub(r"```.*?```", "", text, flags=re.S)))
                for ref in set(re.findall(ix["ids"], text)):
                    if ref not in defined:
                        warnings.append(f"{f}: cites {ref}, which is not in {ix['file']}")
    for rule in CFG["forbid"]:  # import boundaries
        for m in mods.values():
            if not (m.name == rule["source"] or m.name.startswith(rule["source"] + ".")):
                continue
            if any(m.name == e or m.name.startswith(e + ".") for e in rule.get("except", [])):
                continue
            for target, _name, line, top in m.imports:
                if top and any(target == b or target.startswith(b + ".") for b in rule["imports"]):
                    errors.append(f"{m.path}:{line}: imports {target} ({rule.get('reason', 'forbidden by [tool.docmap].forbid')})")
    local, example = ROOT / CFG["local"], ROOT / CFG["local_example"]
    if local.exists() and subprocess.run(["git", "check-ignore", "-q", CFG["local"]]).returncode == 1:
        errors.append(f"{CFG['local']}: holds machine facts but is not git-ignored (add `*.local.md` to .gitignore)")
    if example.exists() and not os.environ.get("CI"):
        if not local.exists():
            warnings.append(f"{CFG['local']} is missing; create it from {CFG['local_example']} (`python tools/docmap.py local`)")
        elif missing := local_keys(example) - local_keys(local):
            warnings.append(f"{CFG['local']} lacks {', '.join(sorted(missing))} (see {CFG['local_example']})")
    by_path, leaks = {m.path: m for m in mods.values()}, local_paths()
    for f in files:  # tracked files name AGENTS.local.md keys, never this machine's paths
        if matches(f, CFG["portable_exempt"]):
            continue
        if matches(f, CFG["portable"]):
            text = (ROOT / f).read_text(encoding="utf-8", errors="replace")
        elif Path(f).suffix in CODE_EXT:
            text = by_path[f].doc if f in by_path else file_summary(f, {})
        else:
            continue
        text = re.sub(r"https?://\S+", "", text)
        for hit in sorted(set(HOME_PATH.findall(text)) | {p for p in leaks if p in text}):
            if hit not in CFG["portable_allow"]:
                errors.append(f"{f}: machine-specific path {hit}; refer to the {CFG['local']} key instead")
    problems, notes = lifecycle_findings(files)
    (errors if CFG["lifecycle_strict"] else warnings).extend(problems)
    warnings.extend(notes)
    agents = ROOT / "AGENTS.md"
    if agents.exists() and len(agents.read_text(encoding="utf-8").splitlines()) > CFG["agents_max_lines"]:
        warnings.append(f"AGENTS.md is over {CFG['agents_max_lines']} lines; move detail into folder READMEs or docs/")
    if (ROOT / CFG["worklog"]).exists() and old_worklog_entries():
        warnings.append(f"{CFG['worklog']} has entries from earlier months; run `python tools/docmap.py rotate`")
    try:
        if subprocess.run(["git", "rev-parse", "--is-shallow-repository"], capture_output=True, text=True).stdout.strip() == "false":
            last = subprocess.run(["git", "log", "-1", "--format=%H", "--", CFG["status"]], capture_output=True, text=True).stdout.strip()
            if last:
                n = int(subprocess.run(["git", "rev-list", "--count", f"{last}..HEAD"], capture_output=True, text=True).stdout.strip() or 0)
                if n > CFG["status_max_commits"]:
                    warnings.append(f"{CFG['status']} last changed {n} commits ago; is the snapshot current?")
    except (OSError, ValueError):
        pass
    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"error: {e}")
    print(f"docmap check: {len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors else 0)


def local_keys(p: Path) -> set[str]:
    return {m.group(1) for ln in p.read_text(encoding="utf-8").splitlines() if (m := re.match(r"^\s*[-*]\s*([A-Za-z][\w-]*)\s*:", ln))}


def local_paths() -> set[str]:
    """Absolute paths named in AGENTS.local.md (they must not appear in tracked files)."""
    p = ROOT / CFG["local"]
    text = p.read_text(encoding="utf-8") if p.exists() else ""
    return set(re.findall(r"(?<![\w~.:/])(/[^\s`'\",;)]{6,}|[A-Za-z]:\\[^\s`'\",;)]{4,})", text))


def exists_exact(p: Path) -> bool:
    """Path exists with exactly this letter case (macOS and Windows file systems ignore case; Linux CI does not)."""
    p = Path(os.path.normpath(p))
    if not p.exists():
        return False
    cur = Path(p.anchor)
    for part in p.parts[1:]:
        try:
            if part not in os.listdir(cur):
                return False
        except OSError:
            return True
        cur = cur / part
    return True


def relink(text: str, src_dir: Path, dst_dir: Path) -> str:
    """Rewrite relative Markdown links in text moved from src_dir to dst_dir (both relative to the repo root)."""
    def fix(m):
        target = m.group(2)
        if re.match(r"^[a-z]+:|^#|^<|^/", target):
            return m.group(0)
        path, _, frag = target.partition("#")
        new = os.path.relpath(os.path.normpath(src_dir / path), dst_dir).replace(os.sep, "/")
        return f"{m.group(1)}({new}{'#' + frag if frag else ''})"
    return re.sub(r"(\])\(([^)\s]+)\)", fix, text)


def find_module(arg: str, mods) -> Module | None:
    arg = arg.removeprefix("./")
    return next((m for m in mods.values() if m.path == arg or m.name == arg), None)


def cmd_where(args):
    name = args[0]
    mods = analyse(tracked_files())
    defs = [(m, s) for m in mods.values() for s in m.symbols if s[1] == name]
    if not defs:
        print(f"no top-level definition of {name!r}")
    for m, (kind, _n, line, sig) in defs:
        print(f"defined: {m.path}:{line}  {kind} {sig}")
        users = sorted({(src, mods[src].path) for src, dst, sym in internal_edges(mods) if dst == m.name and sym == name})
        print("imported by: " + (", ".join(p for _, p in users) or "—"))
    refs = []
    for m in mods.values():
        if m.tree is None:
            continue
        for node in ast.walk(m.tree):
            hit = (isinstance(node, ast.Name) and node.id == name) or (isinstance(node, ast.Attribute) and node.attr == name)
            if hit:
                refs.append(f"{m.path}:{node.lineno}")
    print(f"references ({len(refs)}):")
    for r in sorted(set(refs), key=lambda s: (s.split(':')[0], int(s.split(':')[1])))[:200]:
        print(f"  {r}")


def cmd_show(args):
    files = tracked_files()
    mods = analyse(files)
    m = find_module(args[0], mods)
    if not m:
        print(file_summary(args[0], {}) or "not a Python module in the repository; read the file directly")
        return
    imp = importers(mods)
    print(f"{m.path}  (module {m.name})\n\n{m.doc or '(no docstring)'}\n")
    for kind, n, line, sig in m.symbols:
        print(f"  {line:>5}  {kind} {sig}")
    print("\nimported by: " + (", ".join(sorted(mods[x].path for x in imp.get(m.name, ()))) or "—"))


def cmd_uses(args):
    mods = analyse(tracked_files())
    m = find_module(args[0], mods)
    if not m:
        sys.exit(f"{args[0]}: not a Python module in the repository")
    out = sorted({dst for src, dst, _ in internal_edges(mods) if src == m.name and dst != m.name})
    print("imports from the repo: " + (", ".join(mods[d].path for d in out) or "—"))
    print("imported by: " + (", ".join(sorted(mods[x].path for x in importers(mods).get(m.name, ()))) or "—"))


def entry_month(heading: str):
    h = heading.lower()
    if m := re.search(r"(\d{4})-(\d{2})-\d{2}", h):
        return int(m.group(1)), int(m.group(2))
    if m := re.search(r"\b\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s+(" + "|".join(MONTHS) + r")\s+(\d{4})", h):
        return int(m.group(2)), MONTHS[m.group(1)]
    return None


def split_worklog(text: str):
    parts = re.split(r"(?m)^(?=## )", text)
    head, entries, month = parts[0], [], None
    for e in parts[1:]:
        month = entry_month(e.splitlines()[0]) or month   # undated sections belong to the entry above
        entries.append((month, e))
    return head, entries


def old_worklog_entries():
    import datetime
    today = datetime.date.today()
    _, entries = split_worklog((ROOT / CFG["worklog"]).read_text(encoding="utf-8"))
    return [e for e in entries if e[0] and e[0] < (today.year, today.month)]


def cmd_rotate(_args):
    import datetime
    today = datetime.date.today()
    p = ROOT / CFG["worklog"]
    head, entries = split_worklog(p.read_text(encoding="utf-8"))
    keep = [e for mo, e in entries if not mo or mo >= (today.year, today.month)]
    old = defaultdict(list)
    for mo, e in entries:
        if mo and mo < (today.year, today.month):
            old[mo].append(e)
    for (y, mth), es in sorted(old.items()):
        f = ROOT / CFG["worklog_dir"] / f"{y}-{mth:02d}.md"
        f.parent.mkdir(parents=True, exist_ok=True)
        prev = f.read_text(encoding="utf-8").split("\n", 2)[2].strip() if f.exists() else ""
        moved = relink("".join(es), Path(CFG["worklog"]).parent, Path(CFG["worklog_dir"])).rstrip()
        f.write_text(f"# Work log, {y}-{mth:02d}\n\n" + moved + ("\n\n" + prev if prev else "") + "\n", encoding="utf-8")
        print(f"moved {len(es)} entr{'y' if len(es) == 1 else 'ies'} to {f.relative_to(ROOT)}")
    pointer = f"Earlier months: `{CFG['worklog_dir']}/YYYY-MM.md`."
    if pointer not in head:
        head = head.rstrip() + f"\n\n{pointer}\n\n"
    p.write_text((head + "".join(keep)).rstrip() + "\n", encoding="utf-8")


def dig(d, dotted: str):
    for k in dotted.split("."):
        d = d.get(k) if isinstance(d, dict) else None
    return d


def cmd_runs(_args):
    """Merge every local run manifest into the committed run index. Rows for runs that exist only on
    another machine (e.g. the cluster) are kept, so the index accumulates across machines."""
    import json
    rc = CFG.get("runs")
    if not rc:
        sys.exit('configure [tool.docmap.runs]: manifests = "outputs/**/manifest.json", columns = {run = "run_id", ...}')
    cols, out = rc["columns"], ROOT / rc.get("out", "docs/RUNS.md")
    names = list(cols)
    rows = {}
    if out.exists():
        for ln in out.read_text(encoding="utf-8").splitlines():
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if ln.startswith("|") and len(cells) == len(names) + 1 and cells[0] not in (names[0], "---"):
                rows[cells[-1]] = cells  # keyed by path: run ids repeat across experiments
    for mf in sorted(ROOT.glob(rc["manifests"])):
        try:
            data = json.loads(mf.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        vals = []
        for n in names:
            v = dig(data, cols[n])
            v = "" if v is None else str(v)
            vals.append(v[:10] if re.fullmatch(r"[0-9a-f]{20,}", v) else v.replace("|", "/"))
        path = str(mf.parent.relative_to(ROOT))
        rows[path] = vals + [path]
    order = sorted(rows.values(), key=lambda r: r[1] if len(r) > 1 else "", reverse=True)
    text = ["# Run index", "",
            "Generated by `python tools/docmap.py runs` from run manifests; newest first. Run outputs are not committed,",
            "so rows from other machines are kept. Cite runs by id in RESULTS.md and WORKLOG.md.", "",
            "| " + " | ".join(names + ["path"]) + " |", "|" + "---|" * (len(names) + 1)]
    text += ["| " + " | ".join(r) + " |" for r in order]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(text) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(order)} run(s)")


def cmd_local(_args):
    """Print the machine facts that can be detected, as `- key: value` lines for AGENTS.local.md."""
    import datetime, getpass, platform, shutil
    ram = ""
    try:
        ram = f", {os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / 2**30:.0f} GB RAM"
    except (AttributeError, ValueError, OSError):  # Windows: no sysconf
        pass
    git_user = subprocess.run(["git", "config", "user.name"], capture_output=True, text=True).stdout.strip()
    print(f"# Detected {datetime.date.today()} by `python tools/docmap.py local`; `python` is the interpreter that ran it.")
    print(f"# Check each value, ask the user for the keys in {CFG['local_example']} that are not here.")
    print(f"- machine: {platform.node()} ({platform.system()} {platform.release()}, {platform.machine()}, {os.cpu_count()} CPUs{ram})")
    print(f"- user: {getpass.getuser()}" + (f" (git: {git_user})" if git_user else ""))
    print(f"- python: {sys.executable} (Python {platform.python_version()})")
    print(f"- repo: {ROOT}")
    print(f"- nvidia_gpu: {'yes (nvidia-smi found)' if shutil.which('nvidia-smi') else 'no'}")


def cmd_docs(_args):
    """Every lifecycle doc with its Status line, oldest verification first: the audit queue."""
    rows = []
    for f in lifecycle_docs(tracked_files()):
        st = doc_status(f)
        rows.append((st[2] if st and st[2] else "0000-00-00", f, f"{st[0]} {st[1]}".strip() if st else "NO STATUS LINE"))
    for date, f, st in sorted(rows):
        print(f"{date}  {f}: {st}")


COMMANDS = {"update": cmd_update, "check": cmd_check, "where": cmd_where, "show": cmd_show, "uses": cmd_uses, "rotate": cmd_rotate, "runs": cmd_runs,
            "local": cmd_local, "docs": cmd_docs}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS or (sys.argv[1] in {"where", "show", "uses"} and len(sys.argv) < 3):
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]](sys.argv[2:])
````