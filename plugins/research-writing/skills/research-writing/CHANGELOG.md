# Changelog: research-writing

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.3.0 (2026-11-06)
- readers' Status line (O11), ledger condition column and check (O13), figure-number-vs-text and figure-height notes in wr.py check (O2, O5), step 6 mixed model families as a rule (owner's request 2026-11-06; wins O1, O6, O12) (O2, O5, O11, O13)

## 0.2.0 (2026-11-05)
- Prose layer (O7, O8; the owner read the second write-up and found it correct but "inexpressive and inhuman": telegraphic fragments, skeleton notes turned into sentences, vague references, no reader raised them): step 3 says the In short is an abstract in two or three paragraphs with sources named, and that `% DO:` notes and technique names never become sentences; step 4 adds a Voice rule (full sentences, linked by old-before-new and connectives, bold run-in paragraph heads `\lead{}`, subsections); step 6 and `wr.py readers` add an **editor** reader for the prose (default roles now include it).
- Layout (O10): the template ends with Methods, references, then `\supplementary` (new page, Supplementary Information, S-numbered sections, figures and tables; macro in `preamble.tex`); `wr.py check` exempts figures placed after `\supplementary` or `\appendix` from the near-first-citation rule.
- Figures (O9): figures outside the shared encoding's domain get their own colours, not gray.
- `wr.py` resolves DIR, so a relative path works (O4).

## 0.1.0 (2026-11-04)
- Created at the owner's request (2026-11-04): write-ups and paper drafts that read as an argument, not a lab report. Procedure (message and claims ledger, skeleton in argument order, figures first, build/check/look, fresh-reader question loop, delivery), model tiers as suggestions the person overrides (owner request), LaTeX template, `wr.py` (init, build, pages, check, readers, status), `profile.example.md`.
- References distilled from the owner's copies: `writing-rules.md` (Schimel, Mensh & Kording, Gopen & Swan, Rougier et al., Nature summary paragraph, Pinker, Williams & Bizup; by a Sonnet 5.5 helper, reviewed) and `story.md` (GEB, Hoffman & Prakash, the thalamic single-synapse paper, Goetz et al.; by an Opus 5.5 helper, reviewed).
- Piloted on a real write-up from one of the owner's projects: one drafting pass and one reader round (4 readers, 170 questions) before release; step 6 now groups questions by theme and treats a weakest link every reader names as a change to the message (O1, O3). `wr.py check` exempts appendix figures (`fig:S...`) from the page-distance rule and gives the summary box a 300-word allowance (found in the pilot).
- Evals: `evals/run.py` (init, check on a planted-fault fixture, status, build, pages, readers) passes; judged cases written, not yet run blind (provisional).
