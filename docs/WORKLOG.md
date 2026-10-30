# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

## 2026-10-30 - Pre-launch end-to-end pass
Changed: PR #5 merged. Ran the owner's Mac setup in a sandbox (fake home, `~/Programming/claude-plugins` cloned from a local bare stand-in for GitHub, config and auto_sync as the README says, the real `claude` CLI installing strange-loop from the marketplace) and walked a lesson through the whole loop. It worked, and it found three problems, fixed in strange-loop 0.8.0 and patch releases of the other skills: the skills told agents to write LEARNINGS.md next to the skill, which in an installed or synced copy is lost on update (now one canonical note command that routes to the clone); sync pushed unchecked unit commits (now only observation-only commits are pushed automatically, D10); the hook was silent about syncing. The digest also warns when the genome setting points to a folder that is not a clone (strange-loop O2). AGENTS.md notes that docmap needs Python 3.11+ to read its config.

| Verification command | Result |
|---|---|
| sandbox: `claude plugin marketplace add <clone>` + `claude plugin install strange-loop@horef-claude-plugins` | installed 0.7.0 |
| sandbox: hook run as Claude Code runs it, from another project | digest; next run auto-synced and pushed the notes |
| sandbox: second clone notes + syncs; first machine's hook | note received |
| sandbox: `loop.py absorb -` with a reply block; `loop.py link ~/.kiro/skills` | absorbed 1; skills linked |
| sandbox: bump strange-loop, sync, `claude plugin marketplace update` + `claude plugin update` | updated 0.7.0 → 0.7.1 |
| sandbox: the note command copied verbatim from scientific-figures' SKILL.md, run from another project | recorded in the clone |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 13 tests OK |

Next: owner runs the setup on the Mac; first real use.

## 2026-10-30 - Closing the loop (D10)
Changed: PR #4 merged. The owner asked how lessons propagate. Upward was open: notes written into a clone were never committed or pushed, two machines would collide, reply blocks had no importer. strange-loop 0.7.0 adds `sync` (commit observation-only changes, pull with a union merge for LEARNINGS.md, renumber duplicate ids, push), `hook` (opt-in auto-sync at session start, then the digest), `absorb FILE|-` for reply blocks, and section 11 on the round trip. `.gitattributes` sets the union merge. AGENTS.md records the owner's standing permission: agents merge fix and learn changes once checks and CI are green (D10).

| Verification command | Result |
|---|---|
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 12 tests OK |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py hook` (auto_sync off) | digest printed, exit 0, reports uncommitted LEARNINGS |
| `git check-attr merge -- .../LEARNINGS.md` | merge: union |

Next: owner pulls and turns on auto_sync; the first real observations travel.

## 2026-10-30 - scientific-figures generalised (D9); CI history explained
Changed: PR #3 merged. scientific-figures 7.0.0: general description, audience and defaults; personal choices in a figure profile (`~/.config/scientific-figures/profile.md`, template in the skill); DEVONthink and Anki rules in `references/devonthink.md`; library docstrings made general; two new judged cases. course-lecture-notes 1.2.0 loads that reference directly. Marketplace and README list scientific-figures as general. The red CI run the owner saw is run #1 (commit 5aa9f0a, before the 6.2.2 fix); runs #2-#7 passed.

| Verification command | Result |
|---|---|
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval scientific-figures` | pass: 31 figures, 0 problems, render sheet |
| GitHub Actions runs list (public API) | run 1 failure (5aa9f0a); runs 2-7 success |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py check --base origin/main` | 0 errors |

Next: owner saves the profile; marketplace sync in claude.ai.

## 2026-10-30 - Owner questions: claude.ai sync, general vs personal, memory at scale
Changed: (1) claude.ai can add this repo as a GitHub marketplace with Sync automatically (claude.com/docs/plugins), so the zip routine is gone from setup (strange-loop 0.5.0). (2) Plugins are labelled general or personal in the marketplace and README (D8). (3) project-foundations' memory measured on synthetic projects: lookups are cheap, but the template made agents read DECISIONS.md and MAP.md whole; docmap 5.2 adds `get`, `find`, `stats`, a reading budget in `check` and a folders-only map for big projects (project-foundations 5.2.0); strange-loop 0.6.0 adds "slow costs need sensors".

| Verification command | Result |
|---|---|
| synthetic projects small/large/huge, token estimate of the session-start path | as instructed before: ~8.7k / 43k / 66k; with `find`/`get` and the folders-only map: ~4k / 8k / 12k |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval project-foundations` | 13/13 OK |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 10 tests OK |
| `claude plugin validate .` | passes (warnings: no author fields) |

