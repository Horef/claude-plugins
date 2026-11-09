#!/usr/bin/env python3
"""research-assistant tools: start a research question folder, record gates and deviations, show status, check the rules.

Standard library only. Every command takes the question folder (docs/research/<topic>/ in a project).

  ra.py init DIR --entry project|idea|review|paper --question "..." --tag NB
                                       the folder from templates/research/; the tag (2-6 capitals and digits, e.g. NB
                                       for "NMDA bracket") prefixes every id of this question: NB-H1, NB-A1, NB-Q1, so
                                       they never clash with names the project already uses (refused if they do)
  ra.py retag DIR TAG                  give an existing question a tag: renames the ids in headings, id fields and
                                       log lines (fingerprints stay valid) and lists prose mentions to fix by hand
  ra.py gate DIR G1 "<the person's words>"
  ra.py gate DIR G2 "<words>" --select H1,H2 [--drop H3]   or   --stop   (the literature answered it)
  ra.py gate DIR G3 "<words>" --approve A1,A3 [--drop A2]
                                       each gate first checks its stage is complete, then appends a dated line to
                                       log.md; G3 sets the status in plan.md and fingerprints each approved analysis
  ra.py deviation DIR A2 "<what changed, why, before or after seeing any outcome>"
                                       logs the change and re-fingerprints the analysis
  ra.py audit DIR                      writes verify/audit-N.md for the fresh checker to fill
  ra.py handover DIR                   draft claim rows for research-writing's ledger, one per verdict, with
                                       confirmatory/exploratory, condition and evidence, plus what the write-up discloses
  ra.py close DIR "<where it went>"     after a passing audit: logs the hand-over (write-up path, commit); status: closed
  ra.py status DIR                     stage, gates passed, analyses by status, open decisions
  ra.py check DIR                      the mechanical rules (exit 1 on a problem)

Ids and names: with a tag, each section heading is '## NB-H1: <short name>' (at most 8 words; the claim goes in
'statement'), and status and the gate log print each id with its name. Bare ids given on the command line (H1) are
read as this question's (NB-H1). A folder without a tag keeps plain ids (H1, A1, Q1), as before 0.2.0.

Exit codes: 0 ok, 1 problems found or bad input.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "templates" / "research"
FILES = ("question.md", "log.md", "hypotheses.md", "plan.md", "verdict.md", "decisions.md")
ENTRIES = ("project", "idea", "review", "paper")
STATUSES = ("proposed", "approved", "running", "done", "failed", "dropped")
QUESTION_FIELDS = ("question", "type", "decision", "claim type", "cannot answer", "budget", "stop rules")
HYP_FIELDS = ("source", "rejected if", "analysis", "claim")
PLAN_FIELDS = ("hypotheses", "data", "metric", "decision rule", "negative control", "positive control", "variants",
               "seeds", "cost", "value")
FROZEN = ("hypotheses", "data", "metric", "decision rule", "negative control", "positive control", "variants", "seeds")
VERDICT_DONE = ("rule", "result", "controls", "variants", "analyses run", "rival", "verdict")
VERDICT_FAILED = ("rule", "result", "analyses run", "verdict")
UNSOURCED_OK = ("rule", "verdict", "analyses run")  # copied rule, a label, a count of runs
PLACEHOLDER = re.compile(r"<[^\n]{2,}>")
FIELD = re.compile(r"^- ([a-z][a-z -]*?):\s*(.*)$", re.M)
SOURCE = re.compile(r"\[(?:[^\[\]]*[/§:][^\[\]]*|RESULTS[^\[\]]*|RUNS[^\[\]]*|L\d+[^\[\]]*)\]")
NUMBER = re.compile(r"(?<![\w.§#/-])[-−]?\d+(?:\.\d+)?(?:\s*%)?(?![\w/])")
GATE_LINE = re.compile(r"^- (\d{4}-\d{2}-\d{2}) (G[123])\b(.*)$")
TAG = re.compile(r"^[A-Z][A-Z0-9]{1,5}$")
ID_TAG = r"(?:[A-Z][A-Z0-9]{1,5}-)?"  # an optional question tag in front of an id
NAME_WORDS = 8  # a section heading of a tagged question is a short name, not the claim
TEXT_EXT = {".md", ".py", ".json", ".toml", ".txt", ".tex", ".yml", ".yaml", ".csv", ".rst", ".ipynb"}


def today() -> str:
    return datetime.date.today().isoformat()


def _strip_comments(s: str) -> str:
    return re.sub(r"<!--.*?-->", "", s, flags=re.S)


def _comment_spans(s: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in re.finditer(r"<!--.*?-->", s, re.S)]


def _in(spans, i) -> bool:
    return any(a <= i < b for a, b in spans)


def sections(path: Path, prefix: str) -> dict[str, dict]:
    """{id: {"title": ..., "fields": {name: value}, "text": ...}} for '## <prefix><n>: title' sections, comments ignored."""
    if not path.exists():
        return {}
    s = _strip_comments(path.read_text())
    out = {}
    parts = re.split(rf"^## ({prefix}\d+):\s*(.*)$", s, flags=re.M)
    for i in range(1, len(parts) - 2, 3):
        sid, title, body = parts[i], parts[i + 1].strip(), parts[i + 2]
        out[sid] = {"title": title, "fields": {m.group(1).strip(): m.group(2).strip() for m in FIELD.finditer(body)},
                    "text": body}
    return out


def fields_of(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return {m.group(1).strip(): m.group(2).strip() for m in FIELD.finditer(_strip_comments(path.read_text()))}


def empty(v: str | None) -> bool:
    return not v or bool(PLACEHOLDER.fullmatch(v.strip())) or v.strip() in ("-", "TODO")


def _ids(v: str, prefix: str) -> list[str]:
    return re.findall(rf"\b{prefix}\d+\b", v or "")


# ------------------------------------------------------------------ tags and names
def tag_of(d: Path) -> str:
    """The question's tag from question.md ('- tag: NB'), or '' (plain ids)."""
    t = fields_of(d / "question.md").get("tag", "").strip()
    return t if TAG.match(t) else ""


