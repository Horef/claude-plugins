# Changelog: scientific-figures

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 6.2.1 (2026-10-30)
- Fix: Playwright discovery asks node (NODE_PATH, global installs) and honours $SF_PLAYWRIGHT, so rendering works in containers whose Playwright is not in the three known folders; verified by evals/run.py (lecture1.py renders) and a rendered check sheet. (O6)

## 6.2.0 (2026-10-30)
- The sciencefig library lives in lib/ next to SKILL.md (with LICENSES.md), so it travels with the skill: setup is now a sys.path line instead of the archive round trip through the Mac, and improvements return as commits to the genome. evals/run.py builds, lints and renders all 31 benchmark figures in a temporary copy and lists which differ from the committed renders. Owner approved the move (2026-10-30). (O1, O4)

## 6.1.0 (2026-10-30)
- Adopted into the strange-loop framework: "Learning loop" section, `LEARNINGS.md` (seeded from reading the skill, to be confirmed by use), `evals/cases.md` (three judged figure cases and trigger cases) and `evals/run.py` (runs the library's benchmark builders when the library is reachable, reports "not run" otherwise). No drawing rule changed.

## 6.0.0 (2026-10-30)
- Version as uploaded by the owner (imported into the genome unchanged).
