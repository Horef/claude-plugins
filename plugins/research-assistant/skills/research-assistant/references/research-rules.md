# Research rules for an AI research assistant, by loop stage

Status: reviewed 2026-11-15 (restructure R1). An agent checked every rule for use by the skill (SKILL.md, `ra.py`, templates, eval cases), for duplicates, and against its rows in the evidence ledger; 65 rules became 51, and merged ids are under "Retired ids". First distilled 2026-11-07 by a helper agent (Sonnet 5.5). The evidence behind each rule, its limits and the sources are in `research-rules-sources.md`, under the same ids; read that file when you need the reason or the strength of a rule, not to follow it.

How to read a rule:

- **binding**: the procedure relies on it. SKILL.md names it, or `ra.py` or a template enforces it as a required field or a check. Follow it; a departure is a deviation to log or a question for the person.
- **guidance**: sound practice the procedure does not enforce. Apply it where the case fits.
- `[measured]` an evaluation or experiment measured the failure or the fix. `[method]` a methods source states the practice (essay, tutorial, review, statistical paper); not an experiment. `[syn]` our synthesis for an agent loop with human gates; no source states it in this form.
- Rule ids (RR-A1, RR-D5, RR-H1) belong to this file, and the prefix RR- keeps them from being read as analysis, hypothesis or gate ids. A question's own ids carry its tag (NB-H1, NB-A1), and the gates are "gate 1" to "gate 3" here (`G1` to `G3` only on the `ra.py gate` command line).

## Most important 12

Ranked for an agent that takes a question through the loop with a person at three gates. The measured failures that recur: an invented or substituted result, an undeclared change to the data or the metric, a result picked because the test score was good, an unsearched claim of novelty, a conclusion that depends on one analysis path, and a paper that looks fine while the logs show otherwise. The numbers behind each rule are in `research-rules-sources.md`.

1. Never fill a gap with simulated, placeholder or substituted data; report the failure (RR-E3).
2. Take every number in a report from a logged run output, by script, and have a checker that did not run the analysis re-read it (RR-E2, RR-G2).
3. Fix the data, the splits, the metric and the benchmark in the plan; any change is a logged deviation (RR-D2, RR-D3, RR-D8, RR-E4).
4. Keep test and evaluation data out of anything that selects what to report (RR-D3, RR-E6).
5. Keep the full run log and the code, and audit from them, not from the paper (RR-E1, RR-E8, RR-G6).
6. Write at least three competing hypotheses, each with a result that would reject it, before choosing analyses (RR-C1, RR-C2).
7. Fix the primary analysis and its decision rule before seeing outcomes; label everything else exploratory (RR-A2, RR-D1).
8. Run the pre-listed defensible variants and report the spread, not one path (RR-D7, RR-F2).
9. Run a negative and a positive control on every result that carries a claim (RR-D5, RR-F5).
10. Claim novelty only as "not found in S on D with queries Q" after a real search, and never rate novelty with an unsearched LLM judge (RR-B1, RR-B2, RR-B3).
11. Report null and contradicting results as outputs of the loop (RR-B4, RR-F7).
12. Stop at three gates with the artifacts in hand (RR-H1, RR-H2).

---

## A. Framing (to gate 1)

- **RR-A1** (binding; frame fields `question`, `decision`). Write the question, the decision it serves and the result that would change the decision, before any search or compute. Ask the person if one is missing. `[syn]`
- **RR-A2** (binding; frame field `claim type`). Name the claim type the loop may produce: confirmatory (a prediction fixed before the data) or exploratory (generated or tuned on the data). Every later result carries one of the two labels. `[method]`
- **RR-A3** (binding; frame field `type`). Name the question type: parameter value, mechanism, model comparison, novelty or prior-art check, replication. It sets the evidence a "yes" needs: a parameter value needs primary measurements under matching conditions; a novelty claim is a claim of absence and needs the widest search (RR-B2). `[syn]`
- **RR-A4** (binding; frame fields `budget`, `stop rules`). Record the budget (person time, tokens, wall clock, compute) and a stop rule for each stage. `[syn]`
- **RR-A5** (binding). State the person's task at each gate as concrete checks (open this file, compare this number), never as "approve". `[syn]`
- **RR-A6** (binding; frame field `cannot answer`). Say what the loop cannot answer with the data and compute at hand, so the plan does not stretch. `[syn]`

## B. Literature (to gate 2)

