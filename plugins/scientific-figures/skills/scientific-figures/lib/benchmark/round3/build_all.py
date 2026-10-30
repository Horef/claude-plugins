"""Build, lint and save all round-3 figures to benchmark/round3/after/."""
import sys, os, importlib.util, warnings
ROOT = __file__.rsplit("/benchmark", 1)[0]
sys.path.insert(0, ROOT)
from sciencefig import check as C

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["neuron_styles", "neuron_illustrated", "cortical_column", "brain_areas", "eye", "retina",
         "cochlea"]


def build():
    out = {}
    os.makedirs(os.path.join(HERE, "after"), exist_ok=True)
    for n in NAMES:
        spec = importlib.util.spec_from_file_location(n, os.path.join(HERE, n + ".py"))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        cv = m.draw()
        svg, lint = cv.svg(), cv.lint()
        probs = lint + C.check_inline(svg)
        print(f"{n:22s} {len(svg)//1000:4d} kB  {'OK' if not probs else probs}")
        open(os.path.join(HERE, "after", n + ".svg"), "w").write(svg)
        out[n] = (svg, getattr(cv, "credits", []))
    return out


if __name__ == "__main__":
    build()
