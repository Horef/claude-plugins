---
name: "project-foundations"
description: "Set up, retrofit, upgrade or audit a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md for machine facts, status, decisions, layered docs, generated map, docmap checks, dated doc Status lines and a generated facts table. Use when bootstrapping or upgrading repo scaffolding (AGENTS.md, WORKLOG/STATUS/DECISIONS, tools/docmap.py), auditing project docs for staleness or bloat, or configuring docmap checks. Not for ordinary feature/bug code edits, drawing figures, or auditing skill definitions themselves."
---

# Project foundations

Give a repository the scaffolding that lets any agent (Claude Code, Copilot, Kiro, Codex, Cursor) or human pick it up cold, find the right code without reading everything, do one coherent piece of work, and leave the project in a state the next session can trust. Everything here is plain Markdown plus one standard-library Python script (`tools/docmap.py`, shipped next to this file as `scripts/docmap.py`) - no plugins, MCP servers or tool-specific hooks - so the project works for other people and other agents too. Tracked files hold only project facts; each machine's interpreter, paths, limits and quirks live in a git-ignored `AGENTS.local.md`, so the repository can be shared without losing its specificity.

Modes - pick one in Step 0:

- **Bootstrap**: empty or near-empty repo. Create everything from the templates.
- **Retrofit**: existing project without this scaffolding. Inventory, consolidate, fill gaps, never lose content.
- **Upgrade**: the core docs exist (AGENTS.md, STATUS, WORKLOG, DECISIONS) but not the map layer (`tools/docmap.py`, folder READMEs, docstrings, CI check). Add the layer (see "Upgrade procedure").
- **Audit**: everything exists. Run the checks, find staleness, contradictions and bloat, propose fixes.

Files this skill names (`templates/`, `references/`, `scripts/`) sit next to this file; if this harness shows only SKILL.md, fetch them from `https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/project-foundations/skills/project-foundations/<path>`.

## How the documentation is layered

An agent should be able to go from "nothing loaded" to "the right lines of the right file" by reading a few short things in order, each pointing to the next - the same progressive disclosure that makes skills cheap. Each file and folder describes itself, like a small skill: a one-line description that is read first, and the body only when needed.

1. `AGENTS.md` - rules and commands, loaded automatically every session (short).
2. `docs/MAP.md` - **generated**: every folder and code file with its one-line summary, the most-imported modules, the enforced boundaries.
3. `<folder>/README.md` - **hand-written** purpose paragraph and folder-specific rules, plus a **generated** table of its files and subfolders with their summaries and who imports them.
4. The file's header docstring/comment - **hand-written**: what it is for, how to use it, its contracts.
5. `python tools/docmap.py show PATH | where NAME | uses PATH | find WORDS | get D12` - **computed on demand**: symbols with signatures and line numbers, definitions, importers and every reference.
6. `python tools/docmap.py calls NAME | deps [PATH] | map [--budget N]` - **the code graph, computed on demand** (Python): callers and callees with file:line, module dependencies with import cycles, and a ranked, token-budgeted repo map. How calls are resolved and what is not: `references/code-graph.md`.

**Write what lasts, generate what changes.** People and agents write purpose, usage and reasons, which change rarely. The script generates lists of files, symbols and "who uses this", which change with every commit and go stale the moment anyone maintains them by hand. CI fails when a generated block is out of date or a description is missing, so forgetting becomes visible instead of silent. The same holds for prose that can go stale: every doc carries a dated Status line, key values live once in a generated `docs/FACTS.md`, and `check` points at docs that are overdue for verification or still cite superseded decisions. "Imported by" also lists the tests that import a module, which tells an agent which tests to run after changing it.

The project-level documents, each with one job and one change rate (mixing change rates is what makes docs rot):