def pre(d: Path, kind: str) -> str:
    """The id prefix of a kind (H, A, Q) as a regex: 'NB\\-H' for a tagged question, 'H' otherwise."""
    t = tag_of(d)
    return (re.escape(f"{t}-") if t else "") + kind


def norm_id(d: Path, x: str) -> str:
    """A bare id typed on the command line (H1) is this question's (NB-H1)."""
    t = tag_of(d)
    return f"{t}-{x}" if t and re.fullmatch(r"[HAQ]\d+", x) else x


def label(secs: dict, sid: str) -> str:
    t = secs.get(sid, {}).get("title", "")
    return f"{sid} {t}" if t else sid


def _repo_files(root: Path):
    try:
        out = subprocess.run(["git", "-C", str(root), "ls-files"], capture_output=True, text=True, check=True).stdout
        files = [root / f for f in out.splitlines()]
    except (OSError, subprocess.CalledProcessError):
        files = [p for p in root.rglob("*") if p.is_file() and ".git" not in p.parts]
    for f in files:
        if f.suffix in TEXT_EXT and f.is_file() and f.stat().st_size < 2_000_000:
            yield f


def tag_clashes(d: Path, tag: str) -> tuple[list[str], list[str]]:
    """(clashes, mentions): files outside DIR that already use this tag's ids (NB-H1) or name it in another question
    (refused), and files where the tag appears as a word (shown, for the person to judge)."""
    root = project_root(d) or d.resolve()
    here = d.resolve()
    ids = re.compile(rf"\b{re.escape(tag)}-[HAQ]\d+\b")
    word = re.compile(rf"\b{re.escape(tag)}\b")
    clashes, mentions = [], []
    for f in _repo_files(root):
        if here in f.resolve().parents:
            continue
        try:
            text = f.read_text(errors="ignore")
        except OSError:
            continue
        rel = f.relative_to(root)
        if ids.search(text) or (f.name == "question.md" and re.search(rf"^- tag:\s*{re.escape(tag)}\s*$", text, re.M)):
            clashes.append(str(rel))
        elif word.search(text):
            mentions.append(str(rel))
    return clashes, mentions


def check_tag_free(d: Path, tag: str) -> list[str]:
    if not TAG.match(tag) or re.fullmatch(r"[HAQG]\d*", tag):
        return [f"tag '{tag}': use 2-6 capitals and digits starting with a letter, not an id itself (e.g. NB)"]
    clashes, mentions = tag_clashes(d, tag)
    if mentions:
        print(f"note: '{tag}' appears as a word in {len(mentions)} file(s), e.g. {', '.join(mentions[:3])}; "
              "choose another tag if that is the name of something")
    return [f"tag '{tag}' is already used in {c}" for c in clashes]


def fingerprint(fields: dict[str, str]) -> str:
    """Of the frozen fields, with any question tag removed from ids, so that retag leaves fingerprints valid."""
    text = "\n".join(f"{k}={re.sub(r'\s+', ' ', fields.get(k, '').strip())}" for k in FROZEN)
    text = re.sub(r"\b[A-Z][A-Z0-9]{1,5}-([HAQ]\d+)\b", r"\1", text)
    return hashlib.sha1(text.encode()).hexdigest()[:10]


# ------------------------------------------------------------------ the log
def log_lines(d: Path) -> list[str]:
    log = d / "log.md"
    return log.read_text().splitlines() if log.exists() else []


def gates(d: Path) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for line in log_lines(d):
        m = GATE_LINE.match(line)
        if m:
            out.setdefault(m.group(2), []).append(line)
    return out


def _listed(line: str, word: str) -> list[str]:
    m = re.search(rf"\b{word} ({ID_TAG}[AH]\d+(?:, ?{ID_TAG}[AH]\d+)*)", line)
    return [x.strip() for x in m.group(1).split(",")] if m else []


def approved(d: Path) -> set[str]:
    ids: set[str] = set()
    for line in gates(d).get("G3", []):
        ids |= set(_listed(line, "approve"))
        ids -= set(_listed(line, "drop"))
    return ids


