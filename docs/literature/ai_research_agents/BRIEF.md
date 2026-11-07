Status: proposal (2026-11-07). Brief for a helper: the literature behind the research-assistant skill.

# Brief: what makes AI research agents fail, and what research practice prevents it

**Goal.** We are building a skill, `research-assistant` (folder `plugins/research-assistant/skills/research-assistant/` in this worktree), that runs a research question through the whole loop with human checkpoints:
1. frame the question;
2. review the literature (the literature-research skill);
3. form competing hypotheses and a costed analysis plan;
4. run the approved analyses;
5. record the results;
6. write them up (the research-writing skill).

Its rules should rest on evidence, as literature-research's search rules rest on Cochrane and PRISMA. Your job: find and verify that evidence, then distil it into a rules file.

**Procedure.** Follow the literature-research skill: `plugins/literature-research/skills/literature-research/SKILL.md` in this worktree (read it whole; tool `scripts/lit.py` next to it). Work in `docs/literature/ai_research_agents/` (this folder): `python3 <lit.py> init docs/literature/ai_research_agents --question "..." --type review`, keeping this BRIEF.md. Stop rule: about 40 logged queries or two citation rounds without new relevant papers. Full texts: most of these are on arXiv (free; `lit.py fetch`); DEVONthink is not needed. Ledger: about 20-35 rows, each with a verbatim quote and locator, checked with `lit.py quote`.

**Two strands to cover:**
A. **AI research agents and their evaluations.** Seeds (verify; find more):
   - The AI Scientist (Lu et al. 2024) and v2 (Yamada et al. 2025).
   - Agent Laboratory (Schmidgall et al. 2025).
   - AI co-scientist (Gottweis et al. 2025, Google).
   - FutureHouse's Robin and Kosmos (2025).
   - Si, Yang & Hashimoto 2024 (LLM research ideas judged more novel by experts) and Si et al. 2025 (the ideation-execution gap).
   - Beel et al. 2025, an independent evaluation of the AI Scientist.
   - MLR-Bench, PaperBench and similar benchmarks.
   - Studies of hidden pitfalls in automated research: fabricated or misreported results, data leakage, p-hacking or metric gaming, weak novelty checks, reviewer-gaming, overclaiming.
   What failure modes were measured, how often, and which design features (human checkpoints, verification, logging, tree search, multiple agents) helped, with numbers.
B. **Research practice that prevents those failures**, from methods literature (sources, not opinion):
   - strong inference and multiple working hypotheses (Platt 1964; Chamberlin 1890);
   - the garden of forking paths, HARKing and preregistration (Gelman & Loken 2013; Kerr 1998; Nosek et al. 2018);
   - multiple comparisons;
   - reporting negative results;
   - in computational modelling: Wilson & Collins 2019, "Ten simple rules for the computational modeling of behavioral data" (parameter recovery, model falsification), and simulation-study reporting (Morris et al. 2019, ADEMP);
   - costing and deciding what to run (value of information).
   Keep it brief and rule-oriented.

**Output 1:** the literature-research folder (question.md, search_log.md, candidates.jsonl, ledger.md, synthesis.md, sources.bib). `lit.py check` must pass, apart from rows still `unchecked` (no fresh checker this time; say so in the synthesis).

**Output 2:** `plugins/research-assistant/skills/research-assistant/references/research-rules.md`, in the form of `plugins/literature-research/skills/literature-research/references/search-rules.md` (read its first 60 lines for the format):
- a status/purpose line;
- a "Most important 12" list;
- then rules grouped by loop stage: framing, literature, hypotheses, plan and costs, running (provenance, no fabrication, seeds, logging), analysis (forking paths, multiple comparisons, negative results), write-up and claims, human gates and oversight;
- each rule one or two sentences, with its source keys `[Key]` and an evidence tag: `[measured]` from an evaluation, `[method]` from methods literature, `[syn]` our synthesis;
- a sources table at the end.
Rules must be actionable by an agent (what to do, when) and must say where the evidence is weak. About 250-450 lines.

**Scope.** Write only inside `docs/literature/ai_research_agents/` and `plugins/research-assistant/skills/research-assistant/references/`. Do not commit or push. Do not edit any other skill.

**Report** to the lead (t2g) with `hc send` when done or stuck: 5 lines (counts, the strongest three findings, anything you could not get), and the two paths.
