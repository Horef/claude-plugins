#!/usr/bin/env python3
"""research-writing tools: start a LaTeX write-up, build it, render its pages, check it, brief fresh readers.

Standard library only; needs latexmk (with lualatex or pdflatex, and biber) for `build`, and pdftoppm (poppler) for
`pages`; pdftotext and pdfinfo (poppler) are optional, for two of the check's notes. Every command takes the write-up folder (the one holding main.tex and ledger.md).

  wr.py init DIR [--title T]          copy the template (main.tex, preamble.tex, ledger.md, refs.bib, figures/, review/)
  wr.py build DIR                     latexmk; copies the PDF to DIR/<DIR name>.pdf; prints undefined references and
                                      citations, overfull boxes, missing files
  wr.py pages DIR [--first N --last M --dpi 60]   PNG per page in DIR/build/pages, plus a contact sheet when Pillow is there
  wr.py check DIR                     the mechanical checks of the skill (exit 1 when a problem is found); then notes that
                                      never fail it: figure heights against the page, figure numbers vs the text (pdftotext); with pdftoppm,
                                      figures whose ink reaches their edge (cut off) are problems
  wr.py readers DIR --round N [--roles pi,reviewer,newcomer,outsider,editor]   write one brief per fresh reader into review/round-N/
  wr.py status DIR                    claims, figures and the reader questions still open

Exit codes: 0 ok, 1 problems found, 2 a tool is missing (not checked: never report that as clean).
"""
from __future__ import annotations

import argparse
import datetime
import re
import shutil
import subprocess
import sys
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "templates" / "writeup"


# ------------------------------------------------------------------ init
def cmd_init(a) -> int:
    d = Path(a.dir).resolve()
    if (d / "main.tex").exists():
        print(f"{d}/main.tex exists; not overwriting")
        return 1
    d.mkdir(parents=True, exist_ok=True)
    for p in TEMPLATE.rglob("*"):
        q = d / p.relative_to(TEMPLATE)
        if p.is_dir():
            q.mkdir(exist_ok=True)
        else:
            q.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, q)
    if a.title:
        m = d / "main.tex"
        m.write_text(m.read_text().replace("TITLE: the answer, not the topic", a.title))
    (d / ".gitignore").write_text("build/\n")
    print(f"started {d}: fill ledger.md first (message, reader, claims), then the skeleton in main.tex")
    return 0


# ------------------------------------------------------------------ build
def _engine() -> str | None:
    for e in ("lualatex", "pdflatex"):
        if shutil.which(e):
            return e
    return None


def cmd_build(a) -> int:
    d = Path(a.dir).resolve()
    eng = _engine()
    if not shutil.which("latexmk") or eng is None:
        print("latexmk or a LaTeX engine is missing: not built")
        return 2
    out = d / "build"
    out.mkdir(exist_ok=True)
    cmd = ["latexmk", f"-{eng}", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error",
           f"-outdir={out}", "main.tex"]
    r = subprocess.run(cmd, cwd=d, capture_output=True, text=True)
    log = (out / "main.log").read_text(errors="replace") if (out / "main.log").exists() else ""
    problems = _log_problems(log)
    if r.returncode != 0:
        tail = "\n".join((r.stdout + r.stderr).splitlines()[-25:])
        print(f"build failed (latexmk exit {r.returncode}):\n{tail}")
        for p in problems:
            print("  " + p)
        return 1
    pdf = out / "main.pdf"
    share = d / f"{d.resolve().name}.pdf"  # the copy to share or commit; build/ stays out of git
    shutil.copy2(pdf, share)
    print(f"built {share} ({_npages(log)} pages)")
    for p in problems:
        print("  " + p)
    return 1 if any(p.startswith(("undefined", "missing")) for p in problems) else 0


def _npages(log: str) -> str:
    m = re.search(r"Output written on .*?\((\d+) pages?", log)
    return m.group(1) if m else "?"


