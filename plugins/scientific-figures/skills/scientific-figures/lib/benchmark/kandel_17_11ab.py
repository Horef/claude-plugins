"""Benchmark: Kandel Fig. 17-11 A+B redrawn - lateral inhibition in a relay
nucleus, with the activity profiles aligned under the circuit columns."""
import sys, math
sys.path.insert(0, __file__.rsplit("/benchmark", 1)[0])
import numpy as np
from sciencefig import Canvas, style as S, neuro as N
from sciencefig.svg import Area

W, H = 640, 520
c = Canvas(W, H, "k1711ab")
cols = [150, 240, 330, 420, 510]
pos = np.array([-2, -1, 0, 1, 2])
sig, k, base, gain = 1.0, 0.5, 0.25, 1.6
g = lambda x: np.exp(-x**2 / (2 * sig**2))
recep = lambda x: g(x)
relay = lambda x: gain * (g(x) - k * (g(x - 1) + g(x + 1)))
fire_s = base + 0.75 * recep(pos)          # firing (0..1 scale) of sensory cells
fire_r = base + 0.75 * relay(pos)          # relay cells

# ---- panel a: circuit
c.panel_label(8, 6, "a")
N.stimulus_arrow(c, cols[2], 24, 50)
N.skin(c, 112, 548, 54, depth=24, label="Skin", label_x=100)
Ys, Yr, Yi, Ybot = 104, 188, 262, 318
N.region(c, 112, 150, 436, 150, fill=S.FAINT)
c.lines_of_text(556, 214, ["Relay", "nucleus"], size=S.SIZE_SMALL, color=S.INK2)
for lab, y in (("Sensory neurons", Ys), ("Relay neurons", Yr), ("Inhibitory", Yi - 6), ("interneurons", Yi + 9)):
    c.text(100, y, lab, size=S.SIZE_SMALL, anchor="end", baseline="middle", color=S.INK2)

sens, rel = [], []
for x, fs, fr in zip(cols, fire_s, fire_r):
    sens.append(N.soma(c, x, Ys, r=9, fill=N.activity_color(fs), color=S.EXC))
    rel.append(N.soma(c, x, Yr, r=14, kind="star", fill=N.activity_color(fr), color=S.EXC))
# receptor endings in the skin
for s in sens:
    c.line(s["x"], s["y"] - 9, s["x"], 70, color=S.EXC, width=1.4, tag="dendrite")
# sensory -> relay (excitatory)
for s, r in zip(sens, rel):
    N.synapse_to(c, s["bottom"], r, "exc", color=S.EXC, width=1.6)
# relay outputs and collaterals
for r in rel:
    c.arrow(r["x"], r["y"] + 13, r["x"], Ybot + 14, color=S.EXC, width=1.6, head="tri")
inter = []
for a, b in zip(rel[:-1], rel[1:]):
    xm = (a["x"] + b["x"]) / 2
    inter.append(N.soma(c, xm, Yi, r=8, fill=S.tint(S.INH, 0.25), color=S.INH))
for i, m in enumerate(inter):
    for r in (rel[i], rel[i + 1]):
        # collateral from the relay output axon -> interneuron (excitatory)
        N.synapse_to(c, (r["x"], 236), m, "exc", color=S.EXC, width=1.2, term_size=8)
        # interneuron -> relay neuron (inhibitory)
        start = N.edge_point(m, (r["x"], r["y"] + 8), pad=0)
        N.synapse_to(c, start, r, "inh", color=S.INH, width=1.4, term_size=9)
c.text(cols[-1] + 12, Ybot + 8, "output", size=S.SIZE_SMALL, color=S.INK2, baseline="middle")

# ---- panel b: activity profiles aligned with the columns
c.panel_label(8, 344, "b")
xs = np.linspace(-2.5, 2.5, 161)
for (y0, f, lab1, lab2, fire) in ((352, recep, "Sensory", "neurons", fire_s),
                                    (440, relay, "Relay", "neurons", fire_r)):
    a = Area(c, 105, y0, 450, 64, xlim=(-2.5, 2.5), ylim=(-0.35, 1.05))
    a.fill(xs, f(xs), base=0, pos=S.tint(S.EXC, 0.30), neg=S.tint(S.INH, 0.35))
    a.hline(0, color=S.INK2, width=1.0, dash="4 3")
    a.line(xs, f(xs), color=S.INK, width=1.6, lint=False)
    for p, x, fv in zip(pos, cols, fire):
        c.circle(x, a.Y(f(p)), 4.5, fill=N.activity_color(fv), color=S.EXC, width=1.2, lint=False)
    c.lines_of_text(100, y0 + 26, [lab1, lab2], size=S.SIZE_SMALL, anchor="end", color=S.INK2)
a2 = Area(c, 105, 440, 450, 64, xlim=(-2.5, 2.5), ylim=(-0.35, 1.05))
c.text(560, a2.Y(0) - 2, "baseline", size=S.SIZE_SMALL, color=S.INK2, baseline="middle")
c.text(112, a2.Y(0) - 7, "inhibited flank", size=S.SIZE_SMALL, color=S.shade(S.INH, .2))
c.text(330, 512, "position along the skin  →", size=S.SIZE_SMALL, anchor="middle", color=S.INK2)

if __name__ == "__main__":
    probs = c.lint()
    print("\n".join(probs) or "lint clean")
    open(__file__.replace(".py", ".svg").replace("/benchmark/", "/benchmark/after/"), "w").write(c.svg())