- **RR-B1** (binding). The literature stage is a real, logged search, never the loop's own keyword check: several sources, each query logged as run; each finding a ledger row with value, conditions, locator and verbatim quote; a fresh checker re-reads the rows the hypotheses will rest on. The literature-research skill does this when it is installed; without it, do these steps by hand. `[measured]`
- **RR-B2** (binding). Report novelty as "not found in S on D with queries Q", in the frame, at gate 2 and in the write-up. Run the closest-prior-work check on the final candidate hypotheses and name the nearest paper. `[measured]`
- **RR-B3** (binding). No LLM is the only judge of novelty, interest or quality. If a judge is used, test it first on a task with known answers and report the agreement. `[measured]`
- **RR-B4** (binding). Search for negative, null and contradicting results on purpose, record them, and tell the person when the evidence base is mostly positive. `[method]`
- **RR-B5** (binding). Only checked ledger rows go into the hypothesis stage. A claim from a review stays "indirect" until traced to the primary paper. `[syn]`
- **RR-B6** (binding). At gate 2 give the person the evidence summary, not only the answer: the answer, the conflicts, the gaps and the papers that could not be opened. `[syn]`

## C. Hypotheses (to gate 2)

- **RR-C1** (binding; `ra.py check` counts them). Write at least three competing hypotheses, models or explanations before choosing analyses. Include a rival the data could favour and, where it makes sense, a null or baseline model. `[method]`
- **RR-C2** (binding; hypothesis fields `rejected if`, `analysis`). For each hypothesis state a result that would reject it and an analysis able to produce that result. Drop a hypothesis no available analysis can reject. `[method]`
- **RR-C3** (binding; hypothesis field `source`). Source every hypothesis from the ledger or a stated assumption, never from a model finding it interesting. `[measured]`
- **RR-C4** (binding). Rank hypotheses by decision value, testability and cost, not by an LLM's novelty or excitement score. Take few to compute and say why each is there. `[syn]`
- **RR-C6** (binding). For a modelling question, fix the model space and the model-comparison criterion before fitting, and add a simple baseline model. `[syn]`

## D. Plan and costs (to gate 3)

- **RR-D1** (binding; gate 3 refuses an unfilled field and fingerprints the approved design). The plan fixes for each analysis, before any run and dated: the hypotheses it separates, the data and exclusions, the model or test, the metric, the decision rule (the direction, the effect that counts, the threshold; what supports and what rejects), the controls, the variants, the seeds and the cost. The planned analysis is the primary one; whatever is chosen or added after outcomes are seen is exploratory (RR-A2). `[method]`
- **RR-D2** (binding; plan fields `data`, `metric`). Name the dataset, the benchmark and the metric in the plan. Do not leave their choice to the agent at run time. `[measured]`
- **RR-D3** (binding). Define the splits and name the test or hold-out set that no decision, tuning or selection step may read. Check that the reporting logic cannot see it. `[measured]`
- **RR-D4** (binding; plan fields `cost`, `value`). Cost each analysis (compute, time, tokens, person time) and rank by value of information: which decision it can change, how likely that is, what it costs. Run cheap discriminating analyses first. `[method]`
- **RR-D5** (binding; plan fields `negative control`, `positive control`). Put controls in the plan: a negative control (permuted or noise input should show no effect) and a positive control (simulated data with a known effect should be recovered). Where a result claims a mechanism, add an ablation or perturbation that should break it if the mechanism is right (this part is guidance). `[measured]`
- **RR-D6** (guidance). For simulation and fitting work, plan and report by ADEMP: aims, data-generating mechanisms, estimands, methods, performance measures. `[method]`
- **RR-D7** (binding; plan field `variants`). List the defensible analysis variants before the run (the "multiverse") and say whether the answer will be the primary path or the spread. `[method]`
- **RR-D8** (binding; `ra.py deviation`, and `ra.py check` catches a changed design). Amendments are allowed and logged: every departure from the approved plan goes into the deviation log with its reason and whether it came before or after any outcome was seen. A criterion, threshold or scoring rule never changes after outcomes are seen; a change to the evaluation goes to the person first. `[measured]`
- **RR-D9** (binding). Where possible, write the analysis script and run it on simulated data with a known answer before the real data. `[method]`
- **RR-D10** (binding). Gate 3, before compute: show the person the plan, the cost table, the list of what will be logged and the stop rules. Large compute runs only on an explicit yes. `[syn]`

## E. Running

- **RR-E1** (binding). Log every run: code version, command, parameters, seed, data identifier and hash, environment, start and end time, outputs. Keep the full agent trace and the generated code. `[measured]`
- **RR-E2** (binding; `ra.py check` flags a verdict number without a source). Every number in a table, figure or sentence comes from a logged output file through a script. No typed numbers. `[measured]`
- **RR-E3** (binding). When a run fails, report the failure, fix the cause or stop. Never produce simulated, placeholder or substituted results to complete the task. If data are missing, say so and ask. `[measured]`
- **RR-E4** (binding). Use the planned data and splits in full. Subsampling, generated data, a substituted metric or a changed benchmark is a deviation (RR-D8): log it when it happens and state it in the write-up. `[measured]`
- **RR-E5** (binding; plan field `seeds`). Fix and record seeds. For a stochastic analysis run several seeds and report the spread; never report the best seed alone. `[syn]`
- **RR-E6** (guidance). Limits and the evaluation are not the agent's to edit: do not change a time, storage or network limit, the evaluation code, the splits or the test labels to get a run through; that is an escalation (RR-H3). Where the project can, make them read-only, hash them and check the hashes before reporting. `[measured]`
- **RR-E8** (binding; `ra.py audit`). A fresh checker that did not run the analyses audits the trajectory from the plan, the deviation log, the logs and the code: undeclared deviations, substituted data, selection after seeing results. Keep the roles apart (the context that extracts, the one that runs, the one that checks) and use another model family for the checker where possible. A monitor during long runs is optional. Treat all of it as a net, not a guarantee. `[measured]`

