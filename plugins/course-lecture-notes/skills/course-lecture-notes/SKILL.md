---
name: course-lecture-notes
description: Turn a university lecture or tutorial (slides in DEVONthink) into complete, self-contained teaching notes in Anki-ready concept blocks, linked to the course textbook.
---

# Course lecture → teaching notes

Use this skill when Sergiy asks for help learning a lecture or tutorial for one of his university courses (HUJI Masters), especially one he did not attend. It applies to every course project, not just one.

## Goals (his stated preferences)
1. **Complete teaching text, not pointers.** He must be able to learn everything the lecture taught from the notes alone. Explain every slide's content in full prose, with definitions, mechanisms, worked examples and numbers. Links to the textbook or slides are only optional "Deeper:" reading at the end of a block.
2. **Logical, self-contained blocks.** He pastes single blocks into his Anki generator (~/Scripts/GeminiAnkiCards). Its prompt creates one note per concept, and it requires every note to be understandable without the source. Therefore:
   - Split the notes into Parts (`# Part N – …`) and numbered blocks (`### N.M Title`), with `---` between blocks.
   - Each block covers ONE concept and must make sense when copied alone. Re-state the minimal context, and never write "see block X", "as above" or "in the figure". Describe in prose whatever a figure shows.
   - Use bold for key terms, plus short lists and worked examples. Prefer prose or lists over large tables, because the generator converts tables into separate cards.
3. **Visually rich.** Visual information helps him a lot: he has asked for more images and plots. Plan figures deliberately (see "Visual plan" below), draw them with the **scientific-figures** skill, and give each a caption that opens with an assertion and says how to read it.
4. **Math in LaTeX** (see the Math section below).
5. **Chat naming.** The chat should be named after the lecture or tutorial (e.g., "Lecture 1 - Intro to sensory systems"). Claude cannot rename chats, so remind him of the name to use.

## Math
DEVONthink renders math with MathJax (enabled in his settings). Tested results:
- `$...$` works inline and `$$...$$` works for display. **Use these.**
- `\\(...\\)` and `\\[...\\]` (double backslash) also work.
- Single-backslash `\[...\]` does NOT render: Markdown strips the backslash.
- Matrices as `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` inside `$$...$$` (the form used in all his notes so far).

Rules:
- Every formula, symbol and variable is written in LaTeX: $\Delta S = k \cdot S$, $E_L$, $Ca^{2+}$. Do not use Unicode math.
- Short expressions inside sentences go inline with `$...$`. Key equations go on their own line as display math with `$$...$$`, with a blank line before and after.
- Write a literal dollar sign as `\$`.
- After every displayed equation, add "where:" followed by a list giving each symbol's meaning and units, then one sentence saying what the equation means intuitively.
- Derivations go step by step. Put each step as its own display line, followed by a short reason ("substituting...", "integrating both sides..."). Never jump to the result.
- Give each major formula at least one worked numerical example.
- For math-heavy courses, a block may hold one equation together with its explanation, so that each equation can become its own Anki card. His Anki pipeline converts the LaTeX to Anki's `\( \)` notation itself.
- He should copy blocks into the Anki pipeline from DEVONthink's Markdown source (edit view), not from the rendered preview. Copying rendered MathJax produces garbled text.
- The cloud workspace cannot load MathJax (no CDN access), so math rendering cannot be previewed there. Stick to the tested forms above, and in the reply ask him to spot-check one block with a matrix or derivation.

## Visual plan (do this before writing the blocks)
After reading the slides, transcript and book, write a short figure plan: one line per figure with its block, its one-sentence message, and its tool. Aim for:
- **at least one figure per Part**, and for math or dynamics material roughly **one figure per two blocks** (Lecture 3 of 769001 had 13 figures for 26 blocks, and he liked it);
- every figure placed in exactly one block (a figure is never repeated), and the block's prose describes what it shows.

Menu of figures that teach well (pick what the lecture supports):
- **Circuit or mechanism diagram** for every model introduced (who connects to whom, with signs).
- **Causal-loop diagram** for a verbal mechanism (e.g. "inhibition of inhibition acts as self-excitation"; "E inhibits itself through I, with a delay").
- **Graphical solution** of a fixed-point equation (both sides against the variable, intersections marked by stability).
- **Phase portraits as small multiples**: the same axes for 2–3 parameter values, so only the changing parameter differs.
- **Bifurcation diagram**, ideally next to the **eigenvalues against the same parameter**, so the zero crossing lines up with the branch point.
- **Linearised flow with eigen-directions** (decaying blue, growing vermilion) to show what "unstable along a direction" means.
- **Time traces from simulation** that show the key behaviour (winner-take-all from a tiny difference, convergence, oscillation).
- **Generic math behaviour** (e.g. $e^{\mu t}$ for real and complex $\mu$) when the lecture states a rule.
- **Simulated analogies**: if the lecturer uses an everyday analogy (the hotel shower), simulate a minimal model of it.
- **Experimental results on slides**: describe them in prose; redraw a schematic only when the shape of the result is the point (never copy the published figure).
- **Beyond-the-lecture illustrative models** (e.g. adaptation versus noise in rivalry) when the lecture discusses an idea qualitatively. Mark the block "*(beyond the lecture)*" and say so in the caption.

## Workflow
1. **Locate material in DEVONthink** (the University database → HUJI (Masters) → <course folder>, lectures in its "Lectures" subgroup). Use lookup_records by location or get_record_parents on the slides, then get_group_tree to list the lecture or tutorial PDFs. Check the project's memory and docs for the course's reference textbook UUID.
   - **Do not `project_read` earlier study guides to learn conventions or UUIDs:** they contain inline SVGs and cost ~50k tokens each. Use `project_search` (returns snippets), or `lookup_records` / `get_record_properties` in DEVONthink, for UUIDs, tags and what earlier notes already covered.
