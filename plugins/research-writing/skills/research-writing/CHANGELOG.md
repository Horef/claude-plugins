# Changelog: research-writing

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.1.0 (2026-11-04)
- Created at the owner's request (2026-11-04): write-ups and paper drafts that read as an argument, not a lab report. Procedure (message and claims ledger, skeleton in argument order, figures first, build/check/look, fresh-reader question loop, delivery), model tiers as suggestions the person overrides (owner request), LaTeX template, `wr.py` (init, build, pages, check, readers, status), `profile.example.md`.
- References distilled from the owner's copies: `writing-rules.md` (Schimel, Mensh & Kording, Gopen & Swan, Rougier et al., Nature summary paragraph, Pinker, Williams & Bizup; by a Sonnet 5.5 helper, reviewed) and `story.md` (GEB, Hoffman & Prakash, the thalamic single-synapse paper, Goetz et al.; by an Opus 5.5 helper, reviewed).
- Piloted on a real write-up from one of the owner's projects: one drafting pass and one reader round (4 readers, 170 questions) before release; step 6 now groups questions by theme and treats a weakest link every reader names as a change to the message (O1, O3). `wr.py check` exempts appendix figures (`fig:S...`) from the page-distance rule and gives the summary box a 300-word allowance (found in the pilot).
- Evals: `evals/run.py` (init, check on a planted-fault fixture, status, build, pages, readers) passes; judged cases written, not yet run blind (provisional).
