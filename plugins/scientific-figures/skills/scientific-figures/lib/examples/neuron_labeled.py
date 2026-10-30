"""Schematic neuron anatomy with callouts (morph.pyramidal, myelinated axon, synapses).

Origin: redrawn from the svg-images-test collection."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sciencefig.svg import Canvas
from sciencefig import style as S, morph as M, neuro as N


def draw():
    c = Canvas(640, 370, "r2-neuron")
    x, y = 150, 262
    n = M.pyramidal(c, x, y, size=1.1, apical_len=145, seed=11, tuft_depth=3, obliques=2,
                    basal=5, basal_depth=2, axon_len=0)
    ax0 = (x + 10, y + 6)
    ax1 = (500, y + 6)
    c.line(*ax0, ax0[0] + 26, ax0[1], color=S.CELL, width=1.8, tag="axon")
    nodes = M.myelinated_axon(c, (ax0[0] + 26, ax0[1]), ax1, n=6, width=1.8, thick=8, node=8)
    tips = M.terminal_arbor(c, ax1, angle=0, length=24, depth=3, seed=4, spread=0.62)
    # synapses onto the cell
    tgt = M.on_dendrite(n, "apical", 0.78)
    N.synapse_to(c, (34, tgt["y"]), tgt, kind="exc", color=S.EXC, width=1.8)
    c.text(30, tgt["y"] - 10, "excitatory synapse", size=S.SIZE_SMALL, color=S.shade(S.EXC, .2))
    N.synapse_to(c, (34, y - 6), n["soma"], kind="inh", color=S.INH, width=1.8)
    c.text(30, y - 16, "inhibitory synapse", size=S.SIZE_SMALL, color=S.shade(S.INH, .2))
    top = n["trunk_top"]
    c.callout(250, 46, n["tuft"][-3], "Apical tuft")
    c.callout(250, 120, (top[0] + 2, top[1] + 50), "Apical dendrite")
    c.callout(220, 206, (x + 8, y - 6), "Soma (cell body)")
    c.callout(330, 300, (nodes[1][0] + 30, ax1[1] + 4), "Myelin sheath", anchor="middle")
    c.callout(420, 214, nodes[3], "Node of Ranvier", anchor="middle")
    c.callout(250, 345, n["basal"][-2], "Basal dendrites")
    c.callout(560, 340, tips[-3], "Axon terminals", anchor="middle")
    # signal flow
    c.arrow(330, 150, 540, 150, color=S.INK2, width=1.2, head="tri")
    c.text(435, 140, "signal flow: dendrites → soma → axon", size=S.SIZE_SMALL, anchor="middle",
           color=S.INK2)
    return c
