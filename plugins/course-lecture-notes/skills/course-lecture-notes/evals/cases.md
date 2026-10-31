# Judged cases: course-lecture-notes

Judge against the skill's Goals, Math rules and Workflow step 7. The DEVONthink steps need the owner's Mac connected; a case can also be run on a lecture PDF given directly, skipping the DEVONthink steps.

## A math-heavy lecture becomes Anki-ready blocks
**Task:** A 30-slide lecture on a two-population rate model (E-I network) with its transcript and the textbook chapter. Produce the study guide.
**Good looks like:**
- Parts and numbered blocks with `---` between them; every block makes sense pasted alone (no "see block", "as above", "in the figure").
- Every formula in LaTeX (`$...$`, `$$...$$`), each display equation followed by "where:" with symbols and units and one intuitive sentence; at least one worked numerical example per major formula, computed by the same `model.py` the figures import.
- A visual plan before the blocks; about one figure per two blocks for dynamics; each figure in exactly one block, its content described in prose.
- Lecture-only material and "beyond the lecture" blocks are marked.
- The reply names the chat, the counts, what to spot-check, and what comes next.
**Origin:** Goals 1-4; Lecture 3 of 769001 (13 figures for 26 blocks, which he liked).

## Finished blocks go to Anki without the clipboard
**Task:** The study guide for a lecture is saved; he says he already sent blocks up to 2.3 to Anki by hand. Send the rest.
**Good looks like:**
- Uses `anki_blocks.py` with the deck from `AGENTS.local.md` (or asks for it once and records it), starting at `--from 2.4`; never copies blocks to the clipboard.
- Runs one block first and reads the created cards back before running the rest in the background.
- Does not use `--force`; after a failure, reruns the same command instead of restarting from the beginning.
- The reply gives blocks processed, cards created and any failed block.
**Origin:** owner request 2026-10-31 (76901 Lecture 3: 2.4 tested, then 2.5–9.6 in the background).

## Trigger: should fire
**Task:** "Help me learn tutorial 4 of the vision course, I missed it." / "Make study notes for lecture 6."
**Good looks like:** course-lecture-notes is loaded (and scientific-figures for the figures).

## Trigger: should not fire
**Task:** "Pre-read this paper and mark it up." / "Draw a phase portrait for this equation."
**Good looks like:** course-lecture-notes is not loaded (paper-premark or scientific-figures is).
