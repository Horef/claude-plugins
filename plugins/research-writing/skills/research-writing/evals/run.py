#!/usr/bin/env python3
"""Scripted checks of research-writing: wr.py init, check (on a planted-fault fixture), readers, status; build and
pages when LaTeX and poppler are installed (skipped otherwise, and said so)."""
import json
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


def reader_checks() -> list[str]:
    """0.6.1: status counts open question rows in the SKILL's table (status in the 5th column, O17); a reader role
    without a description is refused unless given one."""
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = Path(t) / "w"
        run("init", str(d))
        (d / "ledger.md").write_text("# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence |"
                                     " figure | condition |\n|---|---|---|---|---|---|\n| C1 | X rises | established | r | "
                                     "fig:a | all |\n")
        (d / "review" / "questions.md").write_text(
            "# Questions\n\n| id | theme | raised by | outcome | status |\n|---|---|---|---|---|\n"
            "| R1.1 | term undefined | pi, newcomer | text | open |\n"
            "| R1.2 | missing control | reviewer | analysis | done / open (analysis) |\n"
            "| R1.3 | title too broad | pi | text | Done |\n"
            "| R1.4 | wording | editor | text | open |\n")
        out = run("status", str(d)).stdout
        if "review/questions.md: 3 open" not in out:
            fails.append("status misses open reader questions (O17):\n" + out)
        (d / "build").mkdir(exist_ok=True)
        (d / "build" / "main.pdf").write_text("%PDF")
        r = run("readers", str(d), "--round", "1", "--roles", "pi,reviewer2")
        if r.returncode != 1 or "reviewer2" not in r.stdout or (d / "review" / "round-1" / "brief-reviewer2.md").exists():
            fails.append("an unknown reader role was accepted without a description:\n" + r.stdout)
        r = run("readers", str(d), "--round", "1", "--roles", "pi,reviewer2", "--role",
                "reviewer2=a referee for a neuroscience journal, hostile to modelling claims")
        brief = d / "review" / "round-1" / "brief-reviewer2.md"
        if r.returncode != 0 or not brief.exists() or "hostile to modelling claims" not in brief.read_text():
            fails.append("--role NAME=DESCRIPTION not used:\n" + r.stdout)
    return fails


def rect_pdf(path: Path, x0: int, y0: int, x1: int, y1: int, w: int = 200, h: int = 100) -> None:
    """A one-page PDF with one black filled rectangle (a stand-in for a drawing that may run past the canvas)."""
    stream = f"0 g {x0} {y0} {x1 - x0} {y1 - y0} re f"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Contents 4 0 R >>",
            f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream"]
    out, offs = "%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offs)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n"
    path.write_text(out, encoding="latin-1")


def colour_checks() -> list[str]:
    """A figure drawn in grey only is noted when another figure uses colour; a \\figref inside a caption builds."""
    import sys as _s
    _s.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    import wr
    fails = []
    if not shutil.which("pdftoppm"):
        print("pdftoppm missing: colour check not run")
        return fails
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "figures").mkdir()
        rect_pdf(d / "figures" / "grey.pdf", 20, 20, 120, 80)
        col = (d / "figures" / "red.pdf")
        rect_pdf(col, 20, 20, 120, 80)
        col.write_text(col.read_text(encoding="latin-1").replace("0 g 20 20", "1 0 0 rg 20 20").replace(
            "/Length 18", "/Length 24"), encoding="latin-1")
        fig = lambda f, lab: ("\\begin{figure}\\includegraphics{figures/%s.pdf}\\caption{\\textbf{T.}}\\label{%s}"
                              "\\end{figure}" % (f, lab))
        got = wr.grey_figures(d, [fig("grey", "fig:g"), fig("red", "fig:r")])
        if len(got) != 1 or not got[0].startswith("fig:g:"):
            fails.append(f"grey figure not noted (or colour one noted): {got}")
        if wr.grey_figures(d, [fig("grey", "fig:g")]):
            fails.append("a write-up with no colour figure at all should not be noted")
    if shutil.which("latexmk") and shutil.which("lualatex"):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t) / "w"
            run("init", str(d), "--title", "T")
            m = (d / "main.tex").read_text()
            i = m.index("\\begin{document}") + len("\\begin{document}")
            body = ("\n\\section{T}\nSee \\figref{fig:a}.\n\\begin{figure}[h]\\centering\\rule{1cm}{1cm}"
                    "\\caption{\\textbf{A.} Compare \\figref{fig:b}.}\\label{fig:a}\\end{figure}\n"
                    "\\begin{figure}[h]\\centering\\rule{1cm}{1cm}\\caption{\\textbf{B.}}\\label{fig:b}\\end{figure}\n")
            j = m.index("\\end{document}")
            (d / "main.tex").write_text(m[:i] + body + m[j:])
            if run("build", str(d)).returncode:
                fails.append("a \\figref inside a caption does not build")
    return fails


