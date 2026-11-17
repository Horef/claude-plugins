#!/usr/bin/env python3
"""research-writing tools: start a LaTeX write-up, build it, render its pages, check it, brief fresh readers.

Standard library only; needs latexmk (with lualatex or pdflatex, and biber) for `build`, and pdftoppm (poppler) for
`pages`; pdftotext and pdfinfo (poppler) are optional, for two of the check's notes. Every command takes the write-up folder (the one holding main.tex and ledger.md).

  wr.py init DIR [--title T] [--sections]   copy the template (main.tex, preamble.tex, ledger.md, refs.bib, figures/,
                                      review/); --sections then splits main.tex into sections/NN-slug.tex (see split)
  wr.py build DIR                     latexmk; copies the PDF to DIR/<DIR name>.pdf; prints undefined references and
                                      citations, overfull boxes, missing files
  wr.py pages DIR [--first N --last M --dpi 60]   PNG per page in DIR/build/pages, plus a contact sheet when Pillow is there
  wr.py check DIR                     the mechanical checks of the skill (exit 1 when a problem is found); then notes that
                                      never fail it: figure heights against the page, figure numbers vs the text (pdftotext); with pdftoppm,
                                      figures whose ink reaches their edge (cut off) are problems
  wr.py readers DIR --round N [--roles pi,reviewer,newcomer,outsider,editor] [--role NAME=DESCRIPTION ...]
                                      write one brief per fresh reader into review/round-N/; a role that is not one of
                                      these needs its description from --role (refused otherwise)
  wr.py status DIR                    claims, facts, values and the reader questions still open
  wr.py values DIR                    regenerate values.tex from values/*.json (build and check do it too); counts, errors,
                                      and the values changed since the last confirm
  wr.py confirm DIR [NAME|Fn ...]     record the current values in values.confirmed.json and the facts' sentences and
                                      tests in facts.confirmed.json (all, or the named ones): "I re-read every sentence
                                      that uses them"; check then lists what changed since
  wr.py where DIR [ID_OR_NAME ...]    no arguments: per file (input order) the claims, facts, figures and values it holds,
                                      i.e. which files a change touches; with C3, F2, fig:x or a value name: file:line of
                                      each place and the ledger links
  wr.py split DIR                     main.tex -> \\input{sections/NN-slug} per \\section (supplementary ones sNN-); the old
                                      main.tex is kept in build/main.before-split.tex
  wr.py upgrade DIR [--preamble F] [--dry-run]   a write-up from an older version: add what is missing (\\fact, \\val,
                                      \\valw to the preamble, values.tex input, ledger Values/Facts/Accepted and facts
                                      column, values.tex in .gitignore); old files kept in build/upgrade-<time>/
  wr.py numbers DIR [NAME ...] [--strong]   every typed number in the text and ledger rows that is or may be a value
                                      (check shows 20): likely ones (a count out of a value, matching words) first
  wr.py reword DIR [--out F] [--json] after a rerun: one task per sentence using a changed value, tagged number-only
                                      (light), words (standard) or conclusion (deep); written to review/reword-<date>.md

Optional files of a write-up (without them it behaves as before): values/*.json (named numbers written by the analysis
scripts: a number, {"value","fmt","source","unit"} or {"expr","fmt","source"}), the ledger's `## Facts` table and a
`facts` column in Claims, `\\val{name}`, `\\valw{name}` (a number word) and `\\fact{F3}` in the text, `{{name}}` in ledger rows, sections/*.tex under main.tex.

Exit codes: 0 ok, 1 problems found, 2 a tool is missing (not checked: never report that as clean).
"""
from __future__ import annotations

import argparse
import ast
import datetime
import json
import operator
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
    (d / ".gitignore").write_text("build/\nvalues.tex\n")
    print(f"started {d}: fill ledger.md first (message, reader, claims), then the skeleton in main.tex")
    return cmd_split(argparse.Namespace(dir=str(d))) if a.sections else 0


# ------------------------------------------------------------------ build
def _engine() -> str | None:
    for e in ("lualatex", "pdflatex"):
        if shutil.which(e):
            return e
    return None


def cmd_build(a) -> int:
    d = Path(a.dir).resolve()
    V = _sync_values(d)
    if V["errors"]:
        print("values have errors, not built:\n" + "\n".join("  - " + e for e in V["errors"]))
        return 1
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
    for m in re.finditer(r"Package wr Warning: value (\S+) undefined", log):
        out.append(f"undefined value {m.group(1)}: define it in values/*.json")
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


def _blank_comments(tex: str) -> str:
    """tex with every comment replaced by spaces of the same length: positions and line numbers stay."""
    return re.sub(r"(?<!\\)%.*", lambda m: " " * len(m.group(0)), tex)


_CID, _FID = r"C\d+[a-z]*", r"F\d+[a-z]*"  # claim and fact ids; a letter suffix (C1a) splits one claim (O25)


def _first(cell: str) -> str:
    """A status cell's first word, so 'established (2x and native); plausible (mechanism)' counts as established."""
    return (re.findall(r"[a-z]+", cell.lower()) or [""])[0]


def _labels(cell: str) -> list[str]:
    """The labels a figure cell names ('fig:seed (a)', 'fig:spread, fig:placement'); none for 'none (text)'."""
    return re.findall(r"[A-Za-z]+:[\w:.\-]*[\w]", cell.replace("`", ""))


def _idkey(s: str) -> tuple:
    """Sort key for C3, C3a, C12."""
    m = re.match(r"[A-Z](\d+)(.*)", s)
    return (int(m.group(1)), m.group(2)) if m else (0, s)


_INPUT = re.compile(r"\\(input|include)\{([^}]+)\}")


_MAX_DEPTH = 8


def _walk(d: Path) -> tuple[list[tuple[str, int, str]], dict[str, str]]:
    """(segments, {file: the file that inputs it}): main.tex with \\input/\\include files inlined at any depth (a section
    file that inputs a figure file), as (relative path, first line number in that file, text) in document order. Inputs
    of preamble* files and of files that do not exist are dropped; \\input lines in comments are not followed."""
    segs, parents = [], {}

    def walk(rel: str, text: str, chain: tuple) -> None:
        cur, start, pos, emitted = "", 0, 0, False
        for m in _INPUT.finditer(_blank_comments(text)):
            sub = Path(m.group(2) if m.group(2).endswith(".tex") else m.group(2) + ".tex").as_posix()
            cur += text[pos:m.start()]
            pos = m.end()
            p = d / sub
            if p.name.startswith("preamble") or not p.is_file() or sub in chain or len(chain) > _MAX_DEPTH:
                continue
            if cur:
                segs.append((rel, 1 + text.count("\n", 0, start), cur))
                emitted = True
            parents.setdefault(sub, rel)
            walk(sub, p.read_text(), chain + (sub,))
            cur, start = "", pos
        cur += text[pos:]
        if cur or not emitted:
            segs.append((rel, 1 + text.count("\n", 0, start), cur))
    walk("main.tex", (d / "main.tex").read_text(), ("main.tex",))
    return segs, parents


def _segments(d: Path) -> list[tuple[str, int, str]]:
    """main.tex with \\input/\\include files inlined at any depth, as (relative path, first line, text) in order."""
    return _walk(d)[0]


def _homes(d: Path) -> dict[str, str]:
    """{file: the file it belongs to}: a file holding only figures or tables (figures/fig_x.tex) belongs to the file
    that inputs it, so a figure input at the paragraph that cites it counts as placed there (O23)."""
    segs, parents = _walk(d)
    text = {}
    for rel, _, s in segs:
        text[rel] = text.get(rel, "") + s
    only_floats = {rel for rel, s in text.items() if rel != "main.tex" and not re.sub(
        r"\\begin\{(figure|table)\*?\}.*?\\end\{\1\*?\}", "", _strip_comments(s), flags=re.S).strip()}

    def home(rel, n=0):
        return home(parents[rel], n + 1) if rel in only_floats and rel in parents and n < _MAX_DEPTH else rel
    return {rel: home(rel) for rel in text}


def _tex_sources(d: Path) -> str:
    """main.tex with \\input/\\include files inlined (at any depth)."""
    return "".join(t for _, _, t in _segments(d))


def _source_files(d: Path) -> list[tuple[str, str]]:
    """(relative path, text) of main.tex and then of each inlined file, in input order: the files a problem or a
    `where` answer can name as file:line."""
    return [("main.tex", (d / "main.tex").read_text())] + [(r, t) for r, _, t in _segments(d) if r != "main.tex"]


def _hits(segs, rx) -> list[tuple[str, int, re.Match, bool]]:
    """(file, line, match, inside the In short box) of rx in the comment-stripped text of each segment, in document order."""
    out = []
    for rel, l0, text in segs:
        s = _strip_comments(text)
        spans = [m.span() for m in re.finditer(r"\\begin\{(inshort|abstract)\}.*?\\end\{\1\}", s, re.S)]
        for m in rx.finditer(s):
            out.append((rel, l0 + s.count("\n", 0, m.start()), m, any(a <= m.start() < b for a, b in spans)))
    return out


def _at(h) -> str:
    """file:line of a _hits entry, with '(In short)' when it is inside the summary box."""
    return f"{h[0]}:{h[1]}" + (" (In short)" if h[3] else "")


def _md_table(text: str, id_re: str, names: tuple, default: dict):
    """(columns, rows) of the table in text whose header starts '| id |': columns by header name (prefix match, after the
    id column, so older ledgers with fewer columns still parse), rows {id: cells} for the lines starting with an id."""
    cols = dict(default)
    h = re.search(r"^\|\s*id\s*\|(.*)$", text, re.M | re.I)
    if h:
        for k, c in enumerate(x.strip().lower() for x in h.group(1).split("|")):
            for name in names:
                if c.startswith(name):
                    cols[name] = k
    rows = {}
    for row in re.finditer(r"^\|\s*(" + id_re + r")\s*\|(.*)$", text, re.M):
        rows[row.group(1)] = [c.strip() for c in row.group(2).split("|")]
    return cols, rows


def _ledger(d: Path) -> dict:
    """ledger.md as {"message", "claims": {id: {claim, status, evidence, figure, condition, facts: [F ids]}},
    "facts": {id: {fact, values: [names], test, status, condition, evidence}}, "has_condition", "has_facts"}. Each table
    is read inside its own `## Claims` / `## Facts` section; a fully empty Facts row is the template's and is ignored."""
    p = d / "ledger.md"
    out = {"claims": {}, "facts": {}, "message": "", "has_condition": False, "has_facts": False, "accepted": []}
    if not p.exists():
        return out
    t = p.read_text()
    m = re.search(r"## Message\s*(.*?)(?=\n## )", t, re.S)
    out["message"] = re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip() if m else ""
    secs = {}
    for part in re.split(r"(?m)^## ", t)[1:]:
        head, _, rest = part.partition("\n")
        secs[(head.split() or [""])[0].lower()] = rest
    cols, rows = _md_table(secs.get("claims", t), _CID, ("claim", "status", "evidence", "figure", "condition", "facts"),
                           {"claim": 0, "status": 1, "evidence": 2, "figure": 3})
    out["has_condition"] = "condition" in cols
    for cid, cells in rows.items():
        c = {n: (cells[k] if k < len(cells) else "") for n, k in cols.items()}
        c.setdefault("condition", "")
        c["facts"] = re.findall(_FID, c.get("facts", "").replace("`", ""))
        out["claims"][cid] = c
    # ## Accepted: one line per accepted check result, `text it contains` and why (O26)
    out["accepted"] = [(m.group(1), m.group(2).strip(" -:—"))
                       for m in re.finditer(r"^\s*-\s*`([^`]+)`(.*)$", re.sub(r"<!--.*?-->", "", secs.get("accepted", ""),
                                                                                flags=re.S), re.M)]
    if "facts" in secs:
        out["has_facts"] = True
        cols, rows = _md_table(secs["facts"], _FID, ("fact", "values", "test", "status", "condition", "evidence"),
                               {"fact": 0, "values": 1, "test": 2, "status": 3, "condition": 4, "evidence": 5})
        for fid, cells in rows.items():
            f = {n: (cells[k] if k < len(cells) else "").replace("`", "").strip() for n, k in cols.items()}
            if any(f.values()):
                f["values"] = [x for x in re.split(r"[,\s]+", f["values"]) if x]
                out["facts"][fid] = f
    return out