def selected(d: Path) -> set[str]:
    ids: set[str] = set()
    for line in gates(d).get("G2", []):
        ids |= set(_listed(line, "select"))
        ids -= set(_listed(line, "drop"))
    return ids


def stopped(d: Path) -> bool:
    return any(" stop" in l.split(":", 1)[0] for l in gates(d).get("G2", []))


def fingerprints(d: Path) -> dict[str, str]:
    """The latest fingerprint per analysis, from G3 approvals and deviations (later lines win)."""
    out: dict[str, str] = {}
    for line in log_lines(d):
        for aid, fp in re.findall(rf"\b({ID_TAG}A\d+)=([0-9a-f]{{10}})\b", line):
            out[aid] = fp
    return out


def append_log(d: Path, line: str) -> None:
    log = d / "log.md"
    text = log.read_text() if log.exists() else "# Log\n"
    log.write_text(text.rstrip("\n") + "\n" + line + "\n")


# ------------------------------------------------------------------ init
def cmd_init(a) -> int:
    d = Path(a.dir)
    if a.entry not in ENTRIES:
        print(f"--entry must be one of {', '.join(ENTRIES)}")
        return 1
    if any((d / f).exists() for f in FILES):
        print(f"{d} already has research files; not overwritten")
        return 1
    tag = (a.tag or "").strip()
    if tag:
        probs = check_tag_free(d, tag)
        if probs:
            for x in probs:
                print("- " + x)
            print("not created: choose another --tag")
            return 1
    d.mkdir(parents=True, exist_ok=True)
    (d / "verify").mkdir(exist_ok=True)
    for f in FILES:
        t = (TEMPLATE / f).read_text()
        (d / f).write_text(t.replace("{date}", today()).replace("{entry}", a.entry).replace("{question}", a.question)
                           .replace("{tag}", tag or "none").replace("{pre}", f"{tag}-" if tag else ""))
    print(f"created {d}: {', '.join(FILES)}, verify/" + (f"; ids {tag}-H1, {tag}-A1, {tag}-Q1" if tag else ""))
    if not tag:
        print("note: no --tag, so ids are plain H1, A1, Q1; if the project already uses such names, "
              "give the question a tag (ra.py retag DIR TAG)")
    print("next: fill question.md (section 1), then gate 1 with the person")
    return 0


# ------------------------------------------------------------------ stage checks (also run before each gate)
def check_question(d: Path) -> list[str]:
    q = fields_of(d / "question.md")
    return [f"question.md: '{k}' is not filled" for k in QUESTION_FIELDS if empty(q.get(k))]


def check_hypotheses(d: Path, for_gate2: bool = False) -> list[str]:
    probs = []
    hyp = sections(d / "hypotheses.md", pre(d, "H"))
    if for_gate2 and len(hyp) < 3:
        probs.append(f"hypotheses.md: {len(hyp)} hypotheses; write at least three competing ones (C1)")
    tagged = bool(tag_of(d))
    for hid, h in hyp.items():
        for k in HYP_FIELDS + (("statement",) if tagged else ()):
            if empty(h["fields"].get(k)):
                probs.append(f"hypotheses.md {hid}: no '{k}'")
    return probs


def check_ids(d: Path) -> list[str]:
    """A tagged question: every section heading carries the tag and a short name."""
    tag = tag_of(d)
    if not tag:
        return []
    probs = []
    for f, kinds in (("hypotheses.md", "H"), ("plan.md", "A"), ("verdict.md", "A"), ("decisions.md", "Q")):
        path = d / f
        if not path.exists():
            continue
        text = _strip_comments(path.read_text())
        for m in re.finditer(rf"^## ({ID_TAG}[{kinds}]\d+):\s*(.*)$", text, re.M):
            sid, title = m.group(1), m.group(2).strip()
            if not sid.startswith(f"{tag}-"):
                probs.append(f"{f}: '## {sid}' lacks this question's tag (write {tag}-{sid.split('-')[-1]}); "
                             "ra.py retag renames them")
            elif f != "verdict.md" and len(title.split()) > NAME_WORDS:
                eg = {"H": "'fails in the V1 bracket'; the claim goes in 'statement'", "A": "'ratio grid, clustered "
                      "and scrambled'", "Q": "'which hypotheses to test'"}[kinds]
                probs.append(f"{f} {sid}: the heading is {len(title.split())} words; make it a short name (at most "
                             f"{NAME_WORDS}, e.g. {eg})")
    return probs


def check_analysis(d: Path, aid: str, f: dict[str, str], hyp: dict) -> list[str]:
    probs = [f"plan.md {aid}: no '{k}'" for k in PLAN_FIELDS if empty(f.get(k))]
    for hid in _ids(f.get("hypotheses", ""), pre(d, "H")):
        if hid not in hyp:
            probs.append(f"plan.md {aid}: hypothesis {hid} is not in hypotheses.md")
    return probs