def source_checks() -> list[str]:
    """Owner preference (2026-11-09): 'measured', 'reported', ... without a citation in the sentence are noted."""
    import sys as _s
    _s.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    import wr
    body = ("The ratio is within the measured range. Kloc and Maffei measured 0.27 \\parencite{KM}. "
            "We measured the cell at 2x. Smith's model has a known decay of 20 ms.")
    got = wr.unsourced_sentences(body)
    want = ["The ratio is within the measured range.", "Smith's model has a known decay of 20 ms."]
    return [] if got == want else [f"unsourced sentences: {got}"]


def edge_checks() -> list[str]:
    """A figure whose drawing reaches its bottom edge (rows cut off, the Mel write-up's Fig. 7) is a problem; one with
    a margin is not."""
    if not shutil.which("pdftoppm"):
        print("pdftoppm not installed: edge check not tested")
        return []
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = Path(t) / "w"
        run("init", str(d))
        (d / "figures").mkdir(exist_ok=True)
        rect_pdf(d / "figures" / "cut.pdf", 20, 0, 180, 40)      # runs into the bottom edge
        rect_pdf(d / "figures" / "fine.pdf", 20, 15, 180, 85)    # 15 pt margin all round
        (d / "ledger.md").write_text("# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence | figure |\n"
                                     "|---|---|---|---|---|\n| C1 | X rises | established | R1 | fig:a |\n\n## Out of scope\n")
        body = ("\\section{X rises}\n\\claim{C1}\nX rises (\\figref{fig:a}, \\figref{fig:b}).\n\n"
                "\\begin{figure}[tbp]\\centering\\includegraphics[width=0.5\\textwidth]{figures/cut.pdf}"
                "\\caption{\\textbf{X rises.} Cut.}\\label{fig:a}\\end{figure}\n"
                "\\begin{figure}[tbp]\\centering\\includegraphics[width=0.5\\textwidth]{figures/fine.pdf}"
                "\\caption{\\textbf{X rises.} Fine.}\\label{fig:b}\\end{figure}\n")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m[:m.index("\\begin{inshort}")] + "\\begin{inshort}We found X.\\end{inshort}\n"
                                    + body + m[m.index("\\printbibliography"):])
        r = run("check", str(d))
        if "fig:a: figures/cut.pdf has ink up to its edge (bottom" not in r.stdout or r.returncode != 1:
            fails.append("cut-off figure not flagged:\n" + r.stdout)
        if "fine.pdf" in r.stdout or "fig:b:" in r.stdout.split("notes")[0]:
            fails.append("figure with a margin flagged:\n" + r.stdout)
    return fails