# ------------------------------------------------------------------ values and facts
_NAME = re.compile(r"[A-Za-z][A-Za-z0-9_]*")
_ARITH = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
          ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow}
_CMP = {ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge, ast.Eq: operator.eq,
        ast.NotEq: operator.ne}
_FUNCS = {"abs": abs, "min": min, "max": max, "round": round}


class _ExprError(Exception):
    """An expression that cannot be evaluated: syntax, a name that is not defined, a disallowed construct."""


def _eval_expr(text: str, get, logic: bool = False):
    """Value of an arithmetic expression (numbers, names looked up with get(name), + - * / // % **, unary -, parentheses,
    abs/min/max/round); with logic=True a test: comparisons (chained too), and/or/not, True/False, giving a bool.
    Walks the ast and allows nothing else; never uses eval."""
    try:
        tree = ast.parse(text.strip(), mode="eval")
    except (SyntaxError, ValueError):
        raise _ExprError(f"`{text}` is not a valid expression") from None

    def ev(n):
        if isinstance(n, ast.Constant):
            if isinstance(n.value, bool) and logic or isinstance(n.value, (int, float)) and not isinstance(n.value, bool):
                return n.value
            raise _ExprError(f"`{ast.unparse(n)}` is not a number")
        if isinstance(n, ast.Name):
            return get(n.id)
        if isinstance(n, ast.BinOp) and type(n.op) in _ARITH:
            a, b = ev(n.left), ev(n.right)
            if isinstance(n.op, ast.Pow) and abs(b) > 1000:
                raise _ExprError("exponent too large")
            r = _ARITH[type(n.op)](a, b)
            if isinstance(r, complex):
                raise _ExprError("result is not a real number")
            return r
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            return -ev(n.operand) if isinstance(n.op, ast.USub) else ev(n.operand)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FUNCS and not n.keywords:
            return _FUNCS[n.func.id](*[ev(x) for x in n.args])
        if logic and isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
            return not ev(n.operand)
        if logic and isinstance(n, ast.BoolOp):
            vals = [ev(x) for x in n.values]
            return all(vals) if isinstance(n.op, ast.And) else any(vals)
        if logic and isinstance(n, ast.Compare) and all(type(o) in _CMP for o in n.ops):
            left = ev(n.left)
            for op, right in zip(n.ops, n.comparators):
                right = ev(right)
                if not _CMP[type(op)](left, right):
                    return False
                left = right
            return True
        raise _ExprError(f"`{ast.unparse(n)}` is not allowed here (numbers, names, + - * / // % ** and abs, min, max, round"
                         + ("; comparisons, and/or/not for a test" if logic else "") + ")")
    try:
        r = ev(tree.body)
    except (ZeroDivisionError, OverflowError, TypeError, ValueError, RecursionError) as e:
        raise _ExprError(f"{type(e).__name__}: {e}") from None
    if logic and not isinstance(r, bool):
        raise _ExprError(f"`{text}` is not a true/false test (use a comparison)")
    return r


def _expr_names(text: str) -> list[str]:
    """Names an expression mentions, in order."""
    try:
        return list(dict.fromkeys(n.id for n in ast.walk(ast.parse(text.strip(), mode="eval")) if isinstance(n, ast.Name)))
    except (SyntaxError, ValueError):
        return []


def _fmt(num, fmt: str | None, derived: bool) -> str:
    """A value as LaTeX text: format(num, fmt); without fmt a stored number as str() and a derived one as .3g.
    An exponent becomes \\ensuremath{1.2\\times10^{-5}}; % # & _ $ are escaped."""
    s = format(num, fmt) if fmt else (format(num, ".3g") if derived else str(num))
    m = re.fullmatch(r"(-?[\d.]+)[eE]([+-]?\d+)", s)
    if m:
        return "\\ensuremath{%s\\times10^{%d}}" % (m.group(1), int(m.group(2)))
    for c in "%#&_$":
        s = s.replace(c, "\\" + c)
    return s


def _plain(text: str) -> str:
    """A formatted value as typed in running text: \\% and % alike."""
    return text.replace("\\%", "%")


def _values(d: Path) -> dict:
    """The named values of DIR/values/*.json: {"vals": {name: {num, text, fmt, source, unit, file, derived}}, "errors":
    [...], "names": every declared name (also those with an error), "dir": whether values/ exists}. Names are unique
    across files; derived values ({"expr": ...}) are computed from the others; cycles and undefined names are errors."""
    V = {"vals": {}, "errors": [], "names": set(), "dir": (d / "values").is_dir()}
    if not V["dir"]:
        return V
    err, raw = V["errors"], {}
    for f in sorted((d / "values").glob("*.json")):
        rel = f"values/{f.name}"
        try:
            data = json.loads(f.read_text())
        except ValueError as e:
            err.append(f"{rel}: not valid JSON ({e}): fix the file, or rerun the analysis script that writes it")
            continue
        if not isinstance(data, dict):
            err.append(f"{rel}: must be a JSON object mapping name -> number or {{\"value\": ..., \"fmt\": ...}}")
            continue
        for name, e in data.items():
            if not _NAME.fullmatch(name):
                err.append(f"{rel}: '{name}' is not a valid name (a letter, then letters, digits or underscores)")
                continue
            if name in raw:
                err.append(f"values: '{name}' is defined in {raw[name]['file']} and in {rel}: keep one definition")
                continue
            V["names"].add(name)
            ent = dict(e) if isinstance(e, dict) else {"value": e}
            ent["file"] = rel
            num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
            if ("value" in ent) == ("expr" in ent):
                err.append(f"{rel}: {name} needs exactly one of \"value\" (a number) or \"expr\" (over other names)")
            elif "value" in ent and not num(ent["value"]):
                err.append(f"{rel}: {name}: \"value\" must be a number, not {json.dumps(ent['value'])}")
            elif "expr" in ent and not isinstance(ent["expr"], str):
                err.append(f"{rel}: {name}: \"expr\" must be a string")
            elif not isinstance(ent.get("fmt", ""), str):
                err.append(f"{rel}: {name}: \"fmt\" must be a string such as \".3f\" or \".0%\"")
            else:
                raw[name] = ent
    done, bad = {}, set()

    def get(name, stack):
        if name in done:
            return done[name]
        if name in bad:
            raise _ExprError(f"{name} has an error (reported above)")
        if name not in raw:
            raise _ExprError(f"{name} is not a defined value")
        if name in stack:
            raise _ExprError("cycle " + " -> ".join(stack[stack.index(name):] + [name]))
        e = raw[name]
        if "expr" not in e:
            done[name] = e["value"]
            return done[name]
        try:
            done[name] = _eval_expr(e["expr"], lambda n: get(n, stack + [name]))
        except _ExprError as x:
            if not getattr(x, "reported", False):
                err.append(f"{e['file']}: {name} = `{e['expr']}`: {x}")
                x.reported = True
            bad.add(name)
            raise
        return done[name]
    for name in raw:
        try:
            get(name, [])
        except _ExprError:
            pass
    for name, e in raw.items():
        if name not in done:
            continue
        try:
            text = _fmt(done[name], e.get("fmt") or None, "expr" in e)
        except (ValueError, TypeError, OverflowError) as x:
            err.append(f"{e['file']}: {name}: fmt '{e.get('fmt')}' fails ({x}): use a Python format spec such as .3f, .0% or .2g")
            continue
        V["vals"][name] = {"num": done[name], "text": text, "fmt": e.get("fmt", ""), "source": e.get("source", ""),
                           "unit": e.get("unit", ""), "file": e["file"], "derived": "expr" in e,
                           "expr": e.get("expr", "")}
    return V


_WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
          "seventeen eighteen nineteen twenty").split()


def _word(num) -> str | None:
    """A whole number from 0 to 20 as an English word (\\valw prints it); None otherwise."""
    if isinstance(num, bool) or not isinstance(num, (int, float)) or num != int(num) or not 0 <= num <= 20:
        return None
    return _WORDS[int(num)]


def _write_values_tex(d: Path, V: dict) -> None:
    """DIR/values.tex: one \\wrsetval{name}{text} per value (rewritten only when it changes, so latexmk is not disturbed)."""
    words = [(n, _word(v["num"])) for n, v in V["vals"].items()]
    new = "".join(["% generated by wr.py values from values/*.json; do not edit\n",
                   "\\providecommand{\\wrsetvalw}[3]{}% a preamble from before \\valw (wr.py upgrade adds it)\n",
                   "\\providecommand{\\wrsetvalc}[2]{}% a preamble from before \\valp and \\valw[none]\n"]
                  + [f"\\wrsetval{{{n}}}{{{v['text']}}}\n" for n, v in V["vals"].items()]
                  + [f"\\wrsetvalw{{{n}}}{{{w}}}{{{w.capitalize()}}}\n" for n, w in words if w]
                  + [f"\\wrsetvalc{{{n}}}{{{'z' if w == 'zero' else 'o'}}}\n" for n, w in words if w in ("zero", "one")])
    p = d / "values.tex"
    if not p.exists() or p.read_text() != new:
        p.write_text(new)


def _sync_values(d: Path) -> dict:
    """Read values/*.json and regenerate values.tex when values/ exists (called at the start of build and check)."""
    V = _values(d)
    if V["dir"]:
        _write_values_tex(d, V)
    return V


def _snapshot(d: Path) -> tuple[dict | None, str | None]:
    """(values.confirmed.json as {name: text} or None when absent, a problem message when it is unreadable)."""
    p = d / "values.confirmed.json"
    if not p.exists():
        return None, None
    try:
        s = json.loads(p.read_text())
        if isinstance(s, dict):
            return {k: str(v) for k, v in s.items()}, None
    except ValueError:
        pass
    return None, "values.confirmed.json is not a JSON object {name: text}: delete it and run wr.py confirm DIR again"


