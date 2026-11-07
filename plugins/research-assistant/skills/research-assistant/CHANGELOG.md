# Changelog: research-assistant

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.1.0 (2026-11-07)
- Created at the owner's request (2026-11-04 idea, 2026-11-07 choices): a conductor for the whole research loop over the building-block skills (literature-research, research-writing, local-run-queue, paper-premark, project-foundations). Owner choices: three checkpoint gates (after framing, after literature, before compute), state in the project's docs (`docs/research/<topic>/` plus RESULTS, DECISIONS, RUNS), four entry points (project question, new idea, reviewer questions, paper to build on).
- `references/research-rules.md`: 65 rules by stage with a "Most important 12", distilled by a Kiro helper (Sonnet 5.5) with the literature-research procedure from 41 sources (AI research-agent evaluations 2024-2026 and research-methods papers; survey in the genome's `docs/literature/ai_research_agents/`, 69 ledger rows, quotes matched by lit.py; three key rows re-checked by the lead at score 1.00; no fresh checker yet, so provisional).
- `scripts/ra.py` (init, gate, deviation, status, check) and `templates/research/`; `evals/run.py` scripted checks (mutation-tested); judged cases written, not yet run blind (provisional).
