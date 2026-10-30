"""Benchmark: Lecture 1 (Intro to sensory systems) figures redrawn with
sciencefig. Run:  python3 benchmark/lecture1.py  -> benchmark/after/*.svg"""
import sys, os
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
import numpy as np
from scipy.stats import norm
from sciencefig import Canvas, style as S, plot as P, flow as F, geom as G, neuro as N

OUT = os.path.join(ROOT, "benchmark", "after")
FIGS = {}


def save(name, svg, problems):
    FIGS[name] = svg
    open(os.path.join(OUT, name + ".svg"), "w").write(svg)
    print(f"{name}: {len(svg)//1000} kB, lint: {problems or 'clean'}")


# ------------------------------------------------------------- 1 pipeline
def fig_pipeline():
    c = Canvas(660, 168, "l1-pipeline")
    stages = [("Stimulus", ["physical energy"]),
              ("Transduction", ["receptor potential", "(graded)"]),
              ("Encoding", ["spike train", "(rate code)"]),
              ("CNS relays", ["relay nuclei", "→ cortex"]),
              ("Perception", ["inferred causes"])]
    bx = F.pipeline(c, 8, 14, stages, gap=24, max_width=644)
    # top-down influences: from perception back to the relays and the periphery
    yb = bx[0]["y"] + bx[0]["h"] + 30
    p, rl, tr = bx[4]["b"], bx[3]["b"], bx[1]["b"]
    col = S.ACCENT2
    c.line(p[0], p[1] + 2, p[0], yb - 8, color=col, width=1.4, dash="5 4", tag="fb")
    c.path(f"M{p[0]} {yb-8} Q{p[0]} {yb} {p[0]-8} {yb} L{tr[0]+8} {yb} Q{tr[0]} {yb} {tr[0]} {yb-8}",
           color=col, width=1.4, dash="5 4", sample_pts=[(p[0], yb), (tr[0], yb)], tag="fb")
    c.arrow(tr[0], yb - 8, tr[0], tr[1] + 2, color=col, width=1.4, dash="5 4")
    c.arrow(rl[0], yb, rl[0], rl[1] + 2, color=col, width=1.4, dash="5 4")
    c.text((tr[0] + rl[0]) / 2, yb + 18, "top-down: feedback, attention, priors",
           size=S.SIZE_SMALL, anchor="middle", color=S.shade(col, .15))
    c.h = yb + 30
    save("l1-pipeline", c.svg(), c.lint())


# ------------------------------------------------------------- 2 adaptation
def fig_adaptation():
    fig, axes = P.figure(640, 250, nrows=2, ncols=2, name="l1-adapt", sharex=True,
                         gridspec_kw=dict(height_ratios=[1, 0.75]))
    t = np.linspace(0, 1.0, 1001)
    on, hold, off = 0.2, 0.3, 0.7   # ramp up 0.2-0.3, hold, ramp down 0.7-0.8
    stim = np.interp(t, [0, on, hold, off, off + 0.1, 1], [0, 0, 1, 1, 0, 0])
    sa_rate = lambda x: 70 * np.interp(x, [0, on, hold, off, off + .1, 1], [0, 0, 1, .75, 0, 0])
    ra_rate = lambda x: 220 * (np.exp(-((x - (on + .05)) / .022) ** 2) + np.exp(-((x - (off + .05)) / .022) ** 2))
    for col, (title, rate, seed) in enumerate((("Slowly adapting (SA)", sa_rate, 3),
                                               ("Rapidly adapting (RA)", ra_rate, 7))):
        ax, axs = axes[0, col], axes[1, col]
        trials = [P.poisson_spikes(rate, 0, 1, seed=seed + k) for k in range(4)]
        P.raster(ax, trials, color=S.ACCENT, lw=1.3)
        ax.set_title(title, size=S.SIZE, loc="left", pad=4)
        P.despine(ax, left=True, bottom=True)
        axs.plot(t, stim, color=S.STIM, lw=2)
        axs.fill_between(t, 0, stim, color=S.FAINT, lw=0)
        P.despine(axs, left=True, bottom=True)
        axs.set_ylim(-0.15, 1.25)
        if col == 0:
            ax.text(-0.02, 1.5, "spikes\n(4 trials)", ha="right", va="center", size=S.SIZE_SMALL,
                    color=S.INK2, transform=ax.transData)
            axs.text(-0.02, 0.5, "pressure", ha="right", va="center", size=S.SIZE_SMALL, color=S.INK2)
        else:
            for tt, lab in ((on + .05, "onset"), (off + .05, "offset")):
                ax.annotate(lab, (tt, -0.5), xytext=(0, -2), textcoords="offset points", ha="center",
                            va="top", size=S.SIZE_SMALL, color=S.INK2, annotation_clip=False)
    P.scale_bar(axes[1, 1], 0.78, -0.12, 0.2, "200 ms")
    probs = P.lint(fig)
    save("l1-adapt", P.export(fig), probs)