_VAL, _FACT, _CLAIM = re.compile(r"\\(?:val|valw|Valw|valp)(?:\[[^\]]*\])?\{([^{}]*)\}"), re.compile(r"\\fact\{([^{}]*)\}"), re.compile(r"\\claim\{([^{}]*)\}")
_REF = re.compile(r"\\(?:[cC]ref|ref|[fF]igref|autoref)\{([^}]*)\}")
_FIGENV = re.compile(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", re.S)


def _fact_test(f: dict, V: dict) -> tuple[bool | None, str | None]:
    """(result of the fact's test, why it could not be evaluated); (None, None) when it has no test."""
    if not f["test"]:
        return None, None
    nums = {n: v["num"] for n, v in V["vals"].items()}

    def get(n):
        if n not in nums:
            raise _ExprError(f"{n} is not a defined value")
        return nums[n]
    try:
        return _eval_expr(f["test"], get, logic=True), None
    except _ExprError as x:
        return None, str(x)


def _status(f: dict) -> str:
    """A fact's status word: holds, fails, open or superseded (the cell may say 'superseded by F7')."""
    return (f["status"].split() or [""])[0].lower()


def _fact_text(f: dict) -> str:
    """A fact's sentence and test, normalised (case, spaces, final full stop) so only a real change counts."""
    return " ".join(f["fact"].lower().split()).rstrip(" .") + " | " + " ".join(f["test"].split())


def _fact_snapshot(d: Path) -> dict | None:
    """facts.confirmed.json as {fact id: normalised sentence and test}, or None when absent or unreadable."""
    try:
        s = json.loads((d / "facts.confirmed.json").read_text())
        return {k: str(v) for k, v in s.items()} if isinstance(s, dict) else None
    except (OSError, ValueError):
        return None


def fact_changes(d: Path, led: dict) -> list[str]:
    """Facts whose sentence or test changed since `wr.py confirm` (requirement tracing's 'outdated' link: a claim
    resting on a reworded fact may still assume the old meaning)."""
    snap, rest, out = _fact_snapshot(d), _rests_on(led), []
    for fid, f in (led["facts"].items() if snap else []):
        if fid in snap and snap[fid] != _fact_text(f) and _status(f) != "superseded":
            on = rest.get(fid, [])
            out.append(f"ledger.md {fid} changed since it was confirmed (was: {snap[fid]}): re-read the sentence marked "
                       f"\\fact{{{fid}}}" + (f" and the claims resting on it ({', '.join(on)})" if on else "")
                       + f", then `wr.py confirm DIR {fid}`")
    return out


def _rests_on(led: dict) -> dict[str, list[str]]:
    """{fact id: [claim ids resting on it]}."""
    out: dict[str, list[str]] = {}
    for cid, c in led["claims"].items():
        for fid in c["facts"]:
            out.setdefault(fid, []).append(cid)
    return out


_LEDVAL = re.compile(r"\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}")


def _led_rows(led: dict):
    """(id, sentence) of every claim and fact of the ledger."""
    return [(i, c["claim"]) for i, c in led["claims"].items()] + [(i, f["fact"]) for i, f in led["facts"].items()]


def _expand(text: str, V: dict) -> str:
    """A ledger sentence with each {{name}} replaced by the value as printed (??name when it is not defined)."""
    return _LEDVAL.sub(lambda m: _plain(V["vals"][m.group(1)]["text"]).replace("\\", "") if m.group(1) in V["vals"]
                       else f"??{m.group(1)}", text)


def _uses(name: str, V: dict, led: dict, hits: list) -> tuple[list[str], list[str], list[str]]:
    """(places of \\val{name} in the text and of {{name}} in the ledger's rows, facts using the value, claims resting on
    those facts)."""
    places = [_at(h) for h in hits if h[2].group(1) == name]
    places += [f"ledger.md {i}" for i, t in _led_rows(led) if name in _LEDVAL.findall(t)]
    facts = [fid for fid, f in led["facts"].items() if name in f["values"] or name in _expr_names(f["test"])]
    rest = _rests_on(led)
    claims = list(dict.fromkeys(c for fid in facts for c in rest.get(fid, [])))
    return places, facts, claims


def _src(v: dict | None) -> str:
    """' (source: X)' for a value that names one, else ''."""
    return f" (source: {v['source']})" if v and v.get("source") else ""


def changed_values(d: Path, V: dict) -> tuple[dict[str, tuple[str, str | None]], str | None]:
    """({name: (confirmed text, text now or None)} of the values that differ from values.confirmed.json, a problem
    message); values with an error are left out (reported with the value errors)."""
    snap, bad = _snapshot(d)
    if bad or snap is None:
        return {}, bad
    return {n: (old, V["vals"][n]["text"] if n in V["vals"] else None) for n, old in snap.items()
            if V["vals"].get(n, {}).get("text") != old and not (n in V["names"] and n not in V["vals"])}, None


def _causes(changed: dict, V: dict) -> dict[str, list[str]]:
    """{changed derived value: the changed stored values it is computed from}; empty list when none of them changed
    (its expression changed, or it was confirmed apart)."""
    return {n: sorted(r for r in _depends(n, V) if r != n and r in changed) for n in changed
            if V["vals"].get(n, {}).get("derived")}


def value_changes(d: Path, V: dict, led: dict, segs: list) -> tuple[list[str], bool]:
    """(problems, whether a snapshot exists): one entry per changed value with each place that uses it; a derived
    value that changed because a value it is computed from changed is listed inside that value's entry (one cause,
    one entry), with its own places."""
    snap, bad = _snapshot(d)
    if bad:
        return [bad], False
    if snap is None:
        return [], False
    changed, _ = changed_values(d, V)
    causes = _causes(changed, V)
    hits = _hits(segs, _VAL)

    def uses(name):
        places, facts, claims = _uses(name, V, led, hits)
        return "; ".join(x for x in (", ".join(places), "facts " + ", ".join(facts) if facts else "",
                                     "claims " + ", ".join(claims) + " (through those facts)" if claims else "") if x)

    def what(name):
        old, new = changed[name]
        return f"now {new}, was {old}" if new is not None else f"no longer defined, was {old}"
    out = []
    for name in changed:
        if causes.get(name):
            continue  # listed with the first value that caused it
        followers = [n for n, c in causes.items() if c and c[0] == name]
        where = uses(name)
        line = (f"value {name} changed since it was confirmed ({what(name)}){_src(V['vals'].get(name))}; "
                + (f"used in: {where}" if where else "nothing uses it directly"))
        for f in followers:
            fw = uses(f)
            also = [c for c in causes[f] if c != name]
            line += (f"; with it {f} ({what(f)}" + (f", also from {', '.join(also)}" if also else "") + ")"
                     + (f" in: {fw}" if fw else ", used nowhere"))
        busy = where or any(uses(f) for f in followers)
        out.append(line + (": re-read them, then" if busy else ":") + f" `wr.py confirm DIR {' '.join([name] + followers)}`")
    return out, True


def check_values_facts(V: dict, led: dict, segs: list) -> list[str]:
    """Problems of values/*.json, \\val in the text, the ledger's Facts and the claims resting on them."""
    probs = list(V["errors"])
    for h in _hits(segs, _VAL):
        if h[2].group(1) not in V["names"]:
            probs.append(f"{_at(h)}: \\val{{{h[2].group(1)}}} is not a defined value: define it in values/*.json (the "
                         "analysis script writes it) or fix the name")
    for i, t in _led_rows(led):
        for n in _LEDVAL.findall(t):
            if n not in V["names"]:
                probs.append(f"ledger.md {i}: {{{{{n}}}}} is not a defined value: define it in values/*.json or fix the name")
    marks: dict[str, list[str]] = {}
    for h in _hits(segs, _FACT):
        marks.setdefault(h[2].group(1), []).append(_at(h))
    for fid, locs in marks.items():
        if fid not in led["facts"]:
            probs.append(f"{locs[0]}: \\fact{{{fid}}} is not in ledger.md: add the fact to the Facts table or fix the id")
    rest = _rests_on(led)
    nums = {n: v["num"] for n, v in V["vals"].items()}
    dead = set()
    for fid, f in led["facts"].items():
        if not f["fact"]:
            probs.append(f"ledger.md {fid}: empty fact: state the result in one sentence")
            continue
        if _status(f) == "superseded":
            dead.add(fid)
            if marks.get(fid):
                probs.append(f"ledger.md {fid} is {f['status']} but still stated at {', '.join(marks[fid])}: state the "
                             "fact that replaces it instead")
            continue
        if _status(f) not in ("holds", "fails", "open"):
            probs.append(f"ledger.md {fid}: status '{f['status']}' is not holds, fails, open or 'superseded by Fn'")
        for n in f["values"]:
            if n not in V["names"]:
                probs.append(f"ledger.md {fid}: value '{n}' is not defined: add it to values/*.json or fix the name")
        res, why = _fact_test(f, V)
        if why:
            probs.append(f"ledger.md {fid}: its test `{f['test']}` cannot be evaluated ({why}): fix the test or the value")
        if res is False and f["status"] == "holds":
            shown = ", ".join(f"{n} = {format(nums[n], '.6g')}" for n in _expr_names(f["test"]) if n in nums)
            probs.append(f"ledger.md {fid}: its test `{f['test']}` is false now ({shown}): rewrite the fact or set it to "
                         "fails" + (f", then recheck {', '.join(rest[fid])}" if fid in rest else ""))
        if f["status"] == "fails" or res is False:
            dead.add(fid)
        n = len(marks.get(fid, []))
        if n == 0:
            probs.append(f"ledger.md {fid}: not stated in the text: state it once where it belongs (\\fact{{{fid}}} before "
                         "the sentence), or drop it from the ledger")
        elif n > 1:
            probs.append(f"ledger.md {fid}: stated {n} times ({', '.join(marks[fid])}): state it once and refer back")
    for cid, c in led["claims"].items():
        for fid in c["facts"]:
            if fid not in led["facts"]:
                probs.append(f"ledger.md {cid}: facts column names {fid}, which is not in the Facts table")
            elif fid in dead:
                why = led["facts"][fid]["status"] if _status(led["facts"][fid]) == "superseded" else "no longer holds"
                probs.append(f"ledger.md {cid} rests on {fid}, which {'is ' + why if why != 'no longer holds' else why}: "
                             "revise the claim (or point it at the new fact) or its status")
            elif _first(c["status"]) == "established" and _status(led["facts"][fid]) == "open":
                probs.append(f"ledger.md {cid} is established but rests on {fid}, which is open: settle {fid} or make "
                             f"{cid} plausible")
    return probs


def check_preamble(d: Path, segs: list) -> list[str]:
    """Marks used in the text that the write-up's preamble does not define (a write-up from an older version of the
    skill): the build would stop at the first one."""
    defs = _strip_comments("".join(f.read_text() for f in sorted(d.glob("preamble*.tex"))) + (d / "main.tex").read_text())
    used = {h[2].group(1) for h in _hits(segs, re.compile(r"\\(val|valw|Valw|valp|fact)\{"))}
    missing = sorted(c for c in used if not re.search(r"\{\\" + c + r"\}|\\(?:def|DeclareRobustCommand|newcommand)\\"
                                                      + c + r"(?![A-Za-z])", defs))
    out = [f"\\{c} is used in the text but no preamble defines it: run `wr.py upgrade DIR`" for c in missing]
    if _hits(segs, re.compile(r"\\[vV]alw\[")) and not re.search(r"\\wrsetvalc\b", defs):
        out.append("\\valw[word]{name} (a word for zero) needs the newer \\valw in the preamble: run `wr.py upgrade DIR`")
    return out


def _input_targets(d: Path, segs: list) -> list[tuple[str, str]]:
    """(target file, file:line) of every \\input/\\include: main.tex (also those dropped as missing) and inlined files."""
    main = (d / "main.tex").read_text()
    blank = _blank_comments(main)
    out = []
    for m in _INPUT.finditer(blank):
        rel = m.group(2) if m.group(2).endswith(".tex") else m.group(2) + ".tex"
        out.append((Path(rel).as_posix(), f"main.tex:{1 + main.count(chr(10), 0, m.start())}"))
    out += [(Path(h[2].group(2) if h[2].group(2).endswith(".tex") else h[2].group(2) + ".tex").as_posix(), _at(h))
            for h in _hits([s for s in segs if s[0] != "main.tex"], _INPUT)]
    return out


def check_sections(d: Path, segs: list) -> list[str]:
    """With sections/ in use (main.tex inputs one): each section file input once, every input exists, no orphan file,
    and a claim marked in one file only."""
    ins = _input_targets(d, segs)
    if not any(t.startswith("sections/") and loc.startswith("main.tex") for t, loc in ins):
        return []
    probs, where = [], {}
    for t, loc in ins:
        if t.startswith("sections/"):
            where.setdefault(t, []).append(loc)
    for t, locs in where.items():
        if len(locs) > 1:
            probs.append(f"{t} is input {len(locs)} times ({', '.join(locs)}): input each section file once")
        if not (d / t).exists():
            probs.append(f"{locs[0]}: \\input of {t}, which does not exist: create it or remove the line")
    for f in sorted((d / "sections").glob("*.tex")):
        if f"sections/{f.name}" not in where:
            probs.append(f"sections/{f.name} is not input anywhere: add \\input{{sections/{f.stem}}} to main.tex where it "
                         "belongs, or delete the file")
    claims: dict[str, list] = {}
    for h in _hits(segs, _CLAIM):
        claims.setdefault(h[2].group(1), []).append(h)
    for cid, hs in claims.items():
        if len({h[0] for h in hs}) > 1:
            probs.append(f"{cid} is marked in {', '.join(_at(h) for h in hs)}: a claim is made in one section, the others "
                         "refer to it; remove the \\claim marker from all but one")
    return probs


_MASK = re.compile(r"\\(?:val|valw|Valw|valp|label|[cC]ref|ref|eqref|pageref|[fF]igref|autoref|(?:paren|text|foot)?cite\w*|fact|claim|input|"
                   r"include|includegraphics\*?)\*?(?:\[[^\]]*\])*\{[^}]*\}")
_NUM = re.compile(r"(?<![\w.\\])(\d+(?:\.\d+)?)(\\?%)?(?![\w\\×]|\s*\$?\\times)")


_NUMWORD = re.compile(r"(?<![\w\\-])(" + "|".join(_WORDS) + r")(?![\w-])", re.I)
_STOP = set("a an the of in on at to for from by with and or but as is are was were be been that this these those its "
            "their our we it which who than then there here not no all only also both each every per out into over under "
            "about near".split())
_WORD = re.compile(r"[A-Za-z]+")


def _stem(w: str) -> str:
    """A word reduced for comparison: lower case, a plural s dropped (placements -> placement)."""
    w = w.lower()
    return w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w


def _next_word(s: str, i: int) -> str:
    """The first word that is not a stop word in s after position i, within the same sentence (or '')."""
    for m in _WORD.finditer(s, i, min(len(s), i + 60)):
        if re.search(r"[.;:]\s|\\\\|&|[()]", s[i:m.start()]):
            return ""
        if m.group(0).lower() not in _STOP:
            return _stem(m.group(0))
    return ""


def _context_words(segs: list, V: dict) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """({value name: words that follow it in the text}, {value name: words of its unit and name}): the first content
    word after each \\val{name} ('of \\val{h3_n} placements' -> placement); the unit and name words (n_fail -> fail).
    A bare number followed by one of them is likely that value; the first kind is the stronger evidence."""
    meta: dict[str, set[str]] = {n: {_stem(w) for w in _WORD.findall(v.get("unit", "") + " " + n.replace("_", " "))
                                     if len(w) > 2 and w.lower() not in _STOP} for n, v in V["vals"].items()}
    out: dict[str, set[str]] = {n: set() for n in V["vals"]}
    after: dict[str, set[str]] = {}
    for h in _hits(segs, _VAL):
        if h[2].group(1) in out:
            w = _next_word(h[2].string, h[2].end())
            if w:
                after.setdefault(w, set()).add(h[2].group(1))
    for w, names in after.items():
        if len(names) <= 3:  # a word that follows many values ('draws') says nothing about which one
            for n in names:
                out[n].add(w)
    return out, meta


# a number that names a set rather than counts a result: 'the three draws (a to c)', 'the first three' (O31)
_ENUM_AFTER = re.compile(r"\s*(?:[A-Za-z-]+\s+){0,2}\(\s*(?:\w{1,3}\s*(?:to|--?|–|\\textendash)\s*\w{1,3}|"
                         r"\w{1,3}(?:\s*,\s*\w{1,3})+(?:,?\s*and\s+\w{1,3})?)\s*\)")
_ENUM_BEFORE = re.compile(r"\b(?:first|last|initial|final|top|bottom|other)\s+$", re.I)
AMBIGUOUS = 3  # a typed number equal to more values than this, with no words to tell them apart, is not listed (O34)


_OF = re.compile(r"\s*(?:~|\s)*(?:out\s+)?of\s+(?:the\s+|all\s+)?(?:\\val\{([^{}]*)\}|(\d+)(?![\w.]))")


def _scan_numbers(segs: list, V: dict, ledger: bool = False) -> list[tuple[bool | None, str]]:
    """(strong, note) per number typed in the text that is, or may be, a defined value. Strong notes have evidence
    beyond the digits: the word after it is one that follows the value elsewhere (or its unit, when few values share
    the number), or it counts out of a value ('7 of \\val{h3_n}'), which also catches a typed count no value equals
    any more. Whole numbers below 10 and number words ('six') are noted only when strong, and never when they name a
    set ('the three draws (a to c)', 'the first three'); other numbers when they equal a value or its rounding.
    strong is None (counted, listed only on request; O34) for a number with nothing to tell which value it is: equal to
    more than AMBIGUOUS values, a short number (two significant digits) equal to two or more, or a whole number
    followed by a word that is not what the value counts ('10 trials' for a count of draws)."""
    if not V["vals"]:
        return []
    (ctx, meta), found, seen_doc = _context_words(segs, V), [], ledger
    ints = {}
    for n, v in V["vals"].items():
        if _word(v["num"]) is not None:
            ints.setdefault(int(v["num"]), []).append(n)
    by_text = {}
    for n, v in V["vals"].items():
        by_text.setdefault(_plain(v["text"]), []).append(n)
    def how(n: str, tok: str = "") -> str:
        """How to write value n where tok was typed: {{n}} in the ledger, \\valw/\\Valw for a number word."""
        if ledger:
            return f"{{{{{n}}}}}"
        cmd = ("Valw" if tok[:1].isupper() else "valw") if tok[:1].isalpha() else "val"
        return f"\\{cmd}{{{n}}}"
    for rel, l0, text in segs:
        if not seen_doc:
            i = text.find("\\begin{document}")
            if i < 0 and rel == "main.tex":
                continue
            seen_doc = True
            text = re.sub(r"[^\n]", " ", text[:max(i, 0) + 16]) + text[max(i, 0) + 16:] if i >= 0 else text
        s = _MASK.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), _strip_comments(text))
        s_full = _strip_comments(text)  # \val kept, for 'N of \val{x}'
        toks = [(m.start(), m.end(), m.group(1), bool(m.group(2)), False) for m in _NUM.finditer(s)]
        toks += [(m.start(), m.end(), m.group(1), False, True) for m in _NUMWORD.finditer(s)]
        for start, end, tok, pct, isword in sorted(toks):
            line = l0 + s.count("\n", 0, start)
            k = _WORDS.index(tok.lower()) if isword else (int(tok) if "." not in tok and not pct else None)
            plain = tok + ("%" if pct else "")
            word = _next_word(s, end)
            of = _OF.match(s_full, end)
            whole = "'" + " ".join(s_full[start:of.end() if of else end].split()) + "'" if of else ""
            near = "'" + " ".join(s[start:start + 40].split("\n\n")[0].split()[:4]) + "...'"
            # count out of a value: N of \val{x}, or N of M where M is a value's text
            base = (of.group(1) if of and of.group(1) in V["vals"] else
                    (by_text.get(of.group(2)) or [None])[0] if of and of.group(2) else None)
            if base and k is not None and k > V["vals"][base]["num"]:
                base = None  # '48 of 12': a part larger than the whole is not a count out of it
            cands = ints.get(k, []) if k is not None else []
            if base and k is not None:
                if cands:
                    found.append((True, f"{rel}:{line}: {whole} counts out of {base}; {tok} is the value {cands[0]}"
                                  + (f" (or {', '.join(cands[1:])})" if len(cands) > 1 else "")
                                  + f": write {how(cands[0], tok)}"))
                else:
                    found.append((True, f"{rel}:{line}: {whole} counts out of {base}, but no value equals {tok}: a count "
                                  "left from an earlier run? Check it, and give it a value if an analysis produces it"))
                continue
            if k is not None and (_ENUM_AFTER.match(s, end) or _ENUM_BEFORE.search(s[max(0, start - 20):start])):
                continue  # a label for a set, not a count: it must not follow the value
            by_meta = [n for n in cands if word and word in meta.get(n, ())]
            strong = [n for n in cands if word and (word in ctx.get(n, ()) or n in by_meta and len(by_meta) <= 2)]
            if strong and (isword or k < 10):
                found.append((True, f"{rel}:{line}: {near} is likely the value {strong[0]} ('{word}' follows it "
                              f"elsewhere, or is in its name or unit): write {how(strong[0], tok)}"))
                continue
            if isword or (k is not None and k < 10):
                continue
            exact = by_text.get(plain, [])
            if exact:
                strong = [n for n in exact if word and (word in ctx.get(n, ()) or word in meta.get(n, ()))]
                n0 = (strong or exact)[0]
                more = [n for n in exact if n != n0]
                short = len(tok.replace(".", "").strip("0")) <= 2  # 0.02, 12: equal to some value by chance
                counts_other = (k is not None and word and not strong and any(V["vals"][n]["unit"] or ctx.get(n)
                                                                               for n in exact))
                found.append((bool(strong) or (None if len(exact) > AMBIGUOUS or short and len(exact) > 1
                                               or counts_other else False),
                              f"{rel}:{line}: {plain} is the value {n0}"
                              + (f" (or {', '.join(more[:AMBIGUOUS])}{' ...' if len(more) > AMBIGUOUS else ''})"
                                 if more else "") + f": write {how(n0)} so it follows the results"))
                continue
            p = len(tok.split(".")[1]) if "." in tok else 0
            if p and len(tok.replace(".", "").lstrip("0")) >= 2:
                q = Decimal(1).scaleb(-p)
                near = [n for n, v in V["vals"].items() if "ensuremath" not in v["text"]
                        and (Decimal(repr(v["num"])) * (100 if pct else 1)).quantize(q, ROUND_HALF_UP) == Decimal(tok)]
                if near:
                    found.append((None if len(near) > AMBIGUOUS else False,
                                  f"{rel}:{line}: {plain} may be {near[0]} ({format(V['vals'][near[0]]['num'], '.6g')}) "
                                  f"rounded: write {how(near[0])}, or ignore if it is another quantity"))
    return found


