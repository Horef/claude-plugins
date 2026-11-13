"""Scripted evals for project-foundations: docmap.py on a throwaway fixture project (exit 1 on any failure).

Checks the behaviour the skill promises: `update` writes the map and README tables, `check` is green on a
well-formed project and fails on a TODO README stub, a missing file header and a forbidden import, `where`
finds definitions and importers, and the code graph (`calls`, `deps`, `map`) resolves calls, flags import cycles and
keeps the map within its token budget. Run: python evals/run.py (from the skill folder or anywhere).
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
DOCMAP = SKILL_DIR / "scripts" / "docmap.py"
FILES = {
    "pyproject.toml": '[project]\nname = "demo"\nversion = "0.1.0"\n\n[[tool.docmap.forbid]]\nsource = "demo.core"\nimports = ["json"]\nreason = "core stays pure"\n',
    "AGENTS.md": "# Demo - agent instructions\n\nA demo project.\n",
    "docs/STATUS.md": "# Status\nUpdated 2026-10-30.\n",
    "docs/WORKLOG.md": "# Work log\n\n## 2026-10-30 - start\nChanged: start.\n",
    "docs/DECISIONS.md": "# Decision log\nDecisions.\n\n## D1. Use stdlib (2026-10-30; status: accepted)\n- **Decision:** stdlib only.\n\n## D2. Pure core (2026-10-30; status: accepted)\n- **Decision:** no json in core.\n",
    "demo/README.md": "# demo/\n\nThe demo package: one pure core and one adapter.\n",
    "demo/__init__.py": '"""Demo package."""\n',
    "demo/core.py": '"""Pure arithmetic core."""\n\n\ndef add(a: int, b: int) -> int:\n    return a + b\n',
    "demo/adapter.py": '"""Adapter that formats results as JSON."""\nimport json\n\nfrom demo.core import add\n\n\ndef dump(a, b):\n    return json.dumps(add(a, b))\n',
}
GRAPH = {  # a small package for the code-graph commands
    "g/__init__.py": '"""G package."""\nfrom .core import helper\n',
    "g/core.py": ('"""Core."""\n\n\ndef helper(x):\n    return x\n\n\nclass Engine:\n    def run(self):\n'
                  '        self.step()\n        return helper(1)\n\n    def step(self):\n        return 0\n'),
    "g/util.py": '"""Util."""\n\n\ndef fmt(v):\n    return str(v)\n',
    "g/app.py": ('"""App."""\nimport json\n\nimport g.util as u\nfrom g import helper\nfrom g.core import Engine\n\n\n'
                 'def main(thing):\n    e = Engine()\n    e.run()\n    thing.step()\n    u.fmt(helper(2))\n'
                 '    return json.dumps(1)\n\n\ndef outer():\n    def inner():\n        return 1\n    return inner()\n'),
    "g/cyc_a.py": '"""Cycle A."""\nfrom g import cyc_b\nfrom g.core import helper\n\n\ndef a():\n    return helper(cyc_b.b())\n',
    "g/cyc_b.py": '"""Cycle B."""\nfrom g import cyc_a\nfrom g.core import helper\n\n\ndef b():\n    return helper(cyc_a)\n',
    "web/app.js": "// Web.\nfunction jsOnly() { return 1; }\n",
}


def sh(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(list(args), cwd=cwd, capture_output=True, text=True)


def docmap(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    return sh(cwd, sys.executable, str(DOCMAP), *args)


def main() -> int:
    failures = []

    def expect(cond: bool, what: str, proc: subprocess.CompletedProcess | None = None):
        print(("ok   " if cond else "FAIL ") + what)
        if not cond:
            failures.append(what)
            if proc is not None:
                print((proc.stdout + proc.stderr)[-1500:])

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        for a in (("init", "-q"), ("config", "user.email", "t@t"), ("config", "user.name", "t")):
            sh(root, "git", *a)
        p = docmap(root, "update")
        expect(p.returncode == 0 and (root / "docs/MAP.md").exists(), "update writes docs/MAP.md", p)
        expect("docmap:begin" in (root / "demo/README.md").read_text(), "update adds the generated table to demo/README.md")
        expect("| D1 |" in (root / "docs/DECISIONS.md").read_text().split("## D1.")[0], "update puts the DECISIONS index above the first entry")
        p = docmap(root, "check")
        expect(p.returncode == 0, "check is green on a well-formed project", p)
        p = docmap(root, "where", "add")
        expect("demo/core.py" in p.stdout and "demo/adapter.py" in p.stdout, "where finds the definition and its user", p)

        p = docmap(root, "get", "D2")
        expect("## D2. Pure core" in p.stdout and "## D1." not in p.stdout, "get D2 prints only that decision", p)
        p = docmap(root, "find", "json", "core")
        expect("docs/DECISIONS.md" in p.stdout and "D2. Pure core" in p.stdout, "find locates the entry by its words", p)
        p = docmap(root, "stats")
        expect(p.returncode == 0 and "AGENTS.md" in p.stdout and "DECISIONS.md" in p.stdout, "stats reports what agents read", p)

        (root / "demo/core.py").write_text('import json\n\n\ndef add(a, b):\n    return a + b\n', encoding="utf-8")
        p = docmap(root, "check")
        expect(p.returncode == 1 and "docstring" in p.stdout + p.stderr, "check fails on a missing file header", p)
        expect("json" in p.stdout + p.stderr, "check fails on a forbidden import", p)

        (root / "demo/core.py").write_text(FILES["demo/core.py"], encoding="utf-8")
        (root / "tools").mkdir()
        (root / "tools/run.py").write_text('"""Runner."""\n', encoding="utf-8")
        docmap(root, "update")
        p = docmap(root, "check")
        expect(p.returncode == 1 and "TODO(docmap)" in p.stdout + p.stderr, "check fails until a new folder's README stub is written", p)

    with tempfile.TemporaryDirectory() as tmp:  # a large project: the map lists folders, and budgets warn
        root = Path(tmp)
        for i in range(160):
            (root / f"pkg{i % 4}").mkdir(exist_ok=True)
            (root / f"pkg{i % 4}" / f"m{i}.py").write_text(f'"""Module {i}."""\n', encoding="utf-8")
        for d in range(4):
            (root / f"pkg{d}" / "README.md").write_text(f"# pkg{d}/\n\nPackage {d}.\n", encoding="utf-8")
        (root / "AGENTS.md").write_text("# Big\n\n" + "word " * 40000, encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        m = (root / "docs/MAP.md").read_text()
        expect("folders only" in m and "m17.py" not in m, "MAP lists folders only above map_files_max")
        p = docmap(root, "check")
        expect("AGENTS.md: about" in p.stdout and "read_max_tokens" in p.stdout, "check warns when a file read whole is over budget", p)

    with tempfile.TemporaryDirectory() as tmp:  # O12: a total budget for the files read whole, apart from the per-file one
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "AGENTS.md").write_text("# Demo\n\n" + "word " * 5600, encoding="utf-8")       # about 7000 tokens each: under 8000
        (root / "docs/STATUS.md").write_text("# Status\nUpdated 2026-10-30.\n\n" + "word " * 5600, encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        expect("read_total_max_tokens" in p.stdout and "read_max_tokens" not in p.stdout.replace("read_total_max_tokens", ""),
               "check warns when the files read whole together exceed read_total_max_tokens though each is under read_max_tokens", p)
        p = docmap(root, "stats")
        expect("per file" in p.stdout and "read_total_max_tokens" in p.stdout and "<- over the total budget" in p.stdout
               and "<- over the per-file budget" not in p.stdout, "stats names the per-file and the total limit and marks the total", p)
        (root / "docmap.toml").write_text("read_total_max_tokens = 20000\n", encoding="utf-8")
        p = docmap(root, "check")
        expect("read_total_max_tokens" not in p.stdout, "read_total_max_tokens can be raised in the configuration", p)

    with tempfile.TemporaryDirectory() as tmp:  # O12: `rotate --keep N` moves older entries regardless of month
        import datetime
        today = datetime.date.today()
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        d = today.isoformat()
        (root / "docs/WORKLOG.md").write_text(
            f"# Work log\n\n## {d} - third\n- c\n\n## {d} - second\n- b\n\n## {d} - first\n- a\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        p = docmap(root, "rotate")
        expect(p.returncode == 0 and (root / "docs/WORKLOG.md").read_text().count("\n## ") == 3
               and not (root / "docs/worklog").exists(), "rotate without --keep leaves current-month entries alone", p)
        p = docmap(root, "rotate", "--keep", "1")
        wl = (root / "docs/WORKLOG.md").read_text()
        arch = root / "docs/worklog" / f"{today.year}-{today.month:02d}.md"
        expect(p.returncode == 0 and "- third" in wl and "- second" not in wl and "- first" not in wl,
               "rotate --keep 1 keeps only the newest entry in the WORKLOG", p)
        text = arch.read_text() if arch.exists() else ""
        expect("- second" in text and "- first" in text and text.index("- second") < text.index("- first"),
               "rotate --keep moves the older entries to the month archive, order kept", p)
        p = docmap(root, "rotate", "--keep", "1")
        expect(p.returncode == 0 and (root / "docs/WORKLOG.md").read_text() == wl and arch.read_text() == text,
               "rotate --keep is idempotent", p)
        p = docmap(root, "rotate", "--keep", "x")
        expect(p.returncode != 0, "rotate rejects a bad --keep value", p)

    with tempfile.TemporaryDirectory() as tmp:  # an older project copy warns when the person's skill clone is newer
        root, home = Path(tmp) / "proj", Path(tmp) / "home"
        genome = home / "skills"
        newer = genome / "plugins/project-foundations/skills/project-foundations/scripts"
        newer.mkdir(parents=True)
        (newer / "docmap.py").write_text('DOCMAP_VERSION = "99.0.0"\n', encoding="utf-8")
        (home / ".config/strange-loop").mkdir(parents=True)
        (home / ".config/strange-loop/genome").write_text(str(genome), encoding="utf-8")
        (root / "tools").mkdir(parents=True)
        (root / "tools/docmap.py").write_text(DOCMAP.read_text(encoding="utf-8"), encoding="utf-8")
        (root / "AGENTS.md").write_text("# P\n\nA project.\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        env = dict(os.environ, HOME=str(home)); env.pop("CI", None)
        p = subprocess.run([sys.executable, "tools/docmap.py", "check"], cwd=root, capture_output=True, text=True, env=env)
        expect("the project-foundations skill has 99.0.0" in p.stdout, "check points an older project at the newer skill", p)

    with tempfile.TemporaryDirectory() as tmp:  # parallel branches: conflicts in generated content heal on `update` (O9)
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        for a in (("init", "-q", "-b", "main"), ("config", "user.email", "t@t"), ("config", "user.name", "t")):
            sh(root, "git", *a)
        docmap(root, "update")
        sh(root, "git", "add", "-A"); sh(root, "git", "commit", "-qm", "base")
        sh(root, "git", "checkout", "-qb", "side")
        (root / "demo/extra_a.py").write_text('"""Side branch module."""\n', encoding="utf-8")
        (root / "AGENTS.md").write_text("# Demo - agent instructions\n\nSide wording.\n", encoding="utf-8")
        docmap(root, "update")
        sh(root, "git", "add", "-A"); sh(root, "git", "commit", "-qm", "side")
        sh(root, "git", "checkout", "-q", "main")
        (root / "demo/extra_b.py").write_text('"""Main branch module."""\n', encoding="utf-8")
        (root / "AGENTS.md").write_text("# Demo - agent instructions\n\nMain wording.\n", encoding="utf-8")
        docmap(root, "update")
        sh(root, "git", "add", "-A"); sh(root, "git", "commit", "-qm", "main")
        m = sh(root, "git", "merge", "side")
        readme = (root / "demo/README.md").read_text()
        expect(m.returncode != 0 and "<<<<<<<" in readme, "fixture: both branches regenerated, so the merge conflicts", m)
        p = docmap(root, "check")
        expect(p.returncode == 1 and "merge conflict" in p.stdout + p.stderr, "check fails on unresolved merge conflict markers", p)
        p = docmap(root, "update")
        readme = (root / "demo/README.md").read_text()
        expect("<<<<<<<" not in readme and "extra_a.py" in readme and "extra_b.py" in readme
               and "<<<<<<<" not in (root / "docs/MAP.md").read_text(),
               "update resolves conflicts inside generated content and regenerates it", p)
        expect("<<<<<<<" in (root / "AGENTS.md").read_text() and "AGENTS.md" in p.stdout,
               "update leaves a conflict in hand-written text and names the file", p)

    with tempfile.TemporaryDirectory() as tmp:  # `worklog` adds a dated entry in the project's style (O10)
        import datetime
        today = datetime.date.today()
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        sh(root, "git", "init", "-q")
        p = subprocess.run([sys.executable, str(DOCMAP), "worklog", "Second step", "-", "--status"], cwd=root,
                           input="- Changed: x.\n- Next: y.\n", capture_output=True, text=True)
        wl = (root / "docs/WORKLOG.md").read_text()
        first = wl.split("\n## ", 1)[1] if "\n## " in wl else ""
        expect(p.returncode == 0 and first.startswith(f"{today.isoformat()} - Second step\n") and "- Next: y." in first,
               "worklog inserts a dated entry at the top (ISO style kept)", p)
        expect("Updated " + today.isoformat() in (root / "docs/STATUS.md").read_text(), "worklog --status bumps STATUS's date", p)
        expect((root / "docs/worklog/2026-10.md").exists() and "## 2026-10-30 - start" not in wl,
               "worklog rotates entries of earlier months", p)
        long = f"{today.day} {today.strftime('%B')} {today.year}"
        (root / "docs/WORKLOG.md").write_text(f"# Work log\n\n## {long} - first\n- a\n", encoding="utf-8")
        body = root / "body.md"
        body.write_text("- b\n", encoding="utf-8")
        p = docmap(root, "worklog", "Second", str(body))
        wl = (root / "docs/WORKLOG.md").read_text()
        expect(f"## {long} - Second" in wl and wl.index(f"## {long} - Second") < wl.index(f"## {long} - first"),
               "worklog keeps a long-date style", p)

    with tempfile.TemporaryDirectory() as tmp:  # code graph: `calls`, `deps`, `map` (Python only, resolved through imports)
        root = Path(tmp)
        for rel, text in GRAPH.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        sh(root, "git", "init", "-q")
        p = docmap(root, "calls", "main")
        out = p.stdout
        callees = out.split("called by")[0]
        expect(p.returncode == 0 and "g.core.helper" in callees and "g.util.fmt" in callees,
               "calls lists resolved callees, through a package re-export and a module alias", p)
        expect("g.core.Engine.run" in callees, "calls resolves a method on a local instance (e = Engine())", p)
        unres = callees.split("by name only")[1] if "by name only" in callees else ""
        expect("step" in unres and "g.core.Engine.step" in unres, "calls lists unresolved calls apart, by name only", p)
        expect("json.dumps" in callees, "calls names external calls separately", p)
        p = docmap(root, "calls", "helper")
        callers = p.stdout.split("called by")[1] if "called by" in p.stdout else ""
        expect("g/app.py:" in callers and "g/core.py:" in callers and "Engine.run" in callers,
               "calls lists callers with file:line and the calling function", p)
        p = docmap(root, "calls", "Engine.run")
        expect("g.core.Engine.step" in p.stdout.split("called by")[0], "calls resolves self.method() in a class", p)
        p = docmap(root, "calls", "main", "--depth", "2")
        expect("g.core.Engine.step  g/core.py:" in p.stdout.split("called by")[0], "calls --depth 2 follows callees of callees", p)
        p = docmap(root, "calls", "outer")
        expect("g.app.outer.inner  g/app.py:" in p.stdout.split("called by")[0], "calls resolves a function defined in the caller", p)
        p = docmap(root, "calls", "jsOnly")
        expect(p.returncode != 0 and "jsOnly" in p.stdout + p.stderr and "Python" in p.stdout + p.stderr,
               "calls says non-Python code is not supported", p)
        p = docmap(root, "deps", "g")
        expect(p.returncode == 0 and "app ->" in p.stdout and "core" in p.stdout.split("app ->")[1].splitlines()[0],
               "deps lists which modules import which", p)
        cyc = [ln for ln in p.stdout.splitlines() if "cycle" in ln.lower()]
        expect(any("cyc_a" in ln and "cyc_b" in ln for ln in cyc), "deps flags an import cycle", p)
        p = docmap(root, "deps", "g", "--mermaid")
        expect(p.stdout.lstrip().startswith(("graph", "flowchart")) and "-->" in p.stdout, "deps --mermaid writes a Mermaid graph", p)
        p = docmap(root, "map", "--budget", "4000")
        out = p.stdout
        expect(p.returncode == 0 and "helper(" in out and "fmt(" in out and out.index("helper(") < out.index("fmt("),
               "map ranks the most-referenced symbol first", p)
        p = docmap(root, "map", "--budget", "60")
        expect(p.returncode == 0 and len(p.stdout) // 4 <= 60 and "helper(" in p.stdout and "fmt(" not in p.stdout,
               "map keeps within the token budget, dropping the least-referenced symbols", p)

    with tempfile.TemporaryDirectory() as tmp:  # O13: any RFC 3986 scheme is a URI, not a relative link
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "docs/NOTES.md").write_text(
            "Status: current (verified 2999-01-01)\n# Notes\n[paper](x-devonthink-item://ABC-123) [web](https://example.org/a) [dev](git+ssh://h/r)\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        expect("broken link" not in p.stdout, "check accepts x-devonthink-item:, https: and git+ssh: links", p)
        (root / "docs/NOTES.md").write_text((root / "docs/NOTES.md").read_text() + "[gone](missing.md)\n", encoding="utf-8")
        p = docmap(root, "check")
        expect(p.returncode == 1 and "broken link -> missing.md" in p.stdout and "x-devonthink" not in p.stdout,
               "check still fails on a real missing relative link", p)

    with tempfile.TemporaryDirectory() as tmp:  # worktrees: check warns about a linked worktree whose branch is merged (owner, 2026-11-09)
        root = Path(tmp) / "proj"
        root.mkdir()
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        for a in (("init", "-q", "-b", "main"), ("config", "user.email", "t@t"), ("config", "user.name", "t")):
            sh(root, "git", *a)
        docmap(root, "update")
        sh(root, "git", "add", "-A")
        sh(root, "git", "commit", "-qm", "base")
        sh(root, "git", "worktree", "add", "-q", str(Path(tmp) / "proj_done"), "-b", "done")
        sh(root, "git", "worktree", "add", "-q", str(Path(tmp) / "proj_open"), "-b", "open")
        (Path(tmp) / "proj_open" / "x.txt").write_text("x", encoding="utf-8")
        sh(Path(tmp) / "proj_open", "git", "add", "x.txt")
        sh(Path(tmp) / "proj_open", "git", "commit", "-qm", "unmerged")
        p = docmap(root, "check")
        hits = [ln for ln in p.stdout.splitlines() if "worktree " in ln]
        expect(len(hits) == 1 and "branch done" in hits[0] and "git worktree remove" in hits[0],
               "check warns about the merged worktree only, not the one with unmerged commits", p)
        sh(root, "git", "worktree", "remove", str(Path(tmp) / "proj_done"))
        p = docmap(root, "check")
        expect(not [ln for ln in p.stdout.splitlines() if "worktree " in ln], "the warning goes once the worktree is removed", p)

    with tempfile.TemporaryDirectory() as tmp:  # O14: STATUS keeps one short line per workstream
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "docs/STATUS.md").write_text(
            "# Status\nUpdated 2026-10-30.\n\n## Workstreams\n| Workstream | Where | State | Next |\n|---|---|---|---|\n| A | `docs/a/` | "
            + "wordy " * 100 + "| x |\n\n- " + "short " * 60 + "\n- " + "long " * 120 + "\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        hits = [ln for ln in p.stdout.splitlines() if "status_line_max_words" in ln]
        expect(len(hits) == 2 and "docs/STATUS.md:7:" in hits[0] and "103 words" in hits[0] and "docs/STATUS.md:10:" in hits[1] and "120 words" in hits[1],
               "check warns about a 103-word ## Workstreams row and a 120-word STATUS bullet (with line numbers) but not a 60-word one", p)
        (root / "docmap.toml").write_text("status_line_max_words = 150\n", encoding="utf-8")
        p = docmap(root, "check")
        expect("status_line_max_words" not in p.stdout, "status_line_max_words can be raised in the configuration", p)

    with tempfile.TemporaryDirectory() as tmp:  # O15: a bare citation of an id that is defined in several folders is ambiguous
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        ok = "Status: current (verified 2999-01-01)\n"
        ledger = ok + "# Ledger\n\n| id | claim |\n|---|---|\n| L1 | x |\n| L2 | y |\n| L3 | z |\n"
        docs = {
            "docs/literature/gosi/ledger.md": ledger, "docs/literature/nmda/ledger.md": ledger,
            "docs/notes.md": ok + "Compare [L1], [L2] and [L3] across the studies.\n",           # ambiguous: one grouped warning
            "docs/named.md": ok + "In gosi, [L2] is the baseline.\n",                              # names a defining folder
            "docs/literature/gosi/notes.md": ok + "L2 is the one that matters here.\n",             # inside one definer's scope
            "docs/syntax.md": ok + "NB-L1 and L2/3 and L1.2 and `L3` and https://x.org/L1 are no citations.\n",
            "docs/h1.md": ok + "### H5f: wiring\n", "docs/h2.md": ok + "### H5f: other wiring\n", "docs/h3.md": ok + "H5f recruits the low side.\n",
            "docs/k/one/ledger.md": ok + "| ID | claim |\n|---|---|\n| K1 | a |\n| K2 | b |\n",
            "docs/k/two/ledger.md": "Status: superseded by docs/k/one/ledger.md\n| ID | claim |\n|---|---|\n| K1 | c |\n| K2 | d |\n",
            "docs/knotes.md": ok + "K1 is settled.\n",
            "docs/writeups/x/review.md": ok + "- A1. first\n- A2. second\n", "docs/writeups/y/review.md": ok + "## A1: other\n\n## A2: more\n",
            "docs/summary.md": ok + "A1 and A2 need an answer.\n",
            "docs/archive/old.md": "- L1. archived\n- L2. archived\n",
        }
        for rel, text in docs.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        hits = [ln for ln in p.stdout.splitlines() if " bare; defined in " in ln]
        notes = [ln for ln in hits if ln.startswith("warning: docs/notes.md ")]
        expect(len(notes) == 1 and "cites L1-L3 bare; defined in 2 places (docs/literature/gosi/, docs/literature/nmda/)" in notes[0] and "<TAG>-L1" in notes[0],
               "check groups ids defined in two ledger tables and cited bare into one warning per citing file and family", p)
        expect(not any(f"warning: {f} " in ln for ln in hits for f in ("docs/named.md", "docs/literature/gosi/notes.md")),
               "no warning when the line names a defining folder or the citer lives inside one definer's folder", p)
        expect(not any("docs/syntax.md" in ln for ln in hits), "NB-L1, L2/3, L1.2, `L3` and a URL do not match as L1, L2 or L3", p)
        expect(not any("H5f" in ln or "docs/h3.md" in ln for ln in hits), "a lone ### H5f: heading defines nothing", p)
        expect(not any("K1" in ln for ln in hits), "a superseded doc defines nothing", p)
        expect(any(ln.startswith("warning: docs/summary.md cites A1, A2 bare; defined in 2 places (docs/writeups/x/, docs/writeups/y/)") for ln in hits)
               and len(hits) == 2, "bullet (- A1.) and heading definitions count, and the archive is not read", p)
        p = docmap(root, "ids")
        lines = p.stdout.splitlines()
        expect(p.returncode == 0 and lines[0].startswith("L ") and "defined in several places: L1-L3" in p.stdout
               and "cited bare in: docs/named.md" not in p.stdout and "cited bare in: docs/notes.md" in p.stdout
               and p.stdout.index("\nA ") < p.stdout.index("\nD "), "ids lists families with their places and bare citers, ambiguous ones first", p)
        (root / "docmap.toml").write_text('id_cite_exempt = ["L\\\\d", "A1"]\nid_scan_exempt = ["docs/archive/*", "docs/writeups/y/*"]\n', encoding="utf-8")
        p = docmap(root, "check")
        expect("bare; defined in" not in p.stdout, "id_cite_exempt (ids or regexes) and id_scan_exempt silence the id warnings", p)

    with tempfile.TemporaryDirectory() as tmp:  # O17: only a status that says "superseded by" is a full supersession; skip only the id the line marks
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "docs/DECISIONS.md").write_text(
            "# Decision log\nDecisions.\n\n"
            "## D1. Old (2026-10-30; status: superseded by D3)\n- **Decision:** a.\n\n"
            "## D2. Kept (2026-10-30; status: accepted; partly superseded by D3: the cache)\n- **Decision:** b.\n\n"
            "## D3. New (2026-10-30; status: accepted)\n- **Decision:** c.\n\n"
            "## D4. Older (2026-10-30; status: accepted)\n- Status: superseded by D3\n- **Decision:** d.\n\n"
            "## D5. Mixed (2026-10-30; status: accepted)\n- Status: accepted; its limit superseded by D3\n- **Decision:** e.\n\n"
            "## D6. Parts (2026-10-30)\n- **Decision:** f. Its retry rule is superseded by D3.\n\n"
            "## D7. Legacy (superseded by D3)\n- **Decision:** g.\n\n"
            "## D8. Legacy part (partly superseded by D3: the log)\n- **Decision:** h.\n", encoding="utf-8")
        ok = "Status: current (verified 2999-01-01)\n"
        (root / "docs/live.md").write_text(ok + "Full: D1 holds.\n\nPartial: D2 and D5 hold.\n\nOwn line: D1 (superseded by D3) said x.\n\n"
                                           "Other id: D1 (superseded by D3) and D4 both matter.\n\nAfter: D4, now superseded, and D1 hold.\n\n"
                                           "Legacy: D7 and D8 hold.\n\n"
                                           "Named: D1, whose cache rule is now superseded by D3, and D4 hold.\n\n"
                                           "| Marked superseded: D1 (by D3: cache), D4 (by D3: retry) | D7 still applies |\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        cites = [ln for ln in p.stdout.splitlines() if "cites D" in ln and "superseded by" in ln]
        expect(any("docs/live.md:2: cites D1, superseded by D3" in ln for ln in cites),
               "a heading status field `superseded by D3` is a full supersession: citing D1 is reported", p)
        expect(any("docs/live.md:8: cites D4, superseded by D3" in ln for ln in cites) and not any("live.md:8: cites D1" in ln for ln in cites),
               "a line saying D1 is superseded is not reported for D1, but another superseded id on it (D4, from a Status line) is", p)
        expect(any("live.md:10: cites D1" in ln for ln in cites) and not any("live.md:10: cites D4" in ln for ln in cites)
               and not any("live.md:6: " in ln for ln in cites), "only the id the line marks superseded is skipped: D4 (\"D4, now superseded\") but not D1 on that line", p)
        expect(not any("cites D2" in ln or "cites D5" in ln or "cites D6" in ln for ln in cites),
               "`partly superseded by D3: ...` and `status: accepted; its X superseded by D3` are partial: no note for D2, D5, D6", p)
        expect(any("live.md:12: cites D7" in ln for ln in cites) and not any("cites D8" in ln for ln in cites),
               "a heading without a status field: `(superseded by D3)` is still full (older form), `(partly superseded by D3: ...)` partial", p)
        expect(any("live.md:14: cites D4" in ln for ln in cites) and not any("live.md:14: cites D1" in ln for ln in cites),
               "an id followed by `by <its replacement>` in the same clause is marked (D1 ... superseded by D3), a later id is not (D4)", p)
        expect(any("live.md:16: cites D7" in ln for ln in cites) and not any("live.md:16: cites D1" in ln or "live.md:16: cites D4" in ln for ln in cites),
               "in a table cell `D1 (by D3: ...)` marks D1; an id in another cell (D7) is still reported", p)

    with tempfile.TemporaryDirectory() as tmp:  # O18: `get` and `ids` follow the configured indexes
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "docmap.toml").write_text(
            "indexes = [{file = 'docs/DECISIONS.md', pattern = '^## (D\\d+)\\.\\s*(.+)$', ids = '\\bD[1-9]\\d*\\b'},\n"
            "           {file = 'docs/ANALYSES.md', pattern = '^## (A\\d+) \u2014 (.+)$', ids = '\\bA[1-9]\\d*\\b'}]\n", encoding="utf-8")
        (root / "docs/ANALYSES.md").write_text("# Analyses\nThe analyses.\n\n## A1 \u2014 First\nbody one\n\n## A2 \u2014 Second\nbody two\n", encoding="utf-8")
        (root / "docs/plain.md").write_text("Status: current (verified 2999-01-01)\n# Plain\n\n## B1 - Dash\nx\n\n## B2: Colon\ny\n\n## C1. Dot\nz\n\n## C2 \u2013 En\nw\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "get", "A2")
        expect("## A2 \u2014 Second" in p.stdout and "body two" in p.stdout and "A1" not in p.stdout, "get A2 prints the entry of a configured custom index", p)
        p = docmap(root, "get", "D2")
        expect("## D2. Pure core" in p.stdout, "get D2 still works with a custom index list", p)
        p = docmap(root, "get", "Z9")
        expect(p.returncode != 0 and "A<n>" in (p.stdout + p.stderr) and "D<n>" in (p.stdout + p.stderr), "get of an unknown family lists the configured families", p)
        p = docmap(root, "ids")
        expect(re.search(r"^A\s+2 id", p.stdout, re.M) and re.search(r"^B\s+2 id", p.stdout, re.M) and re.search(r"^C\s+2 id", p.stdout, re.M),
               "ids lists families defined by `## A1 \u2014 T` (index), `## B1 - T`, `## B2: T`, `## C1. T` and `## C2 \u2013 T` headings", p)

    with tempfile.TemporaryDirectory() as tmp:  # O16: [tool.docmap.facts] takes a glob; the single-file forms are unchanged
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "configs/generators").mkdir(parents=True)
        (root / "configs/generators/v2_weights_1.json").write_text('{"b_h3_native": 0.5, "a_h3_native": 0.25, "z_other": 9}', encoding="utf-8")
        (root / "configs/generators/v1_weights_1.json").write_text('{"a_h3_native": 0.2, "c_h3_nmda": 1.5}', encoding="utf-8")
        (root / "configs/cell.json").write_text('{"id": "cell7"}', encoding="utf-8")
        single = ('[tool.docmap.facts]\n"default cell" = { file = "configs/cell.json", key = "id", note = "D2" }\n'
                  '"pure core" = { file = "demo/core.py", pattern = "^def (\\\\w+)" }\n')
        (root / "pyproject.toml").write_text(FILES["pyproject.toml"] + "\n" + single, encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        before = (root / "docs/FACTS.md").read_text()
        expect("| default cell | cell7 | configs/cell.json `id` | D2 |" in before and "| pure core | add | demo/core.py |" in before,
               "facts: the single-file key and pattern forms give their rows")
        (root / "pyproject.toml").write_text(FILES["pyproject.toml"] + "\n" + single
                                             + '"calibrated weights" = { files = "configs/generators/*_weights_*.json", keys = "^[abc]_h3_" }\n', encoding="utf-8")
        p = docmap(root, "update")
        after = (root / "docs/FACTS.md").read_text()
        rows = [ln for ln in after.splitlines() if ln.startswith("| calibrated weights")]
        expect([r.split(" | ")[0:3] for r in rows] == [
            ["| calibrated weights: a_h3_native (v1_weights_1)", "0.2", "configs/generators/v1_weights_1.json `a_h3_native`"],
            ["| calibrated weights: c_h3_nmda", "1.5", "configs/generators/v1_weights_1.json `c_h3_nmda`"],
            ["| calibrated weights: a_h3_native (v2_weights_1)", "0.25", "configs/generators/v2_weights_1.json `a_h3_native`"],
            ["| calibrated weights: b_h3_native", "0.5", "configs/generators/v2_weights_1.json `b_h3_native`"]],
               "facts glob: one row per (file, key matching `keys`), sorted by file then key; a key in several files carries its file's stem", p)
        expect(all(ln in after for ln in before.splitlines() if ln.startswith("| default cell") or ln.startswith("| pure core")),
               "facts glob: the single-file rows are unchanged when a glob entry is added", p)
        p = docmap(root, "check")
        expect(p.returncode == 0, "check is green with a glob facts table", p)
        (root / "configs/enc").mkdir()
        (root / "configs/enc/a.json").write_text('{"spatial": {"sigma": 1.5}}', encoding="utf-8")
        (root / "configs/enc/b.json").write_text('{"spatial": {"sigma": 2}}', encoding="utf-8")
        (root / "configs/bad.json").write_text("{not json", encoding="utf-8")
        (root / "configs/multi.txt").write_text('ENC = "first\nsecond"\n', encoding="utf-8")
        (root / "pyproject.toml").write_text(FILES["pyproject.toml"] + "\n" + single
                                             + '"morphology" = { files = "configs/enc/*.json", key = "spatial.sigma" }\n'
                                             + '"bad" = { file = "configs/bad.json", key = "x" }\n'
                                             + '"multi" = { file = "configs/multi.txt", pattern = "(?s)ENC = \\"(.*?)\\"" }\n', encoding="utf-8")
        p = docmap(root, "update")
        facts = (root / "docs/FACTS.md").read_text()
        expect(p.returncode == 0 and "| morphology: a | 1.5 | configs/enc/a.json `spatial.sigma` |" in facts
               and "| morphology: b | 2 | configs/enc/b.json `spatial.sigma` |" in facts,
               "facts glob with `key`: one row per file, a dotted key, labelled with the file stem", p)
        expect(p.returncode == 0 and "| bad | UNPARSEABLE FILE |" in facts and "| multi | first second |" in facts,
               "facts: a corrupt source file shows UNPARSEABLE FILE instead of crashing, and values are one line", p)

    with tempfile.TemporaryDirectory() as tmp:  # A3: STATUS line numbers are exact next to a generated block; only the Workstreams table is measured
        root = Path(tmp)
        (root / "docs").mkdir()
        begin, end = "<!-- docmap:begin (generated by tools/docmap.py; do not edit) -->", "<!-- docmap:end -->"
        (root / "docs/STATUS.md").write_text(
            f"# Status\nUpdated 2026-10-30.\n\n{begin}\na\nb\n{end}\n\n## Works (verified)\n| Capability | How verified |\n|---|---|\n| x | "
            + "cmd " * 100 + "|\n\n## Next actions\n- " + "step " * 100 + "\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        p = docmap(root, "check")
        hits = [ln for ln in p.stdout.splitlines() if "status_line_max_words" in ln]
        expect(len(hits) == 1 and "docs/STATUS.md:15:" in hits[0], "STATUS warnings carry exact line numbers after a generated block, and a long Works table cell is not measured", p)

    with tempfile.TemporaryDirectory() as tmp:  # B2: code folders are the ones with code (or an existing docmap folder table); O5: block-comment headers
        root = Path(tmp)
        files = {
            "docs/literature/README.md": "# docs/literature\n\nProse folder.\n",
            "docs/literature/calc/README.md": "# calc\n\nHelper calculations.\n",
            "docs/literature/calc/gosi.py": '"""GOSI helper."""\n',
            "docs/models/README.md": f"# models\n\nModel notes.\n\n{begin}\n| Entry | What it is | Imported by |\n|---|---|---|\n| stale | stale | |\n{end}\n",
            "docs/models/m/README.md": "# m\n\nA model.\n", "docs/models/m/run.py": '"""Run the model."""\n',
            "docs/other/README.md": f"# other\n\nOther notes.\n\n{begin}\nsome other generated block\n{end}\n",
            "docs/other/sub/README.md": "# sub\n\nSub.\n", "docs/other/sub/y.py": '"""Y."""\n',
            "web/README.md": "# web/\n\nThe web part.\n",
            "web/a.ts": "/**\n * Renders the widget.\n */\nexport const a = 1;\n", "web/b.js": "/* One-liner. */\nexport const b = 1;\n",
            "web/c.ts": "export const c = 1;\n",
            "t/README.md": "# t/\n\nStatus: current (verified 2026-11-06).\n\nThe parent-side part (Wilson et al. 2012; e.g. cell 1542). It has more.\n",
            "t/x.py": '"""T."""\n',
            "u/README.md": "# u/\n\nUpdated 26 October 2026.\n\nWe compare A vs. B here. And more.\n", "u/z.py": '"""U."""\n',
        }
        for rel, text in files.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        sh(root, "git", "init", "-q")
        p = docmap(root, "update")
        expect((root / "docs/literature/README.md").read_text() == files["docs/literature/README.md"]
               and "docs/literature/" not in (root / "docs/MAP.md").read_text().replace("docs/literature/calc/", ""),
               "update does not force a table onto a prose parent folder (docs/literature/) of a code folder", p)
        expect("`m/`" in (root / "docs/models/README.md").read_text() and "stale" not in (root / "docs/models/README.md").read_text(),
               "update keeps refreshing a prose folder's README that already carries docmap's folder table", p)
        expect((root / "docs/other/README.md").read_text() == files["docs/other/README.md"],
               "any other generated block does not make a folder a code folder", p)
        m = (root / "docs/MAP.md").read_text()
        expect("Renders the widget." in m and "One-liner." in m, "file_summary reads /** ... */ and /* ... */ headers", p)
        p = docmap(root, "check")
        expect(p.returncode == 1 and "web/c.ts: no header comment" in p.stdout and "/*" in p.stdout and "web/a.ts" not in p.stdout and "web/b.js" not in p.stdout,
               "check accepts block-comment headers and its error names the accepted header forms", p)
        expect("generated content is stale" not in p.stdout, "check finds no stale generated content after update, prose parents included", p)
        expect("**`t/`** — The parent-side part (Wilson et al. 2012; e.g. cell 1542)." in m,
               "a README description skips Status lines and does not split on 'et al.' or 'e.g.'", p)
        expect("**`u/`** — We compare A vs. B here." in m, "a README description skips Updated lines and does not split on 'vs.'", p)
        expect("Look code up with" in m, "MAP.md carries the where/calls/deps/map sentence when the repo has Python modules")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "web").mkdir()
        (root / "web/README.md").write_text("# web/\n\nThe web part.\n", encoding="utf-8")
        (root / "web/a.js").write_text("// A.\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        expect("Look code up with" not in (root / "docs/MAP.md").read_text(), "MAP.md leaves out the Python lookups when the repo has no Python modules")

    with tempfile.TemporaryDirectory() as tmp:  # D1: the templates' own Status lines pass `check`
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        for name, dest in (("brief.md", "docs/BRIEF.md"), ("architecture.md", "docs/ARCHITECTURE.md")):
            body = re.search(r"```markdown\n(.*?)```", (SKILL_DIR / "templates" / name).read_text(encoding="utf-8"), re.S).group(1)
            (root / dest).write_text(body.replace("<YYYY-MM-DD>", "2999-01-01"), encoding="utf-8")
        other = (SKILL_DIR / "templates/other-docs.md").read_text(encoding="utf-8")
        forms = re.findall(r"Status: ([a-z]+)", other)
        expect(bool(forms) and set(forms) <= {"current", "proposal", "superseded", "historical"},
               f"other-docs.md uses only Status words that `check` accepts (found: {sorted(set(forms))})")
        for rel, st in {"docs/plans/p1.md": "proposal (2999-01-01)", "docs/plans/p2.md": "current (verified 2999-01-01; in progress)",
                        "docs/plans/p3.md": "historical (done 2999-01-01)", "docs/plans/p4.md": "historical (abandoned 2999-01-01: why)",
                        "docs/reviews/2999-01-01-x.md": "current (verified 2999-01-01)"}.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(f"# Doc\nStatus: {st}\n", encoding="utf-8")
        sh(root, "git", "init", "-q")
        docmap(root, "update")
        p = docmap(root, "check")
        expect("no Status line" not in p.stdout and "docs/BRIEF.md" not in p.stdout and "docs/ARCHITECTURE.md" not in p.stdout,
               "docs written from the BRIEF and ARCHITECTURE templates, and plan and review Status lines, pass check", p)

    with tempfile.TemporaryDirectory() as tmp:  # O22: legacy docs citing another ledger's D ids can be exempted from the dangling-citation check
        root = Path(tmp)
        for rel, text in FILES.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        (root / "docs/reports").mkdir(parents=True, exist_ok=True)
        (root / "docs/reports/old.md").write_text("# Old report\n\nStatus: historical\n\nFollows D57 and D58 of the lab ledger.\n", encoding="utf-8")
        for a in (("init", "-q"), ("config", "user.email", "t@t"), ("config", "user.name", "t")):
            sh(root, "git", *a)
        docmap(root, "update")
        p = docmap(root, "check")
        expect("docs/reports/old.md: cites D57, which is not in docs/DECISIONS.md" in p.stdout,
               "check warns when a doc cites a D id that DECISIONS.md does not define", p)
        (root / "docmap.toml").write_text('id_scan_exempt = ["docs/archive/*"]\nid_cite_exempt = ["D57"]\n', encoding="utf-8")
        p = docmap(root, "check")
        expect("cites D57" in p.stdout, "id_scan_exempt and id_cite_exempt do not silence the not-in-DECISIONS warning (they cover the ambiguity check)", p)
        (root / "docmap.toml").write_text('id_missing_exempt = ["docs/reports/*"]\n', encoding="utf-8")
        p = docmap(root, "check")
        expect("which is not in" not in p.stdout, "id_missing_exempt silences the warning for the matching files", p)
        (root / "AGENTS.md").write_text("# Demo - agent instructions\n\nA demo project. See D99.\n", encoding="utf-8")
        p = docmap(root, "check")
        expect("AGENTS.md: cites D99, which is not in docs/DECISIONS.md" in p.stdout and "docs/reports/old.md" not in p.stdout,
               "files outside the exempt glob are still checked", p)

    with tempfile.TemporaryDirectory() as tmp:  # O23: a forwarding stub at a moved module's old path: importers follow the move
        root = Path(tmp)
        stub = ("\"\"\"Forwarding stub: the module moved to pkg.sub.mod.\"\"\"\nimport importlib, sys\n\n"
                "if __name__ == '__main__':\n    import runpy; runpy.run_module('pkg.sub.mod', run_name='__main__', alter_sys=True)\n"
                "else:\n    sys.modules[__name__] = importlib.import_module('pkg.sub.mod')\n")
        files = {
            "AGENTS.md": "# Demo - agent instructions\n\nA demo project.\n",
            "docs/STATUS.md": "# Status\nUpdated 2026-10-30.\n",
            "pkg/README.md": "# pkg/\n\nThe moved package.\n",
            "pkg/__init__.py": '"""Package."""\n',
            "pkg/sub/__init__.py": '"""Sub package."""\n',
            "pkg/sub/README.md": "# pkg/sub/\n\nWhere the module lives now.\n",
            "pkg/sub/mod.py": '"""The moved module."""\n\n\ndef work(x):\n    return helper(x)\n\n\ndef helper(x):\n    return x\n',
            "old.py": stub,
            "short.py": '"""One-line stub."""\nimport importlib, sys\nsys.modules[__name__] = importlib.import_module("pkg.sub.mod")\n',
            "dyn.py": '"""Not a stub: the target is computed."""\nimport importlib, sys\nsys.modules[__name__] = importlib.import_module("pkg." + "sub.mod")\n',
            "user_a.py": '"""Imports through the stub."""\nfrom old import work\n\n\ndef a():\n    return work(1)\n',
            "user_b.py": '"""Imports the stub as a module."""\nimport old\n\n\ndef b():\n    return old.work(2)\n',
            "user_c.py": '"""Imports through the one-line stub, inside a function."""\n\n\ndef c():\n    from short import work\n    return work(3)\n',
            "user_d.py": '"""Imports the real module."""\nfrom pkg.sub.mod import work\n\n\ndef d():\n    return work(4)\n',
        }
        for rel, text in files.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding="utf-8")
        for a in (("init", "-q"), ("config", "user.email", "t@t"), ("config", "user.name", "t")):
            sh(root, "git", *a)
        sh(root, "git", "add", "-A")
        p = docmap(root, "show", "pkg/sub/mod.py")
        imp = next((ln for ln in p.stdout.splitlines() if ln.startswith("imported by:")), "")
        expect("user_a.py (via stub old.py)" in imp and "user_b.py (via stub old.py)" in imp and "user_c.py (via stub short.py)" in imp
               and "user_d.py" in imp and "user_d.py (via" not in imp,
               "show lists importers of a stub under the real module, naming the stub; a direct importer carries no note", p)
        expect("old.py, " not in imp.replace("(via stub old.py)", ""), "the stub itself is not listed as an importer", p)
        p = docmap(root, "show", "old.py")
        expect("forwarding stub" in p.stdout and "pkg/sub/mod.py" in p.stdout and "imported by: —" in p.stdout,
               "show on the stub says it forwards to the real file and lists no importers of its own", p)
        p = docmap(root, "uses", "user_a.py")
        expect("pkg/sub/mod.py (via stub old.py)" in p.stdout, "uses: a stub import is an import of the target, via the stub", p)
        p = docmap(root, "where", "work")
        expect("imported by: user_a.py (via stub old.py)" in p.stdout and "user_d.py" in p.stdout, "where: importers of a symbol follow the stub", p)
        p = docmap(root, "show", "dyn.py")
        expect("forwarding stub" not in p.stdout, "a computed import_module argument is not treated as a stub", p)
        p = docmap(root, "deps")
        expect("user_a -> pkg.sub.mod" in p.stdout and "user_a -> old" not in p.stdout, "deps: the edge goes to the target module", p)
        p = docmap(root, "calls", "work")
        expect("user_a.py:6  in a" in p.stdout and "user_c.py" in p.stdout and "user_d.py" in p.stdout and "by name only" not in p.stdout,
               "calls: a function called through a stub import is a resolved caller, not 'by name only'", p)
        docmap(root, "update")
        readme = (root / "pkg/sub/README.md").read_text(encoding="utf-8")
        row = next((ln for ln in readme.splitlines() if ln.startswith("| `mod.py`")), "")
        expect("user_a" in row and "user_d" in row, "folder table: the real module's 'Used by' column has the importers of its stubs", p)
        rootmap = (root / "docs/MAP.md").read_text(encoding="utf-8")
        expect("`pkg.sub.mod` — imported by 4" in rootmap and "`old`" not in rootmap.split("Most imported")[-1],
               "MAP: 'most imported' counts the real module, not the stub's old name", p)

    docmap_version = re.search(r'^DOCMAP_VERSION = "(\d+)\.(\d+)\.(\d+)"', DOCMAP.read_text(encoding="utf-8"), re.M)
    plugin_version = re.search(r'"version":\s*"(\d+)\.(\d+)\.(\d+)"', (SKILL_DIR.parents[1] / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
    d, v = tuple(map(int, docmap_version.groups())), tuple(map(int, plugin_version.groups()))
    state = "equal" if d[:2] == v[:2] else "one minor behind" if d[0] == v[0] and d[1] == v[1] - 1 else "out of step"
    expect(state != "out of step", f"DOCMAP_VERSION {'.'.join(map(str, d))} is {state} with plugin.json's {'.'.join(map(str, v))} (equal is the target; one minor behind is tolerated)")

    # Templates on demand: SKILL.md points at templates/, which holds one file per template.
    skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    refs = set(re.findall(r"`templates/([A-Za-z0-9._-]+\.md)`", skill))
    on_disk = {f.name for f in (SKILL_DIR / "templates").glob("*") if f.is_file()}
    missing = sorted(refs - on_disk)
    expect(bool(refs) and not missing, f"every template referenced from SKILL.md exists ({len(refs)} referenced; missing: {missing or 'none'})")
    unref = sorted(on_disk - refs)
    expect(not unref, f"every file in templates/ is referenced from SKILL.md (unreferenced: {unref or 'none'})")
    bad = [n for n in sorted(on_disk) if not (lambda t: t.startswith("Produces ") and len(t) > 40)((SKILL_DIR / "templates" / n).read_text(encoding="utf-8").split("\n", 1)[0])]
    expect(not bad, f"each template opens with its descriptive 'Produces ...' line (without: {bad or 'none'})")
    expect(len(skill.splitlines()) <= 500, f"SKILL.md stays within its ~500-line budget ({len(skill.splitlines())} lines)")

    print(f"project-foundations evals: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
