# Learnings: research-writing

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-11-04 [win] 6 Readers: in the pilot (a 14-page modelling write-up) four fresh readers with only the PDF (3x Sonnet 5.5, 1x Gemini 4 Argon) all named the same weakest link (the title claimed more generality than the evidence supported); the revision changed the message and title, which no amount of polishing by the writer had done. (claude-code, simple_complex_v1)
- O2 2026-11-04 [wish] 5 Checks: a number mismatch (the text copied a rounded value from a results table; the figure printed the recomputed value, which rounds the other way) was caught only by looking at the page. A check that pulls the text of the figure PDFs (pdftotext) and lists numbers that appear in a figure and differently in the body would catch it; or a light-tier number tracer against the ledger's evidence. (claude-code, simple_complex_v1)
- O3 2026-11-04 [friction] 6 Readers: round 1 brought 170 questions (49 must); one row per question was unworkable, grouping by theme (22 rows) worked; SKILL updated before release. Sorting took about an hour of deep-tier work; a light pre-pass that clusters questions by quoted page and keyword would cut it. (claude-code, simple_complex_v1)
- O4 2026-11-04 [failure] 5 Build: wr.py build with a relative DIR (docs/writeups/x from the repo root) fails: latexmk writes into DIR/docs/writeups/x/build and the copy of build/main.pdf raises FileNotFoundError. Absolute DIR works. Resolve DIR to an absolute path first. (claude-code, simple_complex_v1)
- O5 2026-11-05 [friction] 5 Build: preamble's placeins [section] left half-empty pages with 14 tall figures (27 pp); disabling it gave 23 pp but figures then land 2-3 pages after first citation. Would help: a figure-height budget in step 4 (e.g. at most ~0.55 textheight unless it is the answer figure) and a wr.py check that reports figure heights. (claude-code, simple_complex_v1)
- O6 2026-11-05 [win] 6 Readers: the outsider reader (Gemini Argon via agy, PDF only) caught a factual error carried over from the source write-up: the NMDA block was described as rate-matched but fired 4.4 vs 10 Hz at the design grating. Mixed model families paid off again. (claude-code, simple_complex_v1)

## Resolved