# ------------------------------------------------------------- 3 psychometric
def fig_psychometric():
    fig, (a, b) = P.figure(640, 270, ncols=2, name="l1-psycho")
    # a: detection
    x = np.linspace(0, 10, 300)
    thr, sl = 5.0, 1.1
    a.plot(x, norm.cdf(x, thr, sl), color=S.ACCENT)
    a.set_xlim(0, 10); a.set_ylim(0, 1.04)
    a.set_yticks([0, .5, 1], ["0", "50%", "100%"])
    a.set_xticks([0, 5, 10])
    a.set_xlabel("stimulus intensity")
    a.set_ylabel("P(“yes, I detected it”)")
    P.drop_lines(a, thr, 0.5)
    P.point_label(a, thr, 0.5, "detection threshold", dx=8, dy=-4, va="top")
    a.set_title("Detection", loc="left")
    # b: discrimination
    x = np.linspace(6, 14, 300)
    ref, jnd = 10, 2.0
    sd = jnd / norm.ppf(0.75)
    b.plot(x, norm.cdf(x, ref, sd), color=S.ACCENT)
    b.set_xlim(6, 14); b.set_ylim(0, 1.04)
    b.set_yticks([0, .5, .75, 1], ["0", "50%", "75%", "100%"])
    b.set_xticks([6, 8, 10, 12, 14])
    b.set_xlabel("comparison intensity (reference = 10)")
    b.set_ylabel("P(“comparison is stronger”)")
    P.drop_lines(b, ref, 0.5)
    P.drop_lines(b, ref + jnd, 0.75)
    P.hbracket(b, ref, ref + jnd, 0.12, "JND = 2")
    b.set_title("Discrimination", loc="left")
    probs = P.lint(fig)
    save("l1-psycho", P.export(fig), probs)


# ------------------------------------------------------------- 4 SDT + ROC
def fig_sdt():
    fig, (a, b) = P.figure(640, 290, ncols=2, name="l1-sdt",
                           gridspec_kw=dict(width_ratios=[1.55, 1]))
    x = np.linspace(-3.5, 5.5, 500)
    dp, crit = 2.0, 1.2
    n, s = norm.pdf(x, 0, 1), norm.pdf(x, dp, 1)
    m = x >= crit
    a.fill_between(x[m], 0, s[m], color=S.tint(S.BLUE, .35), lw=0)
    a.fill_between(x[m], 0, n[m], color=S.tint(S.VERMILION, .45), lw=0)
    a.plot(x, n, color=S.MUTED, label="noise")
    a.plot(x, s, color=S.BLUE, label="signal + noise")
    a.plot([crit, crit], [0, 0.445], color=S.INK, lw=1.4)
    a.set_ylim(0, 0.6); a.set_xlim(-3.5, 5.5)
    P.despine(a, left=True)
    a.set_xticks([0, dp], ["noise mean", "signal mean"])
    a.set_xlabel("internal response")
    P.end_label(a, -1.2, norm.pdf(-1.2), "noise", S.MUTED, dx=-4, ha="right", va="bottom")
    P.end_label(a, 2.9, norm.pdf(2.9, dp), "signal + noise", S.BLUE, dx=5, va="bottom")
    a.annotate("criterion: above it, say “yes”", (crit, 0.445), xytext=(0, 3),
               textcoords="offset points", ha="center", va="bottom", size=S.SIZE_SMALL)
    P.point_label(a, 2.55, 0.2, "hits", dx=0, dy=0, ha="center", va="center",
                  color=S.shade(S.BLUE, .35), halo=False)
    a.annotate("false alarms", (1.75, 0.035), xytext=(3.55, 0.135), textcoords="data",
               ha="left", va="bottom", size=S.SIZE_SMALL, color=S.shade(S.VERMILION, .2),
               arrowprops=dict(arrowstyle="-", color=S.INK2, lw=0.8, shrinkA=2, shrinkB=0))
    P.hbracket(a, 0, dp, 0.545, "d′ = 2")
    a.set_title("Signal detection model", loc="left")
    # ROC
    fa = np.linspace(0, 1, 400)
    for d, col, lw in ((2, S.BLUE, 2.4), (1, S.MUTED, 1.6), (0, S.MUTED, 1.0)):
        hit = norm.sf(norm.isf(np.clip(fa, 1e-9, 1 - 1e-9)) - d)
        ls = (0, (3, 3)) if d == 0 else "-"
        b.plot(fa, hit, color=col, lw=lw, ls=ls)
    b.set_aspect("equal"); b.set_xlim(0, 1); b.set_ylim(0, 1)
    b.set_xticks([0, .5, 1], ["0", "0.5", "1"]); b.set_yticks([0, .5, 1], ["0", "0.5", "1"])
    b.set_xlabel("false-alarm rate"); b.set_ylabel("hit rate")
    pf, ph = norm.sf(crit), norm.sf(crit - dp)
    b.plot(pf, ph, "o", color=S.INK, ms=7, mec="white", mew=1.5, zorder=5)
    P.point_label(b, pf, ph, "criterion in\nleft panel", dx=8, dy=-8, va="top", size=S.SIZE_SMALL)
    roc = lambda f, d: norm.sf(norm.isf(f) - d)
    b.text(0.06, 0.93, "d′ = 2", color=S.shade(S.BLUE, .15), size=S.SIZE_SMALL)
    P.point_label(b, 0.5, roc(0.5, 1), "d′ = 1", dx=4, dy=-6, va="top", color=S.INK2, halo=False)
    P.point_label(b, 0.62, 0.62, "d′ = 0", dx=4, dy=-6, va="top", color=S.INK2, halo=False)
    b.set_title("ROC curves", loc="left")
    probs = P.lint(fig)
    save("l1-sdt", P.export(fig), probs)


