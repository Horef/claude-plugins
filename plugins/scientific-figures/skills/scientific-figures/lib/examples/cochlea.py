"""Anatomy component: tonotopy of the cochlea - the spiral and the uncoiled cochlea
with travelling waves for a high and a low tone."""
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, anatomy as An


def draw():
    c = Canvas(640, 300, "r3-cochlea")
    sp = An.cochlea_spiral(c, 104, 160, r0=14, r1=92, turns=2.5, freqs=(16000, 2000, 250))
    for f, q, (ox, oy) in sp["ticks"]:
        lab = f"{f // 1000} kHz" if f >= 1000 else f"{f} Hz"
        c.text(q[0] + ox * 4, q[1] + oy * 4, lab, size=S.SIZE_SMALL,
               anchor="start" if ox > 0.3 else ("end" if ox < -0.3 else "middle"),
               baseline="middle", color=S.INK2, halo=True)
    c.text(110, 22, "cochlea (top view)", size=S.SIZE, anchor="middle", bold=True)
    u = An.cochlea_unrolled(c, 290, 90, 320, 120, tones=((0.15, S.BLUE), (0.65, S.VERMILION)))
    c.text(440, 22, "uncoiled: basilar membrane", size=S.SIZE, anchor="middle", bold=True)
    c.text(290, 236, "base: stiff, narrow", size=S.SIZE_SMALL, color=S.INK2)
    c.text(610, 80, "apex: floppy, wide", size=S.SIZE_SMALL, anchor="end", color=S.INK2)
    c.callout(300, 48, u["peaks"][0], "high tone peaks near the base", color=S.shade(S.BLUE, .25))
    c.callout(470, 262, (u["peaks"][1][0], u["peaks"][1][1] + 2 * 38.4 + 1), "low tone peaks near the apex",
              color=S.shade(S.VERMILION, .25))
    c.callout(268, 268, u["round"], "round window", anchor="end")
    c.callout(268, 70, u["oval"], "stapes at the\noval window", anchor="end")
    return c
