Status: proposal (2026-11-07). Question and criteria for the AI-research-agents review.

# Question

What failure modes have been measured in AI research agents (automated scientific research systems), how often do they occur, and which design features reduced them? And what research practice from the methods literature prevents such failures in a question-to-results loop (frame, literature, hypotheses, costed plan, run, record, write-up) with human gates?

- **Type:** review (two strands: A, AI research agents and their evaluations; B, methods literature on research practice)
- **Created:** 2026-11-07
- **Decision it serves:** which rules go into `research-rules.md` of the research-assistant skill, and how strongly each is worded. A rule with measured evidence is worded as a requirement; a rule resting on methods literature or our synthesis is worded as a default and marked as such.

## Inclusion criteria

- System: LLM-based agents that run some part of a research cycle (ideation, experiments, analysis, writing, review); benchmarks and independent evaluations of such agents; studies of hidden pitfalls (fabricated results, leakage, metric gaming, weak novelty checks, reviewer gaming, overclaiming).
- Strand B: methods papers on strong inference, multiple working hypotheses, forking paths, HARKing, preregistration, multiple comparisons, negative results, computational modelling practice (parameter recovery, model falsification), simulation-study reporting (ADEMP), value of information.
- Years: 2024-2026 for strand A (the field is new); no limit for strand B.
- Evidence wanted: numbers (rates, scores, counts) from evaluations; for strand B the rule as the source states it.
- Excluded: opinion pieces without data in strand A; coding-agent benchmarks with no research element; papers on AI for a single narrow task with no loop.

## Sources to search

- [x] pubmed
- [x] s2 (Semantic Scholar, keyless; bulk fallback)
- [x] arxiv
- [x] openalex
- [ ] devonthink (not used: not needed per brief)
- [x] web / citation chasing (`lit.py cites`)

## Stop rule

About 40 logged queries, or two rounds of citation chasing with no new relevant paper, whichever comes first. Full texts from arXiv or open access; papers not openable go to `to_fetch.md` and are cited from abstracts only (marked `abstract-only`).
