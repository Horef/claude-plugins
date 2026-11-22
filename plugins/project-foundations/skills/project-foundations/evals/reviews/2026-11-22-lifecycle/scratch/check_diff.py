"""Comprehensive verification script for project-foundations 5.17.0 diff review."""
from __future__ import annotations

import ast
import datetime
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

WORKTREE = Path("/Users/sergiyhoref/Programming/cp-pf517")
SKILL_DIR = WORKTREE / "plugins/project-foundations/skills/project-foundations"
DOCMAP = SKILL_DIR / "scripts/docmap.py"
EVIDENCE = Path("/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1")
NEURO_PY = Path("/Users/sergiyhoref/Programming/Neuroscience/envs/neuro/bin/python")


def sh(cwd: Path, *args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    full_env = {**os.environ, **(env or {})}
    return subprocess.run(list(args), cwd=cwd, capture_output=True, text=True, env=full_env)


def dm(cwd: Path, *args: str, py: str = sys.executable, env: dict | None = None) -> subprocess.CompletedProcess:
    return sh(cwd, py, str(DOCMAP), *args, env=env)


def init_repo(root: Path, files: dict[str, str], commit: bool = True, env: dict | None = None):
    for rel, text in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    sh(root, "git", "init", "-q", "-b", "main")
    sh(root, "git", "config", "user.email", "t@t")
    sh(root, "git", "config", "user.name", "t")
    if commit:
        sh(root, "git", "add", "-A")
        sh(root, "git", "commit", "-q", "-m", "init", env=env)


def section(title: str):
    print(f"\n{'=' * 72}\n{title}\n{'=' * 72}")


def main():
    # 1. Python 3.10 syntax & stdlib check
    section("1. Python 3.10 syntax & stdlib check")
    src = DOCMAP.read_text(encoding="utf-8")
    try:
        tree = ast.parse(src, filename=str(DOCMAP), feature_version=(3, 10))
        print("Python 3.10 AST parse: OK")
    except SyntaxError as e:
        print(f"Python 3.10 AST parse: FAIL: {e}")
        tree = ast.parse(src)
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                imports.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    non_stdlib = imports - sys.stdlib_module_names
    print(f"Imports: {sorted(imports)}")
    print(f"Non-stdlib imports: {sorted(non_stdlib)}")
    # Check tomllib usage outside load_config (e.g. load_structured on 3.10)
    tomllib_lines = [i for i, ln in enumerate(src.splitlines(), 1) if "tomllib" in ln]
    print(f"tomllib lines: {tomllib_lines}")

    # 2. Evidence project (simple_complex_v1) - STRICTLY READ-ONLY
    section("2. Evidence project: simple_complex_v1 (read-only)")
    if EVIDENCE.exists():
        py = str(NEURO_PY) if NEURO_PY.exists() else sys.executable
        print(f"Using interpreter: {py}")
        for cmd_args in (["docs"], ["check"], ["archive"], ["find", "twin families"], ["ids"], ["ids", "F"], ["ids", "R"], ["ids", "A"]):
            t0 = time.monotonic()
            p = dm(EVIDENCE, *cmd_args, py=py)
            dt = time.monotonic() - t0
            lines = p.stdout.splitlines()
            print(f"\n--- docmap.py {' '.join(cmd_args)} (rc={p.returncode}, {dt:.2f}s, {len(lines)} lines) ---")
            for ln in lines[:45]:
                print("  " + ln)
            if len(lines) > 45:
                print(f"  ... ({len(lines) - 45} more lines) ...")
                for ln in lines[-5:]:
                    print("  " + ln)
            if p.stderr.strip():
                print("  STDERR:", p.stderr.strip()[:300])
        # Inspect STATUS.md Works and Workstreams lines
        st_path = EVIDENCE / "docs/STATUS.md"
        if st_path.exists():
            print("\n--- simple_complex_v1 docs/STATUS.md (full) ---")
            for i, ln in enumerate(st_path.read_text(encoding="utf-8").splitlines(), 1):
                print(f"  {i:3d}: {ln}")
        # Inspect docs/archive/
        arch_dir = EVIDENCE / "docs/archive"
        if arch_dir.exists():
            print("\n--- simple_complex_v1 docs/archive/ contents ---")
            for p in sorted(arch_dir.rglob("*")):
                if p.is_file():
                    print("  ", p.relative_to(EVIDENCE).as_posix())
        # Check docs/README.md
        dreadme = EVIDENCE / "docs/README.md"
        if dreadme.exists():
            txt = dreadme.read_text(encoding="utf-8")
            print(f"\n--- simple_complex_v1 docs/README.md has docmap:begin? {'docmap:begin' in txt} ---")
        # Inspect archive_mentions breakdown in simple_complex_v1 (strictly in-memory, read-only)
        import importlib.util
        old_cwd = os.getcwd()
        try:
            os.chdir(EVIDENCE)
            spec = importlib.util.spec_from_file_location("dm_mod", str(DOCMAP))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            files = mod.tracked_files()
            plan, folders = mod.archive_plan(files, [], [])
            pairs_all = [pair for _, pairs in plan for pair in pairs]
            moved = dict(pairs_all) | folders
            mentions, history = mod.archive_mentions(files, moved)
            in_gen = 0
            in_keep = 0
            by_file = {}
            for f, n, s, d in mentions:
                by_file.setdefault(f, []).append(n)
                if mod.matches(f, mod.CFG["archive_keep"]):
                    in_keep += 1
            # Check how many mentions in docs/README.md are inside BEGIN..END
            if "docs/README.md" in by_file:
                lines = (EVIDENCE / "docs/README.md").read_text(encoding="utf-8").splitlines()
                b_i = next((i for i, l in enumerate(lines, 1) if mod.BEGIN in l), 10**9)
                e_i = next((i for i, l in enumerate(lines, 1) if mod.END in l), -1)
                in_gen = sum(1 for n in by_file["docs/README.md"] if b_i <= n <= e_i)
            print(f"simple_complex_v1 mentions: {len(mentions)} total in {len(by_file)} files ({history} in logs); "
                  f"in docs/README.md generated block: {in_gen}; in archive_keep: {in_keep}")
            arch = mod.build_archive_readme(files)
            if arch:
                print("--- in-memory build_archive_readme(simple_complex_v1) ---")
                print(arch[1].strip())
        finally:
            os.chdir(old_cwd)
    else:
        print("Evidence project not found")

    # 3. Archive edge cases
    section("3. Archive edge cases")
    base = {
        "AGENTS.md": "# Demo\n",
        "docs/STATUS.md": "# Status\nUpdated 2026-11-22.\n",
        "docs/WORKLOG.md": "# Work log\n\n## 2026-11-22 - start\nStarted.\n",
    }

    # 3a. Companion steals live .py / .json / .md file with same stem!
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        init_repo(root, {
            **base,
            "docs/calc/README.md": "# calc/\n\nCalc tools.\n",
            "docs/calc/model.md": "# Model notes\nStatus: historical\n",
            "docs/calc/model.py": '"""Live calculation script."""\n',
            "docs/calc/model.json": '{"a": 1}\n',
            "docs/calc/model.pdf": "pdf\n",
            "docs/calc/README_LIVE.md": "# Live\nStatus: current (verified 2999-01-01)\n",
            "docs/live_doc.md": "# Live doc\nStatus: current (verified 2999-01-01)\n",
            "docs/live_doc.txt": "old scratch\n",
        })
        p = dm(root, "archive")
        print("[3a.1] Companion steals .py/.json?:")
        print(p.stdout.strip())
        p2 = dm(root, "archive", "--legacy", "docs/*.txt")
        print("[3a.2] --legacy non-.md steals live Status:current .md?:")
        print(p2.stdout.strip())

    # 3b. --dir edge cases: ./ prefix, Windows backslash, --dir docs (contains archive_dir), nested --dir, --dir with .py
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        init_repo(root, {
            **base,
            "docs/old_work/README.md": "# old_work/\n\nOld analysis.\n",
            "docs/old_work/helper.py": '"""Old helper."""\n',
            "docs/old_work/notes.md": "# Notes\nStatus: historical\n",
            "docs/old_work/sub/a.md": "# Sub\nStatus: historical\n",
            "docs/archive/existing.md": "# Existing\nStatus: historical\n",
        })
        p1 = dm(root, "archive", "--dir", "./docs/old_work")
        print(f"[3b.1] --dir ./docs/old_work (rc={p1.returncode}): {(p1.stdout + p1.stderr).strip()}")
        p2 = dm(root, "archive", "--dir", "docs\\old_work")
        print(f"[3b.2] --dir docs\\old_work (rc={p2.returncode}): {(p2.stdout + p2.stderr).strip()}")
        p3 = dm(root, "archive", "--dir", "docs")
        print(f"[3b.3] --dir docs (rc={p3.returncode}): {(p3.stdout + p3.stderr).strip()[:400]}")
        p4 = dm(root, "archive", "--dir", "docs/old_work", "--dir", "docs/old_work/sub")
        print(f"[3b.4] nested --dir (rc={p4.returncode}): {(p4.stdout + p4.stderr).strip()}")
        # Now apply --dir docs/old_work (which has helper.py) and run update + check!
        p5 = dm(root, "archive", "--apply", "--dir", "docs/old_work")
        print(f"[3b.5] --apply --dir docs/old_work (rc={p5.returncode}): {p5.stdout.strip()}")
        p6 = dm(root, "update")
        p7 = dm(root, "check")
        print(f"[3b.5] after update+check (rc={p7.returncode}):")
        print("  update:", p6.stdout.strip())
        print("  check:", p7.stdout.strip())
        print("  MAP mentions archive/old_work?:", "archive/old_work" in (root / "docs/MAP.md").read_text())

    # 3c. rewrite_links inside code spans/fences & mutating already-archived files
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        init_repo(root, {
            **base,
            "docs/OLD.md": "# Old\nStatus: historical\n\n```markdown\nSee [example](GUIDE.md)\n```\n",
            "docs/GUIDE.md": "# Guide\nStatus: current (verified 2999-01-01)\n\nInline code: `[old](OLD.md)`.\n\n```md\n[old](OLD.md)\n```\n",
            "docs/archive/ancient.md": "# Ancient\nStatus: historical\n\nOld ref: [old](../OLD.md).\n",
        })
        p = dm(root, "archive", "--apply")
        print("[3c] rewrite_links in code blocks & already-archived docs:")
        print("  stdout:", p.stdout.strip())
        print("  GUIDE.md:\n" + (root / "docs/GUIDE.md").read_text())
        print("  archive/OLD.md:\n" + (root / "docs/archive/OLD.md").read_text())
        print("  archive/ancient.md:\n" + (root / "docs/archive/ancient.md").read_text())

    # 3d. Dry run vs --apply mention count discrepancy on collision
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        init_repo(root, {
            **base,
            "docs/plans/design.md": "# Design\nStatus: historical\n",
            "docs/archive/plans/design.md": "# Earlier\nStatus: historical\n",
            "docs/GUIDE.md": "# Guide\nStatus: current (verified 2999-01-01)\n\nCompare `design.md` and `plans/design.md`.\n",
        })
        pdry = dm(root, "archive")
        papp = dm(root, "archive", "--apply")
        print("[3d] Dry run vs --apply mention count on collision + relative-to-docs mention:")
        print("  DRY:", pdry.stdout.strip())
        print("  APP:", papp.stdout.strip())

    # 3e. Archive README under shallow CI clone + empty archive_dir + custom archive_dir link_exempt
    with tempfile.TemporaryDirectory() as tmp:
        origin = Path(tmp) / "origin"
        shallow = Path(tmp) / "shallow"
        init_repo(origin, {
            **base,
            "docs/OLD.md": "# Old\nStatus: historical\n",
        }, env={"GIT_AUTHOR_DATE": "2026-06-01T12:00:00", "GIT_COMMITTER_DATE": "2026-06-01T12:00:00"})
        dm(origin, "archive", "--apply")
        dm(origin, "update")
        sh(origin, "git", "add", "-A")
        sh(origin, "git", "commit", "-q", "-m", "archive old",
           env={"GIT_AUTHOR_DATE": "2026-08-15T12:00:00", "GIT_COMMITTER_DATE": "2026-08-15T12:00:00"})
        # Make a second commit later
        (origin / "docs/STATUS.md").write_text("# Status\nUpdated 2026-11-22.\nMore.\n", encoding="utf-8")
        sh(origin, "git", "add", "-A")
        sh(origin, "git", "commit", "-q", "-m", "later")
        # Shallow clone depth=1 using file://
        sh(Path(tmp), "git", "clone", "--depth=1", f"file://{origin}", str(shallow))
        p_check = dm(shallow, "check")
        print(f"[3e.1] Shallow clone check (README committed) rc={p_check.returncode}: {p_check.stdout.strip()}")
        # Now what if archive/README.md was NOT present (e.g. archived before 5.17) on shallow clone?
        (shallow / "docs/archive/README.md").unlink()
        dm(shallow, "update")
        print("[3e.2] Shallow clone README generated without prior README:")
        print((shallow / "docs/archive/README.md").read_text())

        # Empty archive_dir
        empty_repo = Path(tmp) / "empty_arch"
        init_repo(empty_repo, base)
        (empty_repo / "docs/archive").mkdir(parents=True)
        p_empty = dm(empty_repo, "check")
        print(f"[3e.3] Empty docs/archive/ dir -> check rc={p_empty.returncode}: {p_empty.stdout.strip()}")

        # Custom archive_dir without link_exempt
        cust = Path(tmp) / "cust_arch"
        init_repo(cust, {
            **base,
            "docmap.toml": 'archive_dir = "docs/retired"\n',
            "docs/OLD.md": "# Old\nStatus: historical\n\nBroken [x](missing.md).\n",
        })
        dm(cust, "archive", "--apply")
        dm(cust, "update")
        p_cust = dm(cust, "check")
        print(f"[3e.4] Custom archive_dir with broken historical link rc={p_cust.returncode}: {p_cust.stdout.strip()}")

    # 3f. Untracked files & --legacy with untracked & Windows glob
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        init_repo(root, base)
        (root / "docs/UNTRACKED.md").write_text("# Untracked\nStatus: historical\n", encoding="utf-8")
        (root / "docs/UNTRACKED.pdf").write_text("pdf\n", encoding="utf-8")
        (root / "docs/briefs").mkdir()
        (root / "docs/briefs/b1.md").write_text("# Brief\n", encoding="utf-8")
        p1 = dm(root, "archive", "--apply")
        print(f"[3f.1] Untracked doc + companion --apply rc={p1.returncode}: {p1.stdout.strip()}")
        print("  exists in archive?:", (root / "docs/archive/UNTRACKED.md").exists(), (root / "docs/archive/UNTRACKED.pdf").exists())
        p2 = dm(root, "archive", "--legacy", "docs\\briefs\\*")
        print(f"[3f.2] --legacy backslash glob rc={p2.returncode}: {p2.stdout.strip()}")

    # 4. Worklog rotation guard on linked worktree & detached HEAD
    section("4. Worklog rotation guard (worktree, detached HEAD, worklog_max_tokens=0)")
    with tempfile.TemporaryDirectory() as tmp:
        today = datetime.date.today().isoformat()
        entries = "".join(f"## {today} - step {i}\n\n" + "word " * 100 + "\n\n" for i in range(5))
        root = Path(tmp) / "mainrepo"
        init_repo(root, {
            **base,
            "docmap.toml": "worklog_max_tokens = 300\n",
            "docs/WORKLOG.md": "# Work log\n\n" + entries,
        })
        body = Path(tmp) / "body.md"
        body.write_text("Changed: x.\n", encoding="utf-8")
        wt = Path(tmp) / "wt_side"
        sh(root, "git", "worktree", "add", "-q", str(wt), "-b", "side")
        p_wt = dm(wt, "worklog", "In worktree", str(body))
        print("[4a] Linked worktree:", p_wt.stdout.strip())
        # Main worktree on feature, linked worktree on main!
        sh(root, "git", "checkout", "-q", "-b", "dev")
        sh(wt, "git", "checkout", "-q", "main")
        p_wt_main = dm(wt, "worklog", "Worktree on main", str(body))
        print("[4b] Linked worktree checked out on main:", p_wt_main.stdout.strip())
        # Detached HEAD in main worktree
        sh(root, "git", "checkout", "-q", "--detach", "HEAD")
        p_det = dm(root, "worklog", "Detached", str(body))
        print("[4c] Detached HEAD:", p_det.stdout.strip())

    # 5. ID check line numbers & double backticks
    section("5. ID check line numbers & backticks")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        live = "Status: current (verified 2999-01-01)\n"
        begin, end = "<!-- docmap:begin (generated by tools/docmap.py; do not edit) -->", "<!-- docmap:end -->"
        notes = (
            f"# Notes\n{live}"
            f"{begin}\ngen line 1\ngen line 2\n{end}\n"  # lines 3..6
            "```python\nQ1 = 1\nQ2 = 2\n```\n"           # lines 7..10
            "<!-- comment\nQ1\n-->\n"                     # lines 11..13
            "See `docs/writeups/x/` for Q1.\n"            # line 14 (exempt by slug in backticks)
            "Bare Q2 here.\n"                             # line 15 (should report :15)
            "Double backticks ``Q1`` here.\n"             # line 16 (code span!)
            "URL https://example.com/Q1 and Q2.\n"        # line 17 (should report :17 Q2 only)
            "`only code span no newline`"                 # line 18 (no trailing \n)
        )
        init_repo(root, {
            **base,
            "docs/writeups/x/ledger.md": live + "- Q1. a\n- Q2. b\n",
            "docs/writeups/y/ledger.md": live + "- Q1. c\n- Q2. d\n",
            "docs/notes.md": notes,
        })
        p = dm(root, "ids", "Q")
        print("[5] ids Q output (expect :15 Q2 and :17 Q2; watch :16 double backticks!):")
        print(p.stdout.strip())

    # 6. STATUS table cell counting & Works date parsing
    section("6. STATUS table cell counting & Works date parsing")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        status = (
            "# Status\nUpdated 2026-11-22.\n\n"
            "## Workstreams\n"
            "| Workstream | Where | State | Next |\n"
            "|---|---|---|---|\n"
            "| Escaped pipe | `a/` | x \\| y | none |\n"
            "| Double backslash | `b/` | ends \\\\| next |\n"
            "| Pipe in code | `c/` | `a | b` | none |\n"
            "| No trailing pipe | `d/` | ok | none\n\n"
            "## Works (verified)\n"
            "| Capability | How verified |\n"
            "|---|---|\n"
            "| Modal may | up to 5 may fail on GPU |\n"
            "| Old with modal may | 12 may be skipped (verified 2025-01-01) |\n"
            "| Month-first old | `pytest` passed, Oct 1 2025 |\n"
            "| Month-first short | `pytest` passed, Sep 2025 |\n"
            "| Date in filename | runs `schema_2024-01-01.sql`, `pytest` passes |\n"
            "| Date in capability (2024-05-01) | `pytest` passes |\n"
            "| Leap day | `pytest` passed, 29 Feb |\n"
            "| Valid old | `pytest` passed, 29 Oct 2025 |\n"
            "| Valid old short | `pytest` passed, 15 Aug |\n"
        )
        init_repo(root, {**base, "docs/STATUS.md": status})
        dm(root, "update")
        p = dm(root, "check")
        print("[6] STATUS check output:")
        for ln in p.stdout.splitlines():
            print("  " + ln)
        print("  STATUS lines for reference:")
        for i, ln in enumerate(status.splitlines(), 1):
            print(f"    {i:2d}: {ln}")

    # 7. Grace-day dating edge cases & performance
    section("7. Grace-day dating edge cases & performance")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        # Doc created 2025-01-01 as current, retired today (should be 0 days -> warning, not error)
        init_repo(root, {
            **base,
            "docmap.toml": "lifecycle_strict = true\narchive_grace_days = 7\n",
            "docs/RECENTLY_RETIRED.md": "# Doc\nStatus: current (verified 2025-01-01)\n\nBody.\n",
        }, env={"GIT_AUTHOR_DATE": "2025-01-01T12:00:00", "GIT_COMMITTER_DATE": "2025-01-01T12:00:00"})
        (root / "docs/RECENTLY_RETIRED.md").write_text("# Doc\nStatus: historical\n\nBody.\n", encoding="utf-8")
        sh(root, "git", "add", "-A")
        sh(root, "git", "commit", "-q", "-m", "retire today")
        dm(root, "update")
        p1 = dm(root, "check")
        print(f"[7a] Old file retired today rc={p1.returncode}:", [ln for ln in p1.stdout.splitlines() if "retired" in ln])

        # Doc retired 30 days ago, body edited today -> should still be 30 days -> error!
        old30 = (datetime.date.today() - datetime.timedelta(days=30)).isoformat() + "T12:00:00"
        (root / "docs/OLD_RETIRED.md").write_text("# Old\nStatus: historical\n\nBody v1.\n", encoding="utf-8")
        sh(root, "git", "add", "-A")
        sh(root, "git", "commit", "-q", "-m", "retire 30d ago",
           env={"GIT_AUTHOR_DATE": old30, "GIT_COMMITTER_DATE": old30})
        (root / "docs/OLD_RETIRED.md").write_text("# Old\nStatus: historical\n\nBody v2.\n", encoding="utf-8")
        sh(root, "git", "add", "-A")
        sh(root, "git", "commit", "-q", "-m", "edit body today")
        dm(root, "update")
        p2 = dm(root, "check")
        print(f"[7b] Retired 30d ago, body edited today rc={p2.returncode}:", [ln for ln in p2.stdout.splitlines() if "retired" in ln])

        # Uncommitted body edit on OLD_RETIRED.md -> does it mask the 30d age?
        (root / "docs/OLD_RETIRED.md").write_text("# Old\nStatus: historical\n\nBody v3 (uncommitted).\n", encoding="utf-8")
        p3 = dm(root, "check")
        print(f"[7c] Retired 30d ago, uncommitted body edit rc={p3.returncode}:", [ln for ln in p3.stdout.splitlines() if "retired" in ln])
        sh(root, "git", "checkout", "--", "docs/OLD_RETIRED.md")

        # Shallow clone of repo with OLD_RETIRED.md (retired 30d ago, then a newer commit today)
        shallow2 = Path(tmp) / "shallow_grace"
        sh(Path(tmp), "git", "clone", "--depth=1", f"file://{root}", str(shallow2))
        p4 = dm(shallow2, "check")
        print(f"[7d] Shallow clone of 30d-old retired doc rc={p4.returncode}:", [ln for ln in p4.stdout.splitlines() if "retired" in ln])

        # Perf: 40 retired docs all within grace window under lifecycle_strict
        perf_root = Path(tmp) / "perf"
        perf_files = {**base, "docmap.toml": "lifecycle_strict = true\narchive_grace_days = 7\n"}
        for i in range(40):
            perf_files[f"docs/old_{i:02d}.md"] = f"# Old {i}\nStatus: historical\n"
        init_repo(perf_root, perf_files)
        dm(perf_root, "update")
        t0 = time.monotonic()
        p5 = dm(perf_root, "check")
        dt = time.monotonic() - t0
        print(f"[7e] 40 retired docs within grace (lifecycle_strict=true): {dt:.2f}s, rc={p5.returncode}")


if __name__ == "__main__":
    main()