# ------------------------------------------------------------------ gate, deviation, audit
def set_status(d: Path, aid: str, status: str) -> bool:
    """Set '- status:' of the real section ## <aid>: (not one inside a comment); add the line if missing."""
    plan = d / "plan.md"
    s = plan.read_text()
    spans = _comment_spans(s)
    heads = [m for m in re.finditer(rf"^## {ID_TAG}[A-Z]\d+:.*$", s, re.M) if not _in(spans, m.start())]
    for k, h in enumerate(heads):
        if not h.group(0).startswith(f"## {aid}:"):
            continue
        end = heads[k + 1].start() if k + 1 < len(heads) else len(s)
        body = s[h.end():end]
        m = re.search(r"^- status:[^\n]*", body, re.M)
        body = (body[:m.start()] + f"- status: {status}" + body[m.end():]) if m else f"\n- status: {status}" + body
        plan.write_text(s[:h.end()] + body + s[end:])
        return True
    return False


def _words(a) -> str:
    return a.words.strip().replace("\n", " ").replace('"', "'")


def _csv(v: str | None) -> list[str]:
    return [x.strip() for x in (v or "").split(",") if x.strip()]


def cmd_gate(a) -> int:
    d = Path(a.dir)
    g = a.gate.upper()
    if g not in ("G1", "G2", "G3"):
        print("gate must be G1, G2 or G3")
        return 1
    if not a.words.strip():
        print("give the person's words: a gate records what they decided")
        return 1
    prev = {"G2": "G1", "G3": "G2"}.get(g)
    if prev and prev not in gates(d):
        print(f"{prev} has not been passed; record it first")
        return 1
    if g == "G3" and stopped(d):
        print("the loop was stopped at gate 2; there is nothing to approve")
        return 1
    sel, drop, ap = ([norm_id(d, x) for x in _csv(v)] for v in (a.select, a.drop, a.approve))
    extra, names = "", ""
    if g == "G1":
        if sel or drop or ap or a.stop:
            print("G1 takes only the person's words")
            return 1
        probs = check_question(d)
    elif g == "G2":
        if ap:
            print("--approve belongs to G3; G2 selects hypotheses (--select) or stops (--stop)")
            return 1
        if not (sel or drop or a.stop):
            print("G2 selects hypotheses to take forward (--select H1,H2 [--drop H3]) or stops the loop (--stop)")
            return 1
        probs = check_question(d) + check_hypotheses(d, for_gate2=not a.stop)
        if empty(fields_of(d / "question.md").get("literature")):
            probs.append("question.md: 'literature' is not filled (the literature folder, or 'none: why')")
        hyp = sections(d / "hypotheses.md", pre(d, "H"))
        probs += [f"{h} is not in hypotheses.md" for h in sel + drop if h not in hyp]
        extra = (" stop" if a.stop else "") + (f" select {', '.join(sel)}" if sel else "") + \
                (f" drop {', '.join(drop)}" if drop else "")
        names = "; ".join(label(hyp, x) for x in sel + drop if x in hyp and hyp[x]["title"])
    else:
        if sel or a.stop:
            print("G3 approves (--approve A1,A3) or drops (--drop A2) analyses")
            return 1
        if not (ap or drop):
            print("G3 approves or drops analyses: --approve A1,A3 and/or --drop A2")
            return 1
        plan = sections(d / "plan.md", pre(d, "A"))
        hyp = sections(d / "hypotheses.md", pre(d, "H"))
        probs = [f"{x} is not in plan.md" for x in ap + drop if x not in plan]
        for x in ap:
            if x in plan:
                probs += check_analysis(d, x, plan[x]["fields"], hyp)
        if not probs:
            for x in ap:
                set_status(d, x, "approved")
            for x in drop:
                set_status(d, x, "dropped")
            plan = sections(d / "plan.md", pre(d, "A"))
        extra = (f" approve {', '.join(ap)}" if ap else "") + (f" drop {', '.join(drop)}" if drop else "") + \
                "".join(f" {x}={fingerprint(plan[x]['fields'])}" for x in ap if x in plan)
        names = "; ".join(label(plan, x) for x in ap + drop if x in plan and plan[x]["title"])
    if probs:
        print(f"{g} not recorded; the stage is not complete:")
        for p in probs:
            print("- " + p)
        return 1
    append_log(d, f'- {today()} {g}{extra}: "{_words(a)}"' + (f" ({names})" if names and tag_of(d) else ""))
    print(f"recorded {g}{extra}" + (f" ({names})" if names else ""))
    return 0


def cmd_deviation(a) -> int:
    d = Path(a.dir)
    a.analysis = norm_id(d, a.analysis)
    plan = sections(d / "plan.md", pre(d, "A"))
    if a.analysis not in plan:
        print(f"{a.analysis} is not in plan.md")
        return 1
    fp = fingerprint(plan[a.analysis]["fields"])
    append_log(d, f"- {today()} deviation {a.analysis} {a.analysis}={fp}: {a.text.strip()}")
    print(f"recorded deviation for {a.analysis}")
    return 0


RETAG_FILES = ("hypotheses.md", "plan.md", "verdict.md", "decisions.md")


