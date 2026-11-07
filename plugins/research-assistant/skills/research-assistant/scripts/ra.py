#!/usr/bin/env python3
"""research-assistant tools: start a research question folder, record gates and deviations, show status, check the rules.

Standard library only. Every command takes the question folder (docs/research/<topic>/ in a project).

  ra.py init DIR --entry project|idea|review|paper --question "..."   the folder from templates/research/
  ra.py gate DIR G1|G2|G3 "<the person's words>" [--approve A1,A3] [--drop A2]
                                       append a dated gate line to log.md; G3 sets approved/dropped in plan.md
  ra.py deviation DIR A2 "<what changed, why, before or after seeing any outcome>"
  ra.py status DIR                     stage, gates passed, analyses by status, open decisions
  ra.py check DIR                      the mechanical rules (exit 1 on a problem)

Exit codes: 0 ok, 1 problems found or bad input.
"""
from __future__ import annotations

import argparse
import datetime
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "templates" / "research"
FILES = ("question.md", "log.md", "hypotheses.md", "plan.md", "verdict.md", "decisions.md")
ENTRIES = ("project", "idea", "review", "paper")
STATUSES = ("proposed", "approved", "running", "done", "failed", "dropped")
PLAN_FIELDS = ("hypotheses", "data", "metric", "decision rule", "negative control", "positive control", "variants",
               "seeds", "cost", "value")
PLACEHOLDER = re.compile(r"<[^<>\n]{3,}>")
SOURCE = re.compile(r"\[[^\]]+\]")
NUMBER = re.compile(r"(?<![\w.§#-])[-−]?\d+(?:\.\d+)?(?:\s*%)?(?![\w])")


def today() -> str:
    return datetime.date.today().isoformat()


def _strip_comments(s: str) -> str:
    return re.sub(r"<!--.*?-->", "", s, flags=re.S)


def sections(path: Path, prefix: str) -> dict[str, dict]:
    """{id: {"title": ..., "fields": {name: value}, "text": ...}} for '## <prefix><n>: title' sections."""
    if not path.exists():
        return {}
    s = _strip_comments(path.read_text())
    out = {}
    parts = re.split(rf"^## ({prefix}\d+):\s*(.*)$", s, flags=re.M)
    for i in range(1, len(parts) - 2, 3):
        sid, title, body = parts[i], parts[i + 1].strip(), parts[i + 2]
        fields = {}
        for m in re.finditer(r"^- ([a-z][a-z ]*?):\s*(.*)$", body, re.M):
            fields[m.group(1).strip()] = m.group(2).strip()
        out[sid] = {"title": title, "fields": fields, "text": body}
    return out


