# Changelog: course-lecture-notes

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 1.3.0 (2026-10-31)
- Workflow step 7 (new): send the finished blocks to Anki with the pipeline's anki_blocks.py batch script (one Gemini run per block, no clipboard, resumable; test one block, then the rest in the background); deck name from AGENTS.local.md. Owner request, 2026-10-31; first used on 76901 Lecture 3. The reply step (now 8) reports blocks and cards. New judged case.
- Step 5: corrected "Anki cannot show it" (owner: cards show images fine); the real reason figures must be described in prose is that the pipeline builds cards from text only.

## 1.2.2 (2026-10-31)
- Learning loop: the reply-block fallback is opt-in (only when the person takes part in improving their skills), so people who installed this skill without strange-loop see no observation blocks.

## 1.2.1 (2026-10-30)
- Learning loop: record lessons with the note command (routes to the genome clone) instead of editing LEARNINGS.md in a possibly installed copy, where notes are lost on update; found by the pre-launch end-to-end run.

## 1.2.0 (2026-10-30)
- Step 5 points at scientific-figures' references/devonthink.md, where the DEVONthink and Anki figure rules moved in scientific-figures 7.0.0, so study-guide figures keep them even where the owner's figure profile is not readable.

## 1.1.0 (2026-10-30)
- Adopted into the strange-loop framework: Learning loop section, LEARNINGS.md, judged cases. Step 5 now sets the library up from the scientific-figures skill's own lib/ (the Mac folder ~/Scripts/ScientificFigures is retired by scientific-figures 6.2.0); the staging folder for large notes is any connected _to_delete/ folder.

## 1.0.0 (2026-10-30)
- Version as found in the owner's library folder (imported into the genome unchanged; earlier history not recorded).