def cmd_retag(a) -> int:
    """Give a question a tag (or a new one): ids in headings, in the 'hypotheses' and 'analysis' fields and in the
    log's gate and deviation lines are renamed; prose is left alone and listed, since a bare H3 there may name
    something else (a model, a figure)."""
    d = Path(a.dir)
    new = a.tag.strip()
    if not (d / "question.md").exists():
        print(f"{d} is not a research question folder (no question.md)")
        return 1
    old = tag_of(d)
    if new == old:
        print(f"the tag is already {new}")
        return 1
    probs = check_tag_free(d, new)
    if probs:
        for x in probs:
            print("- " + x)
        print("not retagged: choose another tag")
        return 1
    oldp = re.escape(f"{old}-") if old else ""
    idre = re.compile(rf"(?<![\w-]){oldp}([HAQ]\d+)\b")
    sub = lambda m: f"{new}-{m.group(1)}"  # noqa: E731
    renamed: set[str] = set()

    def ids_in(text: str) -> str:
        renamed.update(m.group(1) for m in idre.finditer(text))
        return idre.sub(sub, text)

    for f in RETAG_FILES:
        path = d / f
        if not path.exists():
            continue
        s = path.read_text()
        spans = _comment_spans(s)
        out, last = [], 0
        for m in re.finditer(r"^(## [^\n:]+:)|^(- (?:hypotheses|analysis):[^\n]*)", s, re.M):
            if _in(spans, m.start()):
                continue
            out += [s[last:m.start()], ids_in(m.group(0))]
            last = m.end()
        path.write_text("".join(out) + s[last:])
    lines = []
    for line in log_lines(d):
        m = re.match(r'^(- \S+ (?:G[123]|deviation)\b[^:"]*)(:.*)$', line)
        lines.append(ids_in(m.group(1)) + m.group(2) if m else line)
    (d / "log.md").write_text("\n".join(lines) + "\n")
    q = (d / "question.md").read_text()
    if re.search(r"^- tag:.*$", q, re.M):
        q = re.sub(r"^- tag:.*$", f"- tag: {new}", q, count=1, flags=re.M)
    else:
        q = re.sub(r"^(- entry:.*)$", rf"\1\n- tag: {new}", q, count=1, flags=re.M)
    (d / "question.md").write_text(q)
    pairs = ", ".join(f"{(old + '-') if old else ''}{x} -> {new}-{x}" for x in sorted(renamed))
    append_log(d, f"- {today()} retag {new}: {pairs or 'no ids yet'}")
    print(f"tag {new}: {pairs or 'no ids yet'}")
    left = []
    for f in ("question.md",) + RETAG_FILES:
        path = d / f
        if not path.exists():
            continue
        s = path.read_text()
        spans = _comment_spans(s)
        for m in re.finditer(rf"(?<![\w-]){oldp}[HAQ]\d+\b", s):
            if not _in(spans, m.start()):
                left.append(f"{f}:{s.count(chr(10), 0, m.start()) + 1} {m.group(0)}")
    if left:
        print("prose mentions left unchanged (rename the ones that mean this question's ids; others may name "
              "something else):")
        for x in left:
            print("  " + x)
    return 0


AUDIT = """Status: current (verified {date}). Audit {n} (research-assistant, rules E8, G2, G6): a fresh checker that did not run
the analyses, from another model family where possible, given plan.md, log.md, verdict.md and the runs' logs and code,
not the conversation.

# Audit {n}

- checker: <model and harness>
- inputs: <the files and run folders read>
- numbers: <each number in verdict.md checked against its source: all match, or the ones that do not>
- rules: <each verdict against its decision rule in plan.md>
- deviations: <changes in the logs or code not in log.md>
- substitutions: <simulated, placeholder or substituted data found, or none>
- selection: <signs a result was chosen after seeing outcomes, or none>
- status: <pass | disagreement>
"""


def cmd_audit(a) -> int:
    d = Path(a.dir)
    (d / "verify").mkdir(exist_ok=True)
    n = 1 + max([int(m.group(1)) for p in (d / "verify").glob("audit-*.md")
                 if (m := re.match(r"audit-(\d+)\.md", p.name))], default=0)
    path = d / "verify" / f"audit-{n}.md"
    path.write_text(AUDIT.replace("{date}", today()).replace("{n}", str(n)))
    print(f"wrote {path}: give it to the fresh checker with the plan, the log, the verdicts and the runs")
    return 0


# ------------------------------------------------------------------ status
def audits(d: Path) -> list[dict[str, str]]:
    return [fields_of(p) for p in sorted((d / "verify").glob("audit-*.md"))] if (d / "verify").exists() else []


def audit_status(f: dict[str, str]) -> str:
    """The first word of an audit's status ('pass. All numbers match' -> 'pass'), lower case."""
    m = re.match(r"\W*([A-Za-z]+)", f.get("status", ""))
    return m.group(1).lower() if m else ""


def kind_of(f: dict[str, str]) -> str:
    """An analysis is confirmatory unless plan.md says 'kind: exploratory'."""
    return "exploratory" if f.get("kind", "").strip().lower().startswith("explor") else "confirmatory"


def closed(d: Path) -> str | None:
    """Where the question was handed over, if a close line comes after the last gate-3 line."""
    out = None
    for line in log_lines(d):
        if GATE_LINE.match(line) and " G3" in line[:16]:
            out = None
        m = re.match(r"- \S+ close: (.*)$", line)
        if m:
            out = m.group(1).strip()
    return out