# ------------------------------------------------------------- shared: photopigment template
def govardovskii(lam, lmax):
    """Govardovskii et al. (2000) A1 visual-pigment template, peak = 1."""
    x = lmax / lam
    a = 0.8795 + 0.0459 * np.exp(-(lmax - 300) ** 2 / 11940)
    alpha = 1 / (np.exp(69.7 * (a - x)) + np.exp(28 * (0.922 - x)) + np.exp(-14.9 * (1.104 - x)) + 0.674)
    lmb, bb = 189 + 0.315 * lmax, -40.5 + 0.195 * lmax
    beta = 0.26 * np.exp(-((lam - lmb) / bb) ** 2)
    s = alpha + beta
    return s / s.max()


def wavelength_rgb(w):
    """Approximate display colour of a wavelength (Bruton), for the spectrum bar."""
    if w < 440: r, g, b = -(w - 440) / 60, 0, 1
    elif w < 490: r, g, b = 0, (w - 440) / 50, 1
    elif w < 510: r, g, b = 0, 1, -(w - 510) / 20
    elif w < 580: r, g, b = (w - 510) / 70, 1, 0
    elif w < 645: r, g, b = 1, -(w - 645) / 65, 0
    else: r, g, b = 1, 0, 0
    f = 0.3 + 0.7 * (w - 380) / 40 if w < 420 else (0.3 + 0.7 * (700 - w) / 55 if w > 645 else 1)
    return (r * f, g * f, b * f)


PEAKS = dict(S=437, rod=498, M=533, L=564)
COL = dict(S=S.BLUE, rod=S.INK2, M=S.GREEN, L=S.VERMILION)


# ------------------------------------------------------------- 5 cone spectra
def fig_cones():
    from matplotlib.collections import PatchCollection
    from matplotlib.patches import Rectangle
    fig, ax = P.figure(560, 290, name="l1-cones")
    lam = np.linspace(380, 700, 641)
    for k in ("S", "rod", "M", "L"):
        ax.plot(lam, govardovskii(lam, PEAKS[k]), color=COL[k],
                lw=1.6 if k == "rod" else 2.2, ls=(0, (4, 2.5)) if k == "rod" else "-", label=k)
    ax.set_xlim(380, 700); ax.set_ylim(-0.13, 1.17)
    ax.set_yticks([0, 0.5, 1]); ax.set_xticks([400, 450, 500, 550, 600, 650, 700])
    P.range_frame(ax, y=[0, 1])
    ax.spines["bottom"].set_position(("data", -0.13))
    ax.set_xlabel("wavelength (nm)"); ax.set_ylabel("relative absorbance")
    # visible spectrum strip just above the axis = the x scale shown as colour
    rects = [Rectangle((w, -0.105), 2.6, 0.06) for w in np.arange(380, 700, 2.5)]
    ax.add_collection(PatchCollection(rects, facecolors=[wavelength_rgb(w + 1.25) for w in np.arange(380, 700, 2.5)],
                                      edgecolors="none"))
    lab = dict(S=("S 437", 0, "center"), rod=("rod 498", 0, "center"),
               M=("M 533", 0, "center"), L=("L 564", 0, "center"))
    for k, (t, dx, ha) in lab.items():
        a = ax.annotate(t, (PEAKS[k], 1), xytext=(dx, 5), textcoords="offset points", ha=ha, va="bottom",
                        size=S.SIZE_SMALL, color=S.shade(COL[k], .15) if k != "rod" else S.INK2)
    probs = P.lint(fig)
    save("l1-cones", P.export(fig), probs)