def _vf_fixture(root: Path, name: str = "w", extra_ledger: str = "") -> Path:
    """A clean write-up with values, facts, claims resting on facts, a figure and an In short box that uses a value."""
    d = root / name
    run("init", str(d))
    (d / "values").mkdir()
    (d / "values" / "run.json").write_text(json.dumps({
        "weight_10x_mean": 0.035, "min_site_share_pass": {"value": 0.28, "fmt": ".0%", "source": "sweep.py"},
        "n_cells": {"value": 12, "fmt": "d"}, "tiny": 1.2e-05, "small_n": 3, "precise": {"value": 0.0623, "fmt": ".4f"},
        "weight_pct": {"expr": "weight_10x_mean * 100 / 3"}}))
    (d / "ledger.md").write_text(
        "# L\n\n## Message\nWe found X.\n\n## Facts\n| id | fact | values | test | status | condition | evidence |\n"
        "|---|---|---|---|---|---|---|\n| F1 | The weight is a small number at 10x. | weight_10x_mean | | holds | 10x | R1 |\n"
        "| F2 | Every good placement keeps a share of its sites. | min_site_share_pass | `min_site_share_pass >= 0.23` | "
        "holds | all | R2 |\n\n## Claims\n| id | claim | status | evidence | figure | condition | facts |\n"
        "|---|---|---|---|---|---|---|\n| C1 | X rises | established | R1 | fig:a | 10x | F1 |\n"
        "| C2 | Y holds | plausible | R2 | none | all | F2 |\n" + extra_ledger + "\n## Out of scope\n")
    body = ("\\section{X rises}\n\\claim{C1}\n\\fact{F1} The weight is \\val{weight_10x_mean} at tenfold (\\figref{fig:a}).\n\n"
            "\\begin{figure}[tbp]\\centering\\rule{2cm}{1cm}\\caption{\\textbf{X rises.} Weight \\val{weight_10x_mean}.}"
            "\\label{fig:a}\\end{figure}\n\n"
            "\\section{Y holds}\n\\claim{C2}\n\\fact{F2} Every good placement keeps \\val{min_site_share_pass} of its sites.\n\n")
    m = (d / "main.tex").read_text()
    (d / "main.tex").write_text(m[:m.index("\\begin{inshort}")] + "\\begin{inshort}We found X, weight "
                                "\\val{weight_10x_mean}.\\end{inshort}\n" + body + m[m.index("\\printbibliography"):])
    return d


def _lineof(path: Path, needle: str) -> int:
    try:
        return next(i for i, ln in enumerate(path.read_text().splitlines(), 1) if needle in ln)
    except (OSError, StopIteration):
        return 0


def _probs(out: str) -> list[str]:
    return [ln for ln in out.splitlines() if ln.startswith("- ")]