def stage(d: Path) -> str:
    g = gates(d)
    if stopped(d):
        return "stopped at gate 2 (answered by the literature)"
    plan = sections(d / "plan.md", pre(d, "A"))
    live = {k: p for k, p in plan.items() if p["fields"].get("status") != "dropped"}
    if "G3" in g:
        if live and all(p["fields"].get("status") in ("done", "failed") for p in live.values()):
            ver = sections(d / "verdict.md", pre(d, "A"))
            if any(k not in ver for k in live):
                return "6 verdicts"
            if not any(audit_status(x) == "pass" for x in audits(d)):
                return "6 audit (ra.py audit, then a fresh checker)"
            where = closed(d)
            if where:
                return f"closed (handed over: {where})"
            return "7 write-up (ready for hand-over: ra.py handover, then ra.py close)"
        return "5 run"
    if "G2" in g:
        return "4 plan (gate 3 next)"
    if "G1" in g:
        return "2-3 literature and hypotheses (gate 2 next)"
    return "1 frame (gate 1 next)"


def cmd_status(a) -> int:
    d = Path(a.dir)
    q = fields_of(d / "question.md")
    print(f"{d}: {q.get('question', '?')}")
    tag = tag_of(d)
    print(f"entry: {q.get('entry', '?')}; tag: {tag or 'none (plain ids; ra.py retag DIR TAG)'}; stage: {stage(d)}")
    g = gates(d)
    print("gates: " + (", ".join(f"{k} {v[-1][2:12]}" for k, v in sorted(g.items())) or "none yet"))
    hyp = sections(d / "hypotheses.md", pre(d, "H"))
    sel = selected(d)
    print(f"hypotheses: {len(hyp)}" + (f" (selected {', '.join(sorted(sel))})" if sel else ""))
    dropped = {x for line in g.get("G2", []) for x in _listed(line, "drop")} - sel
    for hid, h in hyp.items():
        st = "selected" if hid in sel else "dropped" if hid in dropped else "held" if "G2" in g else "proposed"
        an = ", ".join(_ids(h["fields"].get("analysis", ""), pre(d, "A")))
        print(f"  {label(hyp, hid)}: {st}" + (f" -> {an}" if an else ""))
    plan = sections(d / "plan.md", pre(d, "A"))
    by: dict[str, list[str]] = {}
    for aid, p in plan.items():
        by.setdefault(p["fields"].get("status", "?"), []).append(aid)
    print("analyses: " + ("; ".join(f"{k} {', '.join(v)}" for k, v in by.items()) or "none yet"))
    for aid, p in plan.items():
        hs = ", ".join(_ids(p["fields"].get("hypotheses", ""), pre(d, "H")))
        print(f"  {label(plan, aid)}: {p['fields'].get('status', '?')}" + (f" (tests {hs})" if hs else ""))
    dec = sections(d / "decisions.md", pre(d, "Q"))
    open_ = [k for k, v in dec.items() if v["fields"].get("status", "open") == "open"]
    print(f"open decisions: {'; '.join(label(dec, k) for k in open_) if open_ else 'none'}")
    print(f"deviations: {sum(1 for l in log_lines(d) if re.match(r'- \S+ deviation ', l))}; "
          f"audits: {len(audits(d))}")
    return 0


# ------------------------------------------------------------------ check
def project_root(d: Path) -> Path | None:
    for p in [d.resolve(), *d.resolve().parents]:
        if (p / "docs" / "RESULTS.md").exists() or (p / ".git").exists():
            return p
    return None


def _clauses(v: str) -> list[str]:
    """Split on ';' and ',' outside brackets, so each number is checked against the source next to it."""
    out, depth, cur = [], 0, ""
    for ch in v:
        depth += ch == "["
        depth -= ch == "]"
        if ch in ";," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    return out + [cur]


def unsourced(v: str) -> list[str]:
    nums = []
    for c in _clauses(v):
        found = [m.group(0) for m in NUMBER.finditer(SOURCE.sub(" ", c))]
        if found and not SOURCE.search(c):
            nums += found
    return nums


