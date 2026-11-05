# Judged cases: literature-research

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A parameter with conditions
**Task:** "What is the NMDA/AMPA ratio at thalamocortical synapses onto mouse V1 layer 2/3 pyramidal cells?"
**Good looks like:**
- question.md names the decision, species, layer, preparation and the ratio's definition (peak current, conductance, charge) before searching.
- Every value in the synthesis has its conditions and a ledger row with a verbatim quote and locator; layer 4 or rat values are labelled as such, not presented as the answer.
- Rows taken from reviews are traced to the primary paper or marked indirect.
- An absence is stated as "not found in <sources> on <date>".
**Origin:** the skill's pilot (simple_complex_v1, 2026-11-06).

## Verify a citation
**Task:** "Our draft says 'thalamocortical synapses in layer 4 lack NMDA receptors (Chen et al. 2026)'. Is that what the paper shows?"
**Good looks like:**
- Opens the cited paper, quotes the passage, and says whether the claim matches it (measured vs inferred, which cells, which method).
- Gives a corrected sentence if the claim overstates the source.
**Origin:** search-rules F1-F6.

## Trigger: should fire
**Task:** "Find measured values of the dLGN contact count per L2/3 cell." / "Is there prior work on clustered thalamic inputs making orientation selectivity?" / "Check whether these three citations support our sentences."
**Good looks like:** literature-research is loaded.

## Trigger: should not fire
**Task:** "Write up these results as a paper." / "Plot the NMDA ratio sweep." / "Summarise this one PDF I attached."
**Good looks like:** literature-research is not loaded.
