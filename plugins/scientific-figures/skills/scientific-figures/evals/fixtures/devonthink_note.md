# Mutual inhibition between two rate populations

Two firing-rate units $r_1$ and $r_2$ inhibit each other symmetrically with strength $J = 10$ and equal external input $h = 1$:

$$\tau \frac{dr_1}{dt} = -r_1 + g(-J r_2 + h), \qquad \tau \frac{dr_2}{dt} = -r_2 + g(-J r_1 + h)$$

where $g(x) = (1 + e^{-x})^{-1}$ is the logistic gain function.

{{FIG:phase}}

## Reading the phase portrait in words

<!-- TODO: replace with prose describing every element the figure shows -->