def facts_values_checks() -> list[str]:
    """Named values (values/*.json -> values.tex, \\val), facts stated once, claims resting on facts, confirm, bare
    numbers, sections (split, orphan files, claims in two files), where; old-style ledgers unchanged (O19-O22)."""
    fails = []
    with tempfile.TemporaryDirectory() as t:
        root = Path(t)
        d = _vf_fixture(root)
        r = run("values", str(d))
        tex = (d / "values.tex").read_text() if (d / "values.tex").exists() else ""
        for want in ("% generated by wr.py values", "\\wrsetval{weight_10x_mean}{0.035}",
                     "\\wrsetval{min_site_share_pass}{28\\%}", "\\wrsetval{n_cells}{12}",
                     "\\wrsetval{tiny}{\\ensuremath{1.2\\times10^{-5}}}", "\\wrsetval{weight_pct}{1.17}",
                     "\\wrsetval{precise}{0.0623}"):
            if want not in tex:
                fails.append(f"values.tex lacks {want}:\n{tex}\n{r.stdout}{r.stderr}")
        if r.returncode != 0 or "7 values (6 stored, 1 derived)" not in r.stdout:
            fails.append("values command counts:\n" + r.stdout + r.stderr)
        r = run("check", str(d))
        if r.returncode != 0 or _probs(r.stdout) or "no values confirmed yet" not in r.stdout:
            fails.append("clean write-up with values: no problems and a note that nothing is confirmed:\n" + r.stdout)
        # confirm, then change two values: the sentences that use them are listed, the In short one marked
        if run("confirm", str(d)).returncode or not (d / "values.confirmed.json").exists():
            fails.append("confirm wrote no values.confirmed.json")
        if "no values confirmed yet" in run("check", str(d)).stdout:
            fails.append("the note about unconfirmed values stays after confirm")
        if run("confirm", str(d), "nope").returncode != 1:
            fails.append("confirm of an unknown name should fail")
        run_json = d / "values" / "run.json"
        run_json.write_text(run_json.read_text().replace("0.035", "0.04").replace("0.28", "0.16"))
        r = run("check", str(d))
        out, ps = r.stdout, _probs(r.stdout)
        main_ln, ish = _lineof(d / "main.tex", "\\fact{F1}"), _lineof(d / "main.tex", "We found X, weight")
        if r.returncode != 1:
            fails.append("changed values did not fail the check:\n" + out)
        w = [p for p in ps if "value weight_10x_mean changed" in p]
        if len(w) != 1 or f"main.tex:{main_ln}" not in w[0] or f"main.tex:{ish} (In short)" not in w[0] \
                or "facts F1" not in w[0] or "claims C1" not in w[0] or "wr.py confirm DIR weight_10x_mean" not in w[0]:
            fails.append("changed value: places, In short mark, facts and claims:\n" + out)
        if not any("F2: its test `min_site_share_pass >= 0.23` is false now (min_site_share_pass = 0.16)" in p
                   and "recheck C2" in p for p in ps):
            fails.append("a fact whose test turned false:\n" + out)
        if not any("C2 rests on F2, which no longer holds" in p for p in ps):
            fails.append("the claim resting on a failed fact was not flagged:\n" + out)
        r = run("confirm", str(d), "weight_10x_mean")
        if "0.035 -> 0.04" not in r.stdout:
            fails.append("confirm does not print old -> new:\n" + r.stdout)
        out = run("check", str(d)).stdout
        if "value weight_10x_mean changed" in out or "value min_site_share_pass changed" not in out:
            fails.append("after confirming one value only that one should be gone:\n" + out)
        run("confirm", str(d))
        led = (d / "ledger.md").read_text().replace("| holds | all | R2 |", "| fails | all | R2 |")
        (d / "ledger.md").write_text(led)
        out = run("check", str(d)).stdout
        if "value " in "".join(_probs(out)) or "is false now" in out or "C2 rests on F2" not in out:
            fails.append("after confirm and setting F2 to fails: only the claim should be flagged:\n" + out)
        # errors in values: duplicate name, cycle, bad name, bad fmt, bad expression
        d = _vf_fixture(root, "bad")
        (d / "values" / "b.json").write_text(json.dumps({"weight_10x_mean": 1, "a": {"expr": "b + 1"},
                                                          "b": {"expr": "a + 1"}, "bad name": 1,
                                                          "f": {"value": 2, "fmt": "zz"}, "g": {"expr": "__import__('os')"},
                                                          "h": {"expr": "nothere * 2"}}))
        out = run("check", str(d)).stdout
        for want in ("'weight_10x_mean' is defined in values/b.json and in values/run.json", "cycle", "bad name",
                     "fmt 'zz' fails", "__import__", "nothere is not a defined value"):
            if want not in out:
                fails.append(f"value errors: missing '{want}':\n{out}")
        if run("values", str(d)).returncode != 1 or run("build", str(d)).returncode != 1:
            fails.append("value errors must make values and build exit 1")
        # facts: undefined \val, a fact not stated, stated twice, unknown marker, unknown value name, bad status
        d = _vf_fixture(root, "facts")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m.replace("\\fact{F2} ", "").replace("\\section{Y holds}", "\\fact{F1} Again \\val{nothere}.\n"
                                    "\\fact{F9} Stray.\n\\section{Y holds}"))
        (d / "ledger.md").write_text((d / "ledger.md").read_text().replace("| holds | 10x | R1 |", "| maybe | 10x | R1 |").replace(
            "| weight_10x_mean | |", "| weight_10x_mean, ghost | |"))
        out = run("check", str(d)).stdout
        for want in ("F2: not stated in the text", "F1: stated 2 times (main.tex:", "\\val{nothere} is not a defined value",
                     "\\fact{F9} is not in ledger.md", "status 'maybe'", "value 'ghost' is not defined"):
            if want not in out:
                fails.append(f"facts: missing '{want}':\n{out}")
        # a claim resting on an unknown fact, and an established claim resting on an open fact
        d = _vf_fixture(root, "claims")
        (d / "ledger.md").write_text((d / "ledger.md").read_text().replace("| 10x | F1 |", "| 10x | F1, F7 |").replace(
            "| holds | 10x | R1 |", "| open | 10x | R1 |"))
        out = run("check", str(d)).stdout
        if "C1: facts column names F7" not in out or "C1 is established but rests on F1, which is open" not in out:
            fails.append("claims from facts:\n" + out)
        # bare numbers: exact, rounded, a second value; integers below 10 and arguments of \val/\ref are not noted
        d = _vf_fixture(root, "bare")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m.replace("\\section{Y holds}", "\\section{Y holds}\nThe weight 0.035, 12 cells (3 of them, "
                                    "fig 2), 0.062 and \\val{small_n} but 28\\% too. Also 1.17 and 7.5 and \\label{x0.035}.\n"))
        out = run("check", str(d)).stdout
        ln = _lineof(d / "main.tex", "The weight 0.035")
        for want in (f"main.tex:{ln}: 0.035 is the value weight_10x_mean: write \\val{{weight_10x_mean}}",
                     f"main.tex:{ln}: 12 is the value n_cells", f"main.tex:{ln}: 0.062 may be precise (0.0623) rounded",
                     f"main.tex:{ln}: 28% is the value min_site_share_pass", f"1.17 is the value weight_pct"):
            if want not in out:
                fails.append(f"bare number note missing '{want}':\n{out}")
        if re.search(r"(?<![\d.])[237] is the value", out) or "7.5" in out or "x0.035" in out:
            fails.append("noise in bare number notes:\n" + out)
        if run("check", str(d)).returncode != 0:
            fails.append("bare numbers must stay notes, not problems")
        # sections: split, then orphan file, input twice, claim in two files, missing file
        d = _vf_fixture(root, "split", "| C3 | Z | plausible | R3 | none | all | |\n")
        (d / "main.tex").write_text((d / "main.tex").read_text().replace("\\section{Y holds}", "\\section{Y holds}\nThe RMP rises.\n"))
        before_main = (d / "main.tex").read_text()
        before_probs = _probs(run("check", str(d)).stdout)
        if not any("RMP" in p for p in before_probs) or not any("C3" in p for p in before_probs):
            fails.append("split fixture should have problems before the split: " + str(before_probs))
        r = run("split", str(d))
        files = sorted(p.name for p in (d / "sections").glob("*.tex")) if (d / "sections").is_dir() else []
        if r.returncode != 0 or files != ["01-x-rises.tex", "02-y-holds.tex", "s01-how-the-result-was-reached.tex"] \
                or "\\input{sections/01-x-rises}" not in (d / "main.tex").read_text() \
                or (d / "build" / "main.before-split.tex").read_text() != before_main:
            fails.append(f"split: files {files}, main.tex or backup wrong:\n{r.stdout}{r.stderr}")
        new_main = (d / "main.tex").read_text()
        joined = re.sub(r"\\input\{(sections/[^}]+)\}", lambda m: (d / (m.group(1) + ".tex")).read_text(), new_main)
        if re.sub(r"\n{2,}", "\n", joined) != re.sub(r"\n{2,}", "\n", before_main):  # up to blank lines before \end{document}
            fails.append("split changed the text: inlining the section files does not give the original main.tex:\n"
                         + joined[:600])
        if "\\begin{inshort}" not in new_main or "\\printbibliography" not in new_main or "\\section{" in new_main:
            fails.append("split left sections in main.tex or removed the In short box / bibliography")
        after_probs = _probs(run("check", str(d)).stdout)
        if after_probs != before_probs:
            fails.append(f"check problems differ after the split:\n{before_probs}\n{after_probs}")
        r = run("split", str(d))
        if r.returncode != 1 or "nothing changed" not in r.stdout:
            fails.append("a second split should be refused:\n" + r.stdout)
        # where: no arguments lists each file with its claims, facts, figures and values; with arguments file:line
        r = run("where", str(d))
        if r.returncode != 0 or not re.search(r"sections/01-x-rises\.tex\n  claims: C1\n  facts: F1\n"
                                              r"  figures: defined fig:a; cited fig:a\n  values: weight_10x_mean", r.stdout) \
                or not re.search(r"sections/02-y-holds\.tex\n  claims: C2\n  facts: F2", r.stdout) \
                or "main.tex\n  values: weight_10x_mean" not in r.stdout:
            fails.append("where without arguments:\n" + r.stdout)
        r = run("where", str(d), "C1", "F2", "fig:a", "weight_10x_mean", "min_site_share_pass")
        ln = _lineof(d / "sections" / "01-x-rises.tex", "\\fact{F1}")
        for want in (f"marked at: sections/01-x-rises.tex:{ln - 1}", "rests on: F1 (holds)", "stated at: sections/02-y-holds.tex:",
                     "claims resting on it: C2", "defined at sections/01-x-rises.tex:", "cited at sections/01-x-rises.tex:",
                     "main.tex:", "(In short)", "facts using it: F1", "source: sweep.py", "28\\%"):
            if want not in r.stdout:
                fails.append(f"where with arguments: missing '{want}':\n{r.stdout}")
        if run("where", str(d), "Q9").returncode != 1:
            fails.append("where of an unknown id should exit 1")
        sec = d / "sections"
        sec.mkdir(exist_ok=True)
        (sec / "extra.tex").write_text("Orphan.\n")
        sec2 = sec / "02-y-holds.tex"
        sec2.touch()
        sec2.write_text(sec2.read_text() + "\\claim{C1}\n")
        (d / "main.tex").write_text(new_main.replace("\\input{sections/02-y-holds}", "\\input{sections/01-x-rises}\n"
                                                     "\\input{sections/02-y-holds}\n\\input{sections/ghost}"))
        out = run("check", str(d)).stdout
        for want in ("sections/extra.tex is not input anywhere", "sections/01-x-rises.tex is input 2 times (main.tex:",
                     "C1 is marked in sections/01-x-rises.tex:", "\\input of sections/ghost.tex, which does not exist"):
            if want not in out:
                fails.append(f"sections: missing '{want}':\n{out}")
        # a figure labelled away from its first citation is noted
        (d / "main.tex").write_text(new_main)
        (sec / "extra.tex").unlink()
        sec2.write_text(sec2.read_text().replace("\\claim{C1}\n", "") + "Also \\figref{fig:b}.\n"
                        "\\begin{figure}\\rule{1cm}{1cm}\\caption{\\textbf{B.} b.}\\label{fig:b}\\end{figure}\n")
        s1 = sec / "01-x-rises.tex"
        s1.touch()
        s1.write_text(s1.read_text() + "See \\figref{fig:b} first.\n")
        if "placement: fig:b: is in sections/02-y-holds.tex but first cited at sections/01-x-rises.tex" not in run("check", str(d)).stdout:
            fails.append("figure in another file than its first citation not noted")
        # init --sections gives the section layout; a write-up without any of the new files is unchanged
        r = run("init", str(root / "sec"), "--sections")
        if r.returncode or not (root / "sec" / "sections" / "01-the-question.tex").exists():
            fails.append("init --sections:\n" + r.stdout + r.stderr)
        d = root / "old"
        run("init", str(d))
        (d / "ledger.md").write_text("# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence | figure |\n"
                                     "|---|---|---|---|---|\n| C1 | X rises | established | R1 | fig:a |\n\n## Out of scope\n")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m[:m.index("\\begin{inshort}")] + "\\begin{inshort}We found X.\\end{inshort}\n"
                                    "\\section{X rises}\n\\claim{C1}\nX rises 0.035 (\\figref{fig:a}).\n\n\\begin{figure}[tbp]"
                                    "\\rule{2cm}{1cm}\\caption{\\textbf{X rises.} Mean of 3.}\\label{fig:a}\\end{figure}\n"
                                    + m[m.index("\\printbibliography"):])
        r = run("check", str(d))
        if r.returncode != 0 or "value" in r.stdout or "fact" in r.stdout.replace("facts", ""):
            fails.append("an old-style write-up gets new problems or notes:\n" + r.stdout)
        if run("status", str(d)).stdout.count("\n") != 1:
            fails.append("status of an old-style write-up changed:\n" + run("status", str(d)).stdout)
    fails += _val_build_check()
    return fails


