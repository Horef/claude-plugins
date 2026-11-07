---
title: Lecture 9 - Two-unit rate model
---

# Lecture 9 - Two-unit rate model

How to use these notes: the lecture map below says "see block 1.2 for the circuit" and "as above"; text outside blocks is not linted.

# Part 1 – The model

### 1.1 Firing-rate unit

A **firing-rate unit** turns its input current into a rate. With input $I$ and gain $g$ the rate is:

$$r = g \cdot I$$

where:
- $r$: output rate (Hz)
- $I$: input current (nA)
- $g$: gain (Hz/nA)

The rate grows in proportion to the input. Example: $g = 10$ Hz/nA and $I = 2$ nA give $r = 20$ Hz. The membrane potential is about $-70$ mV and a pulse lasts $5\ \mu$m of cable per ms; the threshold is $\le 3$ nA.

The literal text `see block 1.2` or `as above` or `α` inside code is not prose, and neither is a fence:

```
see block 2.1, as above, in the figure, β ≤ γ
```

Link targets are not prose either: [slide](x-devonthink-item://ABC?page=3) and a row break in a matrix is fine:

$$\begin{pmatrix} a & b \\[2pt] c & d \end{pmatrix}$$

where:
- $a, b, c, d$: matrix entries (dimensionless)

A 2x2 grid of numbers. Escaped dollar: costs \$5.

---

### 1.2 Decay by steps

The state decays step by step. First step:

$$x_1 = x_0 e^{-t/\tau}$$

substituting the initial value gives the next line:

$$x_1 = 1.0 \cdot e^{-1}$$

so the value after one time constant is:

$$x_1 \approx 0.37$$

where:
- $x_1$: state after one time constant (dimensionless)

The state falls to about a third. Double-backslash display also works: \\[ y = 2x \\]

<svg viewBox="0 0 10 10"><text>see block 3.3, α ≤ β, as above</text></svg>

*Figure 1. Decay is exponential: read the curve from left to right.*

---

# Part 2 – Dynamics

### 2.1 Stability

A fixed point is **stable** when small pushes decay. Next, the notes continue in the same block, which re-states the minimal context itself.

---

## Self-test

1. What does block 1.1 show? (Outside blocks: not linted, see above.)
