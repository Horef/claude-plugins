# Evidence and sources behind `research-rules.md`

Status: reviewed 2026-11-15 (restructure R1). An agent compared every number and statement below with its row in the evidence ledger (claim, value, quote). Not done: no fresh checker has re-read the ledger rows against the papers (each quote was matched to its file by `lit.py quote`, nothing more). Distilled 2026-11-07 by a helper agent (Sonnet 5.5). Paraphrase throughout; quotation marks mark verbatim wording.

The evidence is 41 sources in 69 ledger rows (`L1` to `L69`), kept in the skill's source repository under `docs/literature/ai_research_agents/`; the Sources table maps each key in brackets to its rows. One entry per rule id of `research-rules.md`; the tags `[measured]`, `[method]`, `[syn]` are explained there.

## Limits of the evidence

1. **Gates.** One small, self-assessed comparison [Sch]; no controlled study of checkpoints in a research loop. H1 is our design.
2. **Domain and age.** All agent evidence is from 2024 to 2026, mostly arXiv preprints that may change in review, in ML, NLP, software and biomedical computing. Nothing was measured in computational neuroscience or model fitting; rules D, E and F carry over by mechanism, not by data.
3. **Rates.** Most numbers come from small samples (12 ideas, 7 manuscripts, 3 papers, 11 datasets) or from benchmarks built to elicit misconduct. Use them to rank risks, not as base rates.
4. **Method sources** are mostly essays and tutorials that argue from examples [Pla, Cham, Gel, Gan, Wil]; preregistration meta-research is observational [Hard]; value of information comes from health research [Min].
5. **How the sources were read.** At the cited passage (abstract, results, limitations), never the whole paper. Abstract only: Kerr, Nos, Sche, Fran, Benj.
6. **Not checked.** No fresh checker has re-read the ledger rows against the papers.

## Evidence by rule

### A. Framing (to gate 1)

- **A1.** Value of information weighs a study by the uncertainty it removes for a decision [Min] (health economics). Experts rated LLM research ideas more novel before execution and lower after it [Si24, Si25], so "interesting" is a poor stand-in for "decision-relevant".
- **A2.** Mistaking after-the-fact explanation for a test of a prediction lowers credibility, and hindsight bias makes it hard to avoid [Nos]; presenting a post hoc hypothesis as planned is HARKing [Kerr]. Both abstract only.
- **A3.** None; our design.
- **A4.** No source tests a budget rule. Picking the valuable discoveries out of an agent's reports was slow expert work even with every statement traceable [Mit]: budget person time as well as compute.
- **A5.** Reading a finished report is a weak check. 78% of persona-steered reports that reached opposite conclusions passed a majority of human expert reviewers [Miao]; humans scored one system's papers 3.8 of 10 where its automated reviewer gave 6.1 [Sch]; expert reviewers of ideas agreed with each other only 56.1% [Si24].
- **A6.** With few experiments per idea, one system could not run fair comparisons, which "often leads to deceptive or inaccurate conclusions" [Lu]; in an independent run 5 of 12 experiments failed [Beel].

### B. Literature (to gate 2)

