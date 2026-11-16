# Judged cases: course-lecture-notes

Judge against the skill's Goals, Math rules and Workflow step 7. The DEVONthink steps need the owner's Mac connected; a case can also be run on a lecture PDF given directly, skipping the DEVONthink steps. Without a real lecture, case 1 is mostly a format test: supply the slides, transcript and chapter excerpt yourself, or judge only the format and Math rules. Drawing figures needs numpy and matplotlib for the `sciencefig` library; where they are missing, judge the visual plan and the `{{FIG:name}}` placeholders instead and mark those items not run.

## A math-heavy lecture becomes Anki-ready blocks
**Task:** A 30-slide lecture on a two-population rate model (E-I network) with its transcript and the textbook chapter. Produce the study guide.
**Good looks like:**
- Parts and numbered blocks with `---` between them; every block makes sense pasted alone (no "see block", "as above", "in the figure").
- Every formula in LaTeX (`$...$`, `$$...$$`), each key display equation followed by a one-line italic symbol gloss (symbols and units) and one intuitive sentence; each Part opens with an overview and a symbols table; at least one worked numerical example per major formula, computed by the same `model.py` the figures import.
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
**Without a deck or Anki:** give a small saved guide (any Markdown with `### N.M` blocks) and judge the plan plus `--list` and `--preview-only`; the read-back and card counts are then not run.
**Origin:** owner request 2026-10-31 (76901 Lecture 3: 2.4 tested, then 2.5–9.6 in the background).

## Trigger: should fire
**Task:** "Help me learn tutorial 4 of the vision course, I missed it." / "Make study notes for lecture 6."
**Also:** "Send the rest of the blocks of the Lecture 3 guide to Anki." / "Write me a study guide for tutorial 2."
**Good looks like:** course-lecture-notes is loaded. (Whether scientific-figures loads for the figures is judged in case 1, not here.)

## Trigger: should not fire
**Task:** "Pre-read this paper and mark it up." / "Draw a phase portrait for this equation." / "Summarise this paper in five lines."
**Good looks like:** course-lecture-notes is not loaded (paper-premark or scientific-figures is).

## Soft references are rewritten
**Task:** The finished notes say "the middle panel is the transition" and "the lecture's figure uses an S-shaped curve" in a block.
**Good looks like:** `lint_notes.py` flags both lines; the fix restates the context in words (what the panel shows) rather than pointing at it; the lint then exits 0.
**Origin:** eval grading 2026-11-14 (Lecture 3 run).

## An existing guide is found before writing
**Task:** "Make study notes for lecture 3." A "Lecture 3 - … - Study Guide" record already exists in the Lectures group.
**Good looks like:** the lookup happens in step 1, before any block is written; he is asked whether to update or extend it.
**Origin:** O7; grading 2026-11-14.

## A guide reads well from start to finish
**Task:** Write the guide for a math-heavy tutorial (e.g. the ring model in the continuum limit: $1/N$ scaling, Fourier modes, decoupled mode equations).
**Good looks like:**
- Each Part opens, before its first block, with the question, the idea and the answer in plain words and a "Symbols in this Part" table.
- Each block opens with its takeaway; the idea comes before the equation; prose is connected, with few bold labels.
- Key display equations carry a one-line italic symbol gloss, not a bulleted "where:" list; each block still glosses every symbol it uses (it goes to Anki alone).
- The math is given meaning (what a coefficient means for the neurons, a worked example, an analogy); students' questions and corrected slips sit in blockquote asides.
- The lint exits 0.
**Origin:** owner request 2026-11-16 (769001 Tutorial 3 pilot: "reads much better, simpler and cleaner"; "the short symbol line really helps"); O9.
