---
name: "project-foundations"
description: "Set up, retrofit, upgrade or audit a repo so agents and humans can maintain and share it: AGENTS.md, a git-ignored AGENTS.local.md for machine facts, status, decisions, layered docs, generated map, docmap checks, dated doc Status lines and a generated facts table."
---

# Project foundations

Give a repository the scaffolding that lets any agent (Claude Code, Copilot, Kiro, Codex, Cursor) or human pick it up cold, find the right code without reading everything, do one coherent piece of work, and leave the project in a state the next session can trust. Everything here is plain Markdown plus one standard-library Python script (`tools/docmap.py`, shipped next to this file as `scripts/docmap.py`) - no plugins, MCP servers or tool-specific hooks - so the project works for other people and other agents too. Tracked files hold only project facts; each machine's interpreter, paths, limits and quirks live in a git-ignored `AGENTS.local.md`, so the repository can be shared without losing its specificity.

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
5. `python tools/docmap.py show PATH | where NAME | uses PATH | find WORDS | get D12` - **computed on demand**: symbols with signatures and line numbers, definitions, importers and every reference.
6. `python tools/docmap.py calls NAME | deps [PATH] | map [--budget N]` - **the code graph, computed on demand** (Python): callers and callees with file:line, module dependencies with import cycles, and a ranked, token-budgeted repo map. How calls are resolved and what is not: `references/code-graph.md`.

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
- Research projects: label claims *established* (cited source or code you read), *plausible* (reasoned, untested) or *unresolved*; append-only results; external code and published models are read-only; units and species/conditions with every number.
- Compute: ask before compute-heavy work; local runs stay within the `memory_budget` in `AGENTS.local.md`.
- Environments: the exact interpreter is the `python` key in `AGENTS.local.md`; never the base interpreter. Give commands that work on macOS, Linux and Windows (`python tools/docmap.py ...` does).
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

Core set (always; each has its template in the Step 3 table): `AGENTS.md`, `AGENTS.local.example.md` (tracked) and `AGENTS.local.md` (ignored), `CLAUDE.md` shim, `docs/BRIEF.md`, `docs/STATUS.md`, `docs/WORKLOG.md`, `docs/DECISIONS.md`, `.gitignore`, `tools/docmap.py` with `docs/MAP.md`, a README in every folder that contains code, a header docstring/comment in every code file, tests and a CI workflow running tests + `docmap.py check`.

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
| User defaults file (`~/.config/project-foundations/defaults.md`) | The user states conventions that will recur across projects                                                                                           |

Git-ignored directories that docs mention (`data/`, `outputs/`) don't exist in a fresh clone: track a short README in each (`/data/*` + `!/data/README.md` in `.gitignore`).

## Step 3 - Write the files

Fill templates with real, specific facts; delete sections that don't apply; no `<placeholder>` may survive (except in `AGENTS.local.example.md`, which is a template); absolute dates (`2026-10-23`). Tracked files must stay machine-independent: where a template needs a path, interpreter or limit, name its `AGENTS.local.md` key.

The templates are not in this file: for each module chosen in Step 2, read its template from `templates/` (next to this file) when you write that file, and only those. Keep the template's headings and section order; delete a section only when it does not apply. If this harness shows only SKILL.md and not the skill's other files, fetch the template from `https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/project-foundations/skills/project-foundations/templates/<file>`.

| Module (Step 2)                                             | Template                    |
| ----------------------------------------------------------- | --------------------------- |
| `AGENTS.md` (core, and a nested `AGENTS.md` in a folder)    | `templates/agents.md`       |
| `CLAUDE.md` (core), Copilot / Kiro shims                    | `templates/shims.md`        |
| `AGENTS.local.example.md` and `AGENTS.local.md` (core)      | `templates/agents-local.md` |
| User defaults file (only if the user wants one)             | `templates/user-defaults.md` |
| A README in every folder that contains code (core)          | `templates/folder-readme.md` |
| A header docstring/comment in every code file (core)        | `templates/file-headers.md` |
| `docs/BRIEF.md` (core)                                      | `templates/brief.md`        |
| `docs/STATUS.md` (core)                                     | `templates/status.md`       |
| `docs/WORKLOG.md` (core)                                    | `templates/worklog.md`      |
| `docs/DECISIONS.md` (core)                                  | `templates/decisions.md`    |
| `docs/ARCHITECTURE.md` + `[[tool.docmap.forbid]]` rules     | `templates/architecture.md` |
| `CHANGELOG.md`, `docs/RESULTS.md` + `docs/RUNS.md`, `docs/plans/<slug>.md`, `docs/reviews/…` | `templates/other-docs.md` |
| `.gitignore` (core)                                         | `templates/gitignore.md`    |