| File | Job | Changes |
| --- | --- | --- |
| `AGENTS.md` | Rules and commands an agent can't infer from the code | Rarely; pruned |
| `AGENTS.local.md` | Git-ignored: this machine's interpreter, absolute paths, limits, quirks (template: tracked `AGENTS.local.example.md`) | When the machine changes; one per checkout |
| `docs/BRIEF.md` | Goal, non-goals, success criteria, open questions for the owner | When scope changes |
| `docs/STATUS.md` | Snapshot: a Workstreams table (one line per line of work, pointing to its folder), what works (and how it was verified), open problems, next actions, blockers | Overwritten each session |
| `docs/WORKLOG.md` | Append-only, newest first: what was done, exact commands and results (current month; older months in `docs/worklog/YYYY-MM.md`) | Every session |
| `docs/DECISIONS.md` | Append-only decisions with IDs, alternatives, reasons, evidence; generated index at the top | When a choice is made |
| `docs/ARCHITECTURE.md` | Short: data flow, boundaries, invariants ("core never imports X"), with the checkable ones enforced by docmap | A few times a year |
| `docs/MAP.md` | Generated project map | `docmap.py update` |
| `docs/RESULTS.md`, `docs/RUNS.md` | Research: append-only results with generated index; generated run index | Per experiment / run |
| `docs/FACTS.md` | Generated table of the project's key values (defaults, presets, counts), read from configs and code (one file's key or pattern, or a glob over many parameter files); docs cite it instead of copying values | `docmap.py update` |
| `CHANGELOG.md` | User-visible changes (Keep a Changelog), if others use the project | Per release |

Guiding principles: one source of truth for rules; short always-loaded files; write what lasts, generate what changes; evidence over claims; enforce mechanically; append, don't rewrite history; leave things committable; agents maintain it; shareable without losing specificity; every document says whether it is still true. Read `references/principles.md` when the user asks why, or when a choice is not covered by a step.

## Defaults

Use these unless the project's own rules or the user's defaults file say otherwise; confirm them in the interview instead of asking from scratch. They are generic on purpose, because this skill is meant to be shared.

