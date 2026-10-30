"""Unit tests for scripts/loop.py on a throwaway genome (stdlib unittest; run by evals/run.py)."""
from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import loop  # noqa: E402

SKILL = """---
name: demo
description: "A demo skill used by the strange-loop tests."
---

# Demo

## Learning loop
Record lessons in LEARNINGS.md.
"""


def make_genome(root: Path) -> Path:
    (root / ".claude-plugin").mkdir(parents=True)
    (root / ".claude-plugin" / "marketplace.json").write_text(json.dumps(
        {"name": "t", "owner": {"name": "t"}, "plugins": [{"name": "demo", "source": "./plugins/demo", "description": "d"}]}))
    plug = root / "plugins" / "demo"
    (plug / ".claude-plugin").mkdir(parents=True)
    (plug / ".claude-plugin" / "plugin.json").write_text(json.dumps({"name": "demo", "version": "1.0.0", "description": "d"}))
    skill = plug / "skills" / "demo"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(SKILL)
    (skill / "CHANGELOG.md").write_text("# Changelog: demo\n\n## 1.0.0 (2026-01-01)\n- First.\n")
    return root


def run(*argv: str) -> tuple[int, str]:
    out = io.StringIO()
    code = 0
    with contextlib.redirect_stdout(out):
        try:
            loop.main(list(argv))
        except SystemExit as e:
            code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
            if isinstance(e.code, str):
                out.write(e.code)
    return code, out.getvalue()


class LoopTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.g = make_genome(Path(self.tmp.name) / "genome")
        self.cfg = Path(self.tmp.name) / "config"
        loop.CONFIG, loop.INBOX = self.cfg, self.cfg / "inbox.md"
        self.learn = self.g / "plugins/demo/skills/demo/LEARNINGS.md"

    def tearDown(self):
        self.tmp.cleanup()

    def test_note_creates_learnings_and_dedupes(self):
        run("--genome", str(self.g), "note", "demo", "friction", "the render step needs a browser path that is not documented")
        text = self.learn.read_text()
        self.assertIn("## Open", text)
        self.assertRegex(text, r"- O1 \d{4}-\d{2}-\d{2} \[friction\] the render step")
        code, out = run("--genome", str(self.g), "note", "demo", "friction", "render step needs browser path not documented anywhere")
        self.assertIn("×2", self.learn.read_text())
        self.assertIn("seen again", out)
        run("--genome", str(self.g), "note", "demo", "missing", "an example of a two-panel figure", "--where", "§7")
        self.assertIn("- O2 ", self.learn.read_text())
        self.assertIn("[missing] §7: an example", self.learn.read_text())

    def test_check_passes_then_catches_errors(self):
        run("--genome", str(self.g), "note", "demo", "win", "the checklist caught a clipped label")
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)
        pj = self.g / "plugins/demo/.claude-plugin/plugin.json"
        pj.write_text(json.dumps({"name": "demo", "version": "1.1.0", "description": "d"}))
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 1)
        self.assertIn("newest entry 1.0.0 but plugin.json says 1.1.0", out)

    def test_malformed_and_bad_resolution_are_errors(self):
        run("--genome", str(self.g), "note", "demo", "win", "x works")
        self.learn.write_text(self.learn.read_text() + "- O9 2026-01-01 [friction] resolved without version\n- not an observation\n")
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 1)
        self.assertIn("resolved O9 has no", out)
        self.assertIn("malformed observation", out)

    def test_bump_resolves_and_versions(self):
        run("--genome", str(self.g), "note", "demo", "misled", "step 3 names the wrong flag")
        code, out = run("--genome", str(self.g), "status")
        self.assertIn("RIPE", out)  # one 'misled' is enough
        run("--genome", str(self.g), "bump", "demo", "minor", "Correct the flag in step 3", "--obs", "O1")
        meta = json.loads((self.g / "plugins/demo/.claude-plugin/plugin.json").read_text())
        self.assertEqual(meta["version"], "1.1.0")
        cl = (self.g / "plugins/demo/skills/demo/CHANGELOG.md").read_text()
        self.assertLess(cl.index("## 1.1.0"), cl.index("## 1.0.0"))
        self.assertIn("Correct the flag in step 3 (O1)", cl)
        text = self.learn.read_text()
        self.assertIn("→ 1.1.0", text)
        self.assertLess(text.index("## Resolved"), text.index("- O1 "))
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)

    def test_rejected_and_moved_resolutions(self):
        run("--genome", str(self.g), "note", "demo", "win", "x works")
        base = self.learn.read_text()
        self.learn.write_text(base + "- O7 2026-10-01 [wish] lower the threshold → rejected: owner keeps it\n"
                              "- O8 2026-10-01 [friction] a project rule → moved: project-foundations O4\n")
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)
        self.learn.write_text(base + "- O7 2026-10-01 [wish] lower the threshold → maybe later\n")
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 1)
        self.assertIn("rejected: <reason>", out)

    def test_bump_obs_last_and_pack(self):
        import zipfile
        run("--genome", str(self.g), "note", "demo", "failure", "first problem here")
        run("--genome", str(self.g), "note", "demo", "failure", "second unrelated crash in export")
        run("--genome", str(self.g), "bump", "demo", "patch", "Fix the export crash", "--obs", "last")
        text = self.learn.read_text()
        self.assertIn("second unrelated crash in export → 1.0.1", text)
        self.assertNotIn("first problem here → ", text)
        code, out = run("--genome", str(self.g), "pack", "demo", "--out", str(self.cfg / "dist"))
        names = zipfile.ZipFile(self.cfg / "dist" / "demo-1.0.1.zip").namelist()
        self.assertIn("demo/SKILL.md", names)
        self.assertIn("demo/LEARNINGS.md", names)

    def test_inbox_when_no_genome_then_absorb(self):
        os.environ.pop("STRANGE_LOOP_GENOME", None)
        cwd, real_file = os.getcwd(), loop.__file__
        os.chdir(self.tmp.name)
        try:
            loop.__file__ = str(Path(self.tmp.name) / "nowhere" / "loop.py")
            run("note", "demo", "wish", "a way to see the output before delivering")
        finally:
            os.chdir(cwd)
            loop.__file__ = real_file
        self.assertIn("[demo]", loop.INBOX.read_text())
        code, out = run("--genome", str(self.g), "absorb")
        self.assertIn("absorbed 1", out)
        self.assertIn("[wish] a way to see the output", self.learn.read_text())
        self.assertEqual(loop.INBOX.read_text().strip(), "")

    def test_digest_silent_unless_ripe(self):
        run("--genome", str(self.g), "note", "demo", "win", "fine")
        self.assertEqual(run("--genome", str(self.g), "digest")[1], "")
        run("--genome", str(self.g), "note", "demo", "failure", "the export produced an empty file")
        self.assertIn("demo: 2 open (1 ripe)", run("--genome", str(self.g), "digest")[1])

    def test_base_requires_version_bump(self):
        git = lambda *a: subprocess.run(["git", "-C", str(self.g), *a], capture_output=True, text=True, check=True)
        git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t")
        run("--genome", str(self.g), "note", "demo", "win", "fine")
        git("add", "-A"); git("commit", "-qm", "base")
        run("--genome", str(self.g), "note", "demo", "friction", "observations alone need no bump")
        (self.g / "plugins/demo/skills/demo/evals").mkdir()
        (self.g / "plugins/demo/skills/demo/evals/cases.md").write_text("# Cases\n\n## One\n")
        git("add", "-A"); git("commit", "-qm", "note and eval only")
        self.assertEqual(run("--genome", str(self.g), "check", "--base", "HEAD~1")[0], 0)
        skill = self.g / "plugins/demo/skills/demo/SKILL.md"
        skill.write_text(SKILL + "\nA new rule.\n")
        git("commit", "-qam", "change")
        code, out = run("--genome", str(self.g), "check", "--base", "HEAD~2")
        self.assertEqual(code, 1)
        self.assertIn("still version 1.0.0", out)


if __name__ == "__main__":
    unittest.main()
