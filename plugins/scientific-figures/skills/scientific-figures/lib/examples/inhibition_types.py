"""Small multiples of a circuit: three types of inhibition in a relay nucleus as three
identical circuits that differ in ONE edge (the interneuron's driver), drawn in emphasis.

Origin: redrawn from Kandel et al., Principles of Neural Science, Fig. 17-11 C."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig import Canvas, style as S, neuro as N

def draw():
    W, H = 640, 292
    c = Canvas(W, H, "k1711c")
    CTX = S.MUTED           # context wiring
    panels = [("1  Feed-forward", "driven by the sensory input"),
              ("2  Feedback", "driven by the relay output"),
              ("3  Descending", "driven by the cortex")]
    for i, (title, sub) in enumerate(panels):
        x0 = 8 + i * 212
        c.text(x0, 18, title, size=S.SIZE, bold=True)
        c.text(x0, 36, sub, size=S.SIZE_SMALL, color=S.INK2)
        N.region(c, x0, 58, 196, 170, fill=S.FAINT)
        rx, ry = x0 + 66, 150
        ix, iy = x0 + 138, 182
        relay = N.soma(c, rx, ry, r=14, kind="star", fill="#fff", color=CTX)
        inter = N.soma(c, ix, iy, r=9, fill=S.tint(S.INH, .25), color=S.INH)
        # sensory input from below, output upward
        c.arrow(rx, 262, rx, ry + 17, color=CTX, width=1.4, head="tri", head_size=8)
        c.arrow(rx, ry - 13, rx, 66, color=CTX, width=1.4, head="tri", head_size=8)
        # inhibitory synapse onto the relay neuron (same in all three)
        N.connect(c, inter, relay, kind="inh", color=S.INH, width=1.6)
        # the one edge that differs
        if i == 0:
            N.synapse_to(c, (rx, 232), inter, "exc", color=S.EXC, width=2.4, via=[(ix, 232)])
        elif i == 1:
            N.synapse_to(c, (rx, 104), inter, "exc", color=S.EXC, width=2.4, via=[(ix, 104)])
        else:
            N.synapse_to(c, (x0 + 186, 66), inter, "exc", color=S.EXC, width=2.4,
                         via=[(x0 + 186, iy)])
        if i == 0:
            c.text(rx, 280, "sensory input", size=S.SIZE_SMALL, anchor="middle", color=S.INK2)
            c.text(rx + 8, 74, "output", size=S.SIZE_SMALL, color=S.INK2, baseline="middle")
    c.text(8 + 2 * 212 + 180, 66, "from", size=S.SIZE_SMALL, anchor="end", color=S.INK2, baseline="hanging")
    c.text(8 + 2 * 212 + 180, 80, "cortex", size=S.SIZE_SMALL, anchor="end", color=S.INK2, baseline="hanging")
    # shared key, once, as direct labels on panel 1
    c.text(8 + 66 - 20, 150, "relay", size=S.SIZE_SMALL, anchor="end", baseline="middle", color=S.INK2)
    c.text(8 + 66 - 20, 165, "neuron", size=S.SIZE_SMALL, anchor="end", baseline="middle", color=S.INK2)
    c.text(8 + 138, 150, "inhibitory", size=S.SIZE_SMALL, anchor="middle", color=S.shade(S.INH, .2))
    c.text(8 + 138, 164, "interneuron", size=S.SIZE_SMALL, anchor="middle", color=S.shade(S.INH, .2))
    return c


if __name__ == "__main__":
    print("\n".join(draw().lint()) or "lint clean")
