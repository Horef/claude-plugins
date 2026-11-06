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