def _val_build_check() -> list[str]:
    """\\val prints its value in the text, in a caption and in the In short box; an undefined one fails the build."""
    if not (shutil.which("latexmk") and shutil.which("lualatex") and shutil.which("pdftotext")):
        print("latexmk, lualatex or pdftotext missing: \\val build test skipped")
        return []
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = _vf_fixture(Path(t))
        r = run("build", str(d))
        txt = subprocess.run(["pdftotext", str(d / "build" / "main.pdf"), "-"], capture_output=True, text=True).stdout \
            if (d / "build" / "main.pdf").exists() else ""
        if r.returncode != 0 or txt.count("0.035") < 3 or "28%" not in txt or "??" in txt:
            fails.append(f"\\val in text, caption and In short did not render (0.035 x{txt.count('0.035')}):\n{r.stdout[-600:]}")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m.replace("\\val{min_site_share_pass}", "\\val{no_such_value}"))
        r = run("build", str(d))
        if r.returncode != 1 or "undefined value no_such_value" not in r.stdout:
            fails.append("an undefined \\val should fail the build:\n" + r.stdout[-600:])
    return fails


def fact_lifecycle_checks() -> list[str]:
    """Prior-art additions: a reworded fact flags its claims until confirmed (requirement tracing's outdated links), a
    superseded fact stays in the ledger and flags claims still resting on it, unused values and facts are noted, and a
    \\val in a section title builds without bookmark warnings."""
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = _vf_fixture(Path(t), extra_ledger="| C3 | Z | plausible | R3 | none | all | F2 |\n")
        led = (d / "ledger.md").read_text().replace(
            "\n| F2 | Every", "\n| F9 | The old weight. | | | superseded by F1 | 10x | R0 |\n"
            "| F8 | Unused fact. | | | holds | all | R4 |\n| F2 | Every")
        (d / "ledger.md").write_text(led)
        (d / "main.tex").write_text((d / "main.tex").read_text().replace("\\fact{F2}", "\\claim{C3}\\fact{F8} Spare. \\fact{F2}"))
        run("confirm", str(d))
        if not (d / "facts.confirmed.json").exists():
            fails.append("confirm with no names wrote no facts.confirmed.json")
        out = run("check", str(d)).stdout
        if _probs(out):
            fails.append("superseded fact neither stated nor used: no problem expected:\n" + out)
        if "no claim rests on F8" not in out or "F9" in out.split("notes")[-1]:
            fails.append("fact no claim rests on (F8) noted, superseded F9 not:\n" + out)
        if "used nowhere" not in out or "small_n" not in out or "weight_10x_mean" in out.split("used nowhere")[-1].split("\n")[0]:
            fails.append("unused values noted (small_n), used ones not:\n" + out)
        # reword F2: both claims resting on it are listed until F2 is confirmed again
        (d / "ledger.md").write_text(led.replace("keeps a share of its sites", "keeps a third of its sites"))
        out = run("check", str(d)).stdout
        if not any("F2 changed since it was confirmed" in p and "C2, C3" in p for p in _probs(out)):
            fails.append("reworded fact F2 should list C2, C3:\n" + out)
        (d / "ledger.md").write_text(led.replace("keeps a share of its sites.", "Keeps a share of its  sites"))
        if any("changed since it was confirmed" in p for p in _probs(run("check", str(d)).stdout)):
            fails.append("case, spacing or a full stop is not a change")
        (d / "ledger.md").write_text(led.replace("keeps a share of its sites", "keeps a third of its sites"))
        r = run("confirm", str(d), "F2")
        if r.returncode or "changed since" in run("check", str(d)).stdout:
            fails.append("confirm F2 clears the change:\n" + r.stdout)
        # a claim pointing at a superseded fact, and a superseded fact still stated
        (d / "ledger.md").write_text((d / "ledger.md").read_text().replace("| established | R1 | fig:a | 10x | F1 |",
                                                                           "| established | R1 | fig:a | 10x | F9 |"))
        (d / "main.tex").write_text((d / "main.tex").read_text().replace("\\fact{F8} Spare.", "\\fact{F9} Old."))
        ps = _probs(run("check", str(d)).stdout)
        if not any("C1 rests on F9, which is superseded by F1" in p for p in ps):
            fails.append("claim on a superseded fact:\n" + "\n".join(ps))
        if not any("F9 is superseded by F1 but still stated at main.tex:" in p for p in ps):
            fails.append("superseded fact still stated:\n" + "\n".join(ps))
        if shutil.which("latexmk") and shutil.which("lualatex"):
            m = (d / "main.tex").read_text()
            (d / "main.tex").write_text(m.replace("\\section{Y holds}", "\\section{Y holds at \\val{min_site_share_pass}}"))
            run("build", str(d))
            log = (d / "build" / "main.log").read_text(errors="replace") if (d / "build" / "main.log").exists() else ""
            if not log or "Token not allowed in a PDF string" in log:
                fails.append("\\val in a section title: bookmark warning or no build")
        else:
            print("latexmk or lualatex missing: \\val-in-title build test skipped")
    return fails