def fields_of(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return {m.group(1).strip(): m.group(2).strip()
            for m in re.finditer(r"^- ([a-z][a-z ]*?):\s*(.*)$", _strip_comments(path.read_text()), re.M)}


def gates(d: Path) -> dict[str, list[str]]:
    """{'G1': [lines], ...} from log.md."""
    out: dict[str, list[str]] = {}
    log = d / "log.md"
    for line in (log.read_text().splitlines() if log.exists() else []):
        m = re.match(r"- \d{4}-\d{2}-\d{2} (G[123])\b", line)
        if m:
            out.setdefault(m.group(1), []).append(line)
    return out


def approved(d: Path) -> set[str]:
    ids: set[str] = set()
    for line in gates(d).get("G3", []):
        m = re.search(r"approve ([A\d, ]+?)(?: drop|:)", line)
        if m:
            ids |= {x.strip() for x in m.group(1).split(",") if x.strip()}
    return ids


def empty(v: str | None) -> bool:
    return not v or bool(PLACEHOLDER.fullmatch(v.strip())) or v.strip() in ("-", "TODO")


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


# ------------------------------------------------------------------ gate, deviation
def append_log(d: Path, line: str) -> None:
    log = d / "log.md"
    text = log.read_text() if log.exists() else "# Log\n"
    log.write_text(text.rstrip("\n") + "\n" + line + "\n")


def set_status(d: Path, ids: list[str], status: str) -> list[str]:
    plan = d / "plan.md"
    s = plan.read_text()
    missing = []
    for aid in ids:
        pat = re.compile(rf"(^## {re.escape(aid)}:.*?^- status:)[^\n]*", re.S | re.M)
        if not re.search(rf"^## {re.escape(aid)}:", _strip_comments(s), re.M):
            missing.append(aid)
            continue
        s = pat.sub(lambda m: m.group(1) + " " + status, s, count=1)
    plan.write_text(s)
    return missing


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
    ap = [x.strip() for x in (a.approve or "").split(",") if x.strip()]
    dr = [x.strip() for x in (a.drop or "").split(",") if x.strip()]
    if g != "G3" and (ap or dr):
        print("--approve and --drop belong to G3")
        return 1
    if g == "G3":
        if not ap and not dr:
            print("G3 approves or drops analyses: --approve A1,A3 and/or --drop A2")
            return 1
        missing = set_status(d, ap, "approved") + set_status(d, dr, "dropped")
        if missing:
            print(f"not in plan.md: {', '.join(missing)}")
            return 1
    extra = (f" approve {', '.join(ap)}" if ap else "") + (f" drop {', '.join(dr)}" if dr else "")
    words = a.words.strip().replace("\n", " ")
    append_log(d, f'- {today()} {g}{extra}: "{words}"')
    print(f"recorded {g}{extra}")
    return 0


def cmd_deviation(a) -> int:
    d = Path(a.dir)
    if a.analysis not in sections(d / "plan.md", "A"):
        print(f"{a.analysis} is not in plan.md")
        return 1
    append_log(d, f"- {today()} deviation {a.analysis}: {a.text.strip()}")
    print(f"recorded deviation for {a.analysis}")
    return 0


# ------------------------------------------------------------------ status
def stage(d: Path) -> str:
    g = gates(d)
    plan = sections(d / "plan.md", "A")
    st = [p["fields"].get("status", "") for p in plan.values()]
    if "G3" in g:
        if st and all(s in ("done", "failed", "dropped") for s in st):
            return "6-7 verdict, audit and write-up"
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
    print(f"hypotheses: {len(hyp)}")
    plan = sections(d / "plan.md", "A")
    by: dict[str, list[str]] = {}
    for aid, p in plan.items():
        by.setdefault(p["fields"].get("status", "?"), []).append(aid)
    print("analyses: " + ("; ".join(f"{k} {', '.join(v)}" for k, v in by.items()) or "none yet"))
    dec = sections(d / "decisions.md", "Q")
    open_ = [k for k, v in dec.items() if v["fields"].get("status", "open") == "open"]
    print(f"open decisions: {', '.join(open_) if open_ else 'none'}")
    devs = [l for l in ((d / 'log.md').read_text().splitlines() if (d / 'log.md').exists() else []) if " deviation " in l]
    print(f"deviations: {len(devs)}")
    return 0


# ------------------------------------------------------------------ check
def project_root(d: Path) -> Path | None:
    for p in [d.resolve(), *d.resolve().parents]:
        if (p / "docs" / "RESULTS.md").exists() or (p / ".git").exists():
            return p
    return None


def check(d: Path) -> list[str]:
    probs: list[str] = []
    for f in FILES:
        if not (d / f).exists():
            probs.append(f"{f} is missing (ra.py init)")
    if probs:
        return probs
    g = gates(d)
    q = fields_of(d / "question.md")
    for k in ("question", "type", "decision", "claim type", "budget", "stop rules"):
        if empty(q.get(k)):
            probs.append(f"question.md: '{k}' is not filled" + (" (gate 1 was passed without it)" if "G1" in g else ""))
    hyp = sections(d / "hypotheses.md", "H")
    plan = sections(d / "plan.md", "A")
    if "G1" in g or hyp:
        if "G2" in g and len(hyp) < 3:
            probs.append(f"hypotheses.md: {len(hyp)} hypotheses; write at least three competing ones (C1)")
        for hid, h in hyp.items():
            for k in ("source", "rejected if", "analysis", "claim"):
                if empty(h["fields"].get(k)):
                    probs.append(f"hypotheses.md {hid}: no '{k}'")
            for aid in re.findall(r"\bA\d+\b", h["fields"].get("analysis", "")):
                if plan and aid not in plan:
                    probs.append(f"hypotheses.md {hid}: analysis {aid} is not in plan.md")
    ap = approved(d)
    for aid, p in plan.items():
        f = p["fields"]
        st = f.get("status", "")
        if st not in STATUSES:
            probs.append(f"plan.md {aid}: status '{st}' is not one of {', '.join(STATUSES)}")
        if st == "dropped":
            continue
        for k in PLAN_FIELDS:
            if empty(f.get(k)):
                probs.append(f"plan.md {aid}: no '{k}'")
        for hid in re.findall(r"\bH\d+\b", f.get("hypotheses", "")):
            if hid not in hyp:
                probs.append(f"plan.md {aid}: hypothesis {hid} is not in hypotheses.md")
        if st in ("approved", "running", "done", "failed") and aid not in ap:
            probs.append(f"plan.md {aid}: status {st} without a gate-3 approval in log.md (ra.py gate DIR G3 ... "
                         f"--approve {aid})")
        if st == "done":
            if empty(f.get("runs")):
                probs.append(f"plan.md {aid}: done but no run ids under 'runs'")
            if empty(f.get("results")):
                probs.append(f"plan.md {aid}: done but no RESULTS section under 'results'")
            root = project_root(d)
            res = root / "docs" / "RESULTS.md" if root else None
            for n in re.findall(r"§\s*(\d+)", f.get("results", "")):
                if res and res.exists() and not re.search(rf"^## {n}\.", res.read_text(), re.M):
                    probs.append(f"plan.md {aid}: RESULTS §{n} is not in docs/RESULTS.md")
            runs_md = root / "docs" / "RUNS.md" if root else None
            if runs_md and runs_md.exists() and not empty(f.get("runs")):
                text = runs_md.read_text()
                for rid in re.split(r"[,;\s]+", f["runs"]):
                    if rid and rid not in text:
                        probs.append(f"plan.md {aid}: run {rid} is not in docs/RUNS.md")
    ver = sections(d / "verdict.md", "A")
    for aid, p in plan.items():
        if p["fields"].get("status") in ("done", "failed") and aid not in ver:
            probs.append(f"verdict.md: no section for {aid} ({p['fields'].get('status')})")
    for aid, v in ver.items():
        if aid not in plan:
            probs.append(f"verdict.md {aid}: not in plan.md")
            continue
        rule_plan = plan[aid]["fields"].get("decision rule", "")
        if empty(v["fields"].get("rule")):
            probs.append(f"verdict.md {aid}: no 'rule' (copy the decision rule from plan.md)")
        elif _norm(v["fields"]["rule"]) != _norm(rule_plan):
            probs.append(f"verdict.md {aid}: the rule differs from plan.md's decision rule; a changed rule is a "
                         "deviation (ra.py deviation) and the verdict quotes the planned one")
        if empty(v["fields"].get("verdict")):
            probs.append(f"verdict.md {aid}: no 'verdict'")
        for k, val in v["fields"].items():
            if k in ("rule", "verdict", "rival"):
                continue
            nums = [m.group(0) for m in NUMBER.finditer(SOURCE.sub(" ", val))]
            if nums and not SOURCE.search(val):
                probs.append(f"verdict.md {aid} '{k}': numbers ({', '.join(nums[:3])}) without a [source]; take each "
                             "from a run output or a RESULTS section (E2)")
    dec = sections(d / "decisions.md", "Q")
    for qid, q_ in dec.items():
        if q_["fields"].get("status") == "answered" and empty(q_["fields"].get("answer")):
            probs.append(f"decisions.md {qid}: answered but no 'answer' (the person's words)")
    return probs


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().strip("\"'").lower())


def cmd_check(a) -> int:
    d = Path(a.dir)
    probs = check(d)
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
    s.add_argument("--approve"); s.add_argument("--drop"); s.set_defaults(fn=cmd_gate)
    s = sub.add_parser("deviation"); s.add_argument("dir"); s.add_argument("analysis"); s.add_argument("text")
    s.set_defaults(fn=cmd_deviation)
    s = sub.add_parser("status"); s.add_argument("dir"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("check"); s.add_argument("dir"); s.set_defaults(fn=cmd_check)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
