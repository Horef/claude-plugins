# Changelog: project-foundations

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 5.1.0 (2026-10-30)
- `docmap.py` moved out of SKILL.md into `scripts/docmap.py` (SKILL.md 82 KB → 46 KB); Step 4 now says to copy the file, never retype it, with a download URL for harnesses that show only SKILL.md; each copy carries `DOCMAP_VERSION` so projects can tell when theirs is behind (O1).
- Fix: `docmap.py update` put the DECISIONS/RESULTS index after the first entry instead of above it whenever the title and intro are on adjacent lines, which is what the skill's own template does. It now inserts before the first `## ` entry. Projects whose index already sits in the wrong place keep it there until moved by hand (O2; found by the first run of `evals/run.py`).
- New `evals/run.py` (fixture project: update, check, where, failing cases) and `evals/cases.md` (judged cases).
- New "Learning loop" section, and a maintenance-table row that sends lessons about a skill or tool to that skill instead of the project's AGENTS.md.

## 5.0.0 (2026-10-30)
- Version as uploaded by the owner (imported into the genome unchanged).
