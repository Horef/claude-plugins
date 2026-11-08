#!/usr/bin/env python3
"""Scripted checks of research-assistant's ra.py: init, gates (order, stage checks, G2 selection and stop, G3 approvals
and drops, fingerprints), deviations, audits, status, and check on a filled folder and on planted faults. Includes every
bug of the first review (review-1.md): the G3 status written into the template comment, a section without a status
line, nested placeholders, hyphenated fields, re-gated drops, unsourced numbers hidden by one source, false positives
on L2/3, run counts and failed runs, unselected hypotheses, a design changed after approval, a missing audit.
Standard library only."""
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
RA = HERE.parent / "scripts" / "ra.py"
sys.path.insert(0, str(RA.parent))
import ra  # noqa: E402

FAILS: list[str] = []


def run(*a):
    return subprocess.run([sys.executable, str(RA), *map(str, a)], capture_output=True, text=True)


def want(cond, msg):
    if not cond:
        FAILS.append(msg)


QUESTION = ("# Is TC NMDA enough?\n\n- entry: project\n- question: Is TC NMDA enough?\n- type: mechanism\n"
            "- decision: close the open condition or not\n- claim type: confirmatory\n"
            "- cannot answer: the real ratio in vivo\n- budget: one day, 10 CPU-h\n- stop rules: the plan\n"
            "- literature: <docs/literature/<topic>/ once stage 2 runs>\n- write-up: docs/writeups/x/\n")

HYP = """# Hypotheses

## H1: NMDA at the TC synapses is strong enough (ratio about 1)
- source: L8, L26
- rejected if: orientation index below 0.3 at ratio 0.5
- analysis: A1
- claim: confirmatory

## H2: the cortico-cortical level (about 0.55) is enough
- source: L21
- rejected if: index below 0.3 at 0.55
- analysis: A1
- claim: confirmatory

## H3: no NMDA dependence (null)
- source: assumption: AMPA alone
- rejected if: index changes by more than 0.1 between 0.5 and 2
- analysis: A2
- claim: confirmatory
"""

A1 = """## A1: NMDA ratio sweep on the clustered cell
- status: proposed
- hypotheses: H1, H2
- data: draws a-c, design grating, held-out draw c for the final number only
- metric: gOSI at the preferred SF
- decision rule: H1 supported if gOSI >= 0.3 at ratio 1 and < 0.3 at 0.5
- negative control: scrambled placement, same afferents
- positive control: the simple control cell recovers its known gOSI
- variants: three draws; the answer is the spread
- seeds: 3 per draw
- cost: 6 CPU-h, 5 GB peak, 2 h wall, 50k tokens, 15 min person
- value: decides whether the write-up's open condition can close
- runs: <run ids, once run>
- results: <RESULTS section, once run>
"""
RULE = "H1 supported if gOSI >= 0.3 at ratio 1 and < 0.3 at 0.5"
GOOD = ("# Verdicts\n\n## A1: NMDA ratio sweep\n- rule: " + RULE + "\n"
        "- result: gOSI 0.52 at ratio 1 [outputs/mel_nmda_sweep_a/analysis.json:gosi]; 0.09 at 0.5 "
        "[outputs/mel_nmda_sweep_a/analysis.json:gosi_05] in L2/3\n"
        "- controls: scrambled 0.04 [RESULTS §55], simple control 0.71 [RESULTS §55]\n"
        "- variants: draws 0.48-0.61 [outputs/mel_nmda_sweep_a/analysis.json:draws]\n"
        "- analyses run: 9 (1 failed and rerun)\n"
        "- rival: H2 predicts the same at 1; not separated\n"
        "- verdict: supports H1\n")


def project(t):
    root = Path(t) / "proj"
    (root / "docs" / "literature" / "nmda").mkdir(parents=True)
    (root / "docs" / "RESULTS.md").write_text("# Results\n\n## 55. NMDA sweep\nbody\n\n### 8b. sub\n")
    (root / "docs" / "RUNS.md").write_text("| run | x |\n| mel_nmda_sweep_a | y |\n")
    return root, root / "docs" / "research" / "nmda"


def unit_checks():
    want(ra.empty("<docs/literature/<topic>/ once stage 2 runs>"), "nested placeholder counts as filled")
    with tempfile.TemporaryDirectory() as t:
        p = Path(t) / "q.md"
        p.write_text("- write-up: docs/w/\n")
        want(ra.fields_of(p).get("write-up") == "docs/w/", "hyphenated field dropped")
    want(ra.unsourced("gOSI 0.52 [a/b.json:g], rate 14.2 Hz") == ["14.2"], "one source hid an unsourced number")
    want(ra.unsourced("cells in L2/3 [a/b:c]") == [] and ra.unsourced("cells in L2/3") == [], "L2/3 read as a number")
    want(ra.unsourced("0.5 [TODO]") == ["0.5"], "[TODO] accepted as a source")


