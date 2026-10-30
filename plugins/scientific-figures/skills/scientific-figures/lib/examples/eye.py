"""Anatomy component: the eye in horizontal section (procedural, house style)."""
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from sciencefig.svg import Canvas
from sciencefig import style as S, anatomy as An


def draw():
    c = Canvas(640, 360, "r3-eye")
    e = An.eye_section(c, cx=335, cy=170, R=125)
    left = [(e["ciliary"], "Ciliary body\nand zonule"), (e["iris"], "Iris"), (e["cornea"], "Cornea"),
            (e["pupil"], "Pupil"), (e["lens"], "Lens")]
    right = [(e["sclera"], "Sclera"), (e["choroid"], "Choroid"), (e["retina"], "Retina"),
             (e["fovea"], "Fovea"), (e["optic_disc"], "Optic disc\n(blind spot)"),
             (e["optic_nerve"], "Optic nerve")]
    c.callout_column(left, 120, 40, 310, anchor="end", min_gap=12)
    c.callout_column(right, 560, 30, 330, anchor="start", min_gap=12)
    c.callout(330, 342, e["vitreous"], "Vitreous humour", anchor="middle")
    return c
