"""Scripted evals for paper-premark: scripts/validate_marks.py on synthetic extract files (no DEVONthink needed).

Checks that a good spec passes, and that each failure the skill warns about is caught: a string occurring
twice, a missing string, a soft hyphen, a `***` redaction, a string on the wrong page, a phantom (doubled) page,
and that NBSP in the text is normalised. Run: python evals/run.py (exit 1 on any failure).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "validate_marks.py"
BASE = "x-devonthink-item://ABC?page="
PHANTOM = "\n".join(f"Line {i} of the duplicated page text" for i in range(8))
EXTRACT = [
    {"link": BASE + "0", "text": "Neurons were recorded\nin visual cortex of mice.\nSee www.***.org for data.\nThe tuning is imposed on inputs."},
    {"link": BASE + "1", "text": "We\u00a0found that gain\nincreased in all cells.\nA pro\u00adduced effect.\nThe tuning is imposed on inputs.\nUnique closing remark."},
    {"link": BASE + "2", "text": "\n".join(f"{ln}\n{ln}" for ln in PHANTOM.split("\n"))},
]


def run(tmp: Path, marks: list[dict], name: str) -> subprocess.CompletedProcess:
    mf = tmp / f"{name}.json"
    mf.write_text(json.dumps(marks), encoding="utf-8")
    return subprocess.run([sys.executable, str(SCRIPT), str(tmp / "extract.json"), str(mf)], capture_output=True, text=True)


def main() -> int:
    failures = []

    def expect(cond: bool, what: str, proc: subprocess.CompletedProcess | None = None):
        print(("ok   " if cond else "FAIL ") + what)
        if not cond:
            failures.append(what)
            if proc is not None:
                print((proc.stdout + proc.stderr)[-1500:])

    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        (tmp / "extract.json").write_text(json.dumps(EXTRACT), encoding="utf-8")

        good = [
            {"page": 0, "string": "Neurons were recorded\nin visual cortex of mice.", "colour": "green"},
            {"page": 1, "string": "We found that gain\nincreased in all cells.", "colour": "red", "comment": "[RED · result 1]"},
            {"page": 1, "string": "Unique closing remark.", "colour": "yellow"},
            {"string": "recorded\nin visual", "colour": "ref"},
        ]
        p = run(tmp, good, "good")
        expect(p.returncode == 0 and "4/4 marks would match" in p.stdout, "valid spec passes (NBSP normalised, page optional)", p)

        cases = {
            "duplicate on two pages": ({"page": 0, "string": "The tuning is imposed on inputs."}, "occurs 2x in the document"),
            "string not in the text": ({"page": 0, "string": "Nothing like this"}, "not found"),
            "string on the wrong page": ({"page": 0, "string": "Unique closing remark."}, "found on page 1"),
            "soft hyphen in string": ({"page": 1, "string": "A pro\u00adduced effect."}, "soft hyphen"),
            "*** redaction": ({"page": 0, "string": "See www.***.org for data."}, "*** redaction"),
            "page missing from extract": ({"page": 9, "string": "Unique closing remark."}, "not in the extract"),
            "phantom page": ({"page": 2, "string": "Line 3 of the duplicated page text\nLine 3 of the duplicated page text"}, "phantom"),
            "empty string": ({"page": 0, "string": ""}, "empty string"),
        }
        for name, (mark, needle) in cases.items():
            p = run(tmp, [good[2], mark], name.replace(" ", "_"))
            expect(p.returncode == 1 and needle in p.stdout and "1/2 marks would match" in p.stdout, f"fails on {name}", p)

        p = run(tmp, [{"page": 1, "string": "Unique closing remark.", "colour": "red"}] * 9, "red")
        expect("9 red marks" in p.stdout, "warns above 8 red marks")

        # O6: parallel mark_record_text calls on one PDF -> 'saving failed'; a passing run says how to apply.
        p = run(tmp, good, "good_apply")
        last = p.stdout.strip().splitlines()[-1]
        expect(last.startswith("apply: 4 mark_record_text calls") and "one at a time" in last, "passing spec ends with the apply plan (calls one at a time)", p)
        p = run(tmp, [good[2], {"page": 0, "string": "Nothing like this"}], "bad_apply")
        expect("apply:" not in p.stdout, "failing spec prints no apply plan", p)

        (tmp / "bad.json").write_text("{not json", encoding="utf-8")
        p = subprocess.run([sys.executable, str(SCRIPT), str(tmp / "bad.json"), str(tmp / "good.json")], capture_output=True, text=True)
        expect(p.returncode == 2, "unreadable input exits 2", p)

    print(f"\n{len(failures)} failure(s)" if failures else "\nall ok")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