2. **Read the lecture fully.** Use extract_record_content on the slides. Look at key image-only slides with extract_record_visuals, which is essential for slides made of equations or figures. Read the transcript, if one is given, and note the lecturer's examples, analogies, slips he corrected, and students' questions with his answers: all of these belong in the notes.
3. **Map to the textbook.** Run get_record_outline on the book (save the large output and parse it with Python to find the chapters and sections, using 0-based page indices). If the outline is empty (some book PDFs have none), use extract_record_content with a keyword `query` (a figure number from the slides is a good anchor) to find the pages, then extract the relevant page range fully with `pages`. Use the book to make explanations complete and correct. Note which lecture topics are lecture-only (not in the book) and explain them from expert knowledge.
4. **Write the visual plan** (above), then **the notes**, in the cloud workspace, using this structure: title line with course, lecture number, date and lecturer; links to slides and main chapter; a "How to use these notes" line; a note on overlap with earlier notes (which blocks he can skip); the shared model parameters; a lecture map; then the Parts and blocks; and finally a self-test with answers. Deep links use x-devonthink-item://<UUID>?page=<0-based>. Keep a `{{FIG:name}}` placeholder where each figure goes. For long notes, write two or three part files and join them in the build script.
5. **Figures: follow the scientific-figures skill.** Load it, set up the `sciencefig` library as its §0 says (it is in the skill's own `lib/` folder), read its `references/devonthink.md` (these notes are DEVONthink Markdown with Anki-ready prose, whether or not a figure profile is available), and:
   - Put the lecture's model in ONE module (`model.py`: equations, parameters, fixed-point solver) and import it in every figure script and in a small script that computes the worked-example numbers. Then figures and text agree by construction.
   - Write the one-sentence message first, then choose the tool from the skill's tool-choice table (matplotlib for curves and data; Canvas + neuro for circuits; morph for neuron anatomy and cortical layers; dynamics for phase portraits and stability; nets for networks and architectures; pipeline or Graphviz for flows; geom for vectors and geometry). For dynamics use the high-level helpers (`Dy.portrait`, `Dy.fixed_points`, `Dy.separatrix`, `Dy.bifurcation_branches`) rather than hand-placing fixed points.
   - Use the house style and the neuroscience conventions (excitatory = blue triangle, inhibitory = vermilion dot, the two units of a symmetric pair = `S.UNIT1`/`S.UNIT2` green/purple). Use the same colours for the same things across all figures of the note, and say so in the first caption.
   - Run the loop: lint must be clean (`P.finish(fig)` returns svg and problems) → render → look at the PNG → fix. Check that each figure agrees with the numbers in the text. Iterate on batches of 4–6 figures per render sheet, without `cvd`; do one `cvd=True` pass at the end for the colour-coded figures.
   - Insert the figures with `devonthink.substitute(md, {name: (svg, caption)})`. This keeps each SVG on one line, uses rgb() colours (hex colours become DEVONthink tags on import), and puts a blank line before the italic caption.
   - Simulate rather than sketch when the figure shows model behaviour (traces, flows, fixed points), so the figure matches the numbers in the text.
   - The block's prose must still describe what the figure shows (Anki cannot show it).
   - Only when he wants figures as image files (e.g., to attach to Anki cards): render single-figure PNGs, copy them to /mnt/user-data/outputs/, device_commit_files them to ~/Downloads/<course>-figures/, import_file into the course's "Figures" subgroup, reset the tags to [<course number>, figure], and embed them with `![Figure](x-devonthink-item://<UUID>)`.
6. **Save:**
   - DEVONthink: a markdown record named "<Lecture/Tutorial N> - <title> - Study Guide" in the same group as the slides (e.g. the course's Lectures subgroup), tagged `[<course number>, study-guide, lecture-N]` (or `tutorial-N`), matching the earlier guides. Notes with figures are large (0.3–0.7 MB): copy the file to /mnt/user-data/outputs/, device_commit_files it into a connected folder (a `_to_delete/` staging folder in any connected folder, e.g. `~/Scripts/_to_delete/`), and import_file it, rather than pasting a huge string. If it already exists, update it: use patch mode for small edits and replace mode for rewrites. After import, **reset the tags** (import brings stray auto-tags such as "test", "water", "figure").
   - Add an annotation on the lecture PDF that links to the notes and the main book sections (set_record_annotation). Do not change the PDF's own tags.
   - Write a copy to the claude.ai project with project_write (local_path) so future chats can build on it.
7. **Reply briefly:** what was created and where, the number of blocks and figures, which content is beyond the lecture, anything he should spot-check, the suggested chat name, and what comes next in the course schedule.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, a DEVONthink tool behaves differently than described, the owner corrects the notes, or something clearly pays off, add one line to `LEARNINGS.md` next to this file - `- O<n> <YYYY-MM-DD> [failure|friction|misled|missing|workaround|win|wish] <section>: <what happened, what would have helped> (<harness>, <course and lecture>)` - or run `loop.py note course-lecture-notes <kind> "<text>"` from the strange-loop skill when this copy is read-only, or list the lines at the end of your reply under "Observations for course-lecture-notes". His corrections to a note are the strongest evidence: record what he changed and why. Figure lessons go to scientific-figures instead. Fix only plain errors on the spot, after verifying them; the goals above are his stated preferences and change only when he says so.