def pilot_checks() -> list[str]:
    """From the section-split pilot (O23-O26): figure files input from section files are followed and count as placed
    where they are input; lettered claim ids (C1a); own runs are not unsourced literature; accepted check results."""
    fails = []
    with tempfile.TemporaryDirectory() as t:
        d = Path(t) / "w"
        run("init", str(d))
        (d / "ledger.md").write_text(
            "# L\n\n## Message\nWe found X.\n\n## Claims\n| id | claim | status | evidence | figure | condition |\n"
            "|---|---|---|---|---|---|\n| C1a | X rises | established | R1 | fig:a | all |\n"
            "| C1b | X stays | plausible | R2 | none | all |\n\n## Out of scope\n")
        (d / "sections").mkdir()
        (d / "figures").mkdir(exist_ok=True)
        (d / "sections" / "01-x.tex").write_text(
            "\\section{X rises}\n\\claim{C1a}\nX rises (\\figref{fig:a}); spikes were measured on the same 16 trials "
            "of input.\n\\input{figures/fa}\n\n\\claim{C1b}\nX stays.\n")
        (d / "figures" / "fa.tex").write_text(
            "% figure file\n\\begin{figure}[tbp]\\centering\\rule{2cm}{1cm}\\caption{\\textbf{X rises.} Mean.}"
            "\\label{fig:a}\\end{figure}\n")
        m = (d / "main.tex").read_text()
        (d / "main.tex").write_text(m[:m.index("\\begin{inshort}")] + "\\begin{inshort}We found X.\\end{inshort}\n"
                                    "\\input{sections/01-x}\n" + m[m.index("\\printbibliography"):])
        r = run("check", str(d))
        if r.returncode != 0 or "placement:" in r.stdout or "never cited" in r.stdout or "C1a" in r.stdout \
                or "source:" in r.stdout:
            fails.append("figure file input from a section, lettered ids, own trials: no problem expected:\n" + r.stdout)
        # unsplit: main.tex cites the figure and inputs its file at that paragraph (the pilot's 18 false notes)
        main_split = (d / "main.tex").read_text()
        (d / "main.tex").write_text(main_split.replace("\\input{sections/01-x}", (d / "sections" / "01-x.tex").read_text()))
        (d / "sections" / "01-x.tex").unlink()
        r = run("check", str(d))
        if r.returncode != 0 or "placement:" in r.stdout:
            fails.append("figure file input where main.tex cites it counts as placed there:\n" + r.stdout)
        (d / "sections" / "01-x.tex").write_text((d / "main.tex").read_text().split("\\begin{inshort}We found X.\\end{inshort}\n")[1]
                                                  .split("\\printbibliography")[0])
        (d / "main.tex").write_text(main_split)
        (d / "figures" / "fa.tex").write_text((d / "figures" / "fa.tex").read_text().replace("\\textbf{X rises.}", "X rises."))
        if "fig:a: caption does not start with a bold title" not in run("check", str(d)).stdout:
            fails.append("figure checks must see a figure input two levels down")
        r = run("where", str(d), "C1a", "fig:a")
        if r.returncode or "marked at: sections/01-x.tex:2" not in r.stdout or "defined at figures/fa.tex:2" not in r.stdout:
            fails.append("where C1a and fig:a:\n" + r.stdout)
        # accepted check results: not counted, listed; a stale entry is noted
        (d / "sections" / "01-x.tex").write_text((d / "sections" / "01-x.tex").read_text() + "\n" + "word " * 240 + "\n")
        if run("check", str(d)).returncode != 1:
            fails.append("a 240-word paragraph should be a problem before it is accepted")
        (d / "ledger.md").write_text((d / "ledger.md").read_text() + "\n## Accepted\n- `a paragraph of 240 words` long by "
                                     "design (owner)\n- `no such text` old\n")
        r = run("check", str(d))
        if r.returncode != 1 or "accepted in ledger.md (1" not in r.stdout or "`no such text` in ledger.md matches nothing" \
                not in r.stdout or "- a paragraph of" in r.stdout:
            fails.append("accepted paragraph not counted, stale entry noted (the caption problem remains):\n" + r.stdout)
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
    fails += edge_checks()
    fails += source_checks()
    fails += colour_checks()
    fails += reader_checks()
    fails += facts_values_checks()
    fails += fact_lifecycle_checks()
    fails += pilot_checks()
    for f in fails:
        print("FAIL", f)
    print("ok" if not fails else f"{len(fails)} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