def tagged_checks() -> None:
    """0.2.0: a question tag prefixes every id (NB-H1), headings are short names, retag renames an existing folder."""
    with tempfile.TemporaryDirectory() as t:
        root, d = project(t)
        (root / "docs" / "other.md").write_text("Earlier work, see XY-H2 and the H3 wiring.\n")
        r = run("init", d, "--entry", "project", "--question", "Is TC NMDA enough?", "--tag", "XY")
        want(r.returncode == 1 and "already used in docs/other.md" in r.stdout and not (d / "plan.md").exists(),
             "init with a tag the project already uses was accepted:\n" + r.stdout)
        want(run("init", d, "--entry", "project", "--question", "x", "--tag", "H3").returncode == 1, "tag H3 accepted")
        r = run("init", d, "--entry", "project", "--question", "Is TC NMDA enough?", "--tag", "NB")
        want(r.returncode == 0 and ra.tag_of(d) == "NB" and "## NB-H1:" in (d / "hypotheses.md").read_text()
             and "Not taken forward" in (d / "hypotheses.md").read_text(), "tagged init: " + r.stdout)
        (d / "question.md").write_text(QUESTION.replace("- entry: project\n", "- entry: project\n- tag: NB\n")
                                       .replace("<docs/literature/<topic>/ once stage 2 runs>", "docs/literature/nmda/"))
        run("gate", d, "G1", "yes")
        hyp = HYP.replace("## H", "## NB-H").replace("- source:", "- statement: the claim\n- source:") \
                 .replace("analysis: A", "analysis: NB-A")
        (d / "hypotheses.md").write_text(hyp.replace("## NB-H3", "## H3"))
        out = run("check", d).stdout
        want("'## H3' lacks this question's tag" in out and "the heading is 11 words" in out,
             "untagged heading or long name not reported:\n" + out)
        (d / "hypotheses.md").write_text(hyp.replace("(ratio about 1)", "").replace(" at the TC synapses", ""))
        r = run("gate", d, "G2", "take H1 and H2", "--select", "H1,H2", "--drop", "H3")
        want(r.returncode == 0 and ra.selected(d) == {"NB-H1", "NB-H2"}, "bare ids at a tagged G2: " + r.stdout)
        want("(NB-H1 NMDA is strong enough;" in (d / "log.md").read_text(), "names missing from the gate log")
        st = run("status", d).stdout
        want("tag: NB" in st and "NB-H3 no NMDA dependence (null): dropped" in st, "status names:\n" + st)

    # retag an untagged folder: headings, id fields and log lines renamed, fingerprints kept, prose listed
    with tempfile.TemporaryDirectory() as t:
        root, d = project(t)
        run("init", d, "--entry", "project", "--question", "Is TC NMDA enough?")
        (d / "question.md").write_text(QUESTION.replace("<docs/literature/<topic>/ once stage 2 runs>",
                                                        "docs/literature/nmda/"))
        (d / "hypotheses.md").write_text(HYP + "\nThe H3 wiring is a model, not a hypothesis.\n")
        run("gate", d, "G1", "yes")
        run("gate", d, "G2", "go", "--select", "H1,H2", "--drop", "H3")
        (d / "plan.md").write_text((d / "plan.md").read_text() + "\n" + A1)
        run("gate", d, "G3", "run it", "--approve", "A1")
        r = run("retag", d, "NB")
        want(r.returncode == 0 and "hypotheses.md:" in r.stdout and " H3" in r.stdout, "retag: " + r.stdout)
        want(ra.selected(d) == {"NB-H1", "NB-H2"} and ra.approved(d) == {"NB-A1"}, "retag lost the gates")
        want("The H3 wiring" in (d / "hypotheses.md").read_text(), "retag renamed prose")
        out = run("check", d).stdout
        want("changed since gate 3" not in out and "lacks this question's tag" not in out, "after retag:\n" + out)
        want(run("retag", d, "NB").returncode == 1, "retag to the same tag accepted")
        want(run("deviation", d, "A1", "rerun a crashed draw").returncode == 0 and
             "deviation NB-A1 NB-A1=" in (d / "log.md").read_text(), "bare id at a tagged deviation")