# ------------------------------------------------------------- 6 receptive-field sampling (Nyquist)
def fig_rf():
    fig, axes = P.figure(640, 320, nrows=2, name="l1-rf", sharex=True)
    x = np.linspace(0, 12, 360)
    sig = 0.5
    width = 4 * sig            # RF "width" = +-2 sigma
    for ax, spacing, title in ((axes[0], 1.5 * width, "Under-sampled: spacing 1.5 × RF width → gaps"),
                               (axes[1], width / 2, "Nyquist: spacing ½ × RF width → even coverage")):
        centers = np.arange(1.0, 11.6, spacing)
        rfs = [np.exp(-(x - c) ** 2 / (2 * sig ** 2)) for c in centers]
        cover = np.max(rfs, axis=0)
        ax.fill_between(x, 0, cover, color=S.tint(S.BLUE, .18), lw=0)
        for r in rfs:
            ax.plot(x, r, color=S.BLUE, lw=1.4)
        ax.plot(centers, np.zeros_like(centers) - 0.12, "|", color=S.INK, ms=7, mew=1.4, clip_on=False)
        ax.set_ylim(-0.2, 1.5); ax.set_xlim(0, 12)
        P.despine(ax, left=True, bottom=True)
        ax.set_title(title, loc="left", size=S.SIZE)
        c0 = centers[2]
        P.hbracket(ax, c0 - width / 2, c0 + width / 2, 1.12, "RF width")
    # a point stimulus in the gap of the sparse array
    gap_x = 1.0 + 1.5 * width / 2
    axes[0].annotate("stimulus here is missed", (gap_x, 0.02), xytext=(gap_x, 1.12),
                     textcoords="data", ha="center", va="bottom", size=S.SIZE_SMALL, color=S.VERMILION,
                     arrowprops=dict(arrowstyle="-|>", color=S.VERMILION, lw=1.2, shrinkA=2, shrinkB=0))
    axes[1].annotate("receptor centres", (11.0, -0.12), xytext=(8, 0), textcoords="offset points",
                     ha="left", va="center", size=S.SIZE_SMALL, color=S.INK2, annotation_clip=False)
    probs = P.lint(fig)
    save("l1-rf", P.export(fig), probs)


# ------------------------------------------------------------- 7 colour as a vector (math diagram)
def fig_colorvec():
    fig, ax = P.figure(400, 330, name="l1-colorvec", layout=None)
    ax.set_position([0.08, 0.12, 0.84, 0.84])
    grid = np.linspace(380, 700, 3201)
    L = lambda w: np.interp(w, grid, govardovskii(grid, PEAKS["L"]))
    M = lambda w: np.interp(w, grid, govardovskii(grid, PEAKS["M"]))
    G.plane(ax, (-0.08, 1.25), (-0.08, 1.12), xlabel="L-cone response", ylabel="M-cone response")
    v600 = np.array([L(600), M(600)])
    v520 = np.array([L(520), M(520)])
    G.vector(ax, (0, 0), v600, S.VERMILION, "600 nm, bright", label_at=0.98, label_offset=(4, -2), va="top")
    G.vector(ax, (0, 0), 0.5 * v600, S.tint(S.VERMILION, .55), "same light, dim", label_at=0.75,
             label_offset=(6, -6), va="top", lw=2.4)
    G.vector(ax, (0, 0), v520, S.GREEN, "520 nm", label_at=1.0, label_offset=(-4, 4), ha="right")
    G.angle_arc(ax, (0, 0), v600, v520, r=0.28, label="θ", label_r=1.3)
    ax.text(1.22, 1.1, "direction θ = hue\nlength = brightness", size=S.SIZE_SMALL, color=S.INK2,
            va="top", ha="right")
    probs = P.lint(fig)
    save("l1-colorvec", P.export(fig), probs)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1:] or ["pipeline", "adaptation", "psychometric", "sdt", "cones", "rf", "colorvec"]
    for w in which:
        globals()["fig_" + w]()
    from sciencefig import check as C
    C.render(list(FIGS.values()), "/home/claude/work/l1.png", names=list(FIGS))