## F. Analysis and verdict

- **RR-F1** (binding; verdict field `analyses run`). Count every analysis run, failed and unreported ones included, in the log and the report. Where several tests bear on one claim, state the family and correct for it (family-wise error or false discovery rate), or label the results exploratory and give the number of tests. `[method]`
- **RR-F2** (binding; verdict field `variants`). Report the primary analysis and the spread of estimates across the pre-listed variants (RR-D7). A conclusion that flips across variants is fragile. `[measured]`
- **RR-F5** (binding; verdict field `controls`). Run the planned controls (RR-D5) on every result that carries a claim. A result whose negative control shows signal, or whose perturbation flips it, is not reported as support. The agent's own stated confidence is not evidence. `[measured]`
- **RR-F6** (binding). For fitted models, show parameter recovery and model recovery on simulated data in the range of the real fits before interpreting fitted values or model comparisons. Say that recovery is a best case. `[method]`
- **RR-F7** (binding). Null, negative and contradicting results get the same detail as positive ones and go into the project record. `[method]`
- **RR-F8** (binding). Give effect sizes with intervals, and do not equate statistical significance with scientific value. `[measured]`
- **RR-F9** (guidance). A reviewer's score or an acceptance, from an LLM or a venue, is not evidence that a result is right. Treat it as a prompt to look, and report what the check was. `[measured]`
- **RR-F11** (binding; verdict field `rival`). For each positive result, name the nearest rival hypothesis and say whether the data separate them. If not, say what would. `[method]`

## G. Write-up and claims

- **RR-G1** (binding; `ra.py handover` prints the tags). Claims are no stronger than the audited evidence. Tag each claim confirmatory or exploratory, measured or inferred, and give its conditions. Each interpretive sentence points to the result it rests on, or is cut or marked as speculation. An idea that was not executed is called untested, not promising. `[method]`
- **RR-G2** (binding; the audit's `numbers` field). The checker of RR-E8 verifies each number in the verdict and the draft against the run outputs, and each citation against the literature ledger. A row that fails carries no claim. `[measured]`
- **RR-G3** (binding; `ra.py handover` prints the counts). Disclose: deviations, substituted or generated data, failed runs, the number of analyses, the prompts and models, and what the agent and what the person decided. `[method]`
- **RR-G6** (binding). Ship the logs, the code, the plan, the deviation log and the ledger with the write-up. A reader with only the paper cannot find most of these failures. `[measured]`
- **RR-G8** (binding). Describe the work as what it was: an analysis on stated data, tools and dates, run by an agent under named gates. Do not call it autonomous when a person decided at the gates. `[syn]`

## H. Gates and oversight

- **RR-H1** (binding; owner's choice 2026-11-07; `ra.py gate` records each). Three gates: after framing (question, decision, claim type, budget), after the literature (which hypotheses to test), before compute (the costed plan). Each gate ends with the person's decision written to the log with its date and their words. `[syn]`
- **RR-H2** (binding). At each gate show artifacts, not a summary: the plan file, the cost table, the list of deviations and what changed since the last gate. `[measured]`
- **RR-H3** (binding). Stop and ask the person at once when: a run fails twice, input data are missing, a result contradicts the plan, cost passes the budget, or the agent would change the evaluation or a limit. `[syn]`
- **RR-H5** (binding). The agent does not decide publication, authorship or release of results; the person does. `[syn]`

---

## Limits

No study tests gates in a research loop (RR-H1 is our design), nothing was measured in computational neuroscience or model fitting, most rates come from small samples or from benchmarks built to elicit misconduct, and no fresh checker has re-read the ledger rows against the papers. Details: `research-rules-sources.md`, "Limits of the evidence".

## Retired ids

Merged in the 2026-11-15 review; an old citation of the left id means the right one (older text, such as CHANGELOG entries and the review in `evals/reviews/`, cites these ids without the prefix).

RR-C5 → RR-D1 · RR-C7 → RR-C4 · RR-E7 → RR-E6 · RR-E9 → RR-D5 · RR-E10 → RR-D8 · RR-E11 → RR-H3 · RR-F3 → RR-D1 (label: RR-A2) · RR-F4 → RR-F1 · RR-F10 → RR-G1 · RR-G4 → RR-B2 · RR-G5 → RR-F9 · RR-G7 → RR-G1 · RR-H4 → RR-E8 · RR-H6 → RR-H1
