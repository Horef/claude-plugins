---
name: research-assistant
description: "Run a research question through the whole loop with checkpoints: frame it and the decision it serves, review the literature (literature-research), turn findings into competing hypotheses and a costed analysis plan, run the approved analyses (bounded local runs; large compute only on a yes), record results in the project, and write them up (research-writing). Stops for the person at three gates: after framing, after the literature (which hypotheses to test), and before any compute. Starts from a question in a project, a new idea (novelty check first, then a scaffolded project), reviewer questions, or a paper to build on. Use when asked to research, investigate or test an idea end to end, to plan analyses for open questions, or to take a question from literature to results; for a literature question alone use literature-research, for writing alone research-writing."
---

# Research assistant

Use this skill to take one research question from its first statement to results someone can trust: what the literature says, which explanations compete, which analyses would tell them apart, what those cost, what the runs showed, and a write-up. It conducts the loop and hands each stage to the skill that already does it well (literature-research, research-writing, local-run-queue, paper-premark, project-foundations).

**The problem it solves.** AI research agents measurably fill failed runs with simulated results, pick what to report after seeing test scores, call ideas novel after a keyword search, reach opposite conclusions from the same data depending on the analysis path, and write papers that read well while the logs show otherwise (`references/research-rules.md`, "Most important 12", with the numbers). The procedure therefore fixes each analysis and its decision rule before running it, keeps every number traceable to a run output, audits from logs and code with a fresh checker, and puts the person at three gates where the artifacts, not a summary, are shown.

Rules with sources, by stage: `references/research-rules.md` (rule ids such as D5 below point into it). Tool: `scripts/ra.py`. Templates: `templates/research/`.

## 0. Setup and intake

