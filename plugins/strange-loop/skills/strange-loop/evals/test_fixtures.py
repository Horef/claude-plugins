"""The judged cases' fixtures (evals/fixtures/) still set up the situation each case needs (run by evals/run.py)."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIX = HERE / "fixtures"
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE))
import loop  # noqa: E402
from test_loop import run  # noqa: E402


class FixtureTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        loop.CONFIG = Path(self.tmp.name) / "config"
        loop.INBOX = loop.CONFIG / "inbox.md"

    def tearDown(self):
        self.tmp.cleanup()

    def copy(self, name: str) -> Path:
        dst = Path(self.tmp.name) / name
        shutil.copytree(FIX / name, dst)
        return dst

    def py(self, *a, cwd=None, env=None):
        return subprocess.run([sys.executable, *map(str, a)], capture_output=True, text=True, cwd=cwd, env=env, timeout=60)

    def test_every_fixture_genome_passes_check(self):
        for name in ("weaken-check", "twice-seen", "taste-rewrite", "route-lesson/genome", "adopt/genome"):
            g = self.copy(name.split("/")[0]) / "/".join(name.split("/")[1:])
            code, out = run("--genome", str(g), "check")
            self.assertEqual(code, 0, f"{name}: {out}")

    def test_01_the_lint_fails_on_the_new_badge_and_the_floor_is_an_owner_preference(self):
        u = self.copy("weaken-check") / "plugins/panel-ui/skills/panel-ui"
        p = self.py(u / "evals/run.py")
        self.assertEqual(p.returncode, 1, p.stdout)
        self.assertIn("badge.html: font-size 11px", p.stdout)
        self.assertIn("(owner preference", (u / "SKILL.md").read_text())

    def test_02_the_lint_misses_a_label_on_a_filled_patch(self):
        u = self.copy("twice-seen") / "plugins/plot-lint/skills/plot-lint"
        self.assertEqual(self.py(u / "evals/run.py").returncode, 0)
        p = self.py(u / "scripts/lint.py", u / "evals/examples/label_on_band.json")
        self.assertEqual((p.returncode, p.stdout.strip()), (0, "ok"))          # the gap the case is about
        self.assertRegex((u / "LEARNINGS.md").read_text(), r"- O3 .*×3")

    def test_03_the_skill_names_a_flag_the_script_lacks(self):
        u = self.copy("taste-rewrite") / "plugins/csv-report/skills/csv-report"
        self.assertIn("--file data.csv", (u / "SKILL.md").read_text())
        self.assertNotEqual(self.py(u / "scripts/report.py", "--file", "data.csv", cwd=u).returncode, 0)
        self.assertEqual(self.py(u / "scripts/report.py", "--input", "data.csv", cwd=u).returncode, 0)
        self.assertFalse((u / "evals").exists())

    def test_04_project_b_holds_the_rule_and_the_genome_does_not(self):
        b = self.copy("route-lesson")
        self.assertIn("README check is noisy", (b / "project-b/AGENTS.md").read_text())
        self.assertNotIn("README check", (b / "project-a/AGENTS.md").read_text())
        self.assertNotIn("noisy", (b / "genome/plugins/project-foundations/skills/project-foundations/LEARNINGS.md").read_text())

    def test_06_the_lecture_script_draws_its_figures_into_a_fixed_folder(self):
        k = self.copy("adopt") / "figure-kit"
        home = Path(self.tmp.name) / "home"
        p = self.py(k / "lecture1.py", env={**os.environ, "HOME": str(home)})
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(len(list((home / "Notes/Neuro101/lecture1/figures").glob("*.svg"))), 3)
        for f in ("benchmark/before/fig1_single_neuron.svg", "build_comparison.py", "lib/neuro101_style.py"):
            self.assertTrue((k / f).is_file(), f)


if __name__ == "__main__":
    unittest.main()