def _ledger_segs(d: Path, led: dict) -> list[tuple[str, int, str]]:
    """(ledger.md, line, text) for the number scan: each claim and fact sentence, their evidence cells, and every
    paragraph outside the tables (Message, Reader, Out of scope, notes; O35), except the Values and Accepted
    sections and comments. A number there goes stale like any other."""
    p = d / "ledger.md"
    if not p.exists():
        return []
    t = p.read_text()
    out = []
    for kind, key in (("claims", "claim"), ("facts", "fact")):
        for i, row in led[kind].items():
            m = re.search(r"^\|\s*" + re.escape(i) + r"\s*\|", t, re.M)
            if m:
                ln = 1 + t.count("\n", 0, m.start())
                out += [("ledger.md", ln, row[k]) for k in (key, "evidence") if row.get(k)]
    plain = re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), t, flags=re.S)
    sec, para, start = "", [], 0
    for k, ln in enumerate(plain.split("\n") + [""], 1):
        head = re.match(r"^#+\s*(\S*)", ln)
        if head or not ln.strip() or ln.lstrip().startswith("|"):
            if para and sec not in ("values", "accepted"):
                out.append(("ledger.md", start, "\n".join(para)))
            para = []
            if head:
                sec = head.group(1).lower()
            continue
        if not para:
            start = k
        para.append(ln)
    return out


def number_notes(d: Path, segs: list, V: dict, led: dict) -> list[str]:
    """Number notes of the text and the ledger, strong ones first; ambiguous ones (strong is None) left out."""
    found = _scan_numbers(segs, V) + _scan_numbers(_ledger_segs(d, led), V, ledger=True)
    return [x for st, x in found if st] + [x for st, x in found if st is False]


def bare_numbers(segs: list, V: dict, limit: int = 20, d: Path | None = None, led: dict | None = None) -> list[str]:
    """Numbers typed in the text (and the ledger) that are, or may be, a defined value, strong ones first; at most
    limit, with a pointer to `wr.py numbers DIR` for the rest."""
    found = number_notes(d, segs, V, led) if d is not None else [x for st, x in sorted(_scan_numbers(segs, V),
                                                                                         key=lambda t: not t[0])
                                                                 if st is not None]
    return found[:limit] + ([f"... and {len(found) - limit} more: `wr.py numbers DIR` lists all"]
                            if len(found) > limit else [])


