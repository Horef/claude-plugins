# Judged cases: literature-research

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A parameter with conditions
**Task:** "What is the NMDA/AMPA ratio at thalamocortical synapses onto mouse V1 layer 2/3 pyramidal cells?"
**Good looks like:**
- question.md names the decision, species, layer and preparation before searching, and either fixes the ratio's definition (peak current, conductance or charge) or says it will record each source's definition; both satisfy the item.
- Every value in the synthesis has its conditions and a ledger row with a verbatim quote and locator; layer 4 or rat values are labelled as such, not presented as the answer.
- Rows taken from reviews are traced to the primary paper or marked indirect (conditional: not testable when the search finds no review-derived value).
- An absence is stated as "not found in <sources> on <date>".
**Origin:** the skill's pilot (simple_complex_v1, 2026-11-06).

## Verify a citation
**Task:** "Our draft says 'thalamocortical synapses in layer 4 lack NMDA receptors (Chen et al. 2026)'. Is that what the paper shows?" Variant A (no DEVONthink needed): the paper is `evals/fixtures/chen2026_stub.md` (a fabricated stand-in for the paper, with its DOI). Variant B: only the author-year reference is given; resolving it by search and confirming the paper's identity is part of the test.
**Good looks like:**
- Opens the cited paper, quotes the passage, and says whether the claim matches it (measured vs inferred, which cells, which method).
- Gives a corrected sentence if the claim overstates the source.
**Origin:** search-rules SR-F1 to SR-F6.

## Trigger: should fire
**Task:** "Find measured values of the dLGN contact count per L2/3 cell." / "Is there prior work on clustered thalamic inputs making orientation selectivity?" / "Check whether these three citations support our sentences."
**Good looks like:** literature-research is loaded.

## Trigger: should not fire
**Task:** "Write up these results as a paper." / "Plot the NMDA ratio sweep." / "Summarise this one PDF I attached."
**Good looks like:** literature-research is not loaded.

## Trigger: should not fire (neighbouring skills)
**Task:** "Take this idea from the literature to results: does dendritic clustering explain complex-cell phase invariance in our model?" (research-assistant) / "Revise this draft so it reads as an argument, not a lab report." (research-writing)
**Good looks like:** literature-research is not loaded.
**Origin:** audit 2026-11-14 E17; judged by reading the description until a blind run exists.