def _log_problems(log: str) -> list[str]:
    out = []
    for m in re.finditer(r"Reference `([^']+)' on page (\d+) undefined", log):
        out.append(f"undefined reference {m.group(1)} (page {m.group(2)})")
    for m in re.finditer(r"Citation '([^']+)' on page (\d+) undefined", log):
        out.append(f"undefined citation {m.group(1)} (page {m.group(2)})")
    for m in re.finditer(r"(?:File|Package \w+ Warning: File) `([^']+)' not found", log):
        out.append(f"missing file {m.group(1)}")
    for m in re.finditer(r"Overfull \\hbox \((\d+(?:\.\d+)?)pt too wide\)[^\n]*lines (\d+)--(\d+)", log):
        if float(m.group(1)) > 2:
            out.append(f"overfull line by {m.group(1)} pt (source lines {m.group(2)}-{m.group(3)})")
    if "Float too large" in log:
        out.append("a float is too large for the page")
    return list(dict.fromkeys(out))


# ------------------------------------------------------------------ pages
def cmd_pages(a) -> int:
    d = Path(a.dir).resolve()
    pdf = d / "build" / "main.pdf"
    if not pdf.exists():
        print("no build/main.pdf: run build first")
        return 1
    if not shutil.which("pdftoppm"):
        print("pdftoppm (poppler) is missing: pages not rendered (read the PDF directly, or install poppler)")
        return 2
    pd = d / "build" / "pages"
    pd.mkdir(parents=True, exist_ok=True)
    for f in pd.glob("p-*.png"):
        f.unlink()
    cmd = ["pdftoppm", "-png", "-r", str(a.dpi)]
    if a.first:
        cmd += ["-f", str(a.first)]
    if a.last:
        cmd += ["-l", str(a.last)]
    subprocess.run(cmd + [str(pdf), str(pd / "p")], check=True)
    pages = sorted(pd.glob("p-*.png"))
    sheet = _sheet(pages, pd / "sheet.png")
    print("\n".join(str(p) for p in pages))
    if sheet:
        print(f"contact sheet: {sheet}")
    return 0


