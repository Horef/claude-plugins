#!/usr/bin/env python3
"""Scripted checks of research-writing: wr.py init, check (on a planted-fault fixture), readers, status; build and
pages when LaTeX and poppler are installed (skipped otherwise, and said so)."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

WR = Path(__file__).resolve().parent.parent / "scripts" / "wr.py"


def run(*a):
    return subprocess.run([sys.executable, str(WR), *a], capture_output=True, text=True)


def main() -> int:
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = Path(t) / "w"
        r = run("init", str(d), "--title", "A finding")
        if r.returncode or not (d / "main.tex").exists():
            fails.append("init")
        # a clean small document
        (d / "ledger.md").write_text("# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence | figure |\n"
                                     "|---|---|---|---|---|\n| C1 | X rises | established | R1 | fig:a |\n\n## Out of scope\n")
        body = ("\\section{X rises}\n\\claim{C1}\nX rises with Y (\\figref{fig:a}).\n\n"
                "\\begin{figure}[tbp]\\centering\\rule{2cm}{1cm}\\caption{\\textbf{X rises.} Mean of 3.}"
                "\\label{fig:a}\\end{figure}\n")
        m = (d / "main.tex").read_text()
        start, end = m.index("\\begin{inshort}"), m.index("\\printbibliography")
        (d / "main.tex").write_text(m[:start] + "\\begin{inshort}We found X.\\end{inshort}\n" + body + m[end:])
        r = run("check", str(d))
        if r.returncode != 0:
            fails.append("check on a clean document: " + r.stdout)
        # planted faults: figure before citation, no bold title, unledgered claim, undefined acronym
        bad = body.replace("\\section{X rises}\n\\claim{C1}\nX rises with Y (\\figref{fig:a}).\n\n", "") + \
            "\\claim{C2}\nThe RMP rises (\\figref{fig:a}).\n"
        bad = bad.replace("\\textbf{X rises.} ", "")
        m = (d / "main.tex").read_text()
        s0 = m.index("\\section{X rises}")
        e0 = m.index("\\printbibliography")
        (d / "main.tex").write_text(m[:s0] + bad + m[e0:])
        out = run("check", str(d)).stdout
        for want in ("comes before its first citation", "bold title", "C2", "acronym RMP", "C1 is not carried"):
            if want not in out:
                fails.append(f"check missed: {want}\n{out}")
        if run("status", str(d)).returncode:
            fails.append("status")
        if shutil.which("latexmk") and shutil.which("lualatex"):
            (d / "main.tex").write_text(m)
            r = run("build", str(d))
            if r.returncode != 0:
                fails.append("build: " + r.stdout[-800:])
            elif shutil.which("pdftoppm") and run("pages", str(d)).returncode:
                fails.append("pages")
            if not fails and run("readers", str(d), "--round", "1", "--roles", "pi").returncode:
                fails.append("readers")
        else:
            print("LaTeX not installed: build, pages and readers not checked")
    for f in fails:
        print("FAIL", f)
    print("ok" if not fails else f"{len(fails)} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
