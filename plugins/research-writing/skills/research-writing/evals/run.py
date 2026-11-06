#!/usr/bin/env python3
"""Scripted checks of research-writing: wr.py init, check (on a planted-fault fixture), readers, status; build and
pages when LaTeX and poppler are installed (skipped otherwise, and said so)."""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

WR = Path(__file__).resolve().parent.parent / "scripts" / "wr.py"


def run(*a):
    return subprocess.run([sys.executable, str(WR), *a], capture_output=True, text=True)


def tiny_pdf(path: Path, texts: list[str], w: int = 200, h: int = 100) -> None:
    """A one-page PDF with the given strings, enough for pdftotext and pdfinfo."""
    stream = "BT /F1 10 Tf " + " ".join(f"1 0 0 1 10 {90 - 12 * k} Tm ({t}) Tj" for k, t in enumerate(texts)) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Contents 4 0 R "
            "/Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offs = "%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offs)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n"
    path.write_text(out, encoding="latin-1")


def new_checks() -> list[str]:
    """Condition column, figure heights, figure numbers vs text, Status line of the reader briefs."""
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = Path(t) / "w"
        run("init", str(d))
        (d / "figures").mkdir(exist_ok=True)
        tiny_pdf(d / "figures" / "a.pdf", ["0.5", "1.0", "1.5", "0.34 mean", "7.25 peak"], 200, 100)
        (d / "ledger.md").write_text(
            "# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence | figure | condition |\n"
            "|---|---|---|---|---|---|\n| C1 | X rises | established | R1 | fig:a | 2x NMDA |\n"
            "| C2 | Y falls | plausible | R2 | none | |\n\n## Out of scope\n")
        body = ("\\section{X rises}\n\\claim{C1}\nX rises to 0.35 (\\figref{fig:a}) and peaks at 7.25.\n\\claim{C2}\n\n"
                "\\begin{figure}[tbp]\\centering\\includegraphics[width=0.9\\textwidth]{figures/a.pdf}"
                "\\caption{\\textbf{X rises.} Mean of 3.}\\label{fig:a}\\end{figure}\n"
                "\\begin{figure}[tbp]\\centering\\includegraphics[height=0.4\\textheight]{figures/a.pdf}"
                "\\caption{\\textbf{Again.} Same.}\\label{fig:b}\\end{figure}\n")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m[:m.index("\\begin{inshort}")] + "\\begin{inshort}We found X.\\end{inshort}\n" + body
                                    + m[m.index("\\printbibliography"):])
        out = run("check", str(d)).stdout
        if "C2: no condition" not in out or "C1: no condition" in out:
            fails.append("condition check:\n" + out)
        if shutil.which("pdfinfo"):
            if "fig:a: 0.29 of the text height\n" not in out:
                fails.append("height from width and aspect ratio:\n" + out)
            if "fig:b: 0.40" not in out:
                fails.append("height from height=:\n" + out)
        if shutil.which("pdftotext"):
            if "figure shows 0.34, the text near it says 0.35" not in out:
                fails.append("figure number vs text:\n" + out)
            if "7.25" in out or "1.0, the text" in out or "0.5, the text" in out:
                fails.append("noise: equal number or axis ticks reported:\n" + out)
        # a tall figure goes over the budget
        mm = (d / "main.tex").read_text().replace("height=0.4\\textheight", "height=0.8\\textheight")
        (d / "main.tex").write_text(mm)
        if "fig:b: 0.80 of the text height  over the" not in run("check", str(d)).stdout:
            fails.append("height budget not flagged")
        # reader briefs start with a Status line docmap accepts
        (d / "build").mkdir(exist_ok=True)
        (d / "build" / "main.pdf").write_text("%PDF")
        run("readers", str(d), "--round", "1", "--roles", "pi")
        brief = (d / "review" / "round-1" / "brief-pi.md").read_text()
        if not re.match(r"Status: historical \(\d{4}-\d{2}-\d{2}\)\n", brief) or brief.count("Status: historical") != 2:
            fails.append("brief Status lines:\n" + brief[:300])
    return fails


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
    fails += new_checks()
    for f in fails:
        print("FAIL", f)
    print("ok" if not fails else f"{len(fails)} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
