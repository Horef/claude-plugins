"""Asset plus overlays: primary sensory and motor areas on the lateral surface of the
left hemisphere - a Servier brain outline (assets.place, recoloured gray) with
house-style overlays and callouts."""
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, assets as A

# strips along gyri, in fractional coordinates of the UNFLIPPED drawing
# (anterior is at the right of the original file)
M1 = [(5.42, 0.35), (5.33, 1.5), (5.25, 3.0), (5.38, 4.3), (5.45, 5.1)]       # precentral gyrus
S1 = [(4.42, 0.35), (4.38, 1.5), (4.30, 3.0), (4.36, 4.3), (4.55, 5.2)]       # postcentral gyrus
A1 = [(4.6, 6.15), (5.2, 6.55), (5.8, 6.95)]                                  # superior temporal gyrus
V1 = [(0.28, 5.3), (0.32, 6.4)]                                               # occipital pole


def draw():
    c = Canvas(640, 380, "r3-brain")
    b = A.place(c, A.lib("brain_lateral"), (110, 20, 420, 300), recolor="gray", flip=True)
    at = lambda fx, fy: b["at"](1 - fx / 10, fy / 10)       # flipped: anterior now left
    for pts, col, w in ((M1, S.VERMILION, 15), (S1, S.BLUE, 15), (A1, S.GREEN, 15), (V1, S.PURPLE, 20)):
        P = [at(*p) for p in pts]
        c.polyline(P, color=col, width=w, opacity=0.55, lint=False, tag="area")
    lab = [("Primary motor cortex (M1)", M1[1], S.VERMILION, (20, 40)),
           ("Primary somatosensory\ncortex (S1)", S1[1], S.BLUE, (500, 34)),
           ("Primary auditory cortex (A1),\nmostly hidden in the lateral sulcus", A1[1], S.GREEN, (360, 352)),
           ("Primary visual cortex (V1),\nmostly on the\nmedial surface", V1[1], S.PURPLE, (500, 300))]
    for text, p, col, (tx, ty) in lab:
        c.callout(tx, ty, at(*p), text, color=S.shade(col, .25), line_color=S.shade(col, .1),
                  anchor="end" if tx > 400 and False else "start")
    # orientation
    c.arrow(140, 362, 90, 362, color=S.INK2, width=1.1, head_size=7)
    c.text(146, 362, "anterior", size=S.SIZE_SMALL, baseline="middle", color=S.INK2)
    return c