Next: owner adds the marketplace in claude.ai; decides on generalising the personal plugins.

## 2026-10-30 - Genome, not expressions: the figures library cleaned up
Changed: the owner asked whether `lecture1.py` needed fixing and pointed out that some library files were outputs of tasks, not genome. Every file in `lib/` was sorted: `sciencefig/`, `assets/`, `morphologies/` and the docs are genome; `benchmark/before|after/`, the DEVONthink report builders and the per-round builders were task outputs and are removed (git history and the owner's Mac keep them); the 22 figure scripts were general content in task form and became `lib/examples/`, named after what they show, writing nothing, built by `examples/build_all.py` (scientific-figures 6.3.0). The C.render/topng folder fix of 6.2.2 is general and stays. strange-loop 0.4.0 adds the rule that caused the miss: adoption sorts genome from expressions (section 1, 8, 9) with a judged case. D7's "its benchmarks" now means `lib/examples/`.

| Verification command | Result |
|---|---|
| old scripts vs `examples/build_all.py --out`, all 31 SVGs compared | 20 byte-identical; 11 renamed figures differ only in name-derived ids |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval scientific-figures` | pass: 31 figures, 0 problems, render sheet written |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 10 tests OK |

Next: owner pulls; scientific-figures upload zip rebuilt at 6.3.0.

## 2026-10-30 - Library into the genome, course-lecture-notes adopted, setup for all harnesses
Changed: owner confirmed D1 and D4 and kept the ripeness threshold (strange-loop O6 rejected). The `sciencefig` library is in `plugins/scientific-figures/skills/scientific-figures/lib/` (D7): imported verbatim, then scientific-figures 6.2.0 (setup is a sys.path line; evals build every benchmark in a temp copy) and 6.2.1 (Playwright found through node; the first eval run outside the Mac crashed lecture1.py on it). course-lecture-notes imported (1.0.0) and adopted (1.1.0). strange-loop 0.2.0 (resolutions `→ rejected:`/`→ moved:` parse - they did not, though the skill documented them; `bump --obs last`; `pack`) and 0.3.0 (`link`; per-harness setup table). Decisions: D1, D4 confirmed; D7.

| Verification command | Result |
|---|---|
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 10 tests OK |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval scientific-figures` | 31 figures, 0 failures; 26 differ slightly from the committed Mac renders |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval project-foundations` | 8/8 OK |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py check --base origin/main` | 0 errors, 1 warning |
| `python plugins/project-foundations/skills/project-foundations/scripts/docmap.py check` | 0 errors |

Then the first CI run failed on the figure evals: headless Chrome (the Mac's and the runner's render path) does not create the output folder and lecture1.py wrote to a claude.ai-only path; fixed in scientific-figures 6.2.2, CI green on bb21ada. `claude plugin validate` passes for all five plugins and the marketplace (warnings only: no author field, no icons).

Next: owner sets up the Mac; first real observations; reflection on scientific-figures O5 when convenient.

## 2026-10-30 - strange-loop framework; skills imported and adopted
Changed: imported scientific-figures v6 and project-foundations v5 verbatim; added the strange-loop plugin (skill, `loop.py`, tests, judged cases, session-start hook); adopted all four units (LEARNINGS, CHANGELOG, evals); project-foundations 5.1.0 (docmap.py moved to `scripts/`, index-placement fix found by its new eval, learning-loop section); scientific-figures 6.1.0 (learning-loop section, evals); model-router CHANGELOG reconstructed from git log; genome scaffolding (AGENTS.md, docs, docmap.toml, CI). Research summary in docs/RESEARCH.md. Decisions: D1-D6.

| Verification command | Result |
|---|---|
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval strange-loop` | 7 tests OK |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval project-foundations` | 8/8 OK (first run failed on the DECISIONS index placement; fixed in docmap.py) |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval scientific-figures` | exit 2, not run: library not on this machine |
| `python plugins/strange-loop/skills/strange-loop/scripts/loop.py check` | 0 errors, 1 warning (PF SKILL.md 505 lines) |
| `python plugins/project-foundations/skills/project-foundations/scripts/docmap.py check` | see commit; 0 errors expected |

Next: owner confirms D1/D4 and the library question; real use produces the first observations.