def main() -> int:
    unit_checks()
    tagged_checks()
    with tempfile.TemporaryDirectory() as t:
        root, d = project(t)
        r = run("init", d, "--entry", "project", "--question", "Is TC NMDA enough?")
        want(r.returncode == 0 and (d / "plan.md").exists() and (d / "verify").is_dir(), "init: " + r.stdout + r.stderr)
        want(run("init", d, "--entry", "project", "--question", "x").returncode == 1, "init must not overwrite")
        want(run("init", Path(t) / "x", "--entry", "nonsense", "--question", "x").returncode == 1, "init: bad entry")
        want("question.md: 'decision' is not filled" in run("check", d).stdout, "unfilled frame not reported")

        # gate 1: order, words, and a complete frame
        want(run("gate", d, "G2", "go", "--select", "H1").returncode == 1, "G2 before G1 accepted")
        want(run("gate", d, "G1", "").returncode == 1, "gate without words accepted")
        r = run("gate", d, "G1", "yes")
        want(r.returncode == 1 and "not recorded" in r.stdout, "G1 on an unfilled frame accepted:\n" + r.stdout)
        (d / "question.md").write_text(QUESTION)
        want(run("gate", d, "G1", "yes, that is the decision").returncode == 0, "G1")

        # gate 2: literature filled, three complete hypotheses, a selection
        (d / "hypotheses.md").write_text(HYP.split("## H3")[0])
        r = run("gate", d, "G2", "take H1 and H2", "--select", "H1,H2")
        want(r.returncode == 1 and "'literature' is not filled" in r.stdout and "2 hypotheses" in r.stdout,
             "G2 without literature and three hypotheses accepted:\n" + r.stdout)
        (d / "question.md").write_text(QUESTION.replace("<docs/literature/<topic>/ once stage 2 runs>",
                                                        "docs/literature/nmda/"))
        (d / "hypotheses.md").write_text(HYP)
        want(run("gate", d, "G2", "go", "--approve", "A1").returncode == 1, "--approve at G2 accepted")
        want(run("gate", d, "G2", "go").returncode == 1, "G2 without --select or --stop accepted")
        r = run("gate", d, "G2", "take H1 and H2 forward", "--select", "H1,H2", "--drop", "H3")
        want(r.returncode == 0, "G2: " + r.stdout)
        want(ra.selected(d) == {"H1", "H2"}, f"selected: {ra.selected(d)}")

        # the plan keeps the template comment; G3 must edit the real section, not the comment
        plan0 = (d / "plan.md").read_text()
        (d / "plan.md").write_text(plan0 + "\n" + A1)
        out = run("check", d).stdout
        want(run("check", d).returncode == 0, "clean folder after G2 has problems (H3 unselected names A2):\n" + out)
        want(run("gate", d, "G3", "run A1", "--approve", "A9").returncode == 1, "G3 approving an unknown analysis")
        r = run("gate", d, "G3", "run A1 only", "--approve", "A1")
        want(r.returncode == 0, "G3: " + r.stdout)
        want(ra.sections(d / "plan.md", "A")["A1"]["fields"]["status"] == "approved",
             "G3 did not set the real section's status")
        want("- status: proposed" in (d / "plan.md").read_text().split("-->")[0], "G3 edited the template comment")

        # a design change after approval without a deviation
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("< 0.3 at 0.5", "< 0.25 at 0.5"))
        want("changed since gate 3 without a deviation" in run("check", d).stdout, "changed design not reported")
        want(run("deviation", d, "A1", "threshold 0.25 after the person's yes (Q1), before any outcome").returncode == 0,
             "deviation")
        want("changed since gate 3" not in run("check", d).stdout, "deviation did not re-fingerprint")
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("< 0.25 at 0.5", "< 0.3 at 0.5"))
        run("deviation", d, "A1", "back to 0.3 (the person changed their mind), before any outcome")

        # a missing control is reported; an unfilled analysis cannot be approved
        (d / "plan.md").write_text((d / "plan.md").read_text().replace(
            "- positive control: the simple control cell recovers its known gOSI\n", ""))
        want("plan.md A1: no 'positive control'" in run("check", d).stdout, "missing control not reported")
        (d / "plan.md").write_text((d / "plan.md").read_text().replace(
            "- negative control:", "- positive control: the simple control cell recovers its known gOSI\n"
            "- negative control:"))

        # done without runs or results, verdict or audit
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("status: approved", "status: done"))
        out = run("check", d).stdout
        want("done but no run ids" in out and "done but no RESULTS section" in out and "no section for A1" in out,
             "done analysis without evidence not reported:\n" + out)
        p = (d / "plan.md").read_text().replace("- runs: <run ids, once run>", "- runs: `mel_nmda_sweep_a` (3 seeds)")
        (d / "plan.md").write_text(p.replace("- results: <RESULTS section, once run>", "- results: RESULTS §55"))
        (d / "verdict.md").write_text(GOOD)
        out = run("check", d).stdout
        want("there is no audit" in out and sum(l.startswith("- ") for l in out.splitlines()) == 1, "missing audit not the only problem:\n" + out)
        want("6 audit" in run("status", d).stdout, "status does not show the audit stage")
        run("audit", d)
        want("verify/audit-1.md: 'checker' is not filled" in run("check", d).stdout, "unfilled audit not reported")
        (d / "verify" / "audit-1.md").write_text(
            "# Audit 1\n\n- checker: Gemini 4 Argon (agy)\n- inputs: plan.md, log.md, verdict.md, outputs/mel_nmda_sweep_a\n"
            "- numbers: all match\n- rules: verdict follows the rule\n- deviations: none beyond log.md\n"
            "- substitutions: none\n- selection: none\n- status: pass\n")
        out = run("check", d).stdout
        want(run("check", d).returncode == 0, "clean done analysis with audit has problems:\n" + out)
        want("7 write-up" in run("status", d).stdout, "status does not show the write-up stage")

        # verdict faults
        (d / "verdict.md").write_text(GOOD.replace("- rival: H2 predicts the same at 1; not separated\n", ""))
        want("verdict.md A1: no 'rival'" in run("check", d).stdout, "missing rival not reported")
        (d / "verdict.md").write_text(GOOD.replace(
            "[outputs/mel_nmda_sweep_a/analysis.json:gosi_05]", ""))
        want("numbers (0.09" in run("check", d).stdout, "unsourced number next to a sourced one not reported")
        (d / "verdict.md").write_text(GOOD.replace("ratio 1 and < 0.3", "ratio 1 and < 0.25"))
        want("the rule differs from plan.md" in run("check", d).stdout, "changed rule not reported")
        (d / "verdict.md").write_text(GOOD)

        # a failed analysis needs no sources for its error numbers
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("status: done", "status: failed"))
        (d / "verdict.md").write_text("# Verdicts\n\n## A1: sweep\n- rule: " + RULE + "\n- result: crashed twice with "
                                      "out of memory after 12 min (exit 137)\n- analyses run: 2\n- verdict: failed\n")
        out = run("check", d).stdout
        want(run("check", d).returncode == 0, "failed analysis with error numbers flagged:\n" + out)
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("status: failed", "status: done"))
        (d / "verdict.md").write_text(GOOD)

        # bad RESULTS section and unknown run
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("§55", "§56").replace("`mel_nmda_sweep_a`",
                                                                                            "other_run"))
        out = run("check", d).stdout
        want("RESULTS §56 is not in docs/RESULTS.md" in out and "run other_run is not in docs/RUNS.md" in out,
             "bad RESULTS section or run id not reported:\n" + out)
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("§56", "section 8b").replace("other_run",
                                                                                                   "mel_nmda_sweep_a"))
        out = run("check", d).stdout
        want("RESULTS" not in out and "not in docs/RUNS.md" not in out, "'section 8b' or the run not found:\n" + out)

        # re-gating G3 drops an approved analysis; deviations for unknown analyses refused; status
        want(run("deviation", d, "A7", "x").returncode == 1, "deviation for an unknown analysis accepted")
        st = run("status", d).stdout
        want("deviations: 2" in st and "G3" in st and "selected H1, H2" in st, "status:\n" + st)
        log = (d / "log.md").read_text()
        want(log.count(" G1: ") == 1 and "G3 approve A1 A1=" in log and '"run A1 only"' in log, "log:\n" + log)
        r = run("gate", d, "G3", "drop A1 after all", "--drop", "A1")
        want(r.returncode == 0 and ra.approved(d) == set(), f"re-gated drop: {r.stdout} {ra.approved(d)}")

    # a section without a status line must not overwrite the next one's
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "plan.md").write_text("# Plan\n\n## A1: first\n- hypotheses: H1\n\n## A2: second\n- status: proposed\n")
        ra.set_status(d, "A1", "approved")
        secs = ra.sections(d / "plan.md", "A")
        want(secs["A1"]["fields"].get("status") == "approved" and secs["A2"]["fields"]["status"] == "proposed",
             f"cross-section status edit: {secs}")

    # stop at gate 2
    with tempfile.TemporaryDirectory() as t:
        root, d = project(t)
        run("init", d, "--entry", "idea", "--question", "Is TC NMDA enough?")
        (d / "question.md").write_text(QUESTION.replace("<docs/literature/<topic>/ once stage 2 runs>",
                                                        "docs/literature/nmda/"))
        run("gate", d, "G1", "yes")
        r = run("gate", d, "G2", "the literature answered it", "--stop")
        want(r.returncode == 0 and "stopped at gate 2" in run("status", d).stdout, "G2 --stop: " + r.stdout)
        want(run("check", d).returncode == 0, "stopped folder has problems:\n" + run("check", d).stdout)
        want(run("gate", d, "G3", "x", "--approve", "A1").returncode == 1, "G3 after a stop accepted")

    for f in FAILS:
        print("FAIL", f)
    print("research-assistant evals: " + ("pass" if not FAILS else f"{len(FAILS)} failure(s)"))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
