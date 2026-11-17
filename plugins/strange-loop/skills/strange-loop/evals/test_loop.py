"""Unit tests for scripts/loop.py on a throwaway genome (stdlib unittest; run by evals/run.py)."""
from __future__ import annotations

import contextlib
import io
import json
import os
import re
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
        {"name": "t", "owner": {"name": "t"}, "plugins": [{"name": "demo", "source": "./plugins/demo", "description": "d", "category": "general"}]}))
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

    def test_skill_size_budget_is_in_bytes_and_only_warns(self):
        skill = self.g / "plugins/demo/skills/demo/SKILL.md"
        run("--genome", str(self.g), "note", "demo", "win", "the checklist caught a clipped label")
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)
        self.assertNotIn("bytes", out)                                  # a small skill: no size warning
        wide = "\n".join("word " * 60 for _ in range(100))             # 100 lines, about 30 KB: fits the line budget, not the byte budget
        skill.write_text(SKILL + wide + "\n")
        self.assertLess(len(skill.read_text().splitlines()), loop.SKILL_MAX_LINES)
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)                                  # a warning, never an error
        self.assertRegex(out, r"warning: .*demo/SKILL\.md: \d+ bytes \(> %d\)" % loop.SKILL_MAX_BYTES)
        code, out = run("--genome", str(self.g), "status", "demo")
        self.assertRegex(out, r"SKILL\.md \d+/\d+ lines, \d+\.\d/\d+\.\d KB")

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

    def test_link_symlinks_skills_and_spares_real_folders(self):
        target = Path(self.tmp.name) / "skills"
        (target / "other").mkdir(parents=True)
        code, out = run("--genome", str(self.g), "link", str(target))
        self.assertTrue((target / "demo").is_symlink())
        self.assertEqual((target / "demo" / "SKILL.md").read_text(), SKILL)
        self.assertIn("linked", out)
        self.assertIn("ok", run("--genome", str(self.g), "link", str(target))[1])
        (target / "demo").unlink(); (target / "demo").mkdir()
        self.assertIn("skipped", run("--genome", str(self.g), "link", str(target))[1])

    def test_digest_warns_about_a_wrong_genome_path(self):
        self.cfg.mkdir(parents=True, exist_ok=True)
        (self.cfg / "genome").write_text(str(Path(self.tmp.name) / "typo"))
        self.assertIn("not a clone of the genome", run("digest")[1])
        (self.cfg / "genome").write_text(str(self.g))
        self.assertNotIn("not a clone", run("digest")[1])

    def test_new_skill_passes_check_and_adopts_a_folder(self):
        (self.g / "README.md").write_text("# Plugins\n\n**General**: for anyone.\n\n| Plugin | What it does |\n| --- | --- |\n"
                                          "| [demo](plugins/demo) | d |\n\n**Personal**: mine.\n\n| Plugin | What it does |\n| --- | --- |\n\n## Install\n")
        run("--genome", str(self.g), "note", "demo", "win", "x works")
        code, out = run("--genome", str(self.g), "new", "paper-reading", "--description", "Read a paper and mark it up.", "--category", "personal")
        self.assertEqual(code, 0, out)
        unit = self.g / "plugins/paper-reading/skills/paper-reading"
        self.assertIn(loop.NOTE_CMD + " paper-reading", (unit / "SKILL.md").read_text())
        code, out = run("--genome", str(self.g), "check")
        self.assertEqual(code, 0, out)                                   # complete and valid at once ...
        self.assertIn("TODO(new) placeholders", out)                     # ... but the placeholders are flagged
        readme = (self.g / "README.md").read_text()
        self.assertLess(readme.index("**Personal**"), readme.index("[paper-reading]"))
        self.assertEqual(run("--genome", str(self.g), "new", "paper-reading", "--description", "x", "--category", "general")[0], 1)
        src = Path(self.tmp.name) / "old-skill"
        (src / "scripts").mkdir(parents=True)
        (src / "SKILL.md").write_text("---\nname: old-skill\ndescription: \"An old skill.\"\n---\n\n# Old\n")
        (src / "scripts" / "tool.py").write_text('"""Tool."""\n')
        code, out = run("--genome", str(self.g), "new", "old-skill", "--description", "An old skill.", "--category", "general", "--from", str(src))
        self.assertIn("scripts/tool.py", out)                            # every copied file is listed for sorting
        body = (self.g / "plugins/old-skill/skills/old-skill/SKILL.md").read_text()
        self.assertIn("## Learning loop", body)
        self.assertEqual(run("--genome", str(self.g), "check")[0], 0)
        self.assertIn('"version": "1.0.0"', (self.g / "plugins/old-skill/.claude-plugin/plugin.json").read_text())

    def test_new_from_checks_before_writing_and_takes_a_mod_folder(self):
        src = Path(self.tmp.name) / "hooks-only"
        (src / "hooks").mkdir(parents=True)
        (src / "hooks" / "index.ts").write_text("// A hook.\n")
        code, out = run("--genome", str(self.g), "new", "bad-skill", "--description", "x.", "--category", "general", "--from", str(src))
        self.assertEqual(code, 1, out)
        self.assertFalse((self.g / "plugins/bad-skill").exists())        # nothing written when the source is refused
        code, out = run("--genome", str(self.g), "new", "a-mod", "--description", "A mod.", "--category", "general", "--mod", "--from", str(src))
        self.assertEqual(code, 0, out)
        self.assertTrue((self.g / "plugins/a-mod/hooks/index.ts").is_file())
        self.assertTrue((self.g / "plugins/a-mod/README.md").is_file())

    def test_worktree_of_the_configured_genome_wins(self):
        git = lambda cwd, *a: subprocess.run(["git", "-C", str(cwd), *a], capture_output=True, text=True, check=True)
        git(self.g, "init", "-q", "-b", "main")
        git(self.g, "-c", "user.name=t", "-c", "user.email=t@t", "add", "-A")
        git(self.g, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init")
        wt = Path(self.tmp.name) / "wt"
        git(self.g, "worktree", "add", "-q", "-b", "side", str(wt))
        self.cfg.mkdir(parents=True, exist_ok=True)
        (self.cfg / "genome").write_text(str(self.g))
        os.environ.pop("STRANGE_LOOP_GENOME", None)
        cwd = os.getcwd()
        os.chdir(wt / "plugins")
        try:
            found, why = loop.find_genome()
        finally:
            os.chdir(cwd)
        self.assertEqual(found.resolve(), wt.resolve(), why)
        os.chdir(self.tmp.name)                                          # outside any marketplace the configured clone wins
        try:
            found, _ = loop.find_genome()
        finally:
            os.chdir(cwd)
        self.assertEqual(found.resolve(), self.g.resolve())

    def test_skill_md_template_matches_what_new_writes(self):
        skill = Path(__file__).resolve().parents[1]   # the template lives in exactly this file (owner, 2026-11-15)
        text = (skill / "references" / "learning-loop-template.md").read_text()
        self.assertIn(loop.LOOP_SECTION.format(cmd=loop.NOTE_CMD, name="<name>").rstrip(), text)

    def test_absorb_reply_block(self):
        run("--genome", str(self.g), "note", "demo", "win", "x works")
        block = Path(self.tmp.name) / "reply.txt"
        block.write_text("Some answer text.\n\n**Observations for demo**\n"
                         "- O? 2026-10-29 [friction] §2: the export step needs a folder that may not exist (claude-ai, note)\n"
                         "- 2026-10-29 [banana] not a kind\n")
        code, out = run("--genome", str(self.g), "absorb", str(block))
        self.assertIn("absorbed 1", out)
        self.assertIn("[friction] §2: the export step needs a folder", self.learn.read_text())

    def test_sync_two_machines(self):
        git = lambda cwd, *a: subprocess.run(["git", "-C", str(cwd), *a], capture_output=True, text=True, check=True)
        remote = Path(self.tmp.name) / "remote.git"
        git(self.tmp.name, "init", "-q", "--bare", "-b", "main", str(remote))
        (self.g / ".gitattributes").write_text("LEARNINGS.md merge=union\n")
        run("--genome", str(self.g), "note", "demo", "win", "the checklist works")
        for a in (("init", "-q", "-b", "main"), ("config", "user.email", "a@a"), ("config", "user.name", "a"),
                  ("add", "-A"), ("commit", "-qm", "base"), ("remote", "add", "origin", str(remote)), ("push", "-qu", "origin", "main")):
            git(self.g, *a)
        b = Path(self.tmp.name) / "machine-b"
        git(self.tmp.name, "clone", "-q", str(remote), str(b))
        git(b, "config", "user.email", "b@b"); git(b, "config", "user.name", "b")
        run("--genome", str(self.g), "note", "demo", "friction", "machine A saw the lint miss a patch over text")
        run("--genome", str(b), "note", "demo", "missing", "machine B wanted a contour view of the surface")
        (self.g / "plugins/demo/skills/demo/SKILL.md").write_text(SKILL + "\nwork in progress\n")   # must be left alone
        self.assertEqual(run("--genome", str(self.g), "sync")[0], 0)
        code, out = run("--genome", str(b), "sync")
        self.assertEqual(code, 0, out)
        self.assertIn("renumbered", out)                       # both machines had used O2
        self.assertEqual(run("--genome", str(self.g), "sync")[0], 0)
        for clone in (self.g, b):
            text = (clone / "plugins/demo/skills/demo/LEARNINGS.md").read_text()
            self.assertIn("machine A saw", text)
            self.assertIn("machine B wanted", text)
            ids = re.findall(r"^- (O\d+) ", text, re.M)
            self.assertEqual(len(ids), len(set(ids)), text)
        self.assertIn("work in progress", (self.g / "plugins/demo/skills/demo/SKILL.md").read_text())
        self.assertIn("SKILL.md", git(self.g, "status", "--porcelain").stdout)
        git(self.g, "commit", "-qam", "unfinished skill change")          # a unit change waits for checks: not auto-pushed
        run("--genome", str(self.g), "note", "demo", "win", "a third observation after the unit commit")
        code, out = run("--genome", str(self.g), "sync")
        self.assertIn("not pushed", out)
        self.assertNotIn("unfinished skill change", git(remote, "log", "--oneline", "main").stdout)

    def test_renumber_drops_the_open_copy_of_a_resolved_observation(self):
        """O21: a branch resolved O1, main still had it open; the union merge keeps both lines."""
        line = "- O1 2026-01-01 [friction] the render step needs a browser path"
        self.learn.write_text(f"# Learnings: demo\n\n## Open\n{line} ×2\n\n## Resolved\n{line} → 1.0.0\n")
        code, out = run("--genome", str(self.g), "check")
        self.assertIn("O1 is both open and resolved", out)
        self.assertEqual(loop.Learnings(self.learn, "demo").renumber(), ["O1 dropped (already resolved)"])
        L = loop.Learnings(self.learn, "demo")
        self.assertEqual([m.group(1) for _, m in L.entries("open")], [])
        self.assertEqual([m.group(1) for _, m in L.entries("resolved")], ["O1"])
        # the same id on a different observation is still renumbered, not dropped
        self.learn.write_text(self.learn.read_text().replace("## Open\n", "## Open\n- O1 2026-01-02 [wish] something else\n", 1))
        self.assertEqual(loop.Learnings(self.learn, "demo").renumber(), ["O1->O2"])

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

    def test_reading_notes_are_ripe_like_use_notes(self):
        """Owner, 2026-11-15 (O25): problems found by reading are ripe like any other and fixed promptly;
        reading notes are no longer held back as 'unconfirmed by use'."""
        lp = self.g / "plugins" / "demo" / "skills" / "demo" / "LEARNINGS.md"
        run("--genome", str(self.g), "note", "demo", "misled", "step 1: the flag named here does not exist", "--context", "reading")
        code, out = run("--genome", str(self.g), "status", "demo")
        self.assertIn("demo [RIPE]", out)
        text = lp.read_text(encoding="utf-8")
        lp.write_text(re.sub(r"(- O1 )\d{4}-\d{2}-\d{2}", r"\g<1>2020-01-01", text), encoding="utf-8")
        run("--genome", str(self.g), "note", "demo", "friction", "step 2: export wrote an empty folder")
        run("--genome", str(self.g), "note", "demo", "friction", "step 4: completely unrelated slowness")
        run("--genome", str(self.g), "note", "demo", "friction", "step 9: completely different trouble here")
        for cmd in ("status", "digest"):
            out = run("--genome", str(self.g), cmd)[1]
            self.assertNotIn("unconfirmed", out)
            self.assertNotIn("offer to the owner", out)

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


# Real herdr-delegate observations: O10, O16, O19 and O26 are one lesson, filed as four lines (structure review 2026-11-14).
HERDR = {
    "O10": "- O10 2026-11-06 [friction] Step 4 / helpers.py prompt: Copilot's 'Allow path access' dialog (reading a brief file outside the cwd) blocked the helper, hc wait reported status blocked, but 'helpers.py prompt' printed 'no prompt'; the detector should match that dialog too, and briefs in a scratchpad outside --cwd will always trigger it (put briefs inside the cwd or inline) (claude-code, genome reflection 2026-11-06)",
    "O12": "- O12 2026-11-07 [friction] Brief: a Kiro helper testing a config CLI ran it against the real ~/.config because an exported XDG_CONFIG_HOME did not persist between its shell calls; it reported it honestly and could not delete the files (Kiro blocked rm). Briefs for code that writes user config should say: set the override inline in every command (VAR=... cmd), never rely on export (claude-code, herdr-delegate 0.6.0 build)",
    "O14": "- O14 2026-11-07 [friction] Step 5 Judge: an agy helper (--mode auto) on a 19-row quote-check brief raised about 10 permission prompts (every shell command, each read outside the workspace, its own /tmp cleanup); option 2 (always allow) only covers the exact command prefix, so each new LIT=... script asked again. A brief note to put all quote checks in one script file, or agy's non-workspace 'always allow' up front, would cut the round trips. (claude-code, simple_complex_v1)",
    "O16": "- O16 2026-11-08 [friction] Step 4 Copilot prompts: helpers.py prompt <name> exited non-zero while Copilot showed an 'Allow path access' dialog (shell path outside the session's allowed paths: the project's conda python); the lead's 8-minute wait loop missed it and the helper sat blocked ~6 min. Would help: prompt detection that also matches Copilot's 'Allow path access' / 'Do you want to allow this?' box. (simple_complex_v1)",
    "O19": "- O19 2026-11-09 [missing] helpers.py prompt: Copilot 1.0.107's 'Allow path access' dialog (shell path outside the session's allowed paths, e.g. the conda interpreter) is not detected; prompt printed 'no prompt' while hc said blocked. Would help: match 'Allow path access' / 'Do you want to allow this?' too (simple_complex_v1)",
}
NEW26 = ("Step 4 (helpers.py prompt): Copilot 1.0.11x path-permission dialog ('Permission is checked against the resolved target ... "
         "Do you want to allow this? 1. Yes 2. Yes, and remember these paths for this session') was not detected: prompt printed "
         "'no prompt' while hc showed evalb blocked (permission).")


class RecurrenceTest(unittest.TestCase):
    """`note` offers close open observations (any kind) as recurrences instead of filing the same lesson again."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.g = make_genome(Path(self.tmp.name) / "genome")
        self.cfg = Path(self.tmp.name) / "config"
        loop.CONFIG, loop.INBOX = self.cfg, self.cfg / "inbox.md"
        self.learn = self.g / "plugins/demo/skills/demo/LEARNINGS.md"
        self.learn.write_text("# Learnings: demo\n\n## Open\n" + "\n".join(HERDR[k] for k in ("O10", "O12", "O14", "O16", "O19")) + "\n\n## Resolved\n")
        self.note = lambda *a: run("--genome", str(self.g), "note", "demo", *a)

    def tearDown(self):
        self.tmp.cleanup()

    def line(self, oid):
        return next(l for l in self.learn.read_text().splitlines() if l.startswith(f"- {oid} "))

    def test_same_lesson_in_another_kind_is_not_written_silently(self):
        before = self.learn.read_text()
        code, out = self.note("failure", NEW26, "--harness", "claude-code")
        self.assertNotEqual(code, 0)
        self.assertEqual(self.learn.read_text(), before)
        for oid in ("O10", "O16", "O19"):
            self.assertIn(oid, out)
        self.assertNotIn("O12", out)
        self.assertNotIn("O14", out)
        self.assertIn("--same", out)
        self.assertIn("--new", out)

    def test_same_adds_count_date_and_detail_to_that_line(self):
        code, out = self.note("failure", NEW26, "--same", "O10")
        self.assertEqual(code, 0)
        o10 = self.line("O10")
        self.assertTrue(o10.startswith(HERDR["O10"]))
        self.assertRegex(o10, r"\[\+\d{4}-\d{2}-\d{2} Step 4 helpers\.py prompt[^\]]*\] ×2$")
        self.assertEqual(sum(l.startswith("- O") for l in self.learn.read_text().splitlines()), 5)   # no new line
        self.assertEqual(loop.OBS.match(o10).group(5), "2")
        self.note("failure", NEW26 + " again", "--same", "O10")
        self.assertEqual(loop.OBS.match(self.line("O10")).group(5), "3")

    def test_new_files_a_separate_line(self):
        code, out = self.note("failure", NEW26, "--new")
        self.assertEqual(code, 0)
        text = self.learn.read_text()
        self.assertIn("- O20 ", text)
        self.assertNotIn("×", text)

    def test_unrelated_note_is_written_as_before(self):
        code, out = self.note("missing", "SKILL.md step 3: an example of a two-panel figure with shared axes would help")
        self.assertEqual(code, 0)
        self.assertIn("O20 recorded", out)

    def test_same_and_new_exclude_each_other_and_same_needs_an_open_id(self):
        before = self.learn.read_text()
        self.assertNotEqual(self.note("failure", NEW26, "--same", "O10", "--new")[0], 0)
        self.assertNotEqual(self.note("failure", NEW26, "--same", "O99")[0], 0)
        self.assertEqual(self.learn.read_text(), before)

    def test_recurrences_make_the_lesson_ripe(self):
        self.assertFalse(loop.is_ripe(loop.OBS.match(self.line("O10"))))
        self.note("failure", NEW26, "--same", "O10")
        self.assertTrue(loop.is_ripe(loop.OBS.match(self.line("O10"))))

    def test_closeness_ranks_the_one_lesson_above_unrelated_lines(self):
        body = {k: loop.OBS.match(v).group(4) for k, v in HERDR.items()}
        body["O26"] = NEW26
        lesson = ["O10", "O16", "O19", "O26"]
        for a in lesson:
            for b in lesson:
                if a < b:
                    self.assertGreaterEqual(loop.closeness(body[a], body[b]), loop.CLOSE_MIN, (a, b))
            for b in ("O12", "O14"):
                self.assertLess(loop.closeness(body[a], body[b]), loop.CLOSE_MIN, (a, b))
        self.assertLess(loop.closeness(body["O12"], body["O14"]), loop.CLOSE_MIN)


def git_in(cwd, *a):
    return subprocess.run(["git", "-C", str(cwd), *a], capture_output=True, text=True, check=True)


class PassTest(unittest.TestCase):
    """2026-11-15 reflection pass: O1, O3, O22, O23, O24, O26, audit D15 and E17, new --from --dry-run/--exclude."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.g = make_genome(Path(self.tmp.name) / "genome")
        self.cfg = Path(self.tmp.name) / "config"
        loop.CONFIG, loop.INBOX = self.cfg, self.cfg / "inbox.md"
        self.unit = self.g / "plugins/demo/skills/demo"
        self.learn = self.unit / "LEARNINGS.md"
        self.env = os.environ.pop("STRANGE_LOOP_GENOME", None)
        self.cwd = os.getcwd()

    def tearDown(self):
        os.chdir(self.cwd)
        if self.env is not None:
            os.environ["STRANGE_LOOP_GENOME"] = self.env
        self.tmp.cleanup()

    def g_run(self, *a):
        return run("--genome", str(self.g), *a)

    # O24: a marketplace in the current directory wins over the configured genome; write commands print absolute paths
    def test_cwd_marketplace_wins_over_the_configured_genome(self):
        self.cfg.mkdir(parents=True, exist_ok=True)
        (self.cfg / "genome").write_text(str(self.g))
        only = self.g / "plugins/only-real"
        (only / ".claude-plugin").mkdir(parents=True)
        (only / ".claude-plugin/plugin.json").write_text(json.dumps({"name": "only-real", "version": "1.0.0", "description": "d"}))
        (only / "LEARNINGS.md").write_text(loop.LEARNINGS_TEMPLATE.format(name="only-real", what="plugin"))
        fixture = make_genome(Path(self.tmp.name) / "fixture")
        os.chdir(fixture / "plugins")
        found, why = loop.find_genome()
        self.assertEqual(found.resolve(), fixture.resolve(), why)
        self.assertIn(str(self.g), run("where")[1])                     # where says the configured genome is not used here
        code, out = run("new", "panel-ui", "--description", "Panels. Use when building panels.", "--category", "general")
        self.assertEqual(code, 0, out)
        self.assertTrue((fixture / "plugins/panel-ui").is_dir())
        self.assertFalse((self.g / "plugins/panel-ui").exists())        # the real genome is untouched
        self.assertIn(str((fixture / "plugins/panel-ui").resolve()), out)
        code, out = run("bump", "demo", "patch", "x")
        self.assertIn(str(fixture.resolve()), out)
        self.assertIn('"1.0.1"', (fixture / "plugins/demo/.claude-plugin/plugin.json").read_text())
        self.assertIn('"1.0.0"', (self.g / "plugins/demo/.claude-plugin/plugin.json").read_text())
        run("note", "demo", "wish", "a fixture note stays in the fixture")
        self.assertIn("a fixture note", (fixture / "plugins/demo/skills/demo/LEARNINGS.md").read_text())
        self.assertFalse(self.learn.exists())
        code, out = run("note", "only-real", "wish", "a unit only the configured genome has")
        self.assertIn("a unit only the configured genome", (only / "LEARNINGS.md").read_text())   # not the inbox
        self.g_run("note", "demo", "failure", "the export produced an empty file")
        self.assertIn("demo: 1 open (1 ripe)", run("digest")[1])         # the session hook keeps the configured genome

    # O26: a resolved lesson that recurs can be counted; observations can be looked up by id
    def test_same_on_a_resolved_id_reopens_it_with_its_count(self):
        resolved = "- O3 2026-01-01 [friction] §5 lint: the lint misses filled patches over labels, found only on render (cc, x) ×2 → 1.0.0"
        self.learn.write_text(loop.LEARNINGS_TEMPLATE.format(name="demo", what="skill") + resolved + "\n")
        (self.unit / "CHANGELOG.md").write_text("# Changelog: demo\n\n## 1.0.0 (2026-01-01)\n- Patch check in the lint. (O3)\n")
        code, out = self.g_run("note", "demo", "friction", "lint misses filled patches over labels again")
        self.assertNotEqual(code, 0, out)                               # a close resolved lesson is offered, nothing written
        self.assertIn("O3", out)
        self.assertIn("resolved", out)
        self.assertNotIn("- O4 ", self.learn.read_text())
        code, out = self.g_run("note", "demo", "friction", "lint misses filled patches over labels again", "--same", "O3")
        self.assertEqual(code, 0, out)
        self.assertIn("O4", out)
        L = loop.Learnings(self.learn, "demo")
        (o4,) = [m for _, m in L.entries("open")]
        self.assertEqual(o4.group(1), "O4")
        self.assertEqual(o4.group(5), "3")
        self.assertIn("reopens O3", o4.group(4))
        self.assertTrue(loop.is_ripe(o4))
        self.assertIn(resolved, self.learn.read_text())                 # history unchanged
        self.g_run("note", "demo", "friction", "and once more", "--same", "O3")   # the reopened line counts on
        L = loop.Learnings(self.learn, "demo")
        self.assertEqual([(m.group(1), m.group(5)) for _, m in L.entries("open")], [("O4", "4")])
        self.assertEqual(self.g_run("check")[0], 0)
        code, out = self.g_run("show", "demo", "O3")
        self.assertEqual(code, 0, out)
        self.assertIn("resolved", out)
        self.assertIn("filled patches", out)
        self.assertIn("Patch check in the lint", out)                   # the CHANGELOG entry citing it
        self.assertIn("O4", out)                                        # and the open line that reopens it
        self.assertIn("open", self.g_run("show", "demo", "O4")[1])
        self.assertNotEqual(self.g_run("show", "demo", "O99")[0], 0)

    # O22: repeated --obs accumulate
    def test_bump_takes_repeated_obs(self):
        self.g_run("note", "demo", "failure", "first problem here")
        self.g_run("note", "demo", "failure", "second unrelated crash in export", "--new")
        code, out = self.g_run("bump", "demo", "patch", "Fix both", "--obs", "O1", "--obs", "O2")
        self.assertEqual(code, 0, out)
        L = loop.Learnings(self.learn, "demo")
        self.assertEqual(L.entries("open"), [])
        self.assertIn("Fix both (O1, O2)", (self.unit / "CHANGELOG.md").read_text())

    # O23: scripts must parse at the owner's Python floor, and at the floor a SKILL.md states
    def test_check_warns_about_syntax_newer_than_the_floor(self):
        self.g_run("note", "demo", "win", "fine")
        (self.unit / "scripts").mkdir()
        (self.unit / "scripts/new.py").write_text('x = t"hello {1}"\n')
        code, out = self.g_run("check")
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"warning: .*scripts/new\.py.*Python 3\.12")
        (self.unit / "scripts/new.py").write_text("def f[T](x: T) -> T:\n    return x\n")
        self.assertNotIn("scripts/new.py", self.g_run("check")[1])     # 3.12 syntax is fine at the floor ...
        (self.unit / "SKILL.md").write_text(SKILL.replace("# Demo\n", "# Demo\n\n`new.py` needs Python 3.10+.\n"))
        self.assertRegex(self.g_run("check")[1], r"warning: .*SKILL\.md.*Python 3\.10.*scripts/new\.py")   # ... not at a stated 3.10

    # audit E17: a description should say when to use the skill
    def test_check_warns_when_a_description_has_no_use_when_clause(self):
        self.g_run("note", "demo", "win", "fine")
        code, out = self.g_run("check")
        self.assertEqual(code, 0, out)
        self.assertIn("Use when", out)
        (self.unit / "SKILL.md").write_text(SKILL.replace("strange-loop tests.", "strange-loop tests. Use when testing the loop."))
        self.assertNotIn("Use when", self.g_run("check")[1])

    # R2 (owner-approved 2026-11-15): the Learning loop footer is the template, with the skill's name substituted
    def footer(self, name="demo"):
        return loop.LOOP_SECTION.format(cmd=loop.NOTE_CMD, name=name)

    def test_check_warns_when_the_footer_differs_from_the_template(self):
        self.g_run("note", "demo", "win", "fine")
        (self.unit / "SKILL.md").write_text(SKILL.split("## Learning loop")[0] + self.footer())
        code, out = self.g_run("check")
        self.assertEqual(code, 0, out)
        self.assertNotIn("footer", out)                                  # the template itself, name substituted: no warning
        (self.unit / "SKILL.md").write_text(SKILL.split("## Learning loop")[0] + self.footer("other-name"))
        self.assertRegex(self.g_run("check")[1], r"warning: .*demo/SKILL\.md: .*Learning loop.*differs from the template")
        edited = self.footer().replace("clearly pays off", "pays off nicely")
        (self.unit / "SKILL.md").write_text(SKILL.split("## Learning loop")[0] + edited)
        code, out = self.g_run("check")
        self.assertEqual(code, 0, out)                                   # a warning, never an error
        self.assertRegex(out, r"differs from the template")
        hints = "\n### Observations\n\nSkill-specific hint: a gate the person had to ask for is the best evidence.\n"
        (self.unit / "SKILL.md").write_text(SKILL.split("## Learning loop")[0] + self.footer() + hints)
        self.assertNotIn("differs from the template", self.g_run("check")[1])   # the skill's own ### Observations is not part of the footer

    def test_new_skill_footer_is_the_template(self):
        self.g_run("new", "paper-reading", "--description", "Read a paper. Use when reading.", "--category", "general")
        self.assertNotIn("differs from the template", self.g_run("check")[1])

    # R2: a SKILL.md may exceed the size budget when its front matter gives a reason
    def test_size_exception_silences_the_size_warning_and_status_shows_the_reason(self):
        self.g_run("note", "demo", "win", "fine")
        skill = self.unit / "SKILL.md"
        wide = "\n".join("word " * 60 for _ in range(100))
        base = SKILL.split("## Learning loop")[0] + wide + "\n\n" + self.footer()
        skill.write_text(base)
        self.assertRegex(self.g_run("check")[1], r"bytes \(> %d\)" % loop.SKILL_MAX_BYTES)
        skill.write_text(base.replace('description:', 'size-exception: one worked example per rule would be lost\ndescription:', 1))
        code, out = self.g_run("check")
        self.assertEqual(code, 0, out)
        self.assertNotIn("bytes (>", out)
        self.assertRegex(self.g_run("status", "demo")[1], r"size-exception: one worked example per rule would be lost")
        skill.write_text(base.replace('description:', 'size-exception:\ndescription:', 1))
        self.assertRegex(self.g_run("check")[1], r"bytes \(> %d\)" % loop.SKILL_MAX_BYTES)   # no reason, no exception

    # O3: wins are counted per section, so pruning can see which rules earned their place
    def test_status_counts_wins_by_section(self):
        self.g_run("note", "demo", "win", "§5 lint: caught a clipped label")
        self.g_run("note", "demo", "win", "§5 lint: flagged overlapping text before render", "--new")
        self.g_run("note", "demo", "win", "§2: the checklist order paid off", "--new")
        self.assertIn("wins: §5 lint (2), §2 (1)", self.g_run("status", "demo")[1])

    # O1: the blind A/B packet for a judged case
    def test_judge_writes_a_blind_packet_and_keeps_the_key_aside(self):
        (self.unit / "evals").mkdir()
        (self.unit / "evals/cases.md").write_text("# Judged cases: demo\n\n## Fixes the flag\n**Task:** Fix step 3.\n"
                                                 "**Good looks like:**\n- Names the right flag.\n**Origin:** O1.\n\n## Other\n**Task:** x\n")
        old, new = Path(self.tmp.name) / "old.md", Path(self.tmp.name) / "new.md"
        old.write_text("OUTPUT-OLD uses --wrong\n")
        new.write_text("OUTPUT-NEW uses --right\n")
        out_dir = Path(self.tmp.name) / "packet"
        code, out = self.g_run("judge", "demo", "flag", "--old", str(old), "--new", str(new), "--out", str(out_dir))
        self.assertEqual(code, 0, out)
        packet = (out_dir / "packet.md").read_text()
        for s in ("Fix step 3.", "Names the right flag.", "OUTPUT-OLD", "OUTPUT-NEW", "Output 1", "Output 2"):
            self.assertIn(s, packet)
        self.assertNotIn("old.md", packet)
        self.assertNotIn("new.md", packet)
        self.assertNotIn("**Task:** x", packet)
        key = (out_dir / "key.txt").read_text()
        first = "new" if packet.index("OUTPUT-NEW") < packet.index("OUTPUT-OLD") else "old"
        self.assertIn(f"Output 1 = {first}", key)
        self.assertNotEqual(self.g_run("judge", "demo", "nothing-like-this", "--old", str(old), "--new", str(new),
                                       "--out", str(out_dir))[0], 0)

    # grade 06: sort before copying
    def test_new_from_dry_run_and_exclude(self):
        src = Path(self.tmp.name) / "kit"
        (src / "lib").mkdir(parents=True)
        (src / "benchmark/before").mkdir(parents=True)
        (src / "SKILL.md").write_text('---\nname: kit\ndescription: "A kit."\n---\n\n# Kit\n')
        (src / "lib/a.py").write_text("A = 1\n")
        (src / "benchmark/before/fig1.svg").write_text("<svg/>\n")
        (src / "build_comparison.py").write_text("print(1)\n")
        args = ("new", "kit", "--description", "A kit. Use when testing.", "--category", "general", "--from", str(src))
        code, out = self.g_run(*args, "--dry-run")
        self.assertEqual(code, 0, out)
        self.assertIn("benchmark/before/fig1.svg", out)
        self.assertFalse((self.g / "plugins/kit").exists())
        self.assertNotIn('"kit"', (self.g / ".claude-plugin/marketplace.json").read_text())
        code, out = self.g_run(*args, "--exclude", "benchmark", "--exclude", "build_*.py")
        self.assertEqual(code, 0, out)
        unit = self.g / "plugins/kit/skills/kit"
        self.assertTrue((unit / "lib/a.py").is_file())
        self.assertFalse((unit / "benchmark").exists())
        self.assertFalse((unit / "build_comparison.py").exists())
        self.assertIn("excluded", out)