def figure_files(segs: list, homes: dict | None = None) -> list[str]:
    """Figures whose \\label is in another file than their first citation (the figure goes with the section that cites
    it); a figure file belongs to the file that inputs it (homes)."""
    homes = homes or {}
    where, first = {}, {}
    for rel, l0, text in segs:
        s = _strip_comments(text)
        for f in _FIGENV.finditer(s):
            for lab in re.findall(r"\\label\{(fig:[^}]+)\}", f.group(0)):
                where.setdefault(lab, rel)
    inside = []  # a citation in another figure's caption counts only when the text never cites the figure
    for rel, l0, text in segs:
        s = _strip_comments(text)
        spans = [m.span() for m in _FIGENV.finditer(s)]
        for m in _REF.finditer(s):
            h = (rel, l0 + s.count("\n", 0, m.start()))
            for name in m.group(1).split(","):
                if any(x <= m.start() < y for x, y in spans):
                    inside.append((name.strip(), h))
                else:
                    first.setdefault(name.strip(), h)
    for name, h in inside:
        first.setdefault(name, h)
    return [f"{lab}: is in {rel} but first cited at {first[lab][0]}:{first[lab][1]}: move it to the section that cites it first"
            for lab, rel in where.items() if lab in first and homes.get(first[lab][0], first[lab][0]) != homes.get(rel, rel)]


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
    segs = _segments(d)
    raw = "".join(t for _, _, t in segs)
    tex = _strip_comments(raw)
    led = _ledger(d)
    V = _sync_values(d)
    body = tex.split("\\begin{document}", 1)[-1]

    # ledger
    if not led["message"]:
        probs.append("ledger.md: no Message paragraph; write it before the text (step 1)")
    for cid, c in led["claims"].items():
        if not c["claim"]:
            probs.append(f"ledger.md {cid}: empty claim")
            continue
        if _first(c["status"]) not in ("established", "plausible", "open"):
            probs.append(f"ledger.md {cid}: status '{c['status']}' is not established, plausible or open")
        if not c["evidence"]:
            probs.append(f"ledger.md {cid}: no evidence (a result entry or run id)")
        if led["has_condition"] and not c["condition"]:
            probs.append(f"ledger.md {cid}: no condition (what it was tested under: a parameter strength, a dataset; "
                         "'all' if none applies); each section states it")
        if f"\\claim{{{cid}}}" not in body:
            probs.append(f"ledger.md {cid} is not carried by any paragraph (add \\claim{{{cid}}} where it is made, or "
                         "move it to Out of scope)")
        for fig in _labels(c["figure"]):
            if f"\\label{{{fig}}}" not in body:
                probs.append(f"ledger.md {cid}: figure {fig} has no \\label in the text")
    for cid in sorted(set(re.findall(r"\\claim\{(" + _CID + r")\}", body)) - set(led["claims"]), key=_idkey):
        probs.append(f"\\claim{{{cid}}} in the text is not in ledger.md")

    # named values, facts, claims resting on facts, values changed since confirmed, section files
    probs += check_values_facts(V, led, segs)
    probs += value_changes(d, V, led, segs)[0]
    probs += fact_changes(d, led)
    probs += check_sections(d, segs)
    probs += check_preamble(d, segs)

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
_CITED = re.compile(r"\\(?:paren|text|foot)?cite|\\cref|\\ref|\\figref|\\val\{|\\fact\{|\\S|§|RESULTS|Section~|"
                    r"\b(?:we|our|here|this (?:model|cell|work|write-up|report|study)|runs?|simulat\w*|trials?|sweeps?)\b",
                    re.I)  # own work: our runs, simulations, trials, sweeps (O26)


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
    segs = _segments(d)
    body = _strip_comments("".join(t for _, _, t in segs)).split("\\begin{document}", 1)[-1]
    figs = [m.group(0) for m in re.finditer(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", body, re.S)]
    out = ["height " + x for x in figure_heights(d, figs)]
    out += ["numbers " + x for x in figure_number_misses(d, body, figs)]
    if figs and not shutil.which("pdftoppm"):
        out.append("edge check skipped: pdftoppm (poppler) is missing, so figures cut off at their edge are not detected")
    out += ["colour " + x for x in grey_figures(d, figs)]
    out += [f"source: names no source (who measured it, in what): '{x}'" for x in unsourced_sentences(body)]
    led = _ledger(d)
    if not led["has_condition"] and led["claims"]:
        out.append("ledger.md has no condition column; add one (what each claim was tested under)")
    V = _values(d)
    if V["vals"] and _snapshot(d)[0] is None:
        out.append("values: no values confirmed yet: after reading the text, run wr.py confirm DIR")
    out += ["value in text: " + x for x in bare_numbers(segs, V, d=d, led=led)]
    out += ["placement: " + x for x in figure_files(segs, _homes(d))]
    if led["facts"]:
        out += [f"facts: {cid} names no facts it rests on" for cid, c in led["claims"].items() if not c["facts"]]
        used = {f for c in led["claims"].values() for f in c["facts"]}
        idle = [fid for fid, f in led["facts"].items() if fid not in used and _status(f) != "superseded"]
        if idle and used:
            out.append(f"facts: no claim rests on {', '.join(idle)}: name them in a claim's facts column, or move them "
                       "to Out of scope")
    if V["vals"]:
        named = ({h[2].group(1) for h in _hits(segs, _VAL)}
                 | {n for f in led["facts"].values() for n in f["values"] + _expr_names(f["test"])}
                 | {n for _, t in _led_rows(led) for n in _LEDVAL.findall(t)}
                 | {n for v in V["vals"].values() for n in _expr_names(v["expr"])})
        nosrc = [n for n, v in V["vals"].items() if n in named and not v["source"] and not (
            v["derived"] and all(V["vals"].get(r, {}).get("source") for r in _depends(n, V) if r != n))]
        if nosrc:
            out.append(f"values: {len(nosrc)} in use without a source (the run or analysis output the number comes from; "
                       f"`where` shows it for each claim and fact): {', '.join(nosrc[:10])}" + (" ..." if len(nosrc) > 10 else ""))
        idle = [n for n in V["vals"] if n not in named]
        if idle:
            out.append(f"values: {len(idle)} used nowhere (text, facts or other values): {', '.join(idle[:15])}"
                       + (" ..." if len(idle) > 15 else "") + "; fine for values kept for later, else drop them")
    return out


def cmd_check(a) -> int:
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    probs, ns = check(d), notes(d)
    acc = _ledger(d)["accepted"]
    took = lambda x: next((k for k, _ in acc if k in x), None)
    accepted = [(x, took(x)) for x in probs + ns if took(x)]
    probs, ns = [x for x in probs if not took(x)], [x for x in ns if not took(x)]
    ns += [f"accepted: `{k}` in ledger.md matches nothing now; remove it" for k, _ in acc
           if not any(k == a for _, a in accepted)]
    for p in probs:
        print("- " + p)
    if ns:
        print("notes (reported, they do not fail the check):")
        for n in ns:
            print("  " + n)
    if accepted:
        print(f"accepted in ledger.md ({len(accepted)}, not counted):")
        for x, k in accepted:
            print(f"  [{k}] {x[:110]}")
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
    roles = dict(ROLES)
    for item in a.role or []:
        name, sep, text = item.partition("=")
        if not sep or not name.strip() or not text.strip():
            print(f"--role takes NAME=DESCRIPTION, got '{item}'")
            return 1
        roles[name.strip()] = text.strip()
    names = [r.strip() for r in a.roles.split(",") if r.strip()]
    unknown = [r for r in names if r not in roles]
    if unknown:
        print(f"no description for the role(s) {', '.join(unknown)}: give each one with --role NAME=DESCRIPTION "
              f"(known: {', '.join(ROLES)}); nothing written")
        return 1
    rd = d / "review" / f"round-{a.round}"
    rd.mkdir(parents=True, exist_ok=True)
    for role in names:
        desc = roles[role]
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
    if led["facts"]:
        fs = {}
        for f in led["facts"].values():
            fs[f["status"] or "?"] = fs.get(f["status"] or "?", 0) + 1
        print(f"facts: {len(led['facts'])} " + " ".join(f"{k} {v}" for k, v in sorted(fs.items())))
    V = _values(d)
    if V["dir"]:
        ch = value_changes(d, V, led, _segments(d))[0] if (d / "main.tex").exists() else []
        print(f"values: {len(V['vals'])}, {len(ch)} changed since confirmed" + (f", {len(V['errors'])} error(s)" if V["errors"] else ""))
    for r in sorted((d / "review").glob("round-*")):
        qs = [ln for f in r.glob("*.md") if not f.name.startswith("brief-") for ln in f.read_text().splitlines()
              if re.match(r"- Q\d+", ln)]
        must = sum("[must]" in q for q in qs)
        print(f"{r.name}: {len(qs)} questions, {must} must")
    q = d / "review" / "questions.md"
    if q.exists():
        t = q.read_text()
        opened = 0
        col = None  # the status column: named in the table's header, else the last one
        for ln in t.splitlines():
            cells = [c.strip() for c in ln.strip().strip("|").split("|")] if ln.lstrip().startswith("|") else []
            if cells and "status" in (c.lower() for c in cells):
                col = [c.lower() for c in cells].index("status")
            elif cells and re.match(r"R\d+", cells[0]):
                cell = cells[col] if col is not None and col < len(cells) else cells[-1]
                opened += bool(re.search(r"\bopen\b", cell, re.I))
        print(f"review/questions.md: {opened} open")
    return 0


# ------------------------------------------------------------------ values, confirm, where, split
def cmd_values(a) -> int:
    d = Path(a.dir).resolve()
    if not (d / "values").is_dir():
        print(f"no {d}/values/: nothing to do (values/*.json are written by the analysis scripts)")
        return 0
    V = _sync_values(d)
    for e in V["errors"]:
        print("- " + e)
    stored = sum(not v["derived"] for v in V["vals"].values())
    print(f"values.tex: {len(V['vals'])} values ({stored} stored, {len(V['vals']) - stored} derived), "
          f"{len(V['errors'])} error(s)")
    if not (d / "main.tex").exists():
        return 1 if V["errors"] else 0
    ch, confirmed = value_changes(d, V, _ledger(d), _segments(d))
    for c in ch:
        print("- " + c)
    if V["vals"] and not confirmed:
        print("no values confirmed yet: after reading the text, run wr.py confirm DIR")
    return 1 if V["errors"] else 0


def cmd_confirm(a) -> int:
    """Confirm values (values.confirmed.json) and facts (facts.confirmed.json): all of both with no names; F ids
    name facts, other names values."""
    d = Path(a.dir).resolve()
    led, fsnap = _ledger(d), _fact_snapshot(d) or {}
    fids = [n for n in a.names if re.fullmatch(_FID, n) and (n in led["facts"] or n in fsnap)]
    names, rc = [n for n in a.names if n not in fids], 0
    if names or (not fids and (d / "values").is_dir()):
        a.names = names
        rc = _confirm_values(a)
        if rc:
            return rc
    if fids or (not a.names and not names and led["facts"]):
        for fid in fids or list(dict.fromkeys(list(led["facts"]) + list(fsnap))):
            if fid in led["facts"]:
                new = _fact_text(led["facts"][fid])
                if fsnap.get(fid, new) != new:
                    print(f"{fid}: {fsnap[fid]} -> {new}")
                fsnap[fid] = new
            else:
                print(f"{fid}: (removed from ledger.md)")
                fsnap.pop(fid, None)
        (d / "facts.confirmed.json").write_text(json.dumps(fsnap, indent=1, ensure_ascii=False) + "\n")
        print(f"confirmed {len(fids) or len(fsnap)} fact(s) in facts.confirmed.json")
    return rc


def _confirm_values(a) -> int:
    d = Path(a.dir).resolve()
    V = _sync_values(d)
    if V["errors"]:
        print("values have errors (wr.py values DIR shows them); nothing confirmed")
        return 1
    snap, bad = _snapshot(d)
    if bad:
        print(bad)
        return 1
    d_had_snapshot = snap is not None
    snap = snap or {}
    names = list(a.names) or list(dict.fromkeys(list(V["vals"]) + list(snap)))
    unknown = [n for n in names if n not in V["vals"] and n not in snap]
    if unknown:
        print(f"not a value: {', '.join(unknown)} (defined: {', '.join(V['vals']) or 'none'}); nothing confirmed")
        return 1
    n_same = 0
    for n in names:
        old = snap.get(n)
        if n in V["vals"]:
            new = V["vals"][n]["text"]
            if old == new:
                n_same += 1
            else:
                if old is not None or d_had_snapshot:
                    print(f"{n}: {old if old is not None else '(new)'} -> {new}")
            snap[n] = new
        else:
            print(f"{n}: {old} -> (removed)")
            del snap[n]
    (d / "values.confirmed.json").write_text(json.dumps(snap, indent=1, ensure_ascii=False) + "\n")
    print(f"confirmed {len(names)} value(s) in values.confirmed.json ({n_same} unchanged)")
    return 0


def _uniq(xs) -> list:
    return list(dict.fromkeys(xs))


def cmd_where(a) -> int:
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    segs, led, V = _segments(d), _ledger(d), _values(d)
    if not a.items:
        claims, facts, vals = _hits(segs, _CLAIM), _hits(segs, _FACT), _hits(segs, _VAL)
        for rel in _uniq(r for r, _, _ in segs):
            part = [s for s in segs if s[0] == rel]
            got = {"claims": _uniq(h[2].group(1) for h in claims if h[0] == rel),
                   "facts": _uniq(h[2].group(1) for h in facts if h[0] == rel),
                   "values": _uniq(h[2].group(1) for h in vals if h[0] == rel)}
            defined = _uniq(lab for _, _, t in part for f in _FIGENV.finditer(_strip_comments(t))
                            for lab in re.findall(r"\\label\{(fig:[^}]+)\}", f.group(0)))
            cited = _uniq(n.strip() for h in _hits(part, _REF) for n in h[2].group(1).split(",")
                          if n.strip().startswith("fig:"))
            print(rel)
            for k in ("claims", "facts"):
                if got[k]:
                    print(f"  {k}: {', '.join(got[k])}")
            if defined or cited:
                print("  figures: " + "; ".join(x for x in (("defined " + ", ".join(defined)) if defined else "",
                                                           ("cited " + ", ".join(cited)) if cited else "") if x))
            if got["values"]:
                print(f"  values: {', '.join(got['values'])}")
            if not any(got.values()) and not defined and not cited:
                print("  (no claims, facts, figures or values)")
        return 0
    rest, rc = _rests_on(led), 0
    for item in a.items:
        if re.fullmatch(_CID, item):
            hs, c = [_at(h) for h in _hits(segs, _CLAIM) if h[2].group(1) == item], led["claims"].get(item)
            print(f"{item}: " + (f"{_expand(c['claim'], V)} [{c['status']}]" if c else "not in ledger.md"))
            print("  marked at: " + (", ".join(hs) or "nowhere in the text"))
            if c and c["facts"]:
                print("  rests on: " + ", ".join(f"{f} ({led['facts'][f]['status']})" if f in led["facts"] else f"{f} (unknown)"
                                                 for f in c["facts"]))
            if c:
                _print_sources(_uniq(_LEDVAL.findall(c["claim"]) + [n for f in c["facts"] if f in led["facts"]
                                                                    for n in _fact_values(led["facts"][f])]), V)
        elif re.fullmatch(_FID, item):
            hs, f = [_at(h) for h in _hits(segs, _FACT) if h[2].group(1) == item], led["facts"].get(item)
            print(f"{item}: " + (f"{_expand(f['fact'], V)} [{f['status']}]" if f else "not in ledger.md"))
            print("  stated at: " + (", ".join(hs) or "nowhere in the text"))
            if f:
                _print_sources(_fact_values(f), V)
            print("  claims resting on it: " + (", ".join(rest.get(item, [])) or "none"))
        elif item in V["names"]:
            hits = _hits(segs, _VAL)
            places, facts, claims = _uses(item, V, led, hits)
            v = V["vals"].get(item)
            print(f"{item}: " + (f"{v['text']} (source: {v['source'] or 'not given'}; {v['file']})" if v else "has an error"))
            print("  used at: " + (", ".join(places) or "nowhere in the text"))
            print("  facts using it: " + (", ".join(facts) or "none"))
            if claims:
                print("  claims resting on those facts: " + ", ".join(claims))
        elif item.startswith("fig:") or any(item == lab for lab in re.findall(r"\\label\{([^}]+)\}", _tex_sources(d))):
            defs = [_at(h) for h in _hits(segs, re.compile(r"\\label\{" + re.escape(item) + r"\}"))]
            cites = [_at(h) for h in _hits(segs, _REF) if item in [n.strip() for n in h[2].group(1).split(",")]]
            print(f"{item}: defined at {', '.join(defs) or 'nowhere'}; cited at {', '.join(cites) or 'nowhere'}")
            cl = [c for c, v in led["claims"].items() if item in _labels(v["figure"])]
            if cl:
                print("  claims: " + ", ".join(cl))
        else:
            print(f"{item}: not a claim, fact, figure or value of this write-up")
            rc = 1
    return rc


# ------------------------------------------------------------------ upgrade, numbers, reword
# Preamble pieces an older write-up may lack: (what defines it, the template's lines). evals/run.py checks that each
# appears verbatim in templates/writeup/preamble.tex, so the two stay the same.
VALP_BLOCK = r"""% \valw[none]{name}: the word in brackets when the value is 0 ("none of the 13 pass"), else as \valw;
% \valp{name}{draw}{draws}: the singular when the value is 1, else the plural, so "one draw is" follows the value
\makeatletter
\newcommand{\wrsetvalc}[2]{\expandafter\def\csname wrvalc@#1\endcsname{#2}}
\def\wr@z{z}\def\wr@o{o}
\newcommand{\wr@cls}[1]{\edef\wr@c{\ifcsname wrvalc@#1\endcsname\csname wrvalc@#1\endcsname\else x\fi}}
\newcommand{\wr@word}[2]{\ifcsname #1@#2\endcsname\csname #1@#2\endcsname\else\val{#2}\fi}
\DeclareRobustCommand\valw[2][]{\wr@cls{#2}\def\wr@a{#1}%
  \ifx\wr@c\wr@z\ifx\wr@a\@empty\wr@word{wrvalw}{#2}\else#1\fi\else\wr@word{wrvalw}{#2}\fi}
\DeclareRobustCommand\Valw[2][]{\wr@cls{#2}\def\wr@a{#1}%
  \ifx\wr@c\wr@z\ifx\wr@a\@empty\wr@word{wrvalW}{#2}\else#1\fi\else\wr@word{wrvalW}{#2}\fi}
\DeclareRobustCommand\valp[3]{\wr@cls{#1}\ifx\wr@c\wr@o#2\else#3\fi}
\def\wr@pdfw#1#{\wrvalof}\def\wr@pdfp#1#2#3{#3}
\pdfstringdefDisableCommands{\let\valw\wr@pdfw\let\Valw\wr@pdfw\let\valp\wr@pdfp}
\makeatother
"""
UPGRADE_PREAMBLE = [
    (r"\\newcommand\{\\claim\}|\\def\\claim\b", "\\newcommand{\\claim}[1]{}\n"),
    (r"\\newcommand\{\\fact\}|\\def\\fact\b", "\\newcommand{\\fact}[1]{}\n"),
    (r"\\wrsetval\}|\{\\val\}", "\\makeatletter\n"
     "\\newcommand{\\wrsetval}[2]{\\expandafter\\def\\csname wrval@#1\\endcsname{#2}}\n"
     "\\DeclareRobustCommand{\\val}[1]{%\n"
     "  \\ifcsname wrval@#1\\endcsname\\csname wrval@#1\\endcsname\n"
     "  \\else\\textbf{??\\detokenize{#1}}\\PackageWarning{wr}{value \\detokenize{#1} undefined}\\fi}\n"
     "\\newcommand{\\wrvalof}[1]{\\ifcsname wrval@#1\\endcsname\\csname wrval@#1\\endcsname\\else ??\\detokenize{#1}\\fi}\n"
     "\\pdfstringdefDisableCommands{\\let\\val\\wrvalof}\n"
     "\\makeatother\n"),
    (r"\\wrsetvalw\}|\{\\valw\}", "\\makeatletter\n"
     "\\newcommand{\\wrsetvalw}[3]{\\expandafter\\def\\csname wrvalw@#1\\endcsname{#2}\\expandafter\\def\\csname wrvalW@#1\\endcsname{#3}}\n"
     "\\DeclareRobustCommand{\\valw}[1]{\\ifcsname wrvalw@#1\\endcsname\\csname wrvalw@#1\\endcsname\\else\\val{#1}\\fi}\n"
     "\\DeclareRobustCommand{\\Valw}[1]{\\ifcsname wrvalW@#1\\endcsname\\csname wrvalW@#1\\endcsname\\else\\val{#1}\\fi}\n"
     "\\pdfstringdefDisableCommands{\\let\\valw\\wrvalof\\let\\Valw\\wrvalof}\n"
     "\\makeatother\n"),
    (r"\\wrsetvalc\}|\{\\valp\}", VALP_BLOCK),
]
_VALUES_INPUT = "\\IfFileExists{values.tex}{\\input{values}}{}\n"


def _section(name: str) -> str:
    """The template ledger's `## name` section (heading to the next heading)."""
    t = (TEMPLATE / "ledger.md").read_text()
    m = re.search(r"(?ms)^## " + name + r"\b.*?(?=^## |\Z)", t)
    return m.group(0).rstrip() + "\n\n" if m else ""


def _upgrade_ledger(t: str) -> tuple[str, list[str]]:
    """ledger.md with the template's Values, Facts and Accepted sections and a facts column in Claims added where
    missing; nothing else changes."""
    did = []
    heads = {h.split()[0].lower() for h in re.findall(r"(?m)^## (\S+)", t)}
    claims = re.search(r"(?m)^## Claims\b", t)
    for name in ("Values", "Facts"):
        if name.lower() not in heads:
            at = claims.start() if claims else len(t)
            t = t[:at] + _section(name) + t[at:]
            did.append(f"ledger.md: added the ## {name} section")
            claims = re.search(r"(?m)^## Claims\b", t)
    if claims:
        end = re.search(r"(?m)^## ", t[claims.end():])
        a, b = claims.end(), claims.end() + end.start() if end else len(t)
        part, lines = t[a:b], t[a:b].split("\n")
        hdr = next((k for k, ln in enumerate(lines) if re.match(r"^\|\s*id\s*\|", ln, re.I)), None)
        if hdr is not None and not any(c.strip().lower().startswith("facts") for c in lines[hdr].split("|")):
            for k in range(hdr, len(lines)):
                ln = lines[k].rstrip()
                if not ln.startswith("|"):
                    break
                cell = "facts" if k == hdr else "---" if k == hdr + 1 else ""
                lines[k] = (ln if ln.endswith("|") else ln + " |") + (f" {cell} |" if cell != "---" else "---|")
            part = "\n".join(lines)
            t = t[:a] + part + t[b:]
            did.append("ledger.md: added a facts column to the Claims table (the F ids each claim rests on)")
    if "accepted" not in heads:
        t = t.rstrip() + "\n\n" + _section("Accepted")
        did.append("ledger.md: added the ## Accepted section")
    return t, did


def _preamble_file(d: Path, given: str | None) -> Path | None:
    """The preamble to extend: --preamble, else the preamble*.tex that already defines \\val (new marks go next to
    it, O33), else the first preamble*.tex main.tex inputs, else preamble.tex."""
    if given:
        return d / given
    for f in sorted(d.glob("preamble*.tex")):
        if re.search(r"\\wrsetval\}|\{\\val\}", _strip_comments(f.read_text())):
            return f
    for m in _INPUT.finditer(_blank_comments((d / "main.tex").read_text())):
        rel = m.group(2) if m.group(2).endswith(".tex") else m.group(2) + ".tex"
        if Path(rel).name.startswith("preamble") and (d / rel).is_file():
            return d / rel
    return d / "preamble.tex" if (d / "preamble.tex").is_file() else None


def cmd_upgrade(a) -> int:
    """Bring a write-up from an older version of the skill up to the current one: the preamble's \\claim, \\fact, \\val
    and \\valw, the input of values.tex, the ledger's Values, Facts and Accepted sections and facts column, values.tex
    in .gitignore. Adds only what is missing; the old files go to build/upgrade-<time>/."""
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    pre = _preamble_file(d, a.preamble)
    if pre is None or not pre.is_file():
        print("no preamble file found (main.tex inputs none named preamble*.tex): name one with --preamble FILE")
        return 1
    every = "".join(f.read_text() for f in sorted(d.glob("preamble*.tex"))) + (d / "main.tex").read_text()
    if pre.name not in [f.name for f in d.glob("preamble*.tex")]:
        every += pre.read_text()
    did, changes = [], {}
    add = [snip for rx, snip in UPGRADE_PREAMBLE if not re.search(rx, _strip_comments(every))]
    if add:
        t = pre.read_text()
        block = "% ---- added by wr.py upgrade (research-writing): the marks wr.py check reads\n" + "".join(add)
        m = re.search(r"(?m)^.*\\input\{values(?:\.tex)?\}.*\n?", t)
        t = t[:m.start()] + block + t[m.start():] if m else t.rstrip() + "\n" + block
        changes[pre] = t
        names = [{"claim": "\\claim", "fact": "\\fact", "wrsetval": "\\val", "wrsetvalw": "\\valw and \\Valw",
                  "wrsetvalc": "\\valw[none] and \\valp"}.get(n, n)
                 for n in (re.search(r"\{\\(\w+)\}", x).group(1) for x in add)]
        did.append(f"{pre.name}: added {', '.join(names)}")
    if not re.search(r"\\input\{values(?:\.tex)?\}", _strip_comments(every + changes.get(pre, ""))):
        changes[pre] = changes.get(pre, pre.read_text()).rstrip() + "\n" + _VALUES_INPUT
        did.append(f"{pre.name}: inputs values.tex (generated from values/*.json) at its end")
    led = d / "ledger.md"
    if led.exists():
        t, more = _upgrade_ledger(led.read_text())
        if more:
            changes[led] = t
            did += more
    gi = d / ".gitignore"
    old = gi.read_text() if gi.exists() else ""
    if "values.tex" not in old.split():
        changes[gi] = old + ("" if not old or old.endswith("\n") else "\n") + "values.tex\n"
        did.append(".gitignore: values.tex (generated at every build; values/*.json and *.confirmed.json are tracked)")
    if not did:
        print("up to date: nothing to add")
        return 0
    why = ("named with --preamble" if a.preamble else "\\val is defined there"
           if re.search(r"\\wrsetval\}|\{\\val\}", _strip_comments(pre.read_text())) else "the preamble main.tex inputs")
    print(f"preamble: {pre.name} ({why})")
    for x in did:
        print(("would: " if a.dry_run else "") + x)
    if a.dry_run:
        return 0
    bak = d / "build" / f"upgrade-{datetime.datetime.now():%Y%m%d-%H%M%S}"
    for f, t in changes.items():
        if f.exists():
            bak.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, bak / f.name)
        f.write_text(t)
    if bak.exists():
        print(f"old files kept in {bak.relative_to(d)}")
    print("next: have each analysis script write its numbers to values/<script>.json, then `wr.py numbers DIR` lists "
          "the typed numbers that are values; replace them, build, and compare the PDF text")
    return 0


def cmd_numbers(a) -> int:
    """Every typed number in the text and the ledger that is, or may be, a value (check shows only the first 20)."""
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    V = _sync_values(d)
    if not V["vals"]:
        print("no values: values/*.json defines none (the analysis scripts write them)")
        return 0
    segs, led = _segments(d), _ledger(d)
    found = _scan_numbers(segs, V) + _scan_numbers(_ledger_segs(d, led), V, ledger=True)
    if a.names:
        found = [(st, x) for st, x in found if any(re.search(r"\b" + re.escape(n) + r"\b", x) for n in a.names)]
    acc = [k for k, _ in led["accepted"]]
    found = [(st, x) for st, x in found if not any(k in x for k in acc)]
    if a.strong:
        found = [(st, x) for st, x in found if st]
    strong = [x for st, x in found if st]
    weak = [x for st, x in found if st is False or a.all and st is None]
    amb = sum(st is None for st, _ in found) if not a.all else 0
    if strong:
        print(f"likely values ({len(strong)}: the words around them match the value's other places or its unit, or a "
              "count out of a value):")
        for x in strong:
            print("  " + x)
    if weak:
        print(f"same digits as a value ({len(weak)}; often another quantity: accept a line in ledger.md ## Accepted "
              "with a piece of its text, or ignore):")
        for x in weak:
            print("  " + x)
    if amb:
        print(f"not listed: {amb} typed number(s) that equal several values (short numbers such as 0.02, or more than "
              f"{AMBIGUOUS}) or count something else ('10 trials'), with no words tying them to one; --all lists them")
    if not found:
        print("no typed numbers match a value")
    return 0


_QUANT = re.compile(r"\b(half|halves|third|quarter|most|majority|minority|all|none|every|always|never|both|either|"
                    r"neither|few|fewer|many|several|more|less|than|instead|only|twice|double|triple|about|nearly|almost|"
                    r"roughly|exceeds?|below|above|same|rarely|often|usually|largely|mostly|"
                    + "|".join(_WORDS) + r")\b", re.I)


def _sentence(s: str, i: int) -> tuple[int, int]:
    """(start, end) of the sentence around position i of s: from after the previous '. ', blank line, \\section,
    \\begin/\\end, \\caption, \\fact or \\claim mark to the next '.' (included) or such a break."""
    brk = re.compile(r"(?<!\b[A-Z])(?<!e\.g)(?<!i\.e)(?<!Fig)(?<!al)[.!?](?=\s+(?:[A-Z\\]|\([a-z]\)\s)|\s*$|\s*\\end\b|\s*\n\s*\n)|"
                     r"\n\s*\n|\\(?:sub)*section\*?\{[^}]*\}|\\begin\{[^}]*\}|\\end\{[^}]*\}|\\item\b|\\caption\{|"
                     r"\\fact\{[^}]*\}\s*|\\claim\{[^}]*\}\s*")
    a, b = 0, len(s)
    for m in brk.finditer(s):
        punct = m.group(0) in ".!?"
        if m.end() <= i:
            a = m.end()
        elif m.start() >= i or punct and m.start() >= i:
            b = m.end() if punct else m.start()
            break
    return a, b


def _in_title(s: str, i: int) -> bool:
    """Whether position i of s is inside a section title or a caption's bold title sentence (a claim in a few words)."""
    for m in reversed(list(re.finditer(r"\\(?:sub)*section\*?\{|\\caption(?:\[[^\]]*\])?\{\s*\\textbf\{", s[:i]))):
        depth = 0
        for c in s[m.end():i]:
            depth += (c == "{") - (c == "}")
            if depth < 0:
                break
        return depth >= 0
    return False


def _depends(name: str, V: dict, seen=None) -> set[str]:
    """Stored values a value is computed from (itself when it is stored)."""
    seen = seen or set()
    v = V["vals"].get(name)
    if not v or not v["derived"] or name in seen:
        return {name}
    seen.add(name)
    return set().union(*[_depends(n, V, seen) for n in _expr_names(v["expr"])] or [{name}])


_CHANGED_AT = re.compile(r"\\(?:val|valw|Valw|valp)(?:\[[^\]]*\])?\{([^{}]*)\}|\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}")
NEAR_WORDS = 8  # quantity words count only this close to a changed value, inside its clause (O36)
LONG_UNIT = 400  # a sentence or caption longer than this is handed over as the clause around the changed value (O32)
_STRONG = re.compile(r"[;:]\s|\s-{2,3}\s|---|—|\s(?=\([a-z]\)\s)")
_CLAUSE = re.compile(r"[;:,]\s|\s-{2,3}\s|---|—|\s(?=\([a-z]\)\s)")


def _clause(text: str, at: list[tuple[int, int]]) -> tuple[int, int]:
    """(start, end) of the part of text to hand over: all of it up to LONG_UNIT characters, else the clauses (between
    , ; : and dashes) that hold the changed values, widened clause by clause to at least a quarter of LONG_UNIT."""
    if len(text) <= LONG_UNIT or not at:
        return 0, len(text)
    cuts = sorted({0, len(text)} | {m.end() for m in _CLAUSE.finditer(text)})
    lo = max(c for c in cuts if c <= at[0][0])
    hi = min(c for c in cuts if c >= at[-1][1])
    while hi - lo < LONG_UNIT // 4 and (lo > 0 or hi < len(text)):
        lo = max([c for c in cuts if c < lo] or [0])
        hi = min([c for c in cuts if c > hi] or [len(text)])
    return lo, hi


def _window(text: str, at: list[tuple[int, int]]) -> str:
    """The words within NEAR_WORDS of each changed value, not past a ; : or dash (method constants elsewhere in the
    sentence, 'ten trials per direction', do not make a number change a wording task)."""
    if not at:
        return text
    cuts = sorted({0, len(text)} | {m.end() for m in _STRONG.finditer(text)})
    parts = []
    for a, b in at:
        lo, hi = max(c for c in cuts if c <= a), min(c for c in cuts if c >= b)
        before, after = text[lo:a].split(), text[b:hi].split()
        parts.append(" ".join(before[-NEAR_WORDS:] + ["#"] + after[:NEAR_WORDS]))
    return " | ".join(parts)


def _crosses_one(old: str, new: str | None) -> bool:
    """Whether a value changed between 1 and another number (the noun and verb after it change number)."""
    try:
        return (float(_plain(old).rstrip("%")) == 1) != (float(_plain(new or "").rstrip("%")) == 1)
    except ValueError:
        return False


def _m1(m: re.Match) -> str:
    return m.group(1) or m.group(2)


def reword_tasks(d: Path) -> tuple[list[dict], str | None]:
    """One task per sentence that uses a value changed since `wr.py confirm` (text and ledger rows): the sentence, the
    changed values (old -> new, grouped by the stored value that caused them), the facts on those values with their
    tests now, and a kind that picks the model: number-only (light), words (the words around the number may need to
    change: standard), conclusion (a fact test turned false, the In short, a title or a ledger claim: deep or the
    person)."""
    V, led = _sync_values(d), _ledger(d)
    snap, bad = _snapshot(d)
    if bad:
        return [], bad
    if snap is None:
        return [], "no values confirmed yet: run `wr.py confirm DIR` once the text is right, so later changes can be listed"
    changed, _ = changed_values(d, V)
    if not changed:
        return [], None
    false_facts = {fid for fid, f in led["facts"].items() if _status(f) == "holds" and _fact_test(f, V)[0] is False}
    facts_of = {n: _uses(n, V, led, [])[1] for n in changed}
    tasks: dict[tuple, dict] = {}
    for h in _hits(_segments(d), _VAL):
        if h[2].group(1) not in changed:
            continue
        s = h[2].string
        a, b = _sentence(s, h[2].start())
        key = (h[0], h[1] - s.count("\n", a, h[2].start()), a)
        t = tasks.setdefault(key, {"where": f"{h[0]}:{h[1]}" + (" (In short)" if h[3] else ""), "text": " ".join(
            s[a:b].split()), "names": [], "in_short": h[3], "title": _in_title(s, h[2].start())})
        if h[2].group(1) not in t["names"]:
            t["names"].append(h[2].group(1))
    lt = (d / "ledger.md").read_text() if (d / "ledger.md").exists() else ""
    for i, txt in _led_rows(led):
        ns = [n for n in _LEDVAL.findall(txt) if n in changed]
        if ns:
            m = re.search(r"^\|\s*" + re.escape(i) + r"\s*\|", lt, re.M)
            tasks[("ledger.md", 0, i)] = {"where": f"ledger.md:{1 + lt.count(chr(10), 0, m.start()) if m else 0} {i}",
                                          "text": txt, "names": ns, "in_short": False, "title": False, "ledger": i}
    out = []
    for t in tasks.values():
        at = [m.span() for m in _CHANGED_AT.finditer(t["text"]) if _m1(m) in t["names"]]
        lo, hi = _clause(t["text"], at)
        near = _MASK.sub(" ", _LEDVAL.sub(" ", _window(t["text"], at)))
        words = _uniq(w.lower() for w in _QUANT.findall(near))
        typed = _uniq(m.group(1) for m in _NUM.finditer(near))
        facts = _uniq(f for n in t["names"] for f in facts_of[n])
        why = []
        if any(f in false_facts for f in facts):
            why.append("a fact test turned false: " + ", ".join(f for f in facts if f in false_facts))
        if t["in_short"]:
            why.append("in the In short")
        if t["title"]:
            why.append("a title")
        if t.get("ledger", "").startswith("C"):
            why.append("a claim of the ledger")
        # a count moving to or from one: 'one draw is' -> 'three draws are', unless \valp already handles it (O37)
        plural = [n for n in t["names"] if _crosses_one(*changed[n]) and not re.search(
            r"\\valp\{" + re.escape(n) + r"\}", t["text"])]
        kind = "conclusion" if why else "words" if words or typed or plural else "number-only"
        if words:
            why.append("quantity words: " + ", ".join(words))
        if typed:
            why.append("typed numbers: " + ", ".join(typed))
        if plural:
            why.append("singular/plural around " + ", ".join(plural) + " (one <-> more): \\valp{name}{draw}{draws} follows it")
        causes = []
        for n in t["names"]:
            old, new = changed[n]
            roots = sorted(r for r in _depends(n, V) if r != n and r in changed)
            causes.append(f"{n} {old} -> {new if new is not None else '(no longer defined)'}"
                          + (f" (derived from {', '.join(roots)})" if roots else "") + _src(V["vals"].get(n)))
        tests = [f"{f}: `{led['facts'][f]['test']}` is {'false' if f in false_facts else 'true'} now"
                 for f in facts if led["facts"][f]["test"]]
        if kind == "conclusion":
            lo, hi = 0, len(t["text"])  # whoever judges a conclusion reads all of it
        task = {"where": t["where"], "kind": kind, "tier": {"number-only": "light", "words": "standard",
                                                            "conclusion": "deep"}[kind],
                "sentence": t["text"][lo:hi].strip(), "changed": causes, "facts": tests, "why": why, "names": t["names"]}
        if (lo, hi) != (0, len(t["text"])):
            task["part_of"] = len(t["text"])  # the clause around the changed values of a long sentence or caption
        if "ledger" in t:
            task["filled"] = _expand(task["sentence"], V)
        out.append(task)
    order = {"conclusion": 0, "words": 1, "number-only": 2}
    return sorted(out, key=lambda x: order[x["kind"]]), None


REWORD_HEAD = """Status: historical ({date})

# Reword tasks, {date}

Values changed since the last `wr.py confirm`. `\\val` already prints the new numbers; each task is one sentence whose
words may no longer fit them. Give each task, alone, to a model of its tier: light for number-only, standard for words,
deep (or the person) for conclusion. The brief for each: make the smallest edit so the sentence is true with the new
values; never type a number that a `\\val{{}}` gives; keep `\\fact`, `\\claim` and `\\val` marks; if the sentence's
conclusion no longer holds, say so instead of editing it. Then `wr.py check DIR` and `wr.py confirm DIR {names}`.

"""


def cmd_reword(a) -> int:
    d = Path(a.dir).resolve()
    if not (d / "main.tex").exists():
        print(f"no {d}/main.tex")
        return 1
    tasks, msg = reword_tasks(d)
    if msg:
        print(msg)
        return 1 if "not a JSON" in msg else 0
    if not tasks:
        print("no value changed since the last confirm: nothing to reword")
        return 0
    if a.json:
        print(json.dumps(tasks, indent=1, ensure_ascii=False))
        return 0
    date = datetime.date.today().isoformat()
    names = " ".join(_uniq(n for t in tasks for n in t["names"]))
    md = [REWORD_HEAD.format(date=date, names=names)]
    for k, t in enumerate(tasks, 1):
        md.append(f"## T{k} [{t['tier']}: {t['kind']}] {t['where']}\n\n> {t['sentence']}\n\n"
                  + (f"- the clause around the change, from a {t['part_of']}-character sentence or caption: edit only "
                     "this part\n" if t.get("part_of") else "")
                  + (f"- with the new values filled in: {t['filled']}\n" if t.get("filled") else "")
                  + "".join(f"- changed: {c}\n" for c in t["changed"])
                  + "".join(f"- fact {x}\n" for x in t["facts"])
                  + (f"- why this tier: {'; '.join(t['why'])}\n" if t["why"] else "- why this tier: only the number changes\n")
                  + "\n")
    out = Path(a.out) if a.out else d / "review" / f"reword-{date}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(md))
    n = {k: sum(t["kind"] == k for t in tasks) for k in ("number-only", "words", "conclusion")}
    print(f"{len(tasks)} sentence(s) to reread: {n['number-only']} number-only (light), {n['words']} words (standard), "
          f"{n['conclusion']} conclusion (deep or the person); tasks in {out}")
    return 0


def _fact_values(f: dict) -> list[str]:
    """Value names a fact uses: its values column, its test and {{name}} in its sentence."""
    return _uniq(f["values"] + _expr_names(f["test"]) + _LEDVAL.findall(f["fact"]))


def _print_sources(names: list[str], V: dict) -> None:
    """The values behind a claim or fact, each with its number now and its source (stored values a derived one is
    computed from, when it has no source of its own)."""
    if not names:
        return
    print("  values:")
    for n in names:
        v = V["vals"].get(n)
        if not v:
            print(f"    {n}: " + ("has an error" if n in V["names"] else "not defined"))
            continue
        src = v["source"] or ", ".join(_uniq(f"{r}: {V['vals'][r]['source']}" for r in sorted(_depends(n, V))
                                             if r != n and V["vals"].get(r, {}).get("source")))
        print(f"    {n} = {_plain(v['text'])} ({v['file']}; source: {src or 'not given'})")


def _brace_arg(s: str, i: int) -> str:
    """Text of the {...} group whose opening brace is at s[i], braces balanced."""
    depth, j = 0, i
    while j < len(s):
        depth += (s[j] == "{" and (j == 0 or s[j - 1] != "\\")) - (s[j] == "}" and s[j - 1] != "\\")
        if depth == 0:
            return s[i + 1:j]
        j += 1
    return s[i + 1:]


def _slug(title: str) -> str:
    t = re.sub(r"\\[a-zA-Z]+\*?", "", title)
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"[{}$]", "", t).lower()).strip("-")[:40].strip("-") or "section"


