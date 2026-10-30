# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

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
