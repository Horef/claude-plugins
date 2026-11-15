"""Report label boxes that overlap other label boxes in a figure layout (JSON)."""
import json
import sys


def overlap(a, b):
    return a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]


def lint(fig):
    texts = fig.get("texts", [])
    return [f"label {a['s']!r} overlaps label {b['s']!r}" for i, a in enumerate(texts) for b in texts[i + 1:] if overlap(a, b)]


if __name__ == "__main__":
    problems = lint(json.load(open(sys.argv[1])))
    print("\n".join(problems) or "ok")
    sys.exit(1 if problems else 0)
