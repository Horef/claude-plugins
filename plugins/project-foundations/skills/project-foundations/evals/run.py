"""Scripted evals for project-foundations: docmap.py on a throwaway fixture project (exit 1 on any failure).

Checks the behaviour the skill promises: `update` writes the map and README tables, `check` is green on a
well-formed project and fails on a TODO README stub, a missing file header and a forbidden import, `where`
finds definitions and importers. Run: python evals/run.py (from the skill folder or anywhere).
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

DOCMAP = Path(__file__).resolve().parents[1] / "scripts" / "docmap.py"
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

    print(f"project-foundations evals: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
