"""Simulated voltage traces and an f-I curve (exponential integrate-and-fire).

Message: below rheobase a current step only depolarises the neuron; above
it the neuron fires, and the firing rate grows with the current (f-I curve).
Model: exponential integrate-and-fire (simulated, not drawn by hand).
Origin: redrawn from the svg-images-test collection."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from sciencefig import style as S, plot as P

C_m, gL, EL, VT, DT, Vr, Vpk = 200.0, 10.0, -70.0, -50.0, 2.0, -58.0, 0.0   # pF nS mV
DT_MS, T_ON, T_OFF, T_END = 0.05, 100.0, 500.0, 600.0


def simulate(I_pA, t_on=T_ON, t_off=T_OFF, t_end=T_END):
    t = np.arange(0, t_end, DT_MS)
    V = np.empty_like(t); v = EL; spikes = []
    for k, tk in enumerate(t):
        I = I_pA if t_on <= tk < t_off else 0.0
        dv = (-gL * (v - EL) + gL * DT * np.exp((v - VT) / DT) + I) / C_m  # mV/ms (pA/pF)
        v += DT_MS * dv
        if v >= Vpk:
            spikes.append(tk); V[k] = 30.0; v = Vr       # draw the spike to +30 mV
        else:
            V[k] = v
    return t, V, np.array(spikes)


def rate(I_pA):
    _, _, sp = simulate(I_pA, 0, 1000, 1000)
    sp = sp[sp > 200]                                  # steady state
    return 0.0 if len(sp) < 2 else 1000.0 / np.mean(np.diff(sp))


def draw():
    steps = [(160, "subthreshold"), (205, "a few spikes"), (400, "regular firing")]
    cols = [S.tint(S.BLUE, 0.55), S.BLUE, S.shade(S.BLUE, 0.45)]
    fig = P.plt.figure(figsize=(640 / 72, 380 / 72), layout="constrained")
    fig.get_layout_engine().set(w_pad=6 / 72, h_pad=4 / 72, wspace=0.08, hspace=0.02)
    fig._sf_name = "r2-fi"
    gs = fig.add_gridspec(3, 2, width_ratios=[1.35, 1])
    axes = []
    for k, ((I, name), col) in enumerate(zip(steps, cols)):
        t, V, sp = simulate(I)
        ax = fig.add_subplot(gs[k, 0], sharex=axes[0] if axes else None)
        axes.append(ax)
        ax.plot(*P.decimate(t, V, 700), color=col, lw=1.5)
        # the current step is drawn in the SAME axes, just under the trace,
        # so it lines up in time and sits right below the response it causes
        base, hmax = -104, 22                       # mV units used as drawing space
        ts = np.array([0, T_ON, T_ON, T_OFF, T_OFF, T_END])
        Is_ = np.array([0, 0, I, I, 0, 0]) / 400 * hmax + base
        ax.fill_between(ts, base, Is_, color=S.tint(col, .5), lw=0)
        ax.plot(ts, Is_, color=col, lw=1.0)
        ax.set_ylim(base - 2, 35)
        ax.set_yticks([-70, 0]); ax.set_ylabel("$V$ (mV)" if k == 1 else "")
        ax.spines["left"].set_bounds(-75, 35)
        ax.set_title(f"{I} pA: {name}" + (f" ({len(sp)} spikes)" if len(sp) else ""), loc="left",
                     size=S.SIZE_SMALL, color=S.shade(S.BLUE, .3) if k else S.INK2, pad=2)
        P.despine(ax, bottom=True)
        ax.tick_params(labelbottom=False, bottom=False)
    axi = axes[-1]
    P.scale_bar(axi, 400, -112, 100, "100 ms")
    axes[0].text(T_OFF + 8, -88, "current step", size=S.SIZE_SMALL, color=S.INK2, va="center")
    # f-I curve
    axf = fig.add_subplot(gs[:, 1])
    Is = np.linspace(0, 480, 97)
    fs = np.array([rate(I) for I in Is])
    rheo = Is[np.argmax(fs > 0)]
    axf.plot(Is, fs, color=S.INK, lw=S.LW_DATA)
    for (I, _), col in zip(steps, cols):
        axf.plot([I], [rate(I)], "o", ms=8, color=col, mec="white", mew=1.2, zorder=5, clip_on=False)
    P.despine(axf)
    axf.set_xlabel("injected current (pA)"); axf.set_ylabel("firing rate (Hz)")
    axf.set_xlim(0, 480); axf.set_ylim(0, None)
    axf.axvline(rheo, color=S.MUTED, ls=(0, (3, 3)), lw=1)
    axf.text(rheo - 8, fs.max() * 0.62, f"rheobase\n≈ {rheo:.0f} pA", ha="right", va="center",
             size=S.SIZE_SMALL, color=S.INK2)
    axf.set_title("f–I curve", loc="left", size=S.SIZE, color=S.INK)
    lint = P.lint(fig)
    return P.export(fig), lint
