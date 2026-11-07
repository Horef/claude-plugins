#!/usr/bin/env python3
"""Scripted checks of research-assistant: ra.py init, gate order, G3 approvals, deviations, status, and check on a
filled folder and on planted faults (too few hypotheses, missing controls, a run without approval, an unsourced number,
a changed decision rule, a done analysis without runs or a RESULTS section). Standard library only."""
import subprocess
import sys
import tempfile
from pathlib import Path

RA = Path(__file__).resolve().parent.parent / "scripts" / "ra.py"
FAILS: list[str] = []


def run(*a):
    return subprocess.run([sys.executable, str(RA), *map(str, a)], capture_output=True, text=True)


def want(cond, msg):
    if not cond:
        FAILS.append(msg)


HYP = """# Hypotheses

## H1: NMDA at the TC synapses is strong enough (ratio about 1)
- source: L8, L26
- rejected if: orientation index below 0.3 at ratio 0.5
- analysis: A1
- claim: confirmatory
- rank: decides the open condition

## H2: the cortico-cortical level (about 0.55) is enough
- source: L21
- rejected if: index below 0.3 at 0.55
- analysis: A1
- claim: confirmatory
- rank: second

## H3: no NMDA dependence (null)
- source: assumption: AMPA alone
- rejected if: index changes by more than 0.1 between 0.5 and 2
- analysis: A1
- claim: confirmatory
- rank: baseline
"""

PLAN = """# Plan

## A1: NMDA ratio sweep on the clustered cell
- status: proposed
- hypotheses: H1, H2, H3
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


def main() -> int:
    with tempfile.TemporaryDirectory() as t:
        root = Path(t) / "proj"
        (root / "docs").mkdir(parents=True)
        (root / "docs" / "RESULTS.md").write_text("# Results\n\n## 55. NMDA sweep\nbody\n")
        (root / "docs" / "RUNS.md").write_text("| run | x |\n| mel_nmda_sweep_a | y |\n")
        d = root / "docs" / "research" / "nmda"

        r = run("init", d, "--entry", "project", "--question", "Is TC NMDA enough?")
        want(r.returncode == 0 and (d / "plan.md").exists() and (d / "verify").is_dir(), "init: " + r.stdout + r.stderr)
        want(run("init", d, "--entry", "project", "--question", "x").returncode == 1, "init must not overwrite")
        want(run("init", Path(t) / "x", "--entry", "nonsense", "--question", "x").returncode == 1, "init: bad entry")

        # an unfilled frame is reported
        out = run("check", d).stdout
        want("question.md: 'decision' is not filled" in out, "unfilled frame not reported:\n" + out)

        # gates in order, with words
        want(run("gate", d, "G2", "go").returncode == 1, "G2 before G1 accepted")
        want(run("gate", d, "G1", "").returncode == 1, "gate without words accepted")
        (d / "question.md").write_text(
            "# Is TC NMDA enough?\n\n- entry: project\n- question: Is TC NMDA enough?\n- type: mechanism\n"
            "- decision: close the open condition or not\n- claim type: confirmatory\n"
            "- cannot answer: the real ratio in vivo\n- budget: one day, 10 CPU-h\n- stop rules: the plan\n")
        want(run("gate", d, "G1", "yes, that is the decision").returncode == 0, "G1")

        # too few hypotheses after gate 2
        (d / "hypotheses.md").write_text(HYP.split("## H3")[0])
        (d / "plan.md").write_text(PLAN)
        want(run("gate", d, "G2", "take H1 and H2 forward").returncode == 0, "G2")
        out = run("check", d).stdout
        want("2 hypotheses; write at least three" in out, "too few hypotheses not reported:\n" + out)
        (d / "hypotheses.md").write_text(HYP)
        out = run("check", d).stdout
        want(run("check", d).returncode == 0, "clean folder after G2 has problems:\n" + out)

        # a missing control is reported
        (d / "plan.md").write_text(PLAN.replace("- positive control: the simple control cell recovers its known gOSI\n",
                                                ""))
        want("plan.md A1: no 'positive control'" in run("check", d).stdout, "missing control not reported")
        (d / "plan.md").write_text(PLAN)

        # running without gate-3 approval
        (d / "plan.md").write_text(PLAN.replace("status: proposed", "status: running"))
        want("status running without a gate-3 approval" in run("check", d).stdout, "unapproved run not reported")
        (d / "plan.md").write_text(PLAN)
        want(run("gate", d, "G3", "run A1", "--approve", "A9").returncode == 1, "G3 approving an unknown analysis")
        r = run("gate", d, "G3", "run A1 only", "--approve", "A1")
        want(r.returncode == 0 and "status: approved" in (d / "plan.md").read_text(), "G3 approve: " + r.stdout)

        # done without runs or results; then with them
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("status: approved", "status: done"))
        out = run("check", d).stdout
        want("done but no run ids" in out and "done but no RESULTS section" in out and "no section for A1" in out,
             "done analysis without evidence not reported:\n" + out)
        p = (d / "plan.md").read_text().replace("- runs: <run ids, once run>", "- runs: mel_nmda_sweep_a")
        (d / "plan.md").write_text(p.replace("- results: <RESULTS section, once run>", "- results: RESULTS §55"))
        rule = "H1 supported if gOSI >= 0.3 at ratio 1 and < 0.3 at 0.5"
        good = ("# Verdicts\n\n## A1: NMDA ratio sweep\n- rule: " + rule + "\n"
                "- result: gOSI 0.52 at ratio 1 [outputs/mel_nmda_sweep_a/analysis.json:gosi]\n"
                "- verdict: supports H1\n")
        (d / "verdict.md").write_text(good)
        out = run("check", d).stdout
        want(run("check", d).returncode == 0, "clean done analysis has problems:\n" + out)

        # an unsourced number, a changed rule, a missing RESULTS section, an unknown run
        (d / "verdict.md").write_text(good.replace(" [outputs/mel_nmda_sweep_a/analysis.json:gosi]", ""))
        want("numbers (0.52" in run("check", d).stdout, "unsourced number not reported")
        (d / "verdict.md").write_text(good.replace("ratio 1 and < 0.3", "ratio 1 and < 0.25"))
        want("the rule differs from plan.md" in run("check", d).stdout, "changed rule not reported")
        (d / "verdict.md").write_text(good)
        (d / "plan.md").write_text((d / "plan.md").read_text().replace("§55", "§56").replace("mel_nmda_sweep_a",
                                                                                            "other_run"))
        out = run("check", d).stdout
        want("RESULTS §56 is not in docs/RESULTS.md" in out and "run other_run is not in docs/RUNS.md" in out,
             "bad RESULTS section or run id not reported:\n" + out)

        # deviations and status
        want(run("deviation", d, "A1", "draw c failed twice; reran with seed 4, before seeing any outcome").returncode
             == 0, "deviation")
        want(run("deviation", d, "A7", "x").returncode == 1, "deviation for an unknown analysis accepted")
        st = run("status", d).stdout
        want("deviations: 1" in st and "G3" in st and "done A1" in st, "status:\n" + st)
        log = (d / "log.md").read_text()
        want(log.count(" G1: ") == 1 and "G3 approve A1" in log and '"run A1 only"' in log, "log:\n" + log)

    for f in FAILS:
        print("FAIL", f)
    print("research-assistant evals: " + ("pass" if not FAILS else f"{len(FAILS)} failure(s)"))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