def _sheet(pages: list[Path], out: Path, cols: int = 4) -> Path | None:
    try:
        from PIL import Image
    except ImportError:
        return None
    if not pages:
        return None
    ims = [Image.open(p) for p in pages]
    w, h = max(i.width for i in ims), max(i.height for i in ims)
    rows = (len(ims) + cols - 1) // cols
    s = Image.new("RGB", (cols * w, rows * h), "white")
    for k, im in enumerate(ims):
        s.paste(im, ((k % cols) * w, (k // cols) * h))
    s.save(out)
    return out


# ------------------------------------------------------------------ check
_ENVS_SKIP = re.compile(r"\\begin\{(equation|align|figure|table|tabular|tabularx)\*?\}.*?\\end\{\1\*?\}", re.S)


def _strip_comments(tex: str) -> str:
    return re.sub(r"(?<!\\)%.*", "", tex)


def _tex_sources(d: Path) -> str:
    """main.tex with \\input/\\include files inlined (one level deep is enough for a write-up)."""
    main = (d / "main.tex").read_text()

    def inc(m):
        p = d / (m.group(2) if m.group(2).endswith(".tex") else m.group(2) + ".tex")
        if p.name.startswith("preamble"):
            return ""
        return p.read_text() if p.exists() else ""
    return re.sub(r"\\(input|include)\{([^}]+)\}", inc, main)


def _ledger(d: Path) -> dict:
    p = d / "ledger.md"
    out = {"claims": {}, "message": "", "has_condition": False}
    if not p.exists():
        return out
    t = p.read_text()
    m = re.search(r"## Message\s*(.*?)(?=\n## )", t, re.S)
    out["message"] = re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip() if m else ""
    # columns are found by header name (after the id column), so older ledgers without a condition column still parse
    cols = {"claim": 0, "status": 1, "evidence": 2, "figure": 3}
    h = re.search(r"^\|\s*id\s*\|(.*)$", t, re.M | re.I)
    if h:
        for k, c in enumerate(x.strip().lower() for x in h.group(1).split("|")):
            for name in ("claim", "status", "evidence", "figure", "condition"):
                if c.startswith(name):
                    cols[name] = k
    out["has_condition"] = "condition" in cols
    for row in re.finditer(r"^\|\s*(C\d+)\s*\|(.*)$", t, re.M):
        cells = [c.strip() for c in row.group(2).split("|")]
        out["claims"][row.group(1)] = {n: (cells[k] if k < len(cells) else "") for n, k in cols.items()}
        out["claims"][row.group(1)].setdefault("condition", "")
    return out


EDGE_BAND_MM, EDGE_SHARE, EDGE_INK = 0.8, 0.01, 200  # band along each edge; share of its length inked; grey < 200


def _pgm(path: Path) -> tuple[int, int, bytes]:
    """(width, height, pixels) of a binary greyscale PGM (P5, 8 bit), as pdftoppm -gray writes it."""
    data = path.read_bytes()
    fields, i = [], 2
    while len(fields) < 3:
        while data[i:i + 1].isspace():
            i += 1
        if data[i:i + 1] == b"#":
            i = data.index(b"\n", i)
            continue
        j = i
        while not data[j:j + 1].isspace():
            j += 1
        fields.append(int(data[i:j]))
        i = j
    return fields[0], fields[1], data[i + 1:]


def edge_ink(pdf: Path, dpi: int = 72) -> dict[str, float] | None:
    """Share of each edge's length with ink in a thin band along it. A figure whose drawing runs past its canvas
    (rows of a panel lost, an axis label clipped) has ink up to the edge; matplotlib leaves a margin otherwise.
    None when pdftoppm is missing or the graphic is not a PDF."""
    if pdf.suffix.lower() != ".pdf" or not shutil.which("pdftoppm"):
        return None
    import tempfile
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-gray", "-singlefile", "-f", "1", "-l", "1", str(pdf),
                        t + "/x"], check=True, capture_output=True)
        w, h, px = _pgm(Path(t) / "x.pgm")
    b = max(1, round(EDGE_BAND_MM / 25.4 * dpi))
    ink = lambda x, y: px[y * w + x] < EDGE_INK
    return {"top": sum(any(ink(x, y) for y in range(b)) for x in range(w)) / w,
            "bottom": sum(any(ink(x, y) for y in range(h - b, h)) for x in range(w)) / w,
            "left": sum(any(ink(x, y) for x in range(b)) for y in range(h)) / h,
            "right": sum(any(ink(x, y) for x in range(w - b, w)) for y in range(h)) / h}


def figure_edges(d: Path, figs: list[str]) -> list[str]:
    """Problems for included PDFs with ink touching an edge: probably cut off."""
    out = []
    for f in figs:
        lab = re.search(r"\\label\{(fig:[^}]+)\}", f)
        for m in re.finditer(r"\\includegraphics\*?(?:\[[^\]]*\])?\{([^}]+)\}", f):
            g = _graphic(d, m.group(1))
            e = edge_ink(g) if g else None
            cut = {k: v for k, v in (e or {}).items() if v > EDGE_SHARE}
            if cut:
                sides = ", ".join(f"{k} {v:.0%}" for k, v in cut.items())
                out.append(f"{lab.group(1) if lab else m.group(1)}: {g.relative_to(d)} has ink up to its edge ({sides} "
                           "of the edge): the drawing probably runs past the canvas (rows, labels or markers cut off). "
                           "Render it and look; enlarge the figure or save with bbox_inches='tight', pad_inches=0.05")
    return out


def check(d: Path) -> list[str]:
    """Problems a script can find; each one names where it is and what to do."""
    probs: list[str] = []
    raw = _tex_sources(d)
    tex = _strip_comments(raw)
    led = _ledger(d)
    body = tex.split("\\begin{document}", 1)[-1]

    # ledger
    if not led["message"]:
        probs.append("ledger.md: no Message paragraph; write it before the text (step 1)")
    for cid, c in led["claims"].items():
        if not c["claim"]:
            probs.append(f"ledger.md {cid}: empty claim")
            continue
        if c["status"] not in ("established", "plausible", "open"):
            probs.append(f"ledger.md {cid}: status '{c['status']}' is not established, plausible or open")
        if not c["evidence"]:
            probs.append(f"ledger.md {cid}: no evidence (a result entry or run id)")
        if led["has_condition"] and not c["condition"]:
            probs.append(f"ledger.md {cid}: no condition (what it was tested under: a parameter strength, a dataset; "
                         "'all' if none applies); each section states it")
        if f"\\claim{{{cid}}}" not in body:
            probs.append(f"ledger.md {cid} is not carried by any paragraph (add \\claim{{{cid}}} where it is made, or "
                         "move it to Out of scope)")
        fig = c["figure"].strip("` ")
        if fig and fig != "none" and f"\\label{{{fig}}}" not in body:
            probs.append(f"ledger.md {cid}: figure {fig} has no \\label in the text")
    for cid in sorted(set(re.findall(r"\\claim\{(C\d+)\}", body)) - set(led["claims"]), key=lambda s: int(s[1:])):
        probs.append(f"\\claim{{{cid}}} in the text is not in ledger.md")

    # figures: every figure cited, cited before it appears in the source, its caption starts with a bold title
    figs = [(m.start(), m.group(0)) for m in re.finditer(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", body, re.S)]
    for pos, f in figs:
        lab = re.search(r"\\label\{(fig:[^}]+)\}", f)
        if not lab:
            probs.append("a figure has no \\label{fig:...}")
            continue
        name = lab.group(1)
        refs = [m.start() for m in re.finditer(r"\\(?:[cC]ref|ref|[fF]igref|autoref)\{[^}]*\b" + re.escape(name) + r"\b",
                                               body)]
        if not refs:
            probs.append(f"{name}: never cited in the text")
        elif min(refs) > pos:
            probs.append(f"{name}: the figure comes before its first citation in the source; move it after the "
                         "paragraph that first cites it")
        cap = re.search(r"\\caption(?:\[[^\]]*\])?\{\s*(\\textbf\{)?", f)
        if cap and not cap.group(1):
            probs.append(f"{name}: caption does not start with a bold title sentence (\\textbf{{the finding.}})")
    probs += figure_edges(d, [f for _, f in figs])
    # figure pages vs page of first citation (needs a build and \figref)
    aux = d / "build" / "main.aux"
    if aux.exists():
        a = aux.read_text(errors="replace")
        first: dict[str, int] = {}
        for m in re.finditer(r"\\wrfigcite\{([^}]+)\}\{(\d+)\}", a):
            for name in m.group(1).split(","):
                first.setdefault(name.strip(), int(m.group(2)))
        # figures after \\supplementary or \\appendix sit away from their pointer by design
        cut = min([i for i in (body.find("\\supplementary"), body.find("\\appendix")) if i >= 0], default=len(body))
        late = {lab for pos, f in figs if pos > cut for lab in re.findall(r"\\label\{(fig:[^}]+)\}", f)}
        for m in re.finditer(r"\\newlabel\{(fig:[^}]+)\}\{\{[^}]*\}\{(\d+)\}", a):
            name, page = m.group(1), int(m.group(2))
            if name.startswith("fig:S") or name in late:
                continue
            if name in first and (page < first[name] or page > first[name] + 1):
                probs.append(f"{name}: on page {page}, first cited on page {first[name]} (keep it on the same page or "
                             "the next)")

    # acronyms: defined before or at first use ("full words (ABC)")
    prose = _ENVS_SKIP.sub(" ", body)
    prose = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^{}]*\})?", " ", prose)
    ok = set(re.findall(r"%\s*acronyms-ok:\s*(.*)", raw) and " ".join(re.findall(r"%\s*acronyms-ok:\s*(.*)", raw)).split())
    common = {"PDF", "DNA", "RNA", "USA", "UK", "EU", "OK", "ID", "IDs", "AI", "CPU", "GPU", "II", "III", "IV", "VI"}
    seen = set()
    for m in re.finditer(r"\b([A-Z][A-Z0-9]{1,6})s?\b", prose):
        w = m.group(1)
        if w in seen or w in ok or w in common:
            continue
        seen.add(w)
        if not re.search(r"\(" + re.escape(w) + r"s?\)", prose[: m.end() + 3]):
            probs.append(f"acronym {w} used before it is defined ('full words ({w})'), or list it in "
                         "'% acronyms-ok: ...' if every reader knows it")

    # paragraphs: very long ones (the summary box or abstract may run to about 300 words, Nature's summary paragraph)
    summary = re.search(r"\\begin\{(inshort|abstract)\}(.*?)\\end\{\1\}", body, re.S)
    if summary and len(summary.group(2).split()) > 300:
        probs.append(f"the {summary.group(1)} box has {len(summary.group(2).split())} words; keep it to about 300")
    for para in re.split(r"\n\s*\n", _ENVS_SKIP.sub(" ", re.sub(r"\\begin\{(inshort|abstract)\}.*?\\end\{\1\}", " ", body, flags=re.S))):
        para = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^{}]*\})?", " ", para)
        words = len(para.split())
        if words > 220:
            probs.append(f"a paragraph of {words} words (starts '{' '.join(para.split()[:8])} ...'): split it at its "
                         "second point")
    # placeholders left from the template
    for ph in ("TITLE:", "MESSAGE:", "AUTHORS", "RESULT 1 AS A FINDING", "TODO"):
        if ph in body:
            probs.append(f"template placeholder '{ph}' is still in the text")
    return probs


