---
name: "paper-premark"
description: "Pre-read a scientific paper in DEVONthink and mark it up in Sergiy's colour scheme (whole logical units, comments, skim-safe markers) plus a linked reading-map note. Works with or without a project."
---

# Paper pre-marking (DEVONthink)

Goal: Sergiy reads every paper fully but wants a calibrated visual map *inside the PDF*. Claude pre-reads the paper, adds highlights and comments in his colour scheme, and attaches a short reading-map note to the record. He then reads with the map in place, and his edits are the calibration signal.

Use when he asks to pre-mark, pre-read, highlight or "map" a paper. It works in two modes:
- **Project mode:** a project or memory context exists (research goals, open questions, standards). Blue comments target that context.
- **General mode:** no project. Blue = open questions, reusable methods, claims worth testing.

## Colour scheme (his iPhone palette; match the colours already used in the PDF if they differ)
| Layer | Markup | Hex | Limit |
|---|---|---|---|
| Red: must understand | highlight | #FC8C8C | at most 8 per paper |
| Green: needed to follow the argument | highlight | #99FC8C | follows the units |
| Yellow (lowest): supporting / caveat / speculation | highlight | #FEE832 | follows the units |
| Blue: future directions / project | highlight | #8CB9FC | every one needs a "what to do" comment |
| Reference values (numbers, parameters, protocols) | underline | #808080 | never highlight these |
| Skim-safe | highlight on the first line | #D3D3D3 | comment = "until <phrase/page>" + one-line gist |

Mac palette, if his marks use it: yellow #FFFF0A, green #6CC056, red #F64376, blue #599EEE. Read the existing annotation colours (PyMuPDF `annot.colors['stroke']`) and reuse them.

## Marking rules
1. **Mark the logical unit, not the sentence.** A unit = condition/manipulation → finding → the authors' conclusion ("These results indicate…"). Use one colour across 2–4 sentences.
2. **Never start a mark on a back-reference** ("We find that", "Thus", "These", "in all cases", "this result") unless its referent is marked too. If the referent is more than a paragraph away, the comment starts with `[Context] …` and restates it.
3. **Definitions in green where first introduced:** named metrics, protocols and categories that later results depend on.
4. Red marks a claim once, at its strongest evidence statement. Red also covers the paper's key *assumption* (e.g. "tuning is imposed on the inputs"). In model/resource papers, most reds are usually key assumptions and method conventions (e.g. how an index is computed), not results.
5. Interpretation and speculation get at least yellow, and the comment labels them as hypothesis, not result.
6. **Critical comments are valued.** Flag small n, absence-of-evidence claims, manipulations that remove more than claimed, compensations or fudges behind a "robust" result, mismatches between title and evidence, and claims inferred indirectly (e.g. "determines tuning" shown only as a drop in the preferred response). Say the authors' own careful wording when it is weaker than the headline.
7. Skim-safe sections: put a numbered yellow mark on each step ("evidence 1/4 … 4/4") and red on the conclusion, so skipping loses nothing. Non-paper pages (cover sheets, the tail of another article in the same PDF) also get a skim-safe marker.
8. He prefers over-coverage ("better to read more than to miss"). Only red has a hard limit.
9. Never touch his marks. Add to them only.
10. Comment format: `[RED · result 2] …`, `[GREEN · definition] …`, `[BLUE · project] …`, `[REF] …`, `[SKIM-SAFE → until '…' (p.N)] …`. Page numbers in comments are 1-based PDF pages (= the 0-based index + 1). Double-check them.

## Workflow
1. **Locate the record** (`get_record_properties` on the x-devonthink-item UUID; or `search_records` with `name:<Author> kind:pdf`). Read its Finder comment (often an existing summary), tags and existing annotation (`get_record_annotation`), and check for existing highlights (`extract_record_highlights`). Read the project or memory context if one exists.
2. **Get the text DEVONthink will match against:** `extract_record_content` with `pages` (0-based).
   - Do NOT build strings from PyMuPDF text. It merges words in some PDFs and spaces symbols differently. Use an exported copy plus PyMuPDF only to read existing annotation colours and to verify afterwards.
   - Large results are saved to a file (a JSON list of {link, text}). Parse it into per-page text files (page index from `?page=N` in `link`). Then validate every string with `text.count(s) == 1` in a short script. Requesting many pages at once is fine; the file is the cache.
   - Export: `export_record` into a connected folder (e.g. `<repo>/_reading_tmp/<paper>/`), then `device_stage_files`.
