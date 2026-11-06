#!/usr/bin/env python3
"""Tests for scripts/runq.py. Tiny child jobs (<= ~100 MB each) in a temp dir; exits non-zero on any failure.

Run: python3 evals/run.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNQ = HERE.parent / "scripts" / "runq.py"
PY = sys.executable

WORKER = r'''
import subprocess, sys, time
mb, secs = int(sys.argv[1]), float(sys.argv[2])
args = sys.argv[3:]
def hold(mb):
    b = bytearray(mb * 2**20)
    for i in range(0, len(b), 4096):
        b[i] = 1
    return b
if "--child" in args:
    cm = args[args.index("--child") + 1]
    subprocess.Popen([sys.executable, __file__, cm, str(secs)])
b = hold(mb)
time.sleep(secs)
if "--fail" in args:
    sys.exit(3)
if "--touch" in args:
    open(args[args.index("--touch") + 1], "w").write("ok")
if "--spawn-job" in args:   # write a follow-up job file into $RUNQ_DIR/jobs
    import json, os
    d = os.environ["RUNQ_DIR"]
    json.dump({"name": "follow", "cmd": [sys.executable, __file__, "5", "0.2"]}, open(d + "/jobs/follow.json", "w"))
    time.sleep(0.5)
'''


def runq(*args, **kw):
    return subprocess.run([PY, str(RUNQ), *map(str, args)], capture_output=True, text=True, **kw)


class Q:
    """A queue in a fresh temp dir with helpers."""

    def __init__(self, tmp: Path, name: str, budget=1.0, kill=5.0, maxpar=4):
        self.dir = tmp / name
        self.work = tmp / (name + "_work")
        self.work.mkdir()
        r = runq("init", self.dir, "--budget", budget, "--kill", kill, "--max-parallel", maxpar)
        assert r.returncode == 0, r.stderr
        self.worker = tmp / "worker.py"

    def add(self, name, mb, secs, extra="", **kw):
        cmd = f"{PY} {self.worker} {mb} {secs} {extra}"
        args = ["add", self.dir, "--name", name, "--cmd", cmd, "--cwd", self.work]
        for k, v in kw.items():
            for x in (v if isinstance(v, list) else [v]):
                args += [f"--{k.replace('_', '-')}", x]
        r = runq(*args)
        assert r.returncode == 0, r.stderr

    def run(self, timeout=60):
        r = runq("run", self.dir, "--sample-s", 0.3, timeout=timeout)
        assert r.returncode == 0, r.stderr + r.stdout
        return self.lines()

    def popen(self):
        return subprocess.Popen([PY, str(RUNQ), "run", str(self.dir), "--sample-s", "0.3"],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def lines(self):
        p = self.dir / "queue.log"
        return p.read_text().splitlines() if p.exists() else []

    def state(self):
        return json.loads((self.dir / "state.json").read_text())

    def wait_for(self, pred, timeout=30):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if pred():
                return True
            time.sleep(0.1)
        raise AssertionError("timed out waiting")


def idx(lines, needle):
    for i, ln in enumerate(lines):
        if needle in ln:
            return i
    raise AssertionError(f"{needle!r} not in log:\n" + "\n".join(lines))


def count(lines, needle):
    if needle == "START":  # job starts only, not the "QUEUE START" line of each driver run
        return sum(ln[20:].startswith("START ") for ln in lines)
    return sum(needle in ln for ln in lines)


# ------------------------------------------------------------------ tests
def test_tree_measurement(tmp):
    (tmp / "worker.py").write_text(WORKER)
    r = runq("measure", "--", PY, tmp / "worker.py", "100", "2.5", "--child", "100")
    assert r.returncode == 0, r.stderr
    gb = float(r.stdout.split("peak private")[1].split()[0])
    assert gb >= 0.17, f"grandchild not counted: {r.stdout}"  # 2 x 100 MB = 0.195 GiB
    assert gb < 0.6, r.stdout
    p = subprocess.Popen([PY, tmp / "worker.py", "100", "3", "--child", "100"])
    time.sleep(1.5)
    r = runq("measure", "--pid", p.pid)
    p.wait()
    assert float(r.stdout.split()[0]) >= 0.17, r.stdout


def test_admission_budget(tmp):
    serial = Q(tmp, "serial", budget=0.5)
    serial.add("a", 60, 1.5, est_gb=0.3)
    serial.add("b", 60, 1.5, est_gb=0.3)
    L = serial.run()
    assert idx(L, "END a") < idx(L, "START b"), "budget 0.5 must run two 0.3 GB jobs serially"
    par = Q(tmp, "par", budget=1.0)
    par.add("a", 60, 1.5, est_gb=0.3)
    par.add("b", 60, 1.5, est_gb=0.3)
    L = par.run()
    assert idx(L, "START b") < idx(L, "END a"), "budget 1.0 must run them in parallel"
    # max_parallel
    mp = Q(tmp, "maxpar", budget=5.0, maxpar=1)
    mp.add("a", 20, 1.0, est_gb=0.1)
    mp.add("b", 20, 1.0, est_gb=0.1)
    L = mp.run()
    assert idx(L, "END a") < idx(L, "START b")


def test_est_override_and_peak(tmp):
    q = Q(tmp, "ovr", budget=0.5)
    q.add("a", 60, 1.5, est_gb=0.3, kind="k")
    q.add("b", 60, 1.5, est_gb=0.3, kind="k")
    assert runq("set", q.dir, 'est_gb={"k":0.1}').returncode == 0
    L = q.run()
    assert idx(L, "START b") < idx(L, "END a"), "override 0.1 must admit both"
    # a measured peak raises a too-low declared estimate (declared 0.05, real ~0.1): b and c then run serially
    q2 = Q(tmp, "peak", budget=0.15)
    q2.add("a", 100, 1.5, est_gb=0.05, kind="k")
    q2.add("b", 100, 1.0, est_gb=0.05, kind="k", after="a")
    q2.add("c", 100, 1.0, est_gb=0.05, kind="k", after="a")
    L = q2.run()
    peak = q2.state()["kind_peaks"]["k"]
    assert 0.09 < peak < 0.2, peak
    assert idx(L, "END b") < idx(L, "START c"), f"measured peak {peak} should have raised the estimate"
    # a finished job's peak replaces a too-high declared estimate (declared 0.4, real ~0.05): b and c then run together
    q3 = Q(tmp, "lower", budget=0.5)
    q3.add("a", 40, 1.0, est_gb=0.4, kind="k")
    q3.add("b", 40, 1.5, est_gb=0.4, kind="k", after="a")
    q3.add("c", 40, 1.5, est_gb=0.4, kind="k", after="a")
    L = q3.run()
    done = q3.state()["done_peaks"]["k"]
    assert done < 0.2, done
    assert idx(L, "START c") < idx(L, "END b") and idx(L, "START b") < idx(L, "END c"), \
        f"finished peak {done} should have lowered the declared 0.4 so b and c run together"


def test_kill_requeue(tmp):
    q = Q(tmp, "kill", budget=5.0, kill=0.15)
    q.add("a", 100, 4.0, prio=1)
    q.add("b", 100, 2.0, prio=2)
    L = q.run()
    assert count(L, "KILL b") == 1, "\n".join(L)
    assert "attempt 2" in L[idx(L, "START b attempt 2")]
    assert idx(L, "END a") < idx(L, "START b attempt 2"), "requeued job waits for the others"
    s = q.state()["jobs"]
    assert s["a"]["status"] == "done" and s["b"]["status"] == "done" and s["b"]["attempt"] == 2 and s["b"]["fails"] == 0


def test_after_and_blocked(tmp):
    q = Q(tmp, "after", budget=5.0)
    q.add("fail", 5, 0.2, "--fail")
    q.add("dep", 5, 0.2, after="fail")
    q.add("dep2", 5, 0.2, after="dep")
    q.add("first", 5, 0.5, prio=60)
    q.add("second", 5, 0.2, prio=1, after="first")
    L = q.run()
    assert idx(L, "BLOCKED dep ") and idx(L, "BLOCKED dep2")
    assert count(L, "START dep") == 0
    assert idx(L, "END first") < idx(L, "START second"), "after must beat priority"
    s = q.state()["jobs"]
    assert (s["fail"]["status"], s["dep"]["status"], s["dep2"]["status"], s["second"]["status"]) == \
        ("failed", "blocked", "blocked", "done")
    # retries
    q = Q(tmp, "retry", budget=5.0)
    q.add("r", 5, 0.2, "--fail", retries=1)
    L = q.run()
    assert count(L, "START r") == 2 and count(L, "RETRY r") == 1 and q.state()["jobs"]["r"]["status"] == "failed"


def test_restart_skips_done(tmp):
    q = Q(tmp, "restart", budget=5.0)
    q.add("a", 5, 0.3, f"--touch {q.work}/a.out", done="a.out")
    q.add("b", 5, 0.3)
    L = q.run()
    assert count(L, "START a") == 1 and count(L, "START b") == 1
    n0 = len(L)
    L = q.run()
    assert count(L, "START") == 2, "second run must start nothing new"
    # state lost: the done glob alone makes a done; b (no done paths) reruns
    (q.dir / "state.json").unlink()
    L = q.run()
    assert count(L, "START a") == 1 and count(L, "START b") == 2 and count(L, "DONE (earlier) a") == 1 and len(L) > n0
    # orphan: state says running with a dead pid -> restarted as attempt 2
    st = q.state()
    st["jobs"]["b"].update(status="running", pid=999999)
    (q.dir / "state.json").write_text(json.dumps(st))
    L = q.run()
    assert "attempt 2" in L[idx(L, "ORPHAN b")] or count(L, "START b attempt 2") >= 1
    assert q.state()["jobs"]["b"]["status"] == "done"
    # outputs never deleted
    assert (q.work / "a.out").exists()


def test_dynamic_job(tmp):
    q = Q(tmp, "dyn", budget=5.0)
    q.add("seed", 5, 0.5, "--spawn-job")
    L = q.run()
    assert idx(L, "START follow") and q.state()["jobs"]["follow"]["status"] == "done", "\n".join(L)


def test_stop_and_pause(tmp):
    q = Q(tmp, "stop", budget=5.0, maxpar=1)
    q.add("long", 5, 3.0, prio=1)
    q.add("later", 5, 0.2, prio=2)
    p = q.popen()
    q.wait_for(lambda: "START long" in "\n".join(q.lines()))
    assert runq("stop", q.dir).returncode == 0
    p.wait(timeout=30)
    L = q.lines()
    assert count(L, "START later") == 0 and count(L, "STOP requested") == 1 and "QUEUE STOP" in L[-1]
    assert q.state()["jobs"]["later"]["status"] == "pending"
    assert not (q.dir / "driver.pid").exists()
    # pause: nothing starts, the driver stays alive; resume lets it finish
    q = Q(tmp, "pause", budget=5.0)
    runq("set", q.dir, "pause=true")
    q.add("x", 5, 0.2)
    p = q.popen()
    time.sleep(1.5)
    assert p.poll() is None and count(q.lines(), "START") == 0
    runq("set", q.dir, "pause=null")
    p.wait(timeout=30)
    assert q.state()["jobs"]["x"]["status"] == "done"
    # skip
    q = Q(tmp, "skip", budget=5.0)
    q.add("keep", 5, 0.2)
    q.add("skip_me", 5, 0.2)
    runq("set", q.dir, 'skip=["skip_"]')
    L = q.run()
    assert count(L, "START skip_me") == 0 and count(L, "START keep") == 1


def test_status_plan(tmp):
    q = Q(tmp, "plan", budget=0.5)
    q.add("a", 5, 0.2, est_gb=0.3, prio=1)
    q.add("b", 5, 0.2, est_gb=0.3, prio=2)
    q.add("c", 5, 0.2, est_gb=0.1, prio=3)
    q.add("d", 5, 0.2, after="a", prio=4)
    r = runq("plan", q.dir)
    assert r.returncode == 0, r.stderr
    out = r.stdout
    assert "start" in out.split("a ")[1].splitlines()[0]
    assert "wait: 0.30 + 0.30" in out and "after ['a']" in out
    r = runq("status", q.dir)
    assert r.returncode == 0 and "not running" in r.stdout and "pending" in r.stdout
    assert runq("status", tmp / "nonexistent").returncode == 1


def test_start_detaches(tmp):
    q = Q(tmp, "detach", budget=5.0)
    q.add("slow", 5, 4.0)
    r = subprocess.run(f"{PY} {RUNQ} start {q.dir}", shell=True, capture_output=True, text=True)  # shell exits after
    assert r.returncode == 0, r.stderr
    pid = int(r.stdout.split()[0])
    time.sleep(0.3)
    os.kill(pid, 0)  # survives the starter
    assert os.getpgid(pid) == pid, "driver must lead its own session"
    r2 = runq("start", q.dir)
    assert r2.returncode == 1 and "already running" in r2.stderr
    assert "driver: alive" in runq("status", q.dir).stdout
    q.wait_for(lambda: "START slow" in "\n".join(q.lines()))
    runq("stop", q.dir)
    q.wait_for(lambda: not (q.dir / "driver.pid").exists(), 30)
    q.wait_for(lambda: subprocess.run(["ps", "-p", str(pid)], capture_output=True).returncode != 0, 5)
    assert q.state()["jobs"]["slow"]["status"] == "done"


def test_wait(tmp):
    q = Q(tmp, "wait", budget=5.0)
    q.add("a", 5, 2.0)
    q.add("b", 5, 0.2, extra="--fail")
    # no driver: summary at once, b never ran -> not all done
    r = runq("wait", q.dir, "--timeout", 5)
    assert r.returncode == 3 and "driver: not running" in r.stdout, (r.returncode, r.stdout, r.stderr)
    r = subprocess.run([PY, str(RUNQ), "start", str(q.dir), "--sample-s", "0.3"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    r = runq("wait", q.dir, "--timeout", 0.5)  # driver still busy with a
    assert r.returncode == 4 and "timeout" in r.stderr, (r.returncode, r.stderr)
    r = runq("wait", q.dir, "--timeout", 60)  # driver ends; b failed
    assert r.returncode == 3 and "a " in r.stdout and "failed" in r.stdout, (r.returncode, r.stdout)
    # all ok
    q2 = Q(tmp, "wait_ok", budget=5.0)
    q2.add("ok", 5, 0.5)
    runq("start", q2.dir, "--sample-s", 0.3)
    r = runq("wait", q2.dir, "--timeout", 60)
    assert r.returncode == 0 and "done" in r.stdout, (r.returncode, r.stdout, r.stderr)


TESTS = [test_tree_measurement, test_admission_budget, test_est_override_and_peak, test_kill_requeue,
         test_after_and_blocked, test_restart_skips_done, test_dynamic_job, test_stop_and_pause, test_status_plan,
         test_start_detaches, test_wait]


def main() -> int:
    only = sys.argv[1:]
    failed = 0
    t00 = time.time()
    with tempfile.TemporaryDirectory(prefix="runq_eval_") as t:
        tmp = Path(t)
        (tmp / "worker.py").write_text(WORKER)
        for fn in TESTS:
            if only and fn.__name__ not in only:
                continue
            t0 = time.time()
            try:
                fn(tmp)
                print(f"PASS {fn.__name__} ({time.time() - t0:.1f} s)")
            except Exception:  # noqa: BLE001
                failed += 1
                print(f"FAIL {fn.__name__}\n{traceback.format_exc()}")
    print(f"{len(TESTS) - failed if not only else '-'} passed, {failed} failed in {time.time() - t00:.0f} s")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