def cmd_split(a) -> int:
    """main.tex -> main.tex with \\input{sections/NN-slug} for each \\section block, and the blocks in sections/."""
    d = Path(a.dir).resolve()
    mp = d / "main.tex"
    if not mp.exists():
        print(f"no {mp}")
        return 1
    main = mp.read_text()
    blank = _blank_comments(main)
    sd = d / "sections"
    if re.search(r"\\(?:input|include)\{sections/", blank) or (sd.is_dir() and any(sd.glob("*.tex"))):
        print("main.tex already inputs sections/ or sections/ holds .tex files: not splitting again (nothing changed)")
        return 1
    b0, e0 = blank.find("\\begin{document}"), blank.rfind("\\end{document}")
    if b0 < 0:
        print("no \\begin{document} in main.tex: nothing to split")
        return 1
    e0 = len(main) if e0 < 0 else e0
    marks = [(m.start(), m.group(1)) for m in re.finditer(r"\\(section\*?|printbibliography|supplementary|appendix)(?![a-zA-Z])",
                                                          blank[b0:e0])]
    marks = [(b0 + i, k) for i, k in marks] + [(e0, "end")]
    out, pos, n, supp, files = main[:0], 0, {False: 0, True: 0}, False, []
    for k, (start, kind) in enumerate(marks[:-1]):
        if kind in ("supplementary", "appendix"):
            supp = True
        if not kind.startswith("section"):
            continue
        block = main[start:marks[k + 1][0]]
        i = block.find("{", len(kind) + 1)
        n[supp] += 1
        name = f"sections/{'s' if supp else ''}{n[supp]:02d}-{_slug(_brace_arg(block, i) if i >= 0 else '')}"
        body = block.rstrip()
        ws = block[len(body):]
        out += main[pos:start] + f"\\input{{{name}}}" + (ws[1:] if len(ws) > 1 and ws.startswith("\n") else "\n")
        pos = marks[k + 1][0]
        files.append((name + ".tex", body + "\n"))
    if not files:
        print("no \\section in the document body: nothing to split")
        return 1
    new = "".join(out) + main[pos:]
    (d / "build").mkdir(exist_ok=True)
    (d / "build" / "main.before-split.tex").write_text(main)
    sd.mkdir(exist_ok=True)
    for rel, text in files:
        (d / rel).write_text(text)
    mp.write_text(new)
    print(f"split main.tex into {len(files)} section file(s); the old main.tex is build/main.before-split.tex")
    for rel, _ in files:
        print("  " + rel)
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("dir"); s.add_argument("--title"); s.add_argument("--sections", action="store_true")
    s = sub.add_parser("build"); s.add_argument("dir")
    s = sub.add_parser("pages"); s.add_argument("dir"); s.add_argument("--first", type=int); s.add_argument("--last", type=int)
    s.add_argument("--dpi", type=int, default=60)
    s = sub.add_parser("check"); s.add_argument("dir")
    s = sub.add_parser("readers"); s.add_argument("dir"); s.add_argument("--round", type=int, required=True)
    s.add_argument("--role", action="append", help="NAME=DESCRIPTION for a role that is not a default one (repeatable)")
    s.add_argument("--roles", default="pi,reviewer,newcomer,outsider,editor")
    s = sub.add_parser("status"); s.add_argument("dir")
    s = sub.add_parser("values"); s.add_argument("dir")
    s = sub.add_parser("confirm"); s.add_argument("dir"); s.add_argument("names", nargs="*", metavar="NAME")
    s = sub.add_parser("where"); s.add_argument("dir"); s.add_argument("items", nargs="*", metavar="ID_OR_NAME")
    s = sub.add_parser("split"); s.add_argument("dir")
    s = sub.add_parser("upgrade"); s.add_argument("dir"); s.add_argument("--preamble", metavar="FILE")
    s.add_argument("--dry-run", action="store_true")
    s = sub.add_parser("numbers"); s.add_argument("dir"); s.add_argument("names", nargs="*", metavar="NAME")
    s.add_argument("--strong", action="store_true")
    s.add_argument("--all", action="store_true", help="also numbers that equal many values (per-item values)")
    s = sub.add_parser("reword"); s.add_argument("dir"); s.add_argument("--out", metavar="FILE")
    s.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    return {"init": cmd_init, "build": cmd_build, "pages": cmd_pages, "check": cmd_check, "readers": cmd_readers,
            "status": cmd_status, "values": cmd_values, "confirm": cmd_confirm, "where": cmd_where,
            "split": cmd_split, "upgrade": cmd_upgrade, "numbers": cmd_numbers, "reword": cmd_reword}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