# ------------------------------------------------------------------ notes (reported, never fail the check)
HEIGHT_BUDGET = 0.55  # of \textheight, unless the figure is the answer figure
_PAPERS = {"a4paper": (210.0, 297.0), "letterpaper": (215.9, 279.4)}
_UNIT_MM = {"mm": 1.0, "cm": 10.0, "in": 25.4, "pt": 25.4 / 72.27, "bp": 25.4 / 72.0}
_FIGNUM = re.compile(r"(?<![\w.])\d+\.\d+(?![\w.])")


def _page_mm(d: Path) -> tuple[float, float]:
    """(textwidth, textheight) in mm from the geometry line of preamble.tex; the template's A4 with 25 mm margins if absent."""
    paper, margin = (210.0, 297.0), 25.0
    pre = d / "preamble.tex"
    g = re.search(r"\\usepackage\[([^\]]*)\]\{geometry\}", pre.read_text()) if pre.exists() else None
    if g:
        for k, v in _PAPERS.items():
            if k in g.group(1):
                paper = v
        m = re.search(r"margin=([\d.]+)(mm|cm|in|pt|bp)", g.group(1))
        if m:
            margin = float(m.group(1)) * _UNIT_MM[m.group(2)]
    return paper[0] - 2 * margin, paper[1] - 2 * margin