**User defaults file.** A person's standing conventions (git host and account, commit style, their machines and limits, sensitive-data rules, editor quirks) live outside the skill and outside every repository, in `~/.config/project-foundations/defaults.md` (Windows: `%USERPROFILE%\.config\project-foundations\defaults.md`). Read it in Step 0 if it exists and offer its values as the pre-selected interview answers. If it does not exist and the user states conventions that will recur, offer to create it (template: `templates/user-defaults.md`). Its machine facts go into each project's `AGENTS.local.md`, never into tracked files.

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
- Research projects (experiments module): label claims *established* (cited source or code you read), *plausible* (reasoned, untested) or *unresolved*; append-only results; external code and published models are read-only; units and species/conditions with every number.
- Compute (compute module): ask before compute-heavy work; local runs stay within the `memory_budget` in `AGENTS.local.md`.
- Environments: the exact interpreter or toolchain is the `python` key in `AGENTS.local.md` (for a Python project the interpreter; otherwise whatever runs the project's tests and tools); never the base interpreter. Give commands that work on macOS, Linux and Windows (`python tools/docmap.py ...` does).
- Parallel agents: only once the user runs several at the same time - then one branch (or git worktree) per agent, and a WORKLOG handoff note before merging. Each branch may run `docmap.py update`; after a merge, `update` resolves conflicts inside generated content (map, README tables, indexes) by regenerating it and names any conflict in hand-written text.

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

Everything the skill builds is a module. **Core** is always installed; every other module is chosen from the catalogue in `references/modules.md` (Step 1 answers and what Step 0 found decide): read it now; per module it gives the files it adds, its template, its keys, its AGENTS.md tag and when to add it. A module owns its files, its templates, its `docmap.py` / `AGENTS.local.md` keys and the lines of `templates/agents.md` tagged `[module]`: when you write AGENTS.md, include a tagged line only if its module is chosen, and drop the tag. A module added later (Audit, Upgrade) brings its tagged lines along; one dropped takes them away.

A nested `AGENTS.md` in a folder is not a module: write one when that folder has rules an agent must see automatically whenever it works there (agents auto-load nested AGENTS.md; they only read a README if they choose to). It follows `templates/agents.md`'s shape but keeps only the folder's rules.

Git-ignored directories that docs mention (`data/`, `outputs/`) don't exist in a fresh clone: track a short README in each (`/data/*` + `!/data/README.md` in `.gitignore`).

## Step 3 - Write the files

Fill templates with real, specific facts; delete sections that don't apply; no `<placeholder>` may survive (except in `AGENTS.local.example.md`, which is a template); absolute dates (`2026-10-23`). Tracked files must stay machine-independent: where a template needs a path, interpreter or limit, name its `AGENTS.local.md` key.

The templates are not in this file: for each module chosen in Step 2, read its template from `templates/` (next to this file; the Template column of the catalogue) when you write that file, and only those. Templates by module: core `templates/agents.md`, `templates/agents-local.md`, `templates/shims.md` (CLAUDE.md), `templates/brief.md`, `templates/status.md`, `templates/worklog.md`, `templates/decisions.md`, `templates/gitignore.md`; code-map `templates/folder-readme.md`, `templates/file-headers.md`; architecture `templates/architecture.md`; workstreams `templates/status.md` and `templates/other-docs.md`; experiments, releases, reviews `templates/other-docs.md`; user-defaults `templates/user-defaults.md`; shims `templates/shims.md`. Keep the template's headings and section order; delete a section only when it does not apply. If this harness shows only SKILL.md and not the skill's other files, fetch the template from `https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/project-foundations/skills/project-foundations/templates/<file>`.

No template: `tools/docmap.py` with `docs/MAP.md` and the CI workflow (Step 4), `docs/CONTRACTS.md`, `docs/FACTS.md` (generated), `docs/archive/` and `backlog/` (write them from the catalogue's "Adds" column in Step 2).

## Step 4 - Install the map and the checks

1. Copy `scripts/docmap.py` (in this skill's folder) to `tools/docmap.py` unchanged: copy the file (`cp`, or read and write it whole), never retype it. If this harness shows only SKILL.md and not the skill's other files, download it from the canonical repository: `https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/project-foundations/skills/project-foundations/scripts/docmap.py`. Each copy carries `DOCMAP_VERSION` near the top: when a project's copy is older than the skill's, replace it (Upgrade procedure); when a project changed its copy, carry the change back to the skill (Learning loop below) instead of letting copies diverge. Add a `tools/README.md` purpose paragraph if the folder is new.
2. Configure it in `pyproject.toml` (or `docmap.toml` with the same keys at top level for non-Python projects). In globs, `*` also matches `/`.

Start with the keys the project needs (most need only `exclude` and `forbid`); every key with its default and an example is in `references/docmap-config.md`.

   Only module-level imports count for `forbid`, so deliberate lazy imports inside functions stay allowed. For the experiments module: if the project has no run manifests yet, have the run code write one JSON per run (run id, UTC time, git revision and dirty flag, config hash, seeds, runtime) - it is the cheapest reproducibility record there is.
3. `python tools/docmap.py update`, then `python tools/docmap.py check`. docmap reads tracked files plus untracked files that are not ignored (so new files appear before `git add`); ignore scratch folders first or they show up in the map and the checks. Fix every error: replace each `TODO(docmap)` README stub with a real purpose paragraph and give every code file a header (read the file first; describe what it does, not what its name suggests). Work folder by folder and commit per folder or per few folders, so each commit is reviewable. These commits cannot all pass `check` (it turns green with the last README): say so in their messages and make sure the last one is green. If a README's first paragraph is a status note ("Paused since ..."), add a standalone purpose sentence above it, because the first sentence is what the map shows. If a README already has a hand-written file table, move any information it holds that the generated table lacks into the files' docstrings or the purpose paragraph, then delete the duplicate table; if something would be lost, keep it and say so in WORKLOG.
4. CI (`.github/workflows/tests.yml`), Python ≥ 3.11 - add the docmap step once `check` passes locally:

```yaml
      - run: python -m pip install -e '.[dev]'
      - run: python -m pytest -q   # or: python -m unittest discover -s tests
      - run: python tools/docmap.py check
```

   What `check` fails and warns on, with the key behind each warning: `references/docmap-config.md`, "What `check` reports"; read it when a result surprises you or before tuning a key.
5. Experiments module only: `python tools/docmap.py runs` after runs; commit `docs/RUNS.md` (rows from other machines, e.g. a cluster, are kept).

## Retrofit procedure

Retrofit mode: follow `references/retrofit.md`, step by step, before Step 5.

## Upgrade procedure (core docs exist, map layer missing)

Upgrade mode, or a project's `tools/docmap.py` older than the skill's: follow `references/upgrade.md`, step by step (6b: what each docmap version changed in AGENTS.md), before Step 5.

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

Also check that every file written has the headings of its template (compare each against its `templates/` file; a missing heading means the section was dropped, not that it did not apply). Also read: no rule contradicts another across AGENTS.md, shims and nested files; STATUS has a date and every "Works" row a verification; the brief has non-goals (or `TBD (owner)`); a few generated README tables and docstrings read correctly.

## Step 6 - Audit mode

Run Step 5 and `python tools/docmap.py docs` (the audit queue: oldest verification first; docs with no Status line on top), then look for: **staleness** (docs whose Status is current but whose claims no longer match code, configs, FACTS.md or the latest DECISIONS/RESULTS; proposals that were decided; live docs citing superseded decisions; STATUS behind the last commits or claiming deleted code still works — re-run each `Works` row's verification command when runnable; ARCHITECTURE naming modules that no longer exist; plans "in progress" with no recent commits; docstrings whose first line no longer matches the code); **bloat** (AGENTS.md over ~120 lines, and `check` warns above 150; huge single docs; rules agents follow anyway — to prune a doubtful AGENTS.md rule on evidence, try one representative task with and without it before dropping it); **drift** (rules duplicated across files; shims restating rules; decisions contradicted by code without a superseding entry); **portability** (machine facts in tracked files that `check` cannot see: host or user names, a machine's RAM limit, "on my Mac"; keys missing from `AGENTS.local.example.md`); **gaps** (decisions visible in git log - `git log --oneline -i -E --grep='switch|instead|replace|chose|decid'` - with no D entry; boundaries stated in prose but not in `forbid`). Output a short findings list, most important first, with fixes; apply what the user approves (if the user is unavailable, apply only append-only or snapshot fixes — STATUS, a new WORKLOG entry, reconstructed D entries — and list the rest as proposed fixes). Templates: Audit reads none by default; open one only to compare a file you suspect has drifted from its shape (e.g. an AGENTS.md without the maintenance table against `templates/agents.md`, a STATUS without the verification column against `templates/status.md`) or when a fix creates a missing file.

## Step 7 - Finish

1. WORKLOG entry ("Set up / upgraded project foundations") with the Step 5 output; STATUS reflects the result.
2. Commit (the worklog entry in the same or final commit); push if a remote exists, otherwise say it wasn't pushed.
3. Tell the user briefly: mode, what was created or changed, the `check` summary, what went into `AGENTS.local.md`, anything `TBD (owner)`, and the habit that matters: each session ends with STATUS, WORKLOG, `docmap.py update` + `check`, and a commit - which AGENTS.md tells every agent to do.

## Learning loop

This skill improves itself from use. When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line (`<kind>`: failure, friction, misled, missing, workaround, win or wish):

- If `~/.config/strange-loop/genome` exists, run this (in claude.ai, on the connected computer):
  `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note project-foundations <kind> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"`
- Otherwise, only if the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for project-foundations` holding the line `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; if not, add nothing about it, except one line when the skill clearly failed.

### Observations

Note too when `docmap.py` gets something wrong (a check that is noisy, a lookup that costs too much).
