#!/usr/bin/env python3
"""research-assistant tools: start a research question folder, record gates and deviations, show status, check the rules.

Standard library only. Every command takes the question folder (docs/research/<topic>/ in a project).

  ra.py init DIR --entry project|idea|review|paper --question "..."   the folder from templates/research/
  ra.py gate DIR G1 "<the person's words>"
  ra.py gate DIR G2 "<words>" --select H1,H2 [--drop H3]   or   --stop   (the literature answered it)
  ra.py gate DIR G3 "<words>" --approve A1,A3 [--drop A2]
                                       each gate first checks its stage is complete, then appends a dated line to
                                       log.md; G3 sets the status in plan.md and fingerprints each approved analysis
  ra.py deviation DIR A2 "<what changed, why, before or after seeing any outcome>"
                                       logs the change and re-fingerprints the analysis
  ra.py audit DIR                      writes verify/audit-N.md for the fresh checker to fill
  ra.py status DIR                     stage, gates passed, analyses by status, open decisions
  ra.py check DIR                      the mechanical rules (exit 1 on a problem)

Exit codes: 0 ok, 1 problems found or bad input.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import re
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


def fingerprint(fields: dict[str, str]) -> str:
    text = "\n".join(f"{k}={re.sub(r'\s+', ' ', fields.get(k, '').strip())}" for k in FROZEN)
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
    m = re.search(rf"\b{word} ([AH]\d+(?:, ?[AH]\d+)*)", line)
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
        for aid, fp in re.findall(r"\b(A\d+)=([0-9a-f]{10})\b", line):
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
    d.mkdir(parents=True, exist_ok=True)
    (d / "verify").mkdir(exist_ok=True)
    for f in FILES:
        t = (TEMPLATE / f).read_text()
        (d / f).write_text(t.replace("{date}", today()).replace("{entry}", a.entry).replace("{question}", a.question))
    print(f"created {d}: {', '.join(FILES)}, verify/")
    print("next: fill question.md (section 1), then gate 1 with the person")
    return 0


# ------------------------------------------------------------------ stage checks (also run before each gate)
def check_question(d: Path) -> list[str]:
    q = fields_of(d / "question.md")
    return [f"question.md: '{k}' is not filled" for k in QUESTION_FIELDS if empty(q.get(k))]


def check_hypotheses(d: Path, for_gate2: bool = False) -> list[str]:
    probs = []
    hyp = sections(d / "hypotheses.md", "H")
    if for_gate2 and len(hyp) < 3:
        probs.append(f"hypotheses.md: {len(hyp)} hypotheses; write at least three competing ones (C1)")
    for hid, h in hyp.items():
        for k in HYP_FIELDS:
            if empty(h["fields"].get(k)):
                probs.append(f"hypotheses.md {hid}: no '{k}'")
    return probs


def check_analysis(aid: str, f: dict[str, str], hyp: dict) -> list[str]:
    probs = [f"plan.md {aid}: no '{k}'" for k in PLAN_FIELDS if empty(f.get(k))]
    for hid in _ids(f.get("hypotheses", ""), "H"):
        if hid not in hyp:
            probs.append(f"plan.md {aid}: hypothesis {hid} is not in hypotheses.md")
    return probs


# ------------------------------------------------------------------ gate, deviation, audit
def set_status(d: Path, aid: str, status: str) -> bool:
    """Set '- status:' of the real section ## <aid>: (not one inside a comment); add the line if missing."""
    plan = d / "plan.md"
    s = plan.read_text()
    spans = _comment_spans(s)
    heads = [m for m in re.finditer(r"^## [A-Z]\d+:.*$", s, re.M) if not _in(spans, m.start())]
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
    sel, drop, ap = _csv(a.select), _csv(a.drop), _csv(a.approve)
    extra = ""
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
        hyp = sections(d / "hypotheses.md", "H")
        probs += [f"{h} is not in hypotheses.md" for h in sel + drop if h not in hyp]
        extra = (" stop" if a.stop else "") + (f" select {', '.join(sel)}" if sel else "") + \
                (f" drop {', '.join(drop)}" if drop else "")
    else:
        if sel or a.stop:
            print("G3 approves (--approve A1,A3) or drops (--drop A2) analyses")
            return 1
        if not (ap or drop):
            print("G3 approves or drops analyses: --approve A1,A3 and/or --drop A2")
            return 1
        plan = sections(d / "plan.md", "A")
        hyp = sections(d / "hypotheses.md", "H")
        probs = [f"{x} is not in plan.md" for x in ap + drop if x not in plan]
        for x in ap:
            if x in plan:
                probs += check_analysis(x, plan[x]["fields"], hyp)
        if not probs:
            for x in ap:
                set_status(d, x, "approved")
            for x in drop:
                set_status(d, x, "dropped")
            plan = sections(d / "plan.md", "A")
        extra = (f" approve {', '.join(ap)}" if ap else "") + (f" drop {', '.join(drop)}" if drop else "") + \
                "".join(f" {x}={fingerprint(plan[x]['fields'])}" for x in ap if x in plan)
    if probs:
        print(f"{g} not recorded; the stage is not complete:")
        for p in probs:
            print("- " + p)
        return 1
    append_log(d, f'- {today()} {g}{extra}: "{_words(a)}"')
    print(f"recorded {g}{extra}")
    return 0


