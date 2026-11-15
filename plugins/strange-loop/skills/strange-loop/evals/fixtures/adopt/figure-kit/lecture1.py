"""Draw the figures of Neuro101 lecture 1 into the course notes folder."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "lib"))
from shapes import neuron, svg, synapse  # noqa: E402

OUT = Path.home() / "Notes" / "Neuro101" / "lecture1" / "figures"
FIGS = {
    "fig1_single_neuron": [neuron(100, 50)],
    "fig2_excitatory_pair": [neuron(50, 50), neuron(150, 50), synapse((58, 50), (142, 50))],
    "fig3_inhibitory_pair": [neuron(50, 50, "inh"), neuron(150, 50), synapse((58, 50), (142, 50))],
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, parts in FIGS.items():
        (OUT / f"{name}.svg").write_text(svg(parts))
    print(f"wrote {len(FIGS)} figures to {OUT}")