def _graphic(d: Path, name: str) -> Path | None:
    for c in (name, name + ".pdf", f"figures/{name}", f"figures/{name}.pdf"):
        p = d / c
        if p.is_file():
            return p
    return None


def _aspect(pdf: Path | None) -> float | None:
    """height / width of the first page of a PDF, from pdfinfo."""
    if pdf is None or pdf.suffix != ".pdf" or not shutil.which("pdfinfo"):
        return None
    m = re.search(r"Page size:\s*([\d.]+) x ([\d.]+)", subprocess.run(["pdfinfo", str(pdf)], capture_output=True,
                                                                      text=True).stdout)
    return float(m.group(2)) / float(m.group(1)) if m and float(m.group(1)) else None


def _length_mm(v: str, tw: float, th: float) -> float | None:
    m = re.fullmatch(r"([\d.]*)\s*\\(textheight|textwidth|linewidth|columnwidth)", v.strip())
    if m:
        return (float(m.group(1) or 1)) * (th if m.group(2) == "textheight" else tw)
    m = re.fullmatch(r"([\d.]+)\s*(mm|cm|in|pt|bp)", v.strip())
    return float(m.group(1)) * _UNIT_MM[m.group(2)] if m else None


def figure_heights(d: Path, figs: list[str]) -> list[str]:
    """One line per figure: its tallest \\includegraphics as a fraction of the text height, where it can be found."""
    tw, th = _page_mm(d)
    out = []
    for f in figs:
        lab = re.search(r"\\label\{(fig:[^}]+)\}", f)
        best = None
        for m in re.finditer(r"\\includegraphics\*?\[([^\]]*)\]\{([^}]+)\}", f):
            opts = dict(o.split("=", 1) for o in re.split(r",\s*", m.group(1)) if "=" in o)
            h = next((_length_mm(opts[k], tw, th) for k in ("height", "totalheight") if k in opts), None)
            if h is None and "width" in opts:
                w, asp = _length_mm(opts["width"], tw, th), _aspect(_graphic(d, m.group(2)))
                h = w * asp if w is not None and asp else None
            if h is not None:
                best = max(best or 0.0, h / th)
        if lab and best is not None:
            flag = f"  over the {HEIGHT_BUDGET} budget (fine for the answer figure)" if best > HEIGHT_BUDGET else ""
            out.append(f"{lab.group(1)}: {best:.2f} of the text height{flag}")
    return out