3. **Read the whole paper**, including Methods, Extended Data captions and any supplementary pages appended to the PDF.
4. **Write a mark spec** (list of {colour, type, string, comment}). Strings are copied from the PDFKit text, with `\n` exactly at line breaks. Strings cannot span pages: split a unit at the page break, and put the comment on the first part. Check where a line starts: Methods text often breaks at a different word than you expect (e.g. "We\nused …").
5. **Validate** that each string occurs exactly once in the PDFKit text:
   - Normalise NBSP → space.
   - Avoid soft hyphens (U+00AD), which never match: split around them. Plain end-of-line hyphens ("pro-\nduced") do match.
   - Watch for figure text that PDFKit inserts into the flow, and split units there.
   - **DEVONthink's tool output redacts URLs, e-mail addresses and some tokens as `***`** (e.g. `neuromorpho.org` → `***`, `www.sciencemag.org` → `***`). The real PDF text differs there, so never put `***` or the redacted span into a string. End the string before it or start after it.
   - OCR junk lines (stray letters, Cyrillic look-alikes) and lines with run-together words may appear in the extracted text. Body lines still match; just don't include junk or merged lines.
   - Some text layers drop symbols (±, <, >, =, ×, µ, minus signs; e.g. "0.42 0.02" = 0.42 ± 0.02, "p 0.0001", "mm" = µm). Copy them as they are in the layer, and explain the symbols in the reading-map header and the [REF] comments.
   - **Phantom text layers: do NOT mark a page whose extracted text shows every line twice** (two copies interleaved, often with an extra "From: …" header). Seen on supplement pages he appended inside DEVONthink. `mark_record_text` highlights both copies, and the phantom copy lands ~70 pt lower (or off the page), so highlights appear on the wrong lines. Cover such pages in the reading-map note instead. Mark them only after he re-inserts clean pages.
   - **After pages are replaced or the text layer is rebuilt, `extract_record_content` can be stale** (it may still show the old duplicated text). Verify with an export plus PyMuPDF and a single test mark (`markups_added` = 1) before trusting it.
6. **Apply** with `mark_record_text`, one call per colour/type, passing `comments` in the same order. Multi-line strings work if the `\n`s match.
7. **Verify:**
   - Compare `markups_added` with the number of strings. Too few → missing marks. **Roughly 2× → duplicate or phantom matches: stop and inspect.**
   - If it falls short, export and stage again, list the annotations (PyMuPDF), find the missing ones, and redo them from the PDFKit text.
   - Export once at the end and count annotations by type and colour (PyMuPDF). **Render one or two dense pages** (`get_pixmap`, ~70 dpi) and look at them, especially for appended or supplement pages, scanned or OCRed PDFs, tables and odd counts. Counts alone don't catch misplaced highlights.
   - Extending an existing mark = mark only the adjacent unmarked text in the same colour. Adding to or correcting an existing mark's comment = re-mark the same string with the extra comment (it is appended; no new highlight is created). Use this for page-number fixes, e.g. "(Page fix: … starts on p.29.)".
   - No tool can delete annotations. A wrong batch can only be undone by him (DEVONthink version history, or deleting marks by hand), so prevention matters.
8. **Reading-map note** (`set_record_annotation`, markdown, name "<Author Year> — reading map"):
   - Header line: pre-read by Claude + date, author name of the marks, number of marks, "all marks can be edited or deleted", and anything missing from the PDF (e.g. SI not included).
   - Legend with counts per colour.
   - Any text-layer or layout warning (dropped or garbled symbols: e.g. Na1 = Na+, 6 = ±, 5 = =, T = ±, mm = µm; "paper starts mid-page 2").
   - **What you'll remember in 3 weeks:** at most 5 points, each with page links `x-devonthink-item://UUID?page=N` (0-based).
   - **Map of the paper:** a table of pages | section | how to read ("read closely", "reference", "skim-safe").
   - **For the project** (project mode) or **Open questions** (general mode). Include practical availability (is the model or code public?) and concrete numbers the project can use.
   - **Possible questions for discussion.**
   - To add to an existing note later, use `set_record_annotation` with `mode: append`.
9. **Report briefly:** counts per colour, the 2–3 most important critical or project points, and any warnings. Don't re-describe the paper. Mention that the temporary export folder can be deleted.

## Batches of papers
When he drops several papers in the Inbox: file the relevant ones into the right group (`move_record`), add the project tag (`set_record_tags`), and fix bad names (`update_record`). Pre-mark them in priority order. Say which ones were filed but not marked, which ones you could not find, and which unrequested but relevant ones are still in the Inbox.

## Supplementary material
The DEVONthink tools cannot append pages to an existing PDF in place (merging creates a new record and orphans its note, comment and links). If a supplement matters, ask him to append it himself in DEVONthink. Or offer to import it as a separate record linked from the reading map. Once pages are appended, add a row for them to the map. Before highlighting appended pages, check for a phantom text layer (step 5). Right after appending, the text may not be indexed yet (`extract_record_content` returns empty).

## Calibration loop
After he reads, export again and diff his new or changed annotations (by author) against Claude's. Classify each one: completed a fragment / definition / conclusion sentence / interpretation / deleted / recoloured. Log it in the project rubric doc if one exists (e.g. `claude/paper-premark-rubric.md`), and propose updates to this skill when a pattern repeats.

Calibration history:
- Petousakis 2023: he added 19 marks, about half completing fragments. → Led to the logical-unit and back-reference rules.
- Smith 2013: he made no changes and liked the critical comments and the "skim-safe-ish" sections.
- Branco 2010 and Goetz 2021: every string matched on the first try when built from the PDFKit text. Lesson: avoid `***` redactions and OCR junk lines.
- Smith 2013 supplement (appended pp. 20–21): a phantom duplicate text layer caused ~24 misplaced highlights. → Led to the phantom-layer rule and render-to-verify. Afterwards, the extracted text stayed stale even though the file was clean. → Led to the stale-extract rule.
- Arkhipov 2018, Billeh 2020, Durand 2016 (model/resource papers, 40/75/48 marks): file-based validation gave 100% matches; red went mainly to key assumptions and method conventions; there was a dropped-symbol text layer (Durand).

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, a DEVONthink tool behaves differently than described, a mark string fails to match, the owner's edits to the marks show a pattern (record what he changed and why: the strongest evidence), or a rule clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note paper-premark <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for paper-premark` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
