# Results to write up (fabricated fixture)

Question: does clustering of thalamic inputs on one dendritic branch raise orientation selectivity in a model layer 2/3 cell?

## R1 (run `r-2026-001`)
Clustered inputs give orientation selectivity index (OSI) 0.62; scattered inputs give 0.41 (same synapse count, 200 per cell, 20 seeds each, seeds 1-20). The difference is 0.21 (95% CI 0.15 to 0.27).

## R2 (run `r-2026-002`)
With NMDA conductance removed, the clustered cell's OSI falls to 0.44, close to the scattered case (0.41). Same seeds as R1.

## Figure script
`figures/fig_osi.py` plots OSI for the three conditions (clustered, scattered, clustered without NMDA) as points per seed with the mean.

## Limits
Model cell only; no experiment. Synapse count held fixed; dendrite length not varied.