def _places(s: str) -> int:
    return len(s.split(".")[1])


def _rounding_miss(a: str, b: str) -> bool:
    """True when the two decimals differ as written but by no more than one unit of the less precise one's last digit
    and are not the same number rounded: 0.34 vs 0.35, or 2.4 vs 2.46 (which rounds to 2.5)."""
    da, db = Decimal(a), Decimal(b)
    if da == db:
        return False
    q = Decimal(1).scaleb(-min(_places(a), _places(b)))
    if any(da.quantize(q, m) == db.quantize(q, m) for m in (ROUND_HALF_UP, ROUND_HALF_EVEN)):
        return False
    return abs(da - db) <= q


def _ticks(vals: set[Decimal]) -> set[Decimal]:
    """Members of any three-term arithmetic progression: axis tick labels, which are not results."""
    out = set()
    for x in vals:
        for y in vals:
            if y > x and x + 2 * (y - x) in vals:
                out |= {x, y, x + 2 * (y - x)}
    return out


def figure_number_misses(d: Path, body: str, figs: list[str]) -> list[str]:
    """Numbers (with a decimal point) printed in a figure PDF that differ only by rounding from a number in the paragraph
    citing the figure or in its caption. A hint, not a verdict: the two may be different quantities."""
    found = []
    for f in figs:
        lab = re.search(r"\\label\{(fig:[^}]+)\}", f)
        gm = re.search(r"\\includegraphics\*?(?:\[[^\]]*\])?\{([^}]+)\}", f)
        pdf = _graphic(d, gm.group(1)) if gm else None
        if not lab or pdf is None or pdf.suffix != ".pdf":
            continue
        if not shutil.which("pdftotext"):
            return ["pdftotext (poppler) is missing: numbers in figures not compared with the text"]
        ft = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
        fvals = set(_FIGNUM.findall(ft))
        ticks = _ticks({Decimal(x) for x in fvals})
        near = re.findall(r"\\caption(?:\[[^\]]*\])?\{.*", f, re.S)
        for para in re.split(r"\n\s*\n", body):
            if re.search(r"\\(?:[cC]ref|ref|[fF]igref|autoref)\{[^}]*\b" + re.escape(lab.group(1)) + r"\b", para):
                near.append(para)
        text = re.sub(r"\\(?:[cC]ref|ref|[fF]igref|autoref|label|cite\w*)\{[^}]*\}", " ", " ".join(near))
        bvals = set(_FIGNUM.findall(text))
        for fv in sorted(fvals):
            if Decimal(fv) in ticks:
                continue
            for bv in sorted(bvals):
                if _rounding_miss(fv, bv):
                    found.append(f"{lab.group(1)}: the figure shows {fv}, the text near it says {bv} (same quantity? "
                                 "then one is a rounding slip)")
    return found


# Words that point at someone else's finding; a sentence that uses one names its source (owner preference, 2026-11-09).
_SOURCE_WORDS = re.compile(r"\b(measured|reported|observed|recorded|published|known|the literature|studies|in vivo|in vitro|"
                           r"experiments?|demonstrated|estimated by)\b", re.I)