class HistoryCheckTest(unittest.TestCase):
    """Audit D15: `check --base` enforces 'graders and the graded don't change together' and append-only history, per commit."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.g = make_genome(Path(self.tmp.name) / "genome")
        self.cfg = Path(self.tmp.name) / "config"
        loop.CONFIG, loop.INBOX = self.cfg, self.cfg / "inbox.md"
        self.unit = self.g / "plugins/demo/skills/demo"
        (self.unit / "evals").mkdir()
        (self.unit / "evals/cases.md").write_text("# Judged cases: demo\n\n## One\n**Task:** do one.\n**Good looks like:**\n- one is done.\n")
        (self.unit / "LEARNINGS.md").write_text(loop.LEARNINGS_TEMPLATE.format(name="demo", what="skill")
                                                .replace("## Open\n", "## Open\n- O1 2026-01-01 [wish] a lesson (cc, x)\n"))
        for a in (("init", "-q", "-b", "main"), ("config", "user.email", "t@t"), ("config", "user.name", "t"),
                  ("add", "-A"), ("commit", "-qm", "base")):
            git_in(self.g, *a)
        git_in(self.g, "checkout", "-qb", "work")

    def tearDown(self):
        self.tmp.cleanup()

    def commit(self, msg):
        git_in(self.g, "add", "-A")
        git_in(self.g, "commit", "-qm", msg)

    def check(self):
        return run("--genome", str(self.g), "check", "--base", "main")

    def change_skill(self, text="A new rule."):
        (self.unit / "SKILL.md").write_text(SKILL + f"\n{text}\n")
        run("--genome", str(self.g), "bump", "demo", "minor", text)

    def test_editing_a_case_with_the_code_it_grades_is_an_error(self):
        cases = self.unit / "evals/cases.md"
        cases.write_text(cases.read_text().replace("- one is done.", "- one is roughly done."))
        self.change_skill()
        self.commit("rule and case together")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("evals/cases.md", out)
        self.assertIn("same commit", out)

    def test_separate_commits_and_added_cases_are_fine(self):
        cases = self.unit / "evals/cases.md"
        cases.write_text(cases.read_text().replace("- one is done.", "- one is roughly done."))
        self.commit("case edit alone")
        cases.write_text(cases.read_text() + "\n## Two\n**Task:** do two.\n")
        self.change_skill()
        self.commit("rule with a new case")
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_filling_new_placeholders_with_the_skill_is_fine(self):
        cases = self.unit / "evals/cases.md"
        cases.write_text(cases.read_text() + "\n## TODO(new): a typical task\n**Task:** TODO(new): what a user asks.\n")
        self.commit("placeholder")
        cases.write_text(cases.read_text().replace("## TODO(new): a typical task\n**Task:** TODO(new): what a user asks.\n",
                                                   "## Real\n**Task:** real.\n"))
        self.change_skill("The real skill.")
        self.commit("skill and cases")
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_deleted_learnings_and_changelog_entries_are_errors(self):
        lp = self.unit / "LEARNINGS.md"
        lp.write_text(lp.read_text().replace("- O1 2026-01-01 [wish] a lesson (cc, x)\n", ""))
        self.commit("drop O1")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("O1", out)
        git_in(self.g, "reset", "-q", "--hard", "main")
        run("--genome", str(self.g), "bump", "demo", "patch", "resolve it", "--obs", "O1")   # resolving moves, not deletes
        self.commit("resolve O1")
        code, out = self.check()
        self.assertEqual(code, 0, out)
        cp = self.unit / "CHANGELOG.md"
        cp.write_text(cp.read_text().replace("## 1.0.0 (2026-01-01)\n- First.\n", ""))
        self.commit("drop 1.0.0")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("1.0.0", out)


if __name__ == "__main__":
    unittest.main()


class HeldAndUsageTest(unittest.TestCase):
    """O27: fixes that did not hold (a resolved lesson that came back); O28: `usage` from Claude Code transcripts."""
    setUp, tearDown, g_run = PassTest.setUp, PassTest.tearDown, PassTest.g_run

    def held_fixture(self):
        head = loop.LEARNINGS_TEMPLATE.format(name="demo", what="skill").replace("## Open\n\n## Resolved\n", "")
        self.learn.write_text(head + "\n".join([
            "## Open",
            "- O5 2026-03-01 [failure] lint misses patches over labels [+2026-03-01 again; reopens O3] ×3",
            "",
            "## Resolved",
            "- O1 2026-01-01 [failure] lint misses patches over labels → 1.0.0",
            "- O2 2026-01-01 [friction] slow render on big figures → 1.0.0",
            "- O3 2026-02-01 [failure] lint misses patches over labels [+2026-02-01 seen again; reopens O1] ×2 → 1.1.0",
            "- O4 2026-02-01 [wish] a dark theme → rejected: owner preference",
        ]) + "\n")
        (self.unit / "CHANGELOG.md").write_text("# Changelog: demo\n\n## 1.1.0 (2026-02-02)\n- Second try: check text bboxes (O3)\n\n"
                                                "## 1.0.0 (2026-01-02)\n- First fix: patch check in the lint (O1, O2)\n")

    def test_status_lists_fixes_that_did_not_hold(self):
        self.held_fixture()
        code, out = self.g_run("status", "demo")
        self.assertEqual(code, 0, out)
        self.assertIn("fixes held 1/3", out)                     # O1, O2, O3 were fixes; O1 and O3 came back
        self.assertRegex(out, r"did not hold: O1 \(1\.0\.0\) came back as O3")
        self.assertRegex(out, r"did not hold: O3 \(1\.1\.0\) came back as O5")
        self.assertIn("fixes held 1/3", self.g_run("status")[1])  # the overview line carries the count too

    def test_show_follows_the_chain_of_earlier_fixes(self):
        self.held_fixture()
        code, out = self.g_run("show", "demo", "O5")
        self.assertEqual(code, 0, out)
        self.assertIn("reopens O3, whose fix in 1.1.0 did not hold", out)
        self.assertIn("Second try: check text bboxes", out)
        self.assertIn("reopens O1, whose fix in 1.0.0 did not hold", out)
        self.assertIn("First fix: patch check in the lint", out)
        self.assertIn("came back as O5", self.g_run("show", "demo", "O3")[1])   # a resolved reopener counts too

    def usage_fixture(self):
        (self.unit / "references").mkdir()
        for f in ("a.md", "b.md"):
            (self.unit / "references" / f).write_text("# ref\n")
        (self.unit / "scripts").mkdir()
        (self.unit / "scripts/tool.py").write_text('import argparse\np = argparse.ArgumentParser().add_subparsers()\n'
                                                   'p.add_parser("run")\np.add_parser("list")\n')
        tr = Path(self.tmp.name) / "transcripts" / "-proj"
        (tr / "s1" / "subagents").mkdir(parents=True)
        now = "2026-11-10T10:00:00.000Z"

        def use(name, inp, ts=now):
            return json.dumps({"type": "assistant", "timestamp": ts, "sessionId": "x", "message": {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t", "name": name, "input": inp}]}})
        (tr / "s1.jsonl").write_text("\n".join([
            use("Skill", {"skill": "demo:demo"}),
            use("Read", {"file_path": "/home/u/.claude/plugins/cache/t/demo/1.0.0/skills/demo/references/a.md"}),
            use("Bash", {"command": "cd /p && python3 /x/plugins/demo/skills/demo/scripts/tool.py run --fast | tail"}),
            "not json at all",
        ]) + "\n")
        (tr / "s1" / "subagents" / "agent-1.jsonl").write_text(use("Bash", {"command": "python3 tools/tool.py run"}) + "\n")
        (tr / "s2.jsonl").write_text("\n".join([
            json.dumps({"type": "user", "timestamp": now, "message": {"role": "user", "content":
                        "<command-message>demo</command-message>\n<command-name>/demo:demo</command-name>"}}),
            use("Read", {"file_path": "/g/plugins/demo/skills/demo/references/b.md"}, ts="2020-01-01T00:00:00.000Z"),
        ]) + "\n")
        return tr.parent

    def test_usage_counts_loads_files_and_subcommands(self):
        tr = self.usage_fixture()
        code, out = self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01")
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"demo: loaded in 2 session")                        # Skill tool and a slash command
        self.assertRegex(out, r"references/a\.md\s+1\b")
        self.assertRegex(out, r"never used.*references/b\.md")                     # its only read is before --since
        self.assertRegex(out, r"tool\.py run\s+2\b")                               # subagent transcripts count, any path
        self.assertRegex(out, r"never run.*tool\.py list")
        self.assertIn("not counted", out)                                          # says what it cannot see


class JudgeTwiceTest(unittest.TestCase):
    """Judged outputs vary from run to run (owner, 2026-11-17): judge takes repeated --old/--new, one packet per pair."""
    setUp, tearDown, g_run = PassTest.setUp, PassTest.tearDown, PassTest.g_run

    def test_two_runs_give_two_packets_and_one_run_is_flagged(self):
        (self.unit / "evals").mkdir()
        (self.unit / "evals/cases.md").write_text("# Judged cases: demo\n\n## Fixes the flag\n**Task:** Fix step 3.\n"
                                                 "**Good looks like:**\n- Names the right flag.\n**Origin:** O1.\n")
        files = {}
        for name in ("old1", "old2", "new1", "new2"):
            files[name] = Path(self.tmp.name) / f"{name}.md"
            files[name].write_text(f"OUTPUT-{name.upper()}\n")
        out_dir = Path(self.tmp.name) / "packets"
        code, out = self.g_run("judge", "demo", "flag", "--old", str(files["old1"]), "--old", str(files["old2"]),
                               "--new", str(files["new1"]), "--new", str(files["new2"]), "--out", str(out_dir))
        self.assertEqual(code, 0, out)
        p1, p2 = (out_dir / "packet-1.md").read_text(), (out_dir / "packet-2.md").read_text()
        self.assertIn("OUTPUT-OLD1", p1); self.assertIn("OUTPUT-NEW1", p1); self.assertNotIn("OUTPUT-OLD2", p1)
        self.assertIn("OUTPUT-OLD2", p2); self.assertIn("OUTPUT-NEW2", p2)
        self.assertTrue((out_dir / "key-1.txt").exists() and (out_dir / "key-2.txt").exists())
        self.assertNotEqual(self.g_run("judge", "demo", "flag", "--old", str(files["old1"]), "--new", str(files["new1"]),
                                       "--new", str(files["new2"]), "--out", str(out_dir))[0], 0)   # pairs must match
        code, out = self.g_run("judge", "demo", "flag", "--old", str(files["old1"]), "--new", str(files["new1"]),
                               "--out", str(Path(self.tmp.name) / "one"))
        self.assertEqual(code, 0, out)
        self.assertIn("one run", out)                                    # a single pair is allowed but flagged


class UsageBlindSpotsTest(unittest.TestCase):
    """usage blind spots (owner, 2026-11-17): deleted transcripts, shell variables set in an earlier command."""
    setUp, tearDown, g_run = PassTest.setUp, PassTest.tearDown, PassTest.g_run
    usage_fixture = HeldAndUsageTest.usage_fixture

    def test_counts_survive_a_deleted_transcript(self):
        tr = self.usage_fixture()
        self.assertEqual(self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01")[0], 0)
        for f in tr.rglob("*.jsonl"):
            f.unlink()                                                  # Claude Code's cleanup deleted them
        code, out = self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01")
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"demo: loaded in 2 session")
        self.assertRegex(out, r"tool\.py run\s+2\b")
        self.assertRegex(out, r"references/a\.md\s+1\b")

    def test_a_variable_set_in_an_earlier_command_names_the_script(self):
        tr = self.usage_fixture()

        def bash(cmd):
            return json.dumps({"type": "assistant", "timestamp": "2026-11-10T11:00:00.000Z", "message": {"role": "assistant",
                               "content": [{"type": "tool_use", "id": "t", "name": "Bash", "input": {"command": cmd}}]}})
        (tr / "-proj" / "s3.jsonl").write_text(bash("L=/x/plugins/demo/skills/demo/scripts/tool.py; echo set") + "\n"
                                                + bash('python3 "$L" list --all') + "\n")
        code, out = self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01")
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"tool\.py list\s+1\b")
        self.assertNotRegex(out, r"never run:.*tool\.py list")


def _varint(n: int) -> bytes:
    out = b""
    while True:
        b, n = n & 0x7F, n >> 7
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out


def _pb(*fields) -> bytes:
    """Protobuf wire bytes from (field number, int | bytes | str) pairs (varint or length-delimited)."""
    out = b""
    for num, v in fields:
        if isinstance(v, int):
            out += _varint(num << 3) + _varint(v)
        else:
            v = v.encode() if isinstance(v, str) else v
            out += _varint(num << 3 | 2) + _varint(len(v)) + v
    return out


class UsageOtherHarnessesTest(unittest.TestCase):
    """usage reads the helpers' own logs (owner, 2026-11-17): Codex, Copilot CLI, Kiro CLI and agy, tool calls only."""
    setUp, tearDown, g_run = PassTest.setUp, PassTest.tearDown, PassTest.g_run
    usage_fixture = HeldAndUsageTest.usage_fixture

    def test_each_cli_log_counts_loads_reads_and_runs(self):
        self.usage_fixture()                                            # the unit's references and scripts
        home = Path(self.tmp.name) / "home"
        ts = "2026-11-12T09:00:00.000Z"
        skill = "/r/plugins/demo/skills/demo"
        # Codex: JS source in a custom_tool_call; prose mentioning a path must not count
        cx = home / ".codex/sessions/2026/11/12"
        cx.mkdir(parents=True)
        js = ('const r = await Promise.allSettled([tools.exec_command({cmd:"sed -n 1,80p ' + skill + '/SKILL.md",workdir:"/p"}), '
              'tools.exec_command({cmd:"python3 ' + skill + '/scripts/tool.py run",workdir:"/p"})])')
        (cx / "rollout-2026-11-12T09-00-00-abc.jsonl").write_text("\n".join(json.dumps(r) for r in [
            {"timestamp": ts, "type": "session_meta", "payload": {"id": "cx1"}},
            {"timestamp": ts, "type": "response_item", "payload": {"type": "custom_tool_call", "name": "exec", "input": js}},
            {"timestamp": ts, "type": "response_item", "payload": {"type": "message", "role": "developer",
                                                                    "content": [{"type": "input_text", "text": skill + "/references/b.md"}]}},
        ]) + "\n")
        # Copilot CLI: tool.execution_start and skill.invoked
        cp = home / ".copilot/session-state/cp1"
        cp.mkdir(parents=True)
        (cp / "events.jsonl").write_text("\n".join(json.dumps(r) for r in [
            {"type": "skill.invoked", "timestamp": ts, "data": {"name": "demo", "path": "/h/.copilot/skills/demo/SKILL.md", "content": "..."}},
            {"type": "tool.execution_start", "timestamp": ts, "data": {"toolName": "view", "arguments": {"path": skill + "/references/a.md"}}},
            {"type": "tool.execution_complete", "timestamp": ts, "data": {"result": {"content": skill + "/references/b.md"}}},
        ]) + "\n")
        # Kiro CLI: tool_call records; disclose_context loads a skill
        kr = home / ".kiro/sessions/0123456789abcdef/sess_k1"
        kr.mkdir(parents=True)
        (kr / "messages.jsonl").write_text("\n".join(json.dumps(r) for r in [
            {"timestamp": ts, "payload": {"type": "tool_call", "toolName": "disclose_context", "args": {"name": "demo"}, "status": "completed"}},
            {"timestamp": ts, "payload": {"type": "tool_call", "toolName": "execute_bash", "args": {"command": "python3 tools/tool.py list"}}},
        ]) + "\n")
        # agy: SQLite steps with protobuf payloads; step 132 is a tool call, step 15 repeats it and must not count
        ag = home / ".gemini/antigravity-cli/conversations"
        ag.mkdir(parents=True)
        import sqlite3
        db = sqlite3.connect(ag / "c1.db")
        db.execute("create table steps(idx integer, step_type integer, status integer, metadata blob, step_payload blob, step_format integer)")
        call = _pb((1, 132), (5, _pb((1, _pb((1, 1794480000))), (4, _pb((1, "call_1"), (2, "read_file"),
                                                                          (3, json.dumps({"Path": skill + "/SKILL.md"})))))))
        run = _pb((1, 132), (5, _pb((1, _pb((1, 1794480000))), (4, _pb((1, "call_2"), (2, "run_command"),
                                                                         (3, json.dumps({"CommandLine": "python3 " + skill + "/scripts/tool.py run"})))))))
        echo = _pb((1, 15), (20, _pb((7, _pb((1, "run_command"), (2, json.dumps({"CommandLine": "python3 x/tool.py run"})))))))
        db.executemany("insert into steps values (?, ?, 0, x'', ?, 0)", [(1, 132, call), (2, 132, run), (3, 15, echo)])
        db.commit()
        db.close()
        code, out = self.g_run("usage", "demo", "--home", str(home), "--since", "2026-11-01")
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"demo: loaded in 4 sessions")                   # codex, copilot, kiro, agy
        for h in ("codex", "copilot", "kiro", "agy"):
            self.assertIn(h, out)
        self.assertRegex(out, r"references/a\.md\s+1\b")                       # copilot view
        self.assertRegex(out, r"never used:.*references/b\.md")                # prose and tool output do not count
        self.assertRegex(out, r"tool\.py run\s+2\b")                           # codex and agy, not agy's echo step
        self.assertRegex(out, r"tool\.py list\s+1\b")                          # kiro


class UsageGenomeWorkTest(unittest.TestCase):
    """Work on the genome itself (evals, audits, reflection) reads skill files without using the skill: left out
    of usage by default, counted with --all."""
    setUp, tearDown, g_run = PassTest.setUp, PassTest.tearDown, PassTest.g_run
    usage_fixture = HeldAndUsageTest.usage_fixture

    def test_sessions_working_in_the_genome_are_left_out(self):
        tr = self.usage_fixture()
        rec = {"type": "assistant", "timestamp": "2026-11-10T12:00:00.000Z", "cwd": str(self.g / "plugins"),
               "message": {"role": "assistant", "content": [{"type": "tool_use", "id": "t", "name": "Read",
                           "input": {"file_path": str(self.unit / "references/b.md")}}]}}
        (tr / "-genome" ).mkdir()
        (tr / "-genome" / "g1.jsonl").write_text(json.dumps(rec) + "\n")
        out = self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01")[1]
        self.assertRegex(out, r"never used:.*references/b\.md")
        self.assertRegex(out, r"1 session-day.*genome.*left out")
        out = self.g_run("usage", "demo", "--transcripts", str(tr), "--since", "2026-11-01", "--all")[1]
        self.assertRegex(out, r"references/b\.md\s+1\b")
