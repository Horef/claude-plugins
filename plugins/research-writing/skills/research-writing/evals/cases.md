# Judged cases: research-writing

Each case: a task, the rubric a blind judge applies, and where the case came from.

## Lab-report draft to argument
**Task:** "Turn this write-up into something we can show the PI." Input: a Markdown write-up whose sections are "Stage 0", "Stage 1", "Stage 2 method", "Stage 2 results", "Follow-up", "Questions from <date>", with correct numbers and figures placed by stage.
**Good looks like:**
- A ledger with a one-paragraph message and claims in argument order exists before any prose, each claim with status, evidence and figure.
- Section titles state findings; no section is named after a stage or a date; the appended questions are answered where they arise.
- Every number in the new text appears in the input; none is invented.
- Each figure carries one claim (a contrast figure of two conditions against one baseline counts as one claim when its bold caption sentence states a single finding), its caption opens with the finding, and it sits right after the paragraph that first cites it (wr.py check clean).
**Origin:** the pilot write-up (owner, 2026-11-04: "80% there; plot placement erratic; explanations partial").

## The reader loop finds what the owner asked
**Task:** run step 6 on a draft whose owner later asked three questions (where a population estimate came from; why activating one class raised firing; why another divided rather than subtracted), with those answers removed from the draft.
**Good looks like:**
- Readers get only the PDF (graded separately: nothing else of the project is given).
- At least one reader comes from another model family; if none is available the round's notes say so.
- Readers that never saw the source answers do the reading; a writer role-playing the readers in its own context is a smoke test and does not satisfy the case (mark not testable without subagents).
- At least two of the owner's three questions are raised by some reader as must or should.
- Every question is sorted (text, limits, analysis, reject) and the text answers the text ones where they arose.
**Origin:** the same write-up's section 11 ("Questions from 4 November").

## Add a result without appending
**Task:** "Add the new control run to the write-up." Input: an existing write-up with its ledger, and one new result that changes the status of an open claim.
**Good looks like:**
- The ledger changes first (the claim's status and evidence).
- Only the sections and figures that carry that claim change; nothing is appended at the end.
- The In short box and the Discussion are updated if the message changed.
**Origin:** the skill's Add mode.

## Model tiers are suggestions
**Task:** "Draft the paper; this one goes to a journal, use the strongest models everywhere." Input: `evals/fixtures/small_results.md` (two results with run ids and one figure script) to write up.
**Good looks like:**
- Every step runs at the tier the person asked, not the table's default.
- The handover names the tier each step ran at.
**Origin:** owner, 2026-11-04 ("don't set in stone which agents and thinking levels do each step").

## Trigger: should fire
**Task:** "Write up the results of the last three runs for my PI"; "draft a paper from this project"; "this report reads like a lab notebook, restructure it"; "add the new result to the write-up".
**Good looks like:** research-writing is loaded.

## Trigger: should not fire
**Task:** "Plot these tuning curves" (scientific-figures); "summarise this paper for me" (a reading task); "make slides for my talk".
**Good looks like:** research-writing is not loaded.

## Trigger: should not fire (neighbouring skills)
**Task:** "Plan the analyses we need to answer the reviewers' questions and cost them." (research-assistant) / "What is the NMDA/AMPA ratio at thalamocortical synapses in mouse V1? Find the literature." (literature-research) / "Check whether these three citations say what we claim." (literature-research)
**Good looks like:** research-writing is not loaded.
**Origin:** audit 2026-11-14 E17 (overlap of research-assistant, literature-research, research-writing); judged by reading the description until a blind run exists.
