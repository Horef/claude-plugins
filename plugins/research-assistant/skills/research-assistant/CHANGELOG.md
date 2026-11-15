# Changelog: research-assistant

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.5.3 (2026-11-15)
- research-rules-sources.md follows the 2026-11-15 fresh check of the evidence ledger: RR-E3's 80% is 8 of 10 manually checked tasks (ledger L6 corrected); Nos and Sche read in full text; 'not checked' notes replaced

## 0.5.2 (2026-11-15)
- restructure R7, owner-approved 2026-11-15: the step-tier table is preceded by a one-line, standalone definition of light, standard and deep (no model-router dependence, D12)

## 0.5.1 (2026-11-15)
- Rule ids prefixed RR- so they cannot be read as analysis, hypothesis or gate ids (the tag style of simple_complex_v1); a fallback line in SKILL.md section 0 for each skill it depends on (literature-research, research-writing, local-run-queue, paper-premark, project-foundations); a scripted check that every cited rule id is live or retired and that the rules and sources files define the same ids (owner decisions 2026-11-15) (O12)

## 0.5.0 (2026-11-15)
- Restructure R1 (owner-approved 2026-11-15): references/research-rules.md reviewed and made compact, 65 rules to 51, each marked binding (48: SKILL.md, ra.py or a template relies on it) or guidance (3: D6, E6, F9); 321 lines / 38,028 bytes to 116 / 15,737. Evidence, limits and the sources table moved to the new references/research-rules-sources.md under the same ids (137 lines / 18,484 bytes). Merged duplicates, old ids listed under 'Retired ids': C5, F3 into D1; C7 into C4; E7 into E6; E9 into D5; E10 into D8; E11 into H3; F4 into F1; F10, G7 into G1; G4 into B2; G5 into F9; H4 into E8; H6 into H1. Removed: the 'Where the sources disagree' section (each resolution already sits in its rule's evidence), the source-key list (the Sources table has it), and two statements no ledger row holds (F8 'Kosmos conflated significant with valuable', G6 'the authors recommend journals require traces and code'; Luo 'PNAS 2026' in the table). Each skill must work on its own (owner, 2026-11-15): B1 no longer requires the literature-research skill and carries the minimum itself, A3 and G2 no longer point into it, and SKILL.md stage 2 says what to do when it is not installed. SKILL.md: citations follow the merges (E10, E11, G4 gone) and A1, A3, E1, E5, F5 are now cited where the procedure already did them. Checked: every number against its ledger row; loop.py eval exit 0 before and after. Provisional: no blind judged run of the cases (never run for this unit); no fresh checker has re-read the ledger rows against the papers.

## 0.4.0 (2026-11-15)
- ra.py: a blank audit verdict is no pass (handover refuses); gate --dry-run writes nothing; ra.py round DIR opens a plan round (status shows the round and its next gate); status shows open decisions and a short title; literature-folder check only after gate 2; SKILL: dry-run, append-only gate log, no verdict while an escalation is open, RESULTS heading form (O9, O11)

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