def cmd_deviation(a) -> int:
    d = Path(a.dir)
    plan = sections(d / "plan.md", "A")
    if a.analysis not in plan:
        print(f"{a.analysis} is not in plan.md")
        return 1
    fp = fingerprint(plan[a.analysis]["fields"])
    append_log(d, f"- {today()} deviation {a.analysis} {a.analysis}={fp}: {a.text.strip()}")
    print(f"recorded deviation for {a.analysis}")
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


def stage(d: Path) -> str:
    g = gates(d)
    if stopped(d):
        return "stopped at gate 2 (answered by the literature)"
    plan = sections(d / "plan.md", "A")
    live = {k: p for k, p in plan.items() if p["fields"].get("status") != "dropped"}
    if "G3" in g:
        if live and all(p["fields"].get("status") in ("done", "failed") for p in live.values()):
            ver = sections(d / "verdict.md", "A")
            if any(k not in ver for k in live):
                return "6 verdicts"
            if not any(x.get("status") == "pass" for x in audits(d)):
                return "6 audit (ra.py audit, then a fresh checker)"
            return "7 write-up (ready for hand-over)"
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
    print(f"entry: {q.get('entry', '?')}; stage: {stage(d)}")
    g = gates(d)
    print("gates: " + (", ".join(f"{k} {v[-1][2:12]}" for k, v in sorted(g.items())) or "none yet"))
    hyp = sections(d / "hypotheses.md", "H")
    sel = selected(d)
    print(f"hypotheses: {len(hyp)}" + (f" (selected {', '.join(sorted(sel))})" if sel else ""))
    by: dict[str, list[str]] = {}
    for aid, p in sections(d / "plan.md", "A").items():
        by.setdefault(p["fields"].get("status", "?"), []).append(aid)
    print("analyses: " + ("; ".join(f"{k} {', '.join(v)}" for k, v in by.items()) or "none yet"))
    dec = sections(d / "decisions.md", "Q")
    open_ = [k for k, v in dec.items() if v["fields"].get("status", "open") == "open"]
    print(f"open decisions: {', '.join(open_) if open_ else 'none'}")
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
    q = fields_of(d / "question.md")
    lit = q.get("literature", "")
    if "G2" in g and empty(lit):
        probs.append("question.md: 'literature' is not filled (the literature folder, or 'none: why')")
    elif not empty(lit) and root and re.match(r"docs/\S+/?$", lit.split()[0]) and not (root / lit.split()[0]).exists():
        probs.append(f"question.md: literature folder {lit.split()[0]} does not exist")
    hyp = sections(d / "hypotheses.md", "H")
    plan = sections(d / "plan.md", "A")
    sel = selected(d)
    if "G1" in g or hyp:
        probs += check_hypotheses(d, for_gate2="G2" in g and not stopped(d))
        for hid, h in hyp.items():
            if hid in sel:
                for aid in _ids(h["fields"].get("analysis", ""), "A"):
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
        probs += check_analysis(aid, f, hyp)
        for hid in _ids(f.get("hypotheses", ""), "H"):
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
    ver = sections(d / "verdict.md", "A")
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
            if last.get("status") == "disagreement":
                probs.append(f"verify/audit-{len(au)}.md: disagreement; take it to the person (decisions.md), fix, "
                             "and audit again")
    dec = sections(d / "decisions.md", "Q")
    for qid, q_ in dec.items():
        if q_["fields"].get("status") == "answered" and empty(q_["fields"].get("answer")):
            probs.append(f"decisions.md {qid}: answered but no 'answer' (the person's words)")
    return probs


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().strip("\"'").lower())


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
    s.add_argument("--question", required=True); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("gate"); s.add_argument("dir"); s.add_argument("gate"); s.add_argument("words")
    s.add_argument("--select"); s.add_argument("--approve"); s.add_argument("--drop")
    s.add_argument("--stop", action="store_true"); s.set_defaults(fn=cmd_gate)
    s = sub.add_parser("deviation"); s.add_argument("dir"); s.add_argument("analysis"); s.add_argument("text")
    s.set_defaults(fn=cmd_deviation)
    s = sub.add_parser("audit"); s.add_argument("dir"); s.set_defaults(fn=cmd_audit)
    s = sub.add_parser("status"); s.add_argument("dir"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("check"); s.add_argument("dir"); s.set_defaults(fn=cmd_check)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