No template: `tools/docmap.py` with `docs/MAP.md` and the CI workflow (Step 4), `docs/CONTRACTS.md` and `docs/archive/`, `backlog/` (write them from the "When" column in Step 2).

## Step 4 - Install the map and the checks

1. Copy `scripts/docmap.py` (in this skill's folder) to `tools/docmap.py` unchanged: copy the file (`cp`, or read and write it whole), never retype it. If this harness shows only SKILL.md and not the skill's other files, download it from the canonical repository: `https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/project-foundations/skills/project-foundations/scripts/docmap.py`. Each copy carries `DOCMAP_VERSION` near the top: when a project's copy is older than the skill's, replace it (Upgrade procedure); when a project changed its copy, carry the change back to the skill (Learning loop below) instead of letting copies diverge. Add a `tools/README.md` purpose paragraph if the folder is new.
2. Configure it in `pyproject.toml` (or `docmap.toml` with the same keys at top level for non-Python projects). In globs, `*` also matches `/`.

Start with the keys the project needs (most need only `exclude` and `forbid`); every key with its default and an example is in `references/docmap-config.md`:

```toml
[tool.docmap]
exclude = ["references/*"]            # never mapped (vendored copies, large reference material)

[[tool.docmap.forbid]]                # one block per architectural rule
source = "mypkg"
except = ["mypkg.adapters"]           # where the import is allowed
imports = ["torch", "neuron"]
reason = "core runs without heavy backends"
```

   Only module-level imports count for `forbid`, so deliberate lazy imports inside functions stay allowed. If the project has no run manifests yet, have the run code write one JSON per run (run id, UTC time, git revision and dirty flag, config hash, seeds, runtime) - it is the cheapest reproducibility record there is.
3. `python tools/docmap.py update`, then `python tools/docmap.py check`. docmap reads tracked files plus untracked files that are not ignored (so new files appear before `git add`); ignore scratch folders first or they show up in the map and the checks. Fix every error: replace each `TODO(docmap)` README stub with a real purpose paragraph and give every code file a header (read the file first; describe what it does, not what its name suggests). Work folder by folder and commit per folder or per few folders, so each commit is reviewable. These commits cannot all pass `check` (it turns green with the last README): say so in their messages and make sure the last one is green. If a README's first paragraph is a status note ("Paused since ..."), add a standalone purpose sentence above it, because the first sentence is what the map shows. If a README already has a hand-written file table, move any information it holds that the generated table lacks into the files' docstrings or the purpose paragraph, then delete the duplicate table; if something would be lost, keep it and say so in WORKLOG.
4. CI (`.github/workflows/tests.yml`), Python ≥ 3.11 - add the docmap step once `check` passes locally:

```yaml
      - run: python -m pip install -e '.[dev]'
      - run: python -m pytest -q
      - run: python tools/docmap.py check
```

   `check` fails on: stale generated blocks, missing folder descriptions or file headers, files that don't parse, broken relative links in Markdown, forbidden imports. It warns on: cited decision IDs that don't exist, AGENTS.md over the length limit, a file agents read whole at session start over `read_max_tokens`, or those files together over `read_total_max_tokens` (`docmap.py stats` shows the reading cost), old WORKLOG months, STATUS not touched for many commits, docs without a Status line, "current" docs not verified for `verify_max_days`, proposals open longer than `proposal_max_days`, and lines in live docs that cite a superseded decision without saying so (a decision is superseded when its heading, or its `Status:` line, says `superseded by D<n>`). A stale `docs/FACTS.md` (a source value changed) is an error like any stale generated block.
5. For research projects: `python tools/docmap.py runs` after runs; commit `docs/RUNS.md` (rows from other machines, e.g. a cluster, are kept).

## Retrofit procedure

Templates: read one only when you create that file or restructure an existing one into its shape (Step 3 table): usually `agents.md`, `agents-local.md`, `status.md`, `worklog.md`, `decisions.md`; the others only for modules the project lacks. Moving existing content (steps 5-6) needs no template.

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

Templates: `agents.md` (steps 3 and 6b), `agents-local.md` (3a), `folder-readme.md` and `file-headers.md` (step 2); `shims.md` when step 6 updates the Copilot fallback. Do not read the others: the core docs already exist.

1. Step 4.1–4.2: install and configure `tools/docmap.py`; turn the invariants already written in AGENTS.md/ARCHITECTURE (e.g. "core never imports heavy backends") into `forbid` rules, and check they pass. If a rule fails on a designed exception (e.g. an optional training package that exists to import torch), add it to `except` and record a decision; if it fails on a real violation, ask the owner.
2. `update`, then work through `check` errors folder by folder: README purpose paragraphs, module docstrings. Commit per folder.
3. Shrink `AGENTS.md`: move folder-specific rules into the folder READMEs (or a nested AGENTS.md if they must load automatically), add the "Finding your way" section and the new rows of the maintenance table, keep it under ~120 lines.
3a. Make it shareable: create `AGENTS.local.example.md` and this machine's `AGENTS.local.md`; for every machine-specific path `check` reports (and every host name, user name or machine limit you find), move the value into `AGENTS.local.md` and refer to its key. Use `portable_allow` for paths that are facts about other code. Leave history (WORKLOG, RESULTS, archive) as it is.
4. Split a very long design document into per-component files if agents keep reading all of it; keep `ARCHITECTURE.md` short.
5. `rotate` the WORKLOG; set up `[tool.docmap.runs]` for research repos and run `runs`.
6. Add `python tools/docmap.py check` to CI; update the Copilot shim's fallback rules.
6b. Coming from an older `tools/docmap.py` (compare `DOCMAP_VERSION`): replace the script, then bring AGENTS.md's session-start and finding-your-way lines up to `templates/agents.md` (since 5.2: `find` and `get D<n>` instead of reading DECISIONS whole; since 5.3: the Scaffolding line under the title and the maintenance row that sends lessons about the scaffolding to the skill; since 5.6: the "Design for what will vary next" line under Conventions), run `update`, and `stats` to see what a session now reads.
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

Also check that every file written has the headings of its template (compare each against its `templates/` file; a missing heading means the section was dropped, not that it did not apply). Also read: no rule contradicts another across AGENTS.md, shims and nested files; STATUS has a date and every "Works" row a verification; the brief has non-goals (or `TBD (owner)`); a few generated README tables and docstrings read correctly.

## Step 6 - Audit mode

Run Step 5 and `python tools/docmap.py docs` (the audit queue: oldest verification first; docs with no Status line on top), then look for: **staleness** (docs whose Status is current but whose claims no longer match code, configs, FACTS.md or the latest DECISIONS/RESULTS; proposals that were decided; live docs citing superseded decisions; STATUS behind the last commits; ARCHITECTURE naming modules that no longer exist; plans "in progress" with no recent commits; docstrings whose first line no longer matches the code); **bloat** (AGENTS.md over ~120 lines; huge single docs; rules agents follow anyway); **drift** (rules duplicated across files; shims restating rules; decisions contradicted by code without a superseding entry); **portability** (machine facts in tracked files that `check` cannot see: host or user names, a machine's RAM limit, "on my Mac"; keys missing from `AGENTS.local.example.md`); **gaps** (decisions visible in git log - `git log --oneline -i -E --grep='switch|instead|replace|chose|decid'` - with no D entry; boundaries stated in prose but not in `forbid`). Output a short findings list, most important first, with fixes; apply what the user approves. Templates: Audit reads none by default; open one only to compare a file you suspect has drifted from its shape (e.g. an AGENTS.md without the maintenance table against `templates/agents.md`, a STATUS without the verification column against `templates/status.md`) or when a fix creates a missing file.

## Step 7 - Finish

1. WORKLOG entry ("Set up / upgraded project foundations") with the Step 5 output; STATUS reflects the result.
2. Commit (the worklog entry in the same or final commit); push if a remote exists, otherwise say it wasn't pushed.
3. Tell the user briefly: mode, what was created or changed, the `check` summary, what went into `AGENTS.local.md`, anything `TBD (owner)`, and the habit that matters: each session ends with STATUS, WORKLOG, `docmap.py update` + `check`, and a commit - which AGENTS.md tells every agent to do.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or `docmap.py` gets something wrong (a check that is noisy, a lookup that costs too much), record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note project-foundations <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for project-foundations` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
