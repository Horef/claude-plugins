# Changelog: scientific-figures

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 6.3.0 (2026-10-30)
- Restructure: lib/benchmark becomes lib/examples - 22 general worked examples named after what they show (e.g. saddle_portrait, lateral_inhibition_relay, sensory_basics), each exposing draw() or build() and writing nothing, plus one examples/build_all.py (build, lint, optional --out and --render). Removed as task outputs, not genome: before/after renders, the three DEVONthink report builders, the per-round builders (all kept in git history and on the owner's Mac). Verified: all 31 figures byte-identical to the old scripts' output, except the 11 renamed ones (sensory-*, mutual-inhibition-*), whose only differences are the name-derived ids; evals build, lint and render all 31. SKILL.md lists the examples by kind and says what may become one. Owner's review. (O8)

## 6.2.2 (2026-10-30)
- Fix: C.render, T.svg_to_png and T.svg_to_pdf create the output folder (headless Chrome, used on the Mac and in CI, does not); lecture1.py renders to $SF_WORK or the temp folder instead of a claude.ai path. Found by the first CI run of the figure evals. (O7)

## 6.2.1 (2026-10-30)
- Fix: Playwright discovery asks node (NODE_PATH, global installs) and honours $SF_PLAYWRIGHT, so rendering works in containers whose Playwright is not in the three known folders; verified by evals/run.py (lecture1.py renders) and a rendered check sheet. (O6)

## 6.2.0 (2026-10-30)
- The sciencefig library lives in lib/ next to SKILL.md (with LICENSES.md), so it travels with the skill: setup is now a sys.path line instead of the archive round trip through the Mac, and improvements return as commits to the genome. evals/run.py builds, lints and renders all 31 benchmark figures in a temporary copy and lists which differ from the committed renders. Owner approved the move (2026-10-30). (O1, O4)

## 6.1.0 (2026-10-30)
- Adopted into the strange-loop framework: "Learning loop" section, `LEARNINGS.md` (seeded from reading the skill, to be confirmed by use), `evals/cases.md` (three judged figure cases and trigger cases) and `evals/run.py` (runs the library's benchmark builders when the library is reachable, reports "not run" otherwise). No drawing rule changed.

## 6.0.0 (2026-10-30)
- Version as uploaded by the owner (imported into the genome unchanged).
