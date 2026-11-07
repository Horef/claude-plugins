---
name: research-assistant
description: "Run a research question through the whole loop with checkpoints: frame it and the decision it serves, review the literature (literature-research), turn findings into competing hypotheses and a costed analysis plan, run the approved analyses (bounded local runs; large compute only on a yes), record results in the project, and write them up (research-writing). Stops for the person at three gates: after framing, after the literature (which hypotheses to test), and before any compute. Starts from a question in a project, a new idea (novelty check first, then a scaffolded project), reviewer questions, or a paper to build on. Use when asked to research, investigate or test an idea end to end, to plan analyses for open questions, or to take a question from literature to results; for a literature question alone use literature-research, for writing alone research-writing."
---

# Research assistant

Use this skill to take one research question from its first statement to results someone can trust: what the literature says, which explanations compete, which analyses would tell them apart, what those cost, what the runs showed, and a write-up. It conducts the loop and hands each stage to the skill that already does it well (literature-research, research-writing, local-run-queue, paper-premark, project-foundations). It is not for a literature question alone (use literature-research) or for writing up results that already exist (use research-writing).

**The problem it solves.** Measured on AI research agents (`references/research-rules.md`, "Most important 12"): they fill failed runs with simulated results (about 80% of cases on one benchmark, even when told not to), pick what to report after seeing test scores, call ideas novel after a keyword search, reach opposite conclusions from the same data depending on the analysis path, and write papers that read well while the logs show otherwise; an auditor with logs and code catches 82% of such pitfalls, one with the paper alone 55%. The procedure therefore fixes each analysis and its decision rule before running it, keeps every number traceable to a run output, audits from logs and code with a fresh checker, and puts the person at three gates where the artifacts, not a summary, are shown.

Rules with sources, by stage: `references/research-rules.md` (rule ids such as D5 below point into it). Tool: `scripts/ra.py`. Templates: `templates/research/`.

## 0. Setup and intake

1. `SKILL` = this skill's folder. `ra.py` needs Python 3.10+ only.
2. The project: a repository with project-foundations docs (`AGENTS.md`, `docs/RESULTS.md`, `docs/DECISIONS.md`, `docs/RUNS.md`, `docs/WORKLOG.md`). Read its `AGENTS.md` first: its rules on compute, memory and commits bind this loop too. A new idea without a project starts in a scratch folder and moves into a project scaffolded with project-foundations once gate 2 says to pursue it.
3. `python3 SKILL/scripts/ra.py init docs/research/<topic> --entry project|idea|review|paper --question "..."` creates `question.md`, `log.md`, `hypotheses.md`, `plan.md`, `verdict.md`, `decisions.md`. Link out, never copy: the literature folder, run ids, RESULTS sections, DECISIONS entries and the write-up live where the project keeps them.
4. The entry decides where the loop starts:
   - **project**: a question inside an existing project. Start at 1.
   - **idea**: a raw idea. Frame it (1), then the literature stage runs as a novelty check first (literature-research, type `novelty`): "not found in S on D with queries Q", the nearest prior work named (B2, B3).
   - **review**: questions from a write-up's readers (`review/round-N/`) or a referee. Triage each: answered by the text (send it back to research-writing), answerable from the literature (stage 2 only), or needs an analysis (a hypothesis in 3 and an analysis in 4). This is how a reader round becomes costed analyses.
   - **paper**: a paper to reproduce, extend or test in our system. Read it with paper-premark first; its central claim, its methods and the numbers to match become the frame.

## 1. Frame (rules A) → gate 1

Fill `question.md`: the question in one sentence; its type (parameter, mechanism, model comparison, novelty, replication); the **decision it serves** and the result that would change it; the claim type the loop may produce (confirmatory, exploratory or both, A2); what it cannot answer with the data and compute at hand (A6); the budget (person time, tokens, wall clock, compute) and a stop rule per stage (A4).

**Gate 1.** Show `question.md` and ask concrete questions (A5): is this the decision, is the budget right, what is out. Record the answer with `ra.py gate DIR G1 "<the person's words>"`. Nothing is searched or run before it, except reading the project.

## 2. Literature (rules B)

Run the literature-research skill on the framed question, into `docs/literature/<topic>/`; for an idea, as the novelty check. Its fresh checker must have confirmed the rows the hypotheses will rest on (B5). Name the folder in `question.md`. Search for null and contradicting results on purpose and say so when the evidence is mostly positive (B4). When an earlier literature folder already covers the question, reuse it and say what it did not search.

## 3. Hypotheses (rules C) → gate 2

Write `hypotheses.md`: at least three competing hypotheses, including a rival the data could favour and, where it makes sense, a null or baseline (C1). For each: its source (ledger ids or a stated assumption, C3); the result that would reject it and the analysis able to produce that result (C2: drop a hypothesis nothing available can reject); confirmatory or exploratory; for modelling questions, the model space and the comparison criterion fixed now (C6). Rank them by decision value, testability and cost, never by how interesting a model finds them (C4).

