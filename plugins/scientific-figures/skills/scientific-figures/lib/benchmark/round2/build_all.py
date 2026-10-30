"""Run every round-2 figure script, lint, and save SVGs to benchmark/round2/after/."""
import sys, os, importlib.util
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig import check as C

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["neuron_labeled", "cortical_layers", "hebbian_net", "fi_curve", "autoencoder",
         "activation_surfaces", "t1_diagonalise", "t1_saddle", "t1_tracedet", "t1_ei_spiral",
         "l2_fixedpoints"]


def build():
    out = {}
    os.makedirs(os.path.join(HERE, "after"), exist_ok=True)
    for n in NAMES:
        spec = importlib.util.spec_from_file_location(n, os.path.join(HERE, n + ".py"))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        r = m.draw()
        if isinstance(r, tuple):
            svg, lint = r
        else:
            svg, lint = r.svg(), r.lint()
        probs = lint + C.check_inline(svg)
        print(f"{n:22s} {len(svg)//1000:4d} kB  {'OK' if not probs else probs}")
        open(os.path.join(HERE, "after", n + ".svg"), "w").write(svg)
        out[n] = svg
    return out


if __name__ == "__main__":
    svgs = build()
    if len(sys.argv) > 1:
        C.render(list(svgs.values()), sys.argv[1], names=list(svgs))
