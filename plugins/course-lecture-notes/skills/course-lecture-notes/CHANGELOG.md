# Changelog: course-lecture-notes

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 1.9.0 (2026-11-16)
- reading-first guides (owner request 2026-11-16): Goal 3 Part overviews with symbol tables, takeaway-first blocks, connected prose, meaning and examples, asides as blockquotes; one-line italic symbol gloss replaces the where: list (lint accepts either); blocks still self-contained for Anki (O9)

## 1.8.1 (2026-11-15)
- Learning loop footer shortened to the self-contained template (restructure R2, owner-approved 2026-11-15, D12); skill-specific hints kept under '### Observations'.

## 1.8.0 (2026-11-15)
- restructure R6, owner-approved 2026-11-15: step 5 keeps only the figure rules the notes need on their own (one model module, message first, simulate, consistent colours, one-line rgb() SVG, prose describes the figure; scientific-figures optional); library setup, tool choice and house conventions moved to references/figures.md; step 7 keeps the run procedure, flags and anki_blocks.py internals moved to references/anki.md; the harness file-transfer table moved to references/devonthink.md (audit C13). No rule removed; SKILL.md 18772 -> 16282 bytes

## 1.7.0 (2026-11-15)
- lint catches panel/caption references; step 1 checks for an existing guide and transcript-only sessions; Use-when clause; MAX_TOKENS and missing-figure notes (O5, O6, O7)

## 1.6.0 (2026-11-07)
- scripts/lint_notes.py checks cross-block references, Unicode math, single-backslash display, missing where:, missing --- (owner's request 2026-11-07); evals/run.py with good/bad fixtures; Workflow step 6 runs the lint before saving and before Anki (O1)

## 1.5.0 (2026-11-06)
- Workflow step 0: DEVONthink MCP-only check and harness table (owner decision 2026-11-06: MCP only, resolves the osascript recipes of O3); step 7 follows the pipeline's figures on cards (--no-images, --list figure counts) and in-deck duplicate skip (O3)

## 1.4.0 (2026-11-06)
- Workflow 7: correct anki_blocks.py command line (no --quiet); say what a cross-deck duplicate stop does and how to resume with --from (O2, O4)

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