_CITED = re.compile(r"\\(?:paren|text|foot)?cite|\\cref|\\ref|\\figref|\\S|§|RESULTS|Section~|\b(?:we|our|here|this (?:model|cell|work))\b", re.I)


def unsourced_sentences(body: str, limit: int = 12) -> list[str]:
    """Sentences that say 'measured', 'reported', 'known', ... with no citation or own-work reference in them."""
    text = re.sub(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", " ", body, flags=re.S)
    text = re.sub(r"\\(?:section|subsection|label|claim|lead|input|status)\*?\{[^}]*\}", " ", text)
    out = []
    for sent in re.split(r"(?<=[.!?])\s+(?=[A-Z\\])", re.sub(r"\s+", " ", text)):
        if _SOURCE_WORDS.search(sent) and not _CITED.search(sent):
            out.append(sent.strip()[:140])
            if len(out) >= limit:
                break
    return out


def grey_figures(d: Path, figs: list[str]) -> list[str]:
    """Figures drawn with no colour at all (every pixel grey), when other figures of the write-up use colour: the same
    thing should keep its colour in every figure, main and supplementary (owner, 2026-11-09). Needs pdftoppm."""
    if not shutil.which("pdftoppm"):
        return []
    sat = {}
    for f in figs:
        m = re.search(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}", f)
        lab = re.search(r"\\label\{([^}]+)\}", f)
        if not m or not lab:
            continue
        pdf = (d / m.group(1))
        pdf = pdf if pdf.suffix else pdf.with_suffix(".pdf")
        if not pdf.exists() or pdf.suffix.lower() != ".pdf":
            continue
        r = subprocess.run(["pdftoppm", "-r", "20", "-singlefile", str(pdf)], capture_output=True)
        data = r.stdout
        if r.returncode or not data.startswith(b"P6"):
            continue
        parts = data.split(maxsplit=4)
        px = parts[4][1:] if parts[4][:1].isspace() else parts[4]
        sat[lab.group(1)] = max((max(px[i:i + 3]) - min(px[i:i + 3]) for i in range(0, len(px) - 2, 3)), default=0)
    coloured = [k for k, v in sat.items() if v > 40]
    return [f"{k}: drawn in grey only, while {len(coloured)} other figures use colour; give the things it shows the "
            "colours they have elsewhere" for k, v in sat.items() if v <= 40 and coloured]


def notes(d: Path) -> list[str]:
    """Reports that never fail the check: figure heights against the page, figure numbers against the text."""
    body = _strip_comments(_tex_sources(d)).split("\\begin{document}", 1)[-1]
    figs = [m.group(0) for m in re.finditer(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", body, re.S)]
    out = ["height " + x for x in figure_heights(d, figs)]
    out += ["numbers " + x for x in figure_number_misses(d, body, figs)]
    if figs and not shutil.which("pdftoppm"):
        out.append("edge check skipped: pdftoppm (poppler) is missing, so figures cut off at their edge are not detected")
    out += ["colour " + x for x in grey_figures(d, figs)]
    out += [f"source: names no source (who measured it, in what): '{x}'" for x in unsourced_sentences(body)]
    if not _ledger(d)["has_condition"] and _ledger(d)["claims"]:
        out.append("ledger.md has no condition column; add one (what each claim was tested under)")
    return out


def cmd_check(a) -> int:
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    probs = check(d)
    for p in probs:
        print("- " + p)
    ns = notes(d)
    if ns:
        print("notes (reported, they do not fail the check):")
        for n in ns:
            print("  " + n)
    if not (d / "build" / "main.aux").exists():
        print("(not built: figure-page checks skipped; run build)")
    print(f"{len(probs)} problem(s)")
    return 1 if probs else 0


# ------------------------------------------------------------------ readers
ROLES = {
    "pi": "the head of the lab: knows the field and what the lab is after, has not followed this piece of work, "
          "and must decide what to do next and whether it is ready to show outside the lab",
    "reviewer": "a skeptical reviewer for a good journal in the field: looks for claims that go beyond the evidence, "
                "missing controls, alternative explanations, unclear methods, numbers without uncertainty",
    "newcomer": "a capable student new to this sub-field: knows general neuroscience and maths, not this project, its "
                "jargon or its history; wants to understand every step",
    "outsider": "a scientist from a neighbouring field: reads for the main idea and whether the story holds together",
    "editor": "a scientific editor who reads for the prose, not the science: marks every sentence that is a fragment, "
              "reads as notes or as an instruction to the writer, is ambiguous, refers to something it does not name "
              "('the published model': whose?), or does not follow from the one before, and asks the question it raises",
}

BRIEF = """Status: historical ({date})

# Reader brief: {role} (round {n})

You are {desc}. Everything you know about this piece of work comes from this document: you have not seen its data, code or notes.
Read `{pdf}` (the rendered PDF; read every page, figures included) as that reader would.

Write `{out}`: every question this reader would ask, and every place they would get lost. Start the file with the line `Status: historical ({date})`, then use this format:

```
- Q<k> [p<page>, <section or figure>] [must|should|could] <the question, in the reader's words>
  why: <what in the text caused it: a term not defined, a step skipped, a claim without evidence, a figure that does not show what the text says, ...>
```

- must: the reader cannot follow or believe the argument without an answer. should: an answer would make it clearly better. could: nice to have.
- Ask what the reader would ask, not what the author could add. Do not suggest wording; do not praise.
- End with three lines: the main message as you understood it (one sentence); the weakest link in the argument; the figure that helped most and the one that helped least.

Do not open any other file of the project: the point is to see only what the reader sees.
"""


def cmd_readers(a) -> int:
    d = Path(a.dir).resolve()
    pdf = (d / "build" / "main.pdf").resolve()
    if not pdf.exists():
        print("no build/main.pdf: build first, readers read the rendered document")
        return 1
    rd = d / "review" / f"round-{a.round}"
    rd.mkdir(parents=True, exist_ok=True)
    for role in a.roles.split(","):
        role = role.strip()
        desc = ROLES.get(role, role)
        out = (rd / f"{role}.md").resolve()
        (rd / f"brief-{role}.md").write_text(BRIEF.format(role=role, n=a.round, desc=desc, pdf=pdf, out=out,
                                                       date=datetime.date.today().isoformat()))
        print(rd / f"brief-{role}.md")
    print("launch one fresh agent per brief (no project context); then sort the questions into review/questions.md")
    return 0


# ------------------------------------------------------------------ status
def cmd_status(a) -> int:
    d = Path(a.dir).resolve()
    led = _ledger(d)
    st = {}
    for c in led["claims"].values():
        st[c["status"] or "?"] = st.get(c["status"] or "?", 0) + 1
    print(f"claims: {len(led['claims'])} " + " ".join(f"{k} {v}" for k, v in sorted(st.items())))
    for r in sorted((d / "review").glob("round-*")):
        qs = [ln for f in r.glob("*.md") if not f.name.startswith("brief-") for ln in f.read_text().splitlines()
              if re.match(r"- Q\d+", ln)]
        must = sum("[must]" in q for q in qs)
        print(f"{r.name}: {len(qs)} questions, {must} must")
    q = d / "review" / "questions.md"
    if q.exists():
        t = q.read_text()
        opened = len(re.findall(r"^\|\s*R\d+[^|]*\|[^|]*\|\s*open\s*\|", t, re.M))
        print(f"review/questions.md: {opened} open")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("dir"); s.add_argument("--title")
    s = sub.add_parser("build"); s.add_argument("dir")
    s = sub.add_parser("pages"); s.add_argument("dir"); s.add_argument("--first", type=int); s.add_argument("--last", type=int)
    s.add_argument("--dpi", type=int, default=60)
    s = sub.add_parser("check"); s.add_argument("dir")
    s = sub.add_parser("readers"); s.add_argument("dir"); s.add_argument("--round", type=int, required=True)
    s.add_argument("--roles", default="pi,reviewer,newcomer,outsider,editor")
    s = sub.add_parser("status"); s.add_argument("dir")
    a = p.parse_args(argv)
    return {"init": cmd_init, "build": cmd_build, "pages": cmd_pages, "check": cmd_check, "readers": cmd_readers,
            "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