1. `SKILL` = this skill's folder. `ra.py` needs Python 3.10+ only.
2. The project: a repository with project-foundations docs (`AGENTS.md`, `docs/RESULTS.md`, `docs/DECISIONS.md`, `docs/RUNS.md`, `docs/WORKLOG.md`). Read its `AGENTS.md` first: its rules on compute, memory and commits bind this loop too. A new idea without a project starts in a scratch folder (`ra.py init <scratch>/<topic>`) and moves to `docs/research/<topic>/` of a project scaffolded with project-foundations once gate 2 says to pursue it.
3. `python3 SKILL/scripts/ra.py init docs/research/<topic> --entry project|idea|review|paper --question "..." --tag NB` creates `question.md`, `log.md`, `hypotheses.md`, `plan.md`, `verdict.md`, `decisions.md`. The **tag** (2-6 capitals, from the topic: NB for "NMDA bracket") prefixes every id of the question, NB-H1, NB-A1, NB-Q1, so they never read as names the project already uses (a model called H3, a write-up's analysis A2); `init` refuses a tag whose ids already occur in the repository and shows where the tag appears as a word. Each heading is the id and a **short name** (`## NB-H1: fails in the V1 bracket`, at most 8 words; the claim goes in `statement`); status and the gate log print ids with their names, so say "NB-H1 (fails in the V1 bracket)" to the person, never a bare id. A folder made without a tag gets one with `ra.py retag DIR NB`, which renames the ids in headings, id fields and the log (fingerprints stay valid) and lists the prose mentions to fix by hand. Link out, never copy: the literature folder, run ids, RESULTS sections, DECISIONS entries and the write-up live where the project keeps them.
4. The entry decides where the loop starts:
   - **project**: a question inside an existing project. Start at 1.
   - **idea**: a raw idea. Frame it (1); stage 2 runs a novelty check (literature-research, type `novelty`: "not found in S on D with queries Q", the nearest prior work named; B2, B3) and the background search together, before the hypotheses.
   - **review**: questions from a write-up's readers (`review/round-N/`) or a referee. In framing, triage each under "What is already known" in `question.md`: answered by the text (send it back to research-writing), answerable from the literature (stage 2 only), or needs an analysis (a hypothesis in 3 and an analysis in 4 whose title names the question). This is how a reader round becomes costed analyses.
   - **paper**: a paper to reproduce, extend or test in our system. Read it with paper-premark during framing; its central claim, its methods and the numbers to match become the frame.

## 1. Frame (rules A) → gate 1

Fill `question.md`: the question in one sentence; its type (parameter, mechanism, model comparison, novelty, replication); the **decision it serves** and the result that would change it; the claim type the loop may produce (confirmatory, exploratory or both, A2); what it cannot answer with the data and compute at hand (A6); the budget (person time, tokens, wall clock, compute) and a stop rule per stage (A4). Read what the project already has on the question (RESULTS sections, runs, an existing `docs/literature/` folder) and write it under "What is already known", so the plan does not repeat it; then the concrete questions for gate 1.

**Gate 1.** Show `question.md` and ask its questions (A5). Record the answer with `ra.py gate DIR G1 "<the person's words>"`; the gate refuses an unfilled frame. Before it, read the project and its existing literature and papers; search nothing new and run nothing.

## 2. Literature (rules B)

Run the literature-research skill on the framed question, into `docs/literature/<topic>/`; for an idea, as the novelty check. Its fresh checker must have confirmed the rows the hypotheses will rest on (B5). Name the folder in `question.md`. Search for null and contradicting results on purpose and say so when the evidence is mostly positive (B4). When an earlier literature folder already covers the question, reuse it and say what it did not search.

## 3. Hypotheses (rules C) → gate 2

Write `hypotheses.md`: at least three competing hypotheses, including a rival the data could favour and, where it makes sense, a null or baseline (C1). For each: a short name as its heading and the claim in `statement`; its source (ledger ids or a stated assumption, C3); the result that would reject it and the analysis able to produce that result (C2: drop a hypothesis nothing available can reject); confirmatory or exploratory; for modelling questions, the model space and the comparison criterion fixed now (C6). Rank them by decision value, testability and cost, never by how interesting a model finds them (C4).

**Gate 2.** Show the literature synthesis (the answer, conflicts, gaps, papers not opened; B6) and `hypotheses.md`. The person picks the hypotheses to take forward, `ra.py gate DIR G2 "<words>" --select H1,H2 [--drop H3]`, or stops the loop because the literature answered it, `--stop` (the loop then goes to 7 with the literature alone). Before the gate, a hypothesis's `analysis` may name a provisional A-id; after it, only selected hypotheses must point to analyses in the plan. For an idea, this gate also decides whether to scaffold a project.

## 4. Plan (rules D) → gate 3

Write `plan.md`: the stop rules, the cost table, then one analysis per section (A1, A2, ...) for the selected hypotheses only. Each analysis names the hypotheses it separates and fixes, before any data are seen (D1-D3, D5-D7):
- the data, the splits and the held-out set no selection step may read; the metric; the model or test;
- the **decision rule**: what result supports, what rejects, the threshold;
- the **controls**: a negative control (shuffled or noise input shows no effect) and a positive control (a known effect is recovered); for fitted models, parameter and model recovery (F6);
- the **variants**: the defensible alternatives to run alongside the primary analysis, and whether the answer is the primary path or the spread (D7);
- seeds and repeats; the outputs to be logged;
- the **cost** (compute hours, peak memory, wall clock, tokens, person time) and the **value**: which decision it can change and how likely that is (D4). Run cheap discriminating analyses first.
Before the gate, check only what the costs need (that the inputs exist, the time of one short run); scripts are written after approval.

**Gate 3.** Show `plan.md`, its cost table and the stop rules (D10, H2). The person approves analyses one by one: `ra.py gate DIR G3 "<words>" --approve A1,A3 --drop A2`; the gate refuses an analysis with an unfilled field and records a fingerprint of each approved design, so a later change without a deviation is caught. Runs beyond the project's local limits (a sweep, a cluster job, training) need their own yes even inside an approved plan.

## 5. Run (rules E)

Write each approved analysis's script and run it on simulated data with a known answer first where possible (D9). Then run with the project's own tools; batches of local runs through local-run-queue within the memory budget. Log every run where the project logs runs (RUNS.md, the run's config and provenance) and set the analysis's status in `plan.md` (`running`, `done`, `failed`).
- **A failed run is a result, not a gap.** Report it, fix the cause or stop; never fill it with simulated, placeholder or substituted values (E3).
- **Two kinds of change after approval** (D8, E4, E10). An operational one that leaves the evaluation as approved (a crashed seed rerun, a smaller batch) is logged: `ra.py deviation DIR A2 "<what changed, why, before or after seeing any outcome>"`. A change to the evaluation (data, splits, metric, threshold, decision rule, controls) goes to the person first, through `decisions.md`, and is logged as a deviation only after their yes.
- **Side questions and extras** (pilot, 2026-11-09). A literature question that comes up mid-run (is the threshold a sensible one?) runs as its own literature-research folder (`docs/literature/<slug>/`), linked from a `decisions.md` entry; it informs the reading of results, never the pre-set rules. An extra analysis the person asks for after gate 3 is added to `plan.md` with `kind: exploratory` *before it runs* and approved with another `ra.py gate DIR G3 ... --approve`; it has no rule to pass, its verdict starts with `exploratory`, and the write-up says it was not planned before the runs.
- **Escalate at once** (H3, E11): a run fails twice, input data are missing, a result contradicts the plan, cost passes the budget, or you would change the evaluation. Write it into `decisions.md` and ask.

## 6. Verdict and audit (rules F)

Write `verdict.md`, one section per analysis: the result against the decision rule copied from the plan; the controls; the spread across variants (a conclusion that flips across variants is fragile, F2); the number of analyses run, including failed ones (F1); effect sizes with intervals (F8); the nearest rival hypothesis and whether the data separate them (F11). **Every number carries its source** next to it, such as `[outputs/<run>/analysis.json:gosi]` or `[RESULTS §55]`, taken by script, never typed (E2): a few lines that read the output file and print `value [path:key]` for pasting. Nulls and contradictions get the same detail as positive results and go into RESULTS too (F7). Results land in the project: a new RESULTS section per analysis, citing run ids; a DECISIONS entry, drafted for the person, when a choice follows.

**Audit before any write-up** (E8, G2, G6): a fresh checker that did not run the analyses, from another model family where possible, gets the plan, the deviation log, the logs and code of the runs and `verdict.md`, but not the conversation. It checks every number against the outputs, every verdict against its pre-set rule, and looks for undeclared deviations, substituted data and selection after seeing results. `ra.py audit DIR` writes `verify/audit-N.md` with the fields the checker fills (checker, inputs, numbers, rules, deviations, substitutions, selection, status starting with `pass` or `disagreement`, reasons after it); a disagreement goes to the person, and the write-up waits for a `pass`.

## 7. Write-up and hand-over (rules G)

Hand `verdict.md`, the plan and the audit to research-writing: `ra.py handover DIR` prints one draft claim row per verdict (confirmatory or exploratory, condition, evidence) and the counts the write-up must disclose; into an existing write-up this is research-writing's Add mode. When the write-up is revised and pushed, `ra.py close DIR "<write-up path, commit>"` logs it and status reads `closed`; a later gate-3 approval reopens the question. Claims are no stronger than the audited evidence; each is tagged confirmatory or exploratory with its conditions (G1); the write-up discloses deviations, failed runs, the number of analyses, and what the agent and the person decided (G3); novelty is "not found in S on D" with the closest prior work named (G4). Describe the work as what it was: an analysis run by an agent under the named gates (G8). Publication, authorship and release are the person's (H5).

## Between gates

Work alone and collect the person's decisions in `decisions.md`, each with its options and a recommendation, so a returning person can answer them in one pass. `ra.py status DIR` shows the stage, the gates, the analyses by status, the open decisions and the audits. Run `ra.py check DIR` (exit 1 on a problem) before each gate and before the hand-over.

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