**Gate 2.** Show the literature synthesis (the answer, conflicts, gaps, papers not opened; B6) and `hypotheses.md`. The person picks the hypotheses to take forward, or stops the loop because the literature answered it. Record with `ra.py gate DIR G2 "<words>"`. For an idea, this gate also decides whether to scaffold a project.

## 4. Plan (rules D) → gate 3

Write `plan.md`, one analysis per section (A1, A2, ...). Each analysis names the hypotheses it separates and fixes, before any data are seen (D1-D3, D5-D7):
- the data, the splits and the held-out set no selection step may read; the metric; the model or test;
- the **decision rule**: what result supports, what rejects, the threshold;
- the **controls**: a negative control (shuffled or noise input shows no effect) and a positive control (a known effect is recovered); for fitted models, parameter and model recovery (F6);
- the **variants**: the defensible alternatives to run alongside the primary analysis, and whether the answer is the primary path or the spread (D7);
- seeds and repeats; the outputs to be logged;
- the **cost** (compute hours, peak memory, wall clock, tokens, person time) and the **value**: which decision it can change and how likely that is (D4). Run cheap discriminating analyses first.
Write the analysis script first and run it on simulated data where possible (D9).

**Gate 3.** Show `plan.md`, its cost table and the stop rules (D10, H2). The person approves analyses one by one: `ra.py gate DIR G3 "<words>" --approve A1,A3 --drop A2`. Before this gate, only smoke runs that test a script (seconds to minutes, within the project's memory budget). Runs beyond the project's local limits (a sweep, a cluster job, training) need their own yes even inside an approved plan.

## 5. Run (rules E)

Run the approved analyses with the project's own tools; batches of local runs through local-run-queue within the memory budget. Log every run where the project logs runs (RUNS.md, the run's config and provenance) and set the analysis's status in `plan.md` (`running`, `done`, `failed`).
- **A failed run is a result, not a gap.** Report it, fix the cause or stop; never fill it with simulated, placeholder or substituted values (E3).
- Any change to data, splits, metric, threshold, seeds or design after approval is a **deviation**: `ra.py deviation DIR A2 "<what changed, why, before or after seeing any outcome>"` (D8, E4, E10).
- **Escalate at once** (H3, E11): a run fails twice, input data are missing, a result contradicts the plan, cost passes the budget, or you would change the evaluation. Write it into `decisions.md` and ask.

## 6. Verdict and audit (rules F)

Write `verdict.md`, one section per analysis: the result against the decision rule copied from the plan; the controls; the spread across variants (a conclusion that flips across variants is fragile, F2); the number of analyses run, including failed ones (F1); effect sizes with intervals (F8); the nearest rival hypothesis and whether the data separate them (F11). **Every number carries its source**, such as `[outputs/<run>/analysis.json:gosi]` or `[RESULTS §55]`, taken by script, never typed (E2). Nulls and contradictions get the same detail as positive results and go into RESULTS too (F7). Results land in the project: a new RESULTS section per analysis, citing run ids; a DECISIONS entry when a choice follows.

**Audit before any write-up** (E8, G2, G6): a fresh checker that did not run the analyses, from another model family where possible, gets the plan, the deviation log, the logs and code of the runs and `verdict.md`, but not the conversation. It checks every number against the outputs, every verdict against its pre-set rule, and looks for undeclared deviations, substituted data and selection after seeing results. Its report goes in `verify/audit-N.md`; disagreements go to the person.

## 7. Write-up and hand-over (rules G)

Hand `verdict.md`, the plan and the audit to research-writing. Claims are no stronger than the audited evidence; each is tagged confirmatory or exploratory with its conditions (G1); the write-up discloses deviations, failed runs, the number of analyses, and what the agent and the person decided (G3); novelty is "not found in S on D" with the closest prior work named (G4). Describe the work as what it was: an analysis run by an agent under the named gates (G8). Publication, authorship and release are the person's (H5).

## Between gates

Work alone and collect the person's decisions in `decisions.md`, each with its options and a recommendation, so a returning person can answer them in one pass. `ra.py status DIR` shows the stage, the gates passed, the analyses by status and the open decisions. `ra.py check DIR` (exit 1 on a problem) enforces the mechanical rules: at least three hypotheses, each with a rejection result; every analysis with hypotheses, a decision rule, controls, a cost and a value; nothing running or done without a gate-3 approval; every done analysis tied to a run id and a RESULTS section; every number in the verdict sourced. Run it before each gate and before the hand-over.

## Who does each step (a suggestion; the profile and the project override)

| Step | Suggested tier | Why |
|---|---|---|
| 1 Frame, 3 Hypotheses, the gates | deep, here with the person | the question and the competing explanations decide everything after |
| 2 Literature | as literature-research suggests (search on a helper, synthesis deep) | |
| 4 Plan | deep | choosing discriminating analyses and their rules |
| 5 Run | standard; a helper for long scripted batches | the instructions exist by then |
| 6 Audit | standard, another model family, fresh context | the runner sees what it expects |
| 7 Write-up | as research-writing suggests | |

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note research-assistant <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for research-assistant` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass. A gate where the person had to ask for something the artifacts should have shown, or an audit finding the procedure should have prevented, is the best evidence there is.