def check(d: Path) -> list[str]:
    probs: list[str] = [f"{f} is missing (ra.py init)" for f in FILES if not (d / f).exists()]
    if probs:
        return probs
    g = gates(d)
    root = project_root(d)
    probs += [p + (" (gate 1 was passed without it)" if "G1" in g else "") for p in check_question(d)]
    probs += check_ids(d)
    q = fields_of(d / "question.md")
    lit = q.get("literature", "")
    if "G2" in g and empty(lit):
        probs.append("question.md: 'literature' is not filled (the literature folder, or 'none: why')")
    elif not empty(lit) and root and re.match(r"docs/\S+/?$", lit.split()[0]) and not (root / lit.split()[0]).exists():
        probs.append(f"question.md: literature folder {lit.split()[0]} does not exist")
    hyp = sections(d / "hypotheses.md", pre(d, "H"))
    plan = sections(d / "plan.md", pre(d, "A"))
    sel = selected(d)
    if "G1" in g or hyp:
        probs += check_hypotheses(d, for_gate2="G2" in g and not stopped(d))
        for hid, h in hyp.items():
            if hid in sel:
                for aid in _ids(h["fields"].get("analysis", ""), pre(d, "A")):
                    if plan and aid not in plan:
                        probs.append(f"hypotheses.md {hid} (selected): analysis {aid} is not in plan.md")
    if stopped(d):
        return probs
    ap, fps = approved(d), fingerprints(d)
    for aid, p in plan.items():
        f = p["fields"]
        st = f.get("status", "")
        if st not in STATUSES:
            probs.append(f"plan.md {aid}: status '{st}' is not one of {', '.join(STATUSES)}")
        if st == "dropped":
            continue
        probs += check_analysis(d, aid, f, hyp)
        for hid in _ids(f.get("hypotheses", ""), pre(d, "H")):
            if sel and hid not in sel:
                probs.append(f"plan.md {aid}: hypothesis {hid} was not selected at gate 2")
        if st in ("approved", "running", "done", "failed"):
            if aid not in ap:
                probs.append(f"plan.md {aid}: status {st} without a gate-3 approval in log.md "
                             f"(ra.py gate DIR G3 ... --approve {aid})")
            elif fps.get(aid) and fps[aid] != fingerprint(f):
                probs.append(f"plan.md {aid}: data, metric, decision rule, controls, variants or seeds changed since "
                             "gate 3 without a deviation (ra.py deviation; a change to the evaluation goes back to "
                             "the person first)")
        if st == "done":
            if empty(f.get("runs")):
                probs.append(f"plan.md {aid}: done but no run ids under 'runs'")
            if empty(f.get("results")):
                probs.append(f"plan.md {aid}: done but no RESULTS section under 'results'")
            res = root / "docs" / "RESULTS.md" if root else None
            if res and res.exists() and not empty(f.get("results")):
                secs = re.findall(r"(?:§|section\s*)\s*(\d+[a-z]?)", f["results"], re.I)
                if not secs:
                    probs.append(f"plan.md {aid}: 'results' names no RESULTS section (write §N)")
                text = res.read_text()
                for n in secs:
                    if not re.search(rf"^#{{2,3}} {re.escape(n)}\.", text, re.M):
                        probs.append(f"plan.md {aid}: RESULTS §{n} is not in docs/RESULTS.md")
            runs_md = root / "docs" / "RUNS.md" if root else None
            if runs_md and runs_md.exists() and not empty(f.get("runs")):
                text = runs_md.read_text()
                for rid in re.findall(r"[A-Za-z0-9_][A-Za-z0-9_./-]*", re.sub(r"\([^)]*\)|`", " ", f["runs"])):
                    if re.search(r"[A-Za-z_]", rid) and rid not in text:
                        probs.append(f"plan.md {aid}: run {rid} is not in docs/RUNS.md")
    ver = sections(d / "verdict.md", pre(d, "A"))
    for aid, p in plan.items():
        if p["fields"].get("status") in ("done", "failed") and aid not in ver:
            probs.append(f"verdict.md: no section for {aid} ({p['fields'].get('status')})")
    for aid, v in ver.items():
        if aid not in plan:
            probs.append(f"verdict.md {aid}: not in plan.md")
            continue
        failed = plan[aid]["fields"].get("status") == "failed"
        for k in (VERDICT_FAILED if failed else VERDICT_DONE):
            if empty(v["fields"].get(k)):
                probs.append(f"verdict.md {aid}: no '{k}'")
        rule = v["fields"].get("rule", "")
        if not empty(rule) and _norm(rule) != _norm(plan[aid]["fields"].get("decision rule", "")):
            probs.append(f"verdict.md {aid}: the rule differs from plan.md's decision rule; quote the planned rule "
                         "(a changed rule is a deviation)")
        if failed:
            continue
        vv = v["fields"].get("verdict", "").strip().lower()
        if kind_of(plan[aid]["fields"]) == "exploratory" and not vv.startswith("exploratory"):
            probs.append(f"verdict.md {aid}: an exploratory analysis has no decision rule to pass or fail; "
                         "its verdict starts with 'exploratory'")
        for k, val in v["fields"].items():
            if k in UNSOURCED_OK:
                continue
            nums = unsourced(val)
            if k == "rival":  # conditions ("at ratio 1") are named there; measured values have decimals or a %
                nums = [n for n in nums if "." in n or "%" in n]
            if nums:
                probs.append(f"verdict.md {aid} '{k}': numbers ({', '.join(nums[:3])}) without a [source] next to "
                             "them; take each from a run output or a RESULTS section (E2)")
    live = [k for k, p in plan.items() if p["fields"].get("status") != "dropped"]
    if live and all(plan[k]["fields"].get("status") in ("done", "failed") and k in ver for k in live):
        au = audits(d)
        if not au:
            probs.append("all analyses have verdicts but there is no audit: ra.py audit, then a fresh checker fills "
                         "verify/audit-N.md before any write-up")
        else:
            last = au[-1]
            for k in ("checker", "inputs", "numbers", "rules", "deviations", "substitutions", "selection", "status"):
                if empty(last.get(k)):
                    probs.append(f"verify/audit-{len(au)}.md: '{k}' is not filled")
            st = audit_status(last)
            if not empty(last.get("status")) and st not in ("pass", "disagreement"):
                probs.append(f"verify/audit-{len(au)}.md: status must start with 'pass' or 'disagreement' "
                             f"(found '{last.get('status', '')[:40]}')")
            if st == "disagreement":
                probs.append(f"verify/audit-{len(au)}.md: disagreement; take it to the person (decisions.md), fix, "
                             "and audit again")
    dec = sections(d / "decisions.md", pre(d, "Q"))
    for qid, q_ in dec.items():
        if q_["fields"].get("status") == "answered" and empty(q_["fields"].get("answer")):
            probs.append(f"decisions.md {qid}: answered but no 'answer' (the person's words)")
    return probs


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().strip("\"'").lower())


