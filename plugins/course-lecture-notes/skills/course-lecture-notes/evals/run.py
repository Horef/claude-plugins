"""Scripted evals for course-lecture-notes: the notes linter (exit 0 pass, 1 fail).

Runs `scripts/lint_notes.py` on `evals/fixtures/good.md` (must be clean: it holds the tricky allowed forms such as
code fences, inline SVG, `\\[2pt]` in a matrix, a derivation chain, references outside blocks) and on
`evals/fixtures/bad.md` (must report exactly the problems listed in EXPECTED_BAD, one per rule at least), and
checks that an unreadable file exits 2. Needs only Python; nothing is written.
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LINT = HERE.parent / "scripts" / "lint_notes.py"

EXPECTED_BAD = {
    ("1.1", 7, "cross-reference"): 2,  # "As above", "See block"
    ("1.1", 8, "cross-reference"): 2,  # "in the figure", "previous block"
    ("1.2", 15, "unicode-math"): 1,
    ("1.3", 22, "single-backslash-display"): 1,
    ("1.3", 26, "missing-where"): 1,
    ("1.3", 47, "missing-where"): 1,
    ("1.4", 50, "missing-separator"): 1,
}
LINE = re.compile(r"^block (\S+) line (\d+): ([a-z-]+): ")


def lint(path):
    p = subprocess.run([sys.executable, str(LINT), str(path)], capture_output=True, text=True, timeout=60)
    return p.returncode, p.stdout.splitlines()


def main() -> int:
    failures = []
    code, out = lint(HERE / "fixtures" / "good.md")
    if code != 0 or out:
        failures.append(f"good.md should be clean, got exit {code}: {out[:3]}")
    code, out = lint(HERE / "fixtures" / "bad.md")
    got = {}
    for line in out:
        m = LINE.match(line)
        if not m:
            failures.append(f"bad.md: unparseable output line: {line}")
            continue
        key = (m.group(1), int(m.group(2)), m.group(3))
        got[key] = got.get(key, 0) + 1
    if code != 1:
        failures.append(f"bad.md should exit 1, got {code}")
    for key in sorted(set(EXPECTED_BAD) | set(got)):
        if EXPECTED_BAD.get(key, 0) != got.get(key, 0):
            failures.append(f"bad.md {key}: expected {EXPECTED_BAD.get(key, 0)}, got {got.get(key, 0)}")
    # Soft position references (grading 2026-11-14): panels, captions, "the lecture's figure"; block 1.2 holds allowed forms.
    code, out = lint(HERE / "fixtures" / "soft-refs.md")
    soft = [l for l in out if l.startswith("block 1.1 ") and ": cross-reference: " in l]
    other = [l for l in out if not l.startswith("block 1.1 ")]
    if code != 1 or len(soft) < 6 or other:
        failures.append(f"soft-refs.md: expected at least 6 cross-reference problems in block 1.1 and none elsewhere, got exit {code}, {len(soft)} in 1.1, other: {other[:3]}")
    # Reading-first glosses (owner preference 2026-11-16): a one-line *(...)* gloss satisfies missing-where; 1.3 has none.
    code, out = lint(HERE / "fixtures" / "gloss.md")
    if code != 1 or out != ["block 1.3 line 41: missing-where: display equation not followed by a symbol gloss '*(...)*' or 'where:'"]:
        failures.append(f"gloss.md: expected exactly one missing-where at block 1.3 line 41, got exit {code}: {out[:3]}")
    code, _ = lint(HERE / "fixtures" / "does-not-exist.md")
    if code != 2:
        failures.append(f"missing file should exit 2, got {code}")
    for f in failures:
        print("FAIL:", f)
    print(f"course-lecture-notes evals: {'FAIL' if failures else 'pass'} (lint_notes.py on 4 fixtures)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
