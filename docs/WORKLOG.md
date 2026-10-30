# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

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