def cmd_handover(a) -> int:
    d = Path(a.dir)
    st = stage(d)
    if not (st.startswith("7") or st.startswith("closed")):
        print(f"not ready for hand-over: stage {st}")
        return 1
    plan = sections(d / "plan.md", pre(d, "A"))
    hyp = sections(d / "hypotheses.md", pre(d, "H"))
    ver = sections(d / "verdict.md", pre(d, "A"))
    print(f"Draft claim rows for research-writing's ledger (from {d}); rewrite each 'claim' as one sentence that "
          "states a finding. Confirmatory rows follow a rule fixed before the runs; exploratory rows must say so in "
          "the text ('not planned before the runs').\n")
    print("| analysis | claim (from the verdict) | type | hypotheses | condition | evidence |")
    print("|---|---|---|---|---|---|")
    for aid, v in ver.items():
        if aid not in plan:
            continue
        f, vf = plan[aid]["fields"], v["fields"]
        hs = "; ".join(label(hyp, h) for h in _ids(f.get("hypotheses", ""), pre(d, "H")) if h in hyp)
        cell = lambda x: re.sub(r"\s+", " ", x or "").replace("|", "/").strip()
        print(f"| {label(plan, aid)} | {cell(vf.get('verdict'))}: {cell(vf.get('result'))[:300]} | {kind_of(f)} | "
              f"{cell(hs)} | {cell(f.get('data'))[:160]} | {cell(f.get('results'))}; runs {cell(f.get('runs'))[:120]} |")
    devs = [l for l in log_lines(d) if re.match(r"- \S+ deviation ", l)]
    failed = [k for k, p in plan.items() if p["fields"].get("status") == "failed"]
    dropped = [k for k, p in plan.items() if p["fields"].get("status") == "dropped"]
    au = audits(d)
    print("\nThe write-up discloses (G3): " + "; ".join([
        f"{len(ver)} analyses with verdicts ({sum(kind_of(plan[k]['fields']) == 'exploratory' for k in ver if k in plan)} exploratory)",
        f"failed: {', '.join(failed) or 'none'}", f"dropped at gate 3: {', '.join(dropped) or 'none'}",
        f"deviations: {len(devs)}", f"audits: {len(au)} (last: {audit_status(au[-1]) if au else 'none'})",
        "the person's gate decisions in log.md"]))
    return 0


def cmd_close(a) -> int:
    d = Path(a.dir)
    st = stage(d)
    if not st.startswith("7"):
        print(f"cannot close at stage {st}: close follows a passing audit and the hand-over")
        return 1
    if not a.where.strip():
        print("say where the results went (the write-up path, a commit)")
        return 1
    append_log(d, f"- {today()} close: {a.where.strip()}")
    print(f"closed: {a.where.strip()}")
    return 0


def cmd_check(a) -> int:
    probs = check(Path(a.dir))
    for p in probs:
        print("- " + p)
    print(f"{len(probs)} problem(s)")
    return 1 if probs else 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("dir"); s.add_argument("--entry", required=True)
    s.add_argument("--question", required=True); s.add_argument("--tag"); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("gate"); s.add_argument("dir"); s.add_argument("gate"); s.add_argument("words")
    s.add_argument("--select"); s.add_argument("--approve"); s.add_argument("--drop")
    s.add_argument("--stop", action="store_true"); s.set_defaults(fn=cmd_gate)
    s = sub.add_parser("retag"); s.add_argument("dir"); s.add_argument("tag"); s.set_defaults(fn=cmd_retag)
    s = sub.add_parser("deviation"); s.add_argument("dir"); s.add_argument("analysis"); s.add_argument("text")
    s.set_defaults(fn=cmd_deviation)
    s = sub.add_parser("audit"); s.add_argument("dir"); s.set_defaults(fn=cmd_audit)
    s = sub.add_parser("status"); s.add_argument("dir"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("handover"); s.add_argument("dir"); s.set_defaults(fn=cmd_handover)
    s = sub.add_parser("close"); s.add_argument("dir"); s.add_argument("where"); s.set_defaults(fn=cmd_close)
    s = sub.add_parser("check"); s.add_argument("dir"); s.set_defaults(fn=cmd_check)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
