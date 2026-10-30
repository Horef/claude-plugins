# DEVONthink Markdown notes (and flashcards)

Read this when the output target is a Markdown note in DEVONthink (the profile says `devonthink-markdown`, or the note lives in a DEVONthink database). The general rules in SKILL.md section 6 still apply; these are DEVONthink's additions. `D.md_figure`, `D.substitute` and `C.check_inline` enforce the mechanical ones.

**Importing notes with inline SVG**
- **No `#rrggbb` hex colours: DEVONthink turns them into tags when a Markdown file is imported.** The library converts them to `rgb()`.
- After `import_file`, reset the record's tags (`set_record_tags`): imported files also bring their macOS Finder tags and DEVONthink may auto-tag.

**Links**
- DEVONthink WikiLinks must be set to "Square Brackets" only. If links appear inside figures, check that setting.

**Flashcards (Anki)**
- The note text must describe in prose everything the figure shows, because Anki cards cannot say "see figure".
- If the person wants figures on cards, export PNGs via `C.render` of single figures; import them as images (course-lecture-notes has a worked procedure).

**Replacing a figure in an existing DEVONthink note**
- `update_record_content` needs the exact old text in a patch, so a large inline SVG is costly to swap. Render the new figure with `T.svg_to_png`, import the PNG into the note's Figures group (reset its tags), and patch the old `<svg …>` line into `![…](x-devonthink-item://UUID)`. New notes keep inline SVG.
