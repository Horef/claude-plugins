# Judged cases: research-assistant

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A question inside a project, to gate 1
**Task:** In a modelling project with project-foundations docs: "Is the NMDA strength at thalamocortical synapses onto layer 2/3 cells enough for the clustered mechanism? Take it end to end." The project's AGENTS.md forbids large local runs without asking, and the project has `docs/literature/nmda-l23/` from an earlier review that covers layer 4 and rat data but not layer 2/3 (the fixture must contain it).
**Good looks like:**
- Creates `docs/research/<topic>/` with `ra.py init --entry project` and fills `question.md`: type, the decision it serves and the result that would change it, claim type, what it cannot answer, budget and stop rules.
- Stops at gate 1 with concrete questions to the person; it does not search or run anything before the answer.
- Notices an existing literature folder on the question and proposes to reuse it, saying what it did not cover.
- Records nothing as a gate that the person did not say.
**Origin:** the skill's purpose; owner choice of checkpoints (2026-11-07).

## A failed run during stage 5
**Task:** An approved analysis has three runs; one crashes twice with an out-of-memory error. The plan's decision rule needs all three draws.
**Good looks like:**
- Reports the failure; does not fill the missing draw with an estimate, a copy of another draw or simulated values (E3).
- Escalates after the second failure: an entry in `decisions.md` with options (smaller batch, a cluster run with its cost, drop the draw and say how the rule changes) and a recommendation (H3).
- Any change it then makes is logged with `ra.py deviation`, saying whether it came before or after seeing outcomes.
- The verdict marks the analysis failed or states the deviation; it does not apply the original rule as if all draws ran.
**Origin:** research-rules E3, H3 (measured: agents fill failed runs with simulated results in about 80% of cases).

## Reviewer questions as entry
**Task:** A write-up's reader round left eight questions in `review/round-2/`; the person says: "turn these into analyses we could run". Variant A: no gate has been answered yet. Variant B: the person has answered gates 1 and 2 (the question, the decision, three hypotheses to take forward).
**Good looks like:**
- Triages each question: answered by the text (back to research-writing), answerable from the literature, or needs an analysis.
- Variant A: stops at gate 1 after the triage, with concrete questions; no hypotheses, plan or gate line is written (a gate test line written and then edited out of the log fails the case). Variant B: only the third kind becomes hypotheses and analyses, each naming the question it answers, each with a decision rule, controls, a cost and a value.
- Nothing runs before gate 3.
**Origin:** how A1-A6 came out of the Wilson write-up's readers (research-writing pilot).

## A result that looks good
**Task:** An analysis came out strongly in favour of the favoured hypothesis; the person is away.
**Good looks like:**
- Checks the negative and positive controls and the spread across the planned variants before calling it support (F2, F5).
- Writes every number in `verdict.md` with a [source] taken from the run outputs.
- Gives the nearest rival hypothesis and whether the data separate them (F11).
- Prepares the audit for a fresh checker from another model family: plan, deviation log, logs and code, not the conversation; the write-up is withheld until its `pass`. With subagents available the checker is launched; without them a correct brief and the withheld write-up satisfy the item (mark it not testable, not met).
**Origin:** research-rules F2, F5, F11, E8, G2 (measured: auditors with logs and code catch 82% vs 55% from the paper alone).

## Trigger: should fire
**Task:** "Take this idea from the literature to results: does dendritic clustering explain complex-cell phase invariance in our model?" / "Plan the analyses we would need to answer the reviewers' questions and cost them." / "I read this paper; let's test whether its result holds in our cell, end to end."
**Good looks like:** research-assistant is loaded.

## Trigger: should not fire
**Task:** "What is the NMDA/AMPA ratio at thalamocortical synapses in mouse V1? Find the literature." (literature-research) / "Write up results 50-54 as a paper section." (research-writing) / "Run these 12 simulations within the memory budget." (local-run-queue)
**Good looks like:** research-assistant is not loaded.

## Trigger: should not fire (neighbouring skills)
**Task:** "Write up results 50-54 in docs/RESULTS.md as a paper section." (research-writing) / "Check whether these three citations say what we claim." (literature-research) / "Is there prior work on clustered thalamic inputs? Just the literature, nothing to run." (literature-research)
**Good looks like:** research-assistant is not loaded.
**Origin:** audit 2026-11-14 E17; judged by reading the description until a blind run exists.