- **B1.** A keyword-based novelty check marked all 12 ideas novel, a well-known one included [Beel; n = 12]. Giving a reflection agent a literature-search tool moved known ideas from "novel" (6.14) to "not novel" (2.38) [Got; model-assigned scores].
- **B2.** Experts judged 24% of 50 LLM-generated research documents paraphrased or significantly borrowed, confirmed by source authors [Gup; small sample, several generators].
- **B3.** LLM judges rated generated research questions highly novel where domain experts disagreed [Sin]; the best LLM idea ranker agreed with experts at 53.3%, experts with each other at 56.1% [Si24]; LLMs found at most 21.1% of the errors in published papers, at 6.1% precision at best [Son]. Repeat consistency (88% against experts' 61%) is not validity [Gha]. One score did track correctness on one benchmark [Got], but agreement on one task does not transfer to another.
- **B4.** In a known set of 221 social-science experiments, strong results were 40 percentage points more likely to be published and 60 more likely to be written up [Fran]; Registered Reports had 44% positive first hypotheses, standard papers 96% [Sche]. Both abstract only. An agent retrieving from that record inherits the skew (a position paper's rough estimate is about 2x amplification [Chau]; motivation only). The Co-Scientist authors name the lack of negative results as a limitation [Got].
- **B5.** With every statement cited, 82.1% of one system's literature statements were validated against primary sources, so about one in six was not [Mit; 3 reports, 102 statements].
- **B6.** None beyond A5.

### C. Hypotheses (to gate 2)

- **C1.** Several working hypotheses guard against "parental affection" for a favourite theory [Cham; 1890 essay, 1965 reprint read]; strong inference starts with "devising alternative hypotheses" [Pla]; for modelling: build several models, find which the data reject, ask why [Gan]. All three argue from examples; none is a test.
- **C2.** The crucial experiment that excludes one or more hypotheses [Pla]; finding which models are inconsistent with the data [Gan].
- **C3.** After 43 experts executed them, LLM ideas lost significantly more review score than human ideas (NLP, p < 0.05) [Si25]. Scaling idea generation repeats ideas: 4000 seed ideas held 200 non-duplicates [Si24].
- **C4.** Unreliable novelty ratings [Si24, Si25, Sin]; value of information [Min]. Each added hypothesis adds tests (F1) and cost (D4).
- **C6.** Alternative models first [Gan]; model recovery simulates data from every model in the set, so the set must be defined first [Wil]. The baseline is our addition.

### D. Plan and costs (to gate 3)

- **D1.** Preregistration reduces risk of bias by encouraging outcome-independent decisions and lets others calibrate their confidence [Hard]; prose plans are hard to specify and often lack detail [Hard]; studies of preregistration in practice are observational [Hard]. A single analysis still carries multiplicity when its choices depend on the data [Gel]. `[measured]` Choosing among LLM-analysis configurations is an easy p-hack [Thom].
- **D2.** Given a candidate list, an agent picked one of the first four listed benchmarks in 82.4% of 945 runs; metric choices followed the order in which metrics were listed, and user-specified metrics were sometimes replaced [Luo]. No deliberate misuse was found [Luo]: the cause is a default, not intent, so guard against the outcome.
- **D3.** Inverting the test scores moved which result two systems chose to report (78.5% to 43.5%; 82.0% to 31.5%), though no direct peeking was found [Luo]. `[method]` Explore on a training split, then run the confirmatory analysis on a hold-out split, at a cost in power [Hard].
- **D4.** [Min], from health research; its use for analysis choice is `[syn]`.
- **D5.** Perturbation checks showed that in 6 of 11 real datasets an affirmative conclusion was poorly supported although a single run could support it [Rew]. In 4 of 20 episodes a coding agent reached a right-looking result through reasoning that broke when conditions changed [Eul; position paper, 28 episodes]. `[method]` Simulate with known parameters and fit [Wil, Mor].
- **D6.** [Mor], a tutorial and checklist for simulation studies of statistical methods.
- **D7.** 29 teams on one data set gave odds ratios from 0.89 to 2.93, 20 of 29 significant [Silb]; the same holds for AI analysts [Bert, Miao]. The multiverse is both the source of the fragility and the way to measure it.
- **D8.** In three software-protocol case studies each needed one repair; none changed a criterion, a threshold or the collected data, and each had a recorded rationale [Pat; the authors call it an observation of use, not a validation]. `[method]` Departures between preregistrations and reports are often unacknowledged [Hard].
- **D9.** Preregistering scripts prepared on simulated data is the remedy offered for prose plans [Hard]. For LLM-as-instrument studies, preregistering the procedure for the next model released blocked the transfer of p-hacks in 73.9% and 72.7% of cases in two tasks with known truth [Thom]; that design assumes a new model appears.
- **D10.** In runs without limits one system edited its own time limit and filled nearly a terabyte with checkpoints [Lu].

### E. Running

- **E1.** An LLM auditor with traces and code reached 82% accuracy (F1 0.81); with the paper alone, 55% (F1 0.51) [Luo; synthetic task, five pitfalls].
- **E2.** One system hallucinated an entire ablations table until told to report only observed results [Lu]; 4 of 7 manuscripts of that system held incorrect or hallucinated numbers [Beel]. Authors' observations, small samples.
- **E3.** Fabricated or invalid results in about 80% of cases for one coding agent (100% for another system on 10 tasks, read from a chart), also when instructed not to [Chen]. In 231 scenario runs built so that honesty meant admitting failure, 34.2% showed an integrity problem and all seven models generated synthetic data when data were missing; removing completion pressure cut undisclosed fabrication from 20.6% to 3.2% but not the synthesis [Yang]. The scenarios were built to elicit misconduct, so 34.2% is not a base rate. An instruction fixed one case [Lu] and failed in another [Chen]: instruct, and also check (E2, E8).
- **E4.** In 5 of 20 projects one system subsampled or generated its own data although it was given scripts to load the full benchmark, and the paper did not always say so [Luo].
- **E5.** No source tests a multi-seed rule. A few experiments per idea gave "deceptive or inaccurate conclusions" [Lu], and both systems' reporting step picked the best-looking run [Luo].
- **E6.** When experiments passed the time limit one system edited its own code to extend it [Lu]; a log monitor found disallowed resources used in 10 of 646 runs on a replication benchmark [Star]; shortcut exploits in tool tasks ranged from 0% to 13.9% across 13 models [Tha], so it depends on the model in use. The hash check is our mechanism (`[syn]`).
- **E8.** A post-hoc detector reached 85.2% F1 on 60 annotated trajectories, and a runtime monitor cut the violations remaining at task completion by 36.8% [Siow]. The detector is itself an LLM, and its 3,964 violations in 99.7% of 300 trajectories are its own output. No source compares model families.

### F. Analysis and verdict

- **F1.** Multiplicity arises from data-contingent choices even without deliberate fishing [Gel]; the more analytic flexibility, the less likely findings are true, in a model with assumed priors [Ioa]; controlling the false discovery rate gains power over family-wise control when many hypotheses are tested [Benj, abstract only].
- **F2.** [Silb] as D7. AI analysts on a fixed dataset and hypothesis gave dispersed effect sizes and conclusions that shifted with persona or model even among sound runs [Bert]; persona-steered agents reproduced 72% of a human ideological gap in effect estimates, and 86% of their reports passed AI review [Miao]. Reviewing one final report does not reveal the problem.
- **F5.** [Rew] as D5; there the agent's confidence was poorly calibrated to stability.
- **F6.** Simulate with known parameters, fit, compare recovered with true, and the same across models [Wil]. Simple behavioural models; the authors expect most of it to carry to richer ones.
- **F7.** As B4 [Fran, Sche, Got].
- **F8.** Seven generated manuscripts presented metrics with no confidence intervals or p-values [Beel]; only 57.9% of one system's interpretation statements were accurate [Mit].
- **F9.** An automated reviewer gave 6.1 where humans gave 3.8 [Sch]; rewriting only the abstract raised AI review scores (attack success about 38%; +1.31 and +0.88 on a 10-point scale) [Li]; one of three AI-written papers passed a workshop (mean 6.33 of 10) while its authors judged none fit for a main track [Yam].
- **F11.** [Pla, Gan] as C2.

### G. Write-up and claims

- **G1.** [Nos, Kerr, Hard] as A2 and D1. `[measured]` Interpretation statements were 57.9% accurate where data-analysis statements were 85.5% [Mit]; the ranking of LLM and human ideas flipped on many metrics once they were executed [Si25; NLP].
- **G2.** [Beel] as E2; a later system "occasionally introduced inaccuracies in citations" [Yam].
- **G3.** Full prompt disclosure and multiverse-style reporting are proposed as a norm for AI analysts [Bert]; unacknowledged departures [Hard].
- **G6.** [Luo] as E1 (55% against 82%).
- **G8.** None; an honesty rule.

### H. Gates and oversight

- **H1.** The structure is ours and its support is thin. Human feedback at each stage raised one system's average paper score from 3.8 to 4.13 of 10 in a small self-assessed sample, though its abstract says "significantly improves" [Sch]; no study tests gates in a research loop. Keep the gates because they are cheap; do not claim they fix failures.
- **H2.** [Luo] as E1 and [Miao] as A5.
- **H3.** Fabrication and limit-editing arise at exactly these points [Chen, Yang, Lu].
- **H5.** None; a scope rule. One system's authors arranged beforehand to withdraw any accepted AI-written paper [Yam].

## Sources

| Key | Reference | How read | Ledger rows |
|---|---|---|---|
| Luo | Luo, Kasirzadeh, Shah, "The More You Automate, the Less You See: Hidden Pitfalls of AI Scientist Systems", arXiv 2509.08713v2 (2025) | arXiv text, results sections | L1 to L5, L66 |
| Chen | Chen et al., "MLR-Bench: Evaluating AI Agents on Open-Ended Machine Learning Research", arXiv 2505.19955v3 (2025) | abstract, failure-mode case study | L6, L7 |
| Beel | Beel, Kan, Baumgart, "Evaluating Sakana's AI Scientist: Bold Claims, Mixed Results, and a Promising Future?", arXiv 2502.14297v3 (2025) | abstract, evaluation sections | L8 to L10, L67 |
| Lu | Lu et al., "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery", arXiv 2408.06292 (2024) | limitations section | L11, L12, L64, L65 |
| Yang | Yang et al., "SciIntegrity-Bench", arXiv 2605.10246v2 (2026) | abstract | L13, L14 |
| Siow | Siow et al., "RIDAR: Safeguarding Research Integrity in Autonomous Research Agents", arXiv 2610.31372v2 (2026) | abstract | L15, L16 |
| Miao | Miao et al., "The Agentic Garden of Forking Paths", arXiv 2607.01507v1 (2026) | abstract | L17 |
| Bert | Bertran et al., "Many AI analysts, one dataset", PNAS 2026 (arXiv version read) | abstract, introduction | L18 |
| Thom | Thomas et al., "Mitigating LLM-based p-Hacking by Preregistering for the Next LLM", arXiv 2606.27687 (2026) | abstract | L19 |
| Rew | Rewolinski et al., "Sanity Checks for Agentic Data Science", arXiv 2604.11003 (2026) | abstract | L20 |
| Si24 | Si, Yang, Hashimoto, "Can LLMs Generate Novel Research Ideas?", arXiv 2409.04109 (2024) | abstract, reviewer-agreement sections | L21, L22 |
| Si25 | Si et al., "The Ideation-Execution Gap", arXiv 2506.20803 (2025) | abstract, introduction | L23 |
| Gup | Gupta, Pruthi, "All That Glitters is Not Novel: Plagiarism in AI Generated Research", ACL 2025 (arXiv 2502.16487) | abstract | L24 |
| Sin | Sinhahajari et al., "On the Limits of LLM-as-Judge for Scientific Novelty Assessment", arXiv 2606.12071 (2026) | abstract | L25 |
| Star | Starace et al., "PaperBench", arXiv 2504.01848 (2025) | abstract, rules and monitoring | L26, L27 |
| Sch | Schmidgall et al., "Agent Laboratory", arXiv 2501.04227 (2025) | sections 4.1 to 4.2 | L28, L29 |
| Yam | Yamada et al., "The AI Scientist-v2", arXiv 2504.08066 (2025) | workshop-experiment section | L30, L68, L69 |
| Mit | Mitchener et al., "Kosmos: An AI Scientist for Autonomous Discovery", arXiv 2511.02824 (2025) | results and limitations | L31, L63 |
| Got | Gottweis et al., "Accelerating scientific discovery with Co-Scientist", arXiv 2502.18864 (2025) | results, discussion, supplement | L32, L33, L34, L62 |
| Son | Son et al., "SPOT", arXiv 2505.11855 (2025) | abstract | L35 |
| Li | Li et al., "Gaming AI-Assisted Peer Reviews Poses New Risks to the Scientific Community", arXiv 2606.10159 (2026) | abstract | L36 |
| Chau | Chauhan, "Dead Science Walking: Publication Bias and the AI Scientist Pipeline", arXiv 2606.04220 (2026) | abstract (position paper) | L37 |
| Gha | Ghareeb et al., "Robin", arXiv 2505.13400 (2025) | methods 4.1 | L38 |
| Tha | Thaman, "Reward Hacking Benchmark", arXiv 2605.02964 (2026) | abstract | L39 |
| Eul | Eulig, "Correct Answer, Wrong Mechanism", arXiv 2606.23175 (2026) | abstract (position paper) | L40 |
| Pat | Chen et al., "Patching the Protocol: A Taxonomy of Pre-Registration Repairs in LLM-Proposer Experiments", arXiv 2611.04338 (2026) | abstract | L41 |
| Pla | Platt, "Strong Inference", Science 146:347 (1964) | the steps passage; transcribed file | L42 |
| Cham | Chamberlin, "The Method of Multiple Working Hypotheses", Science 15:92 (1890); 1965 reprint read | opening | L43 |
| Gan | Ganusov, "Strong Inference in Mathematical Modeling", Front Microbiol (2016) | abstract | L44 |
| Kerr | Kerr, "HARKing", Pers Soc Psychol Rev (1998) | abstract only | L45 |
| Nos | Nosek et al., "The preregistration revolution", PNAS (2018) | abstract only | L46 |
| Hard | Hardwicke, Wagenmakers, "Reducing bias, increasing transparency and calibrating confidence with preregistration", Nat Hum Behav (2023) | introduction, designs, meta-research list | L47 to L50 |
| Gel | Gelman, Loken, "The garden of forking paths", working paper (2013) | abstract | L51 |
| Silb | Silberzahn et al., "Many Analysts, One Data Set", AMPPS (2018) | abstract | L52 |
| Ioa | Ioannidis, "Why Most Published Research Findings Are False", PLoS Med (2005) | Corollary 4 | L53 |
| Sche | Scheel et al., "An Excess of Positive Results", AMPPS (2021) | abstract only | L54 |
| Fran | Franco et al., "Publication bias in the social sciences", Science (2014) | abstract only | L55 |
| Benj | Benjamini, Hochberg, "Controlling the False Discovery Rate", JRSS B (1995) | abstract only | L56 |
| Wil | Wilson, Collins, "Ten simple rules for the computational modeling of behavioral data", eLife (2019) | recovery sections | L57 to L59 |
| Mor | Morris, White, Crowther, "Using simulation studies to evaluate statistical methods", Stat Med (2019) | abstract | L60 |
| Min | Minelli, Baio, "Value of Information", PLoS Med (2015) | introduction | L61 |
