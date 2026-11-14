# Changelog: research-assistant

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.3.1 (2026-11-14)
- A later gate-3 approval opens a new audit round: ra.py audit logs its audit, stage/check/handover/close need a passing audit written after the last approval (unlogged older audits by their verified date); SKILL.md says Python 3.12+. (O10) (O10)

## 0.3.0 (2026-11-09)
- Pilot gaps (owner request 2026-11-09): audit status read by its first word and checked to be pass or disagreement (O4); ra.py close and a 'closed' stage (O5); ra.py handover prints draft ledger rows with confirmatory/exploratory, condition, evidence and the disclosure counts (O6); 'kind: exploratory' analyses with an 'exploratory' verdict, and a rule for side literature questions and extras after gate 3 (O7). O8 (win: gates, verbatim rules, cross-family audit) kept as is. (O4, O5, O6, O7, O8)

## 0.2.0 (2026-11-08)
- Question tags and short names (owner, 8 Nov): ra.py init --tag NB prefixes every id (NB-H1, NB-A1, NB-Q1), refusing tags whose ids already occur in the repo; headings are short names with the claim in 'statement'; status and the gate log print ids with names; bare ids typed at gates are read as the question's; ra.py retag renames an existing folder (headings, id fields, log; fingerprints kept) and lists prose mentions. Hypotheses template gains 'statement' and 'Not taken forward'. (O2, O3)

## 0.1.0 (2026-11-07)
- Created at the owner's request (2026-11-04 idea, 2026-11-07 choices): a conductor for the whole research loop over the building-block skills (literature-research, research-writing, local-run-queue, paper-premark, project-foundations). Owner choices: three checkpoint gates (after framing, after literature, before compute), state in the project's docs (`docs/research/<topic>/` plus RESULTS, DECISIONS, RUNS), four entry points (project question, new idea, reviewer questions, paper to build on).
- `references/research-rules.md`: 65 rules by stage with a "Most important 12", distilled by a Kiro helper (Sonnet 5.5) with the literature-research procedure from 41 sources (AI research-agent evaluations 2024-2026 and research-methods papers; survey in the genome's `docs/literature/ai_research_agents/`, 69 ledger rows, quotes matched by lit.py; three key rows re-checked by the lead at score 1.00; no fresh checker yet, so provisional).
- `scripts/ra.py` (init, gate, deviation, audit, status, check) and `templates/research/`.
- Piloted to gate 1 on a real question (simple_complex_v1 `docs/research/nmda_tc_l23_mechanism/`): the frame needed "What is already known" and "Questions for gate 1" sections, now in the template.
- A fresh review by another model family (Gemini 4 Argon via agy; `evals/reviews/review-1.md`) found nine problems, all fixed before release. The worst: G3 wrote the approval into the template's example comment; a section without a status line could overwrite the next one; nested placeholders counted as filled; one [source] hid unsourced numbers on the same line; the audit was never checked; a design could change after approval without a deviation; G2 recorded no selection; scripts were written before gate 3. Gates now check their stage is complete, G2 takes `--select/--drop/--stop`, G3 fingerprints each approved design, `ra.py audit` writes the audit form and `check` requires a passing audit before the write-up.
- `evals/run.py`: scripted checks for every finding of the review; four fixes mutation-tested. Judged cases written, not yet run blind (provisional).
