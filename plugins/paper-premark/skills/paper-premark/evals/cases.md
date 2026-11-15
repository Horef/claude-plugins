# Judged cases: paper-premark

Judge against the skill's colour scheme, marking rules 1-10 and Workflow steps 2-9. Every case needs the owner's Mac with DEVONthink connected; a case can also be run on an exported PDF with PyMuPDF standing in for the DEVONthink steps (marks written as annotations in a copy), which still tests the choices of units, colours and comments. A small fixture is in `fixtures/`: `awkward.pdf` (3 pages: one owner highlight in yellow by "Sergiy" on page 1, a text layer that dropped `±` and `µ`, and a short supplement page whose text shows its lines twice) and `awkward-extract.json`, its `extract_record_content`-style text; `run.py` validates marks against it. A judged run without DEVONthink grades the DEVONthink-side items of a case (apply, `markups_added`, export count, render) as *planned*, and a case passes if every other item is met and those are specified as calls.

## An experimental paper in project mode
**Task:** "Pre-mark the Smith paper in DEVONthink for the visual-cortex project." The record is a 20-page research article with Methods and Extended Data pages; memory holds the project's open questions.
**Good looks like:**
- Strings were taken from `extract_record_content` text (not PyMuPDF), saved to files, and each checked to occur exactly once before any `mark_record_text` call; no string contains `***`.
- Marks cover whole logical units (condition, finding, conclusion) in one colour; none starts on a back-reference ("Thus", "These results") unless its referent is marked, otherwise the comment starts `[Context] …`.
- At most 8 red marks; numbers and parameters are grey underlines, not highlights; each blue mark has a "what to do" comment tied to the project.
- Comments use the `[RED · result 2]` / `[GREEN · definition]` / `[BLUE · project]` / `[REF]` format, include at least one critical remark (small n, indirect inference, title versus evidence), and give 1-based PDF page numbers.
- `markups_added` was compared with the strings sent (about 2x would be a stop-and-inspect signal), the result exported and counted by colour, and at least one dense page rendered and looked at.
- A linked reading-map note exists with a legend and counts, a "what you'll remember in 3 weeks" list (at most 5, with `x-devonthink-item://UUID?page=N` links), a page map, project points and discussion questions; the reply is short and does not retell the paper.
**Origin:** purpose; Smith 2013 and Petousakis 2023 calibration.

## A model/resource paper in general mode, with an awkward text layer
**Task:** "Map this paper for me" (no project; PDF whose text layer drops ±, µ and = and whose appended supplement pages show every line twice, and which already carries one of the owner's yellow highlights; `fixtures/awkward.pdf` is a 3-page version).
**Good looks like:**
- Blue marks are open questions, reusable methods or claims worth testing, not project items.
- Red goes mainly to key assumptions and method conventions, not only to results.
- The supplement pages with doubled text are not marked; the reading-map note covers them and asks the owner to re-insert clean pages.
- Strings keep the layer's dropped symbols as they are, and the note's header explains them (for example "6 = ±").
- Existing marks of the owner are untouched; any addition is in his colours.
**Origin:** Durand 2016 symbol layer; Smith 2013 supplement phantom layer.

## Trigger: should fire
**Task:** "Pre-read this paper and mark it up." / "Highlight the key parts of the Billeh paper in DEVONthink like you did before." / "Map this PDF so I know what to read closely." / "Which parts of this paper in DEVONthink should I read closely?"
**Good looks like:** paper-premark is loaded.

## Trigger: should not fire
**Task:** "Summarise this paper in five bullets." / "Make study notes for lecture 6 of the vision course." / "Highlight my own marks in the last paper in yellow." / "Draw a figure of the circuit in this paper." / "Recolour the highlights I made in that PDF to green." / "Go through this PDF in DEVONthink and write me notes for the lecture."
**Good looks like:** paper-premark is not loaded (a plain summary needs no skill; course-lecture-notes or scientific-figures fits the others; his own marks are not paper-premark's to change).
