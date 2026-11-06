#!/usr/bin/env python3
"""runq.py: a small local job queue that admits jobs under a private-memory budget (macOS and Linux, stdlib only).

A queue lives in one directory QDIR:
  jobs/*.json      job definitions (one job or a list per file), re-read every loop, so a job can add follow-ups
  overrides.json   live control, re-read every loop (budget_gb, kill_gb, max_parallel, sample_s, est_gb {kind: gb},
                   priority {name: n}, skip [name prefixes], stop, pause)
  state.json       driver state (atomic writes); queue.log; logs/<name>.<attempt>.log; driver.pid; driver.out

Job fields: name (unique, [A-Za-z0-9._-]), cmd (list, or string run by /bin/sh -c), cwd (relative paths are taken
against the jobs file's directory; `add` stores the caller's cwd), kind (default "default"), est_gb (default 1.0),
prio (default 50, lower first), after [names], done [paths or globs relative to cwd], env {k: v}, retries (default 0).
Each job gets RUNQ_DIR and RUNQ_JOB in its environment (a job writes follow-ups to $RUNQ_DIR/jobs/<x>.json).

Memory is the PRIVATE footprint of the whole process tree (the job and every descendant): macOS `footprint`
(phys_footprint), Linux the sum of Pss from /proc/<pid>/smaps_rollup (fallback Private_Clean+Private_Dirty from
smaps). Never RSS, which counts shared pages. GB here means GiB (2**30 bytes).

Policy:
- Estimate of a job = overrides.json est_gb[kind] if set (it may lower), else the larger of its declared est_gb and
  the largest peak measured for its kind in this queue's history (state.json): measured peaks only raise it. Set the
  override from the peaks of real runs of the same kind (`measure`), not from a smoke run with other settings.
- Admission by estimate: start a job only if sum(max(estimate, measured now) of running jobs) + its estimate <= budget
  and running < max_parallel. Lower prio number first; a job that does not fit is skipped and a later (lower
  priority) job that fits may start (first fit). Trade-off: a large job can starve while small ones keep coming;
  use `pause`/`priority`/`max_parallel` to drain. A job alone always starts (above budget it is logged).
- Protection by measurement: measured total > kill_gb with more than one job running -> SIGTERM the newest job's
  process group (SIGKILL after 60 s), requeue it (attempt+1, not counted as a failure) and hold it until the jobs
  that were running have ended. A single job above kill_gb is only logged.
- Restart-safe: a job is done when all its `done` paths exist, or (no `done`) when it ended with exit 0. On start,
  done jobs are skipped, orphaned running jobs are restarted (attempt+1), failed/blocked ones get a fresh try.
  The driver refuses to start while a job of a previous driver is still alive. Outputs are never deleted.
- Stopping the driver (SIGTERM) leaves running jobs alone (own process groups); use `stop` for a clean drain.

Exit codes: 0 ok, 1 usage/state error, 2 a needed system tool missing (e.g. `footprint` on macOS).
`wait` adds: 3 the driver is gone but not every job is done (failed, blocked or never run), 4 --timeout reached.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

GIB = 2**30
DEFAULT_BUDGET_GB, DEFAULT_MAX_PARALLEL, DEFAULT_SAMPLE_S = 8.0, 4, 10.0
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
TERMINAL = ("done", "failed", "blocked")


class UsageError(Exception):
    """Bad usage or inconsistent queue state (exit 1)."""


class ToolMissing(Exception):
    """A needed system tool is absent or unusable (exit 2)."""


# ------------------------------------------------------------------ memory measurement
def process_table() -> dict[int, int]:
    out = subprocess.run(["ps", "-Ao", "pid=,ppid="], capture_output=True, text=True).stdout
    parent = {}
    for line in out.splitlines():
        f = line.split()
        if len(f) == 2 and f[0].isdigit() and f[1].isdigit():
            parent[int(f[0])] = int(f[1])
    return parent


def tree_pids(roots: list[int], parent: dict[int, int] | None = None) -> dict[int, list[int]]:
    """{root: [root and all its descendants]} (empty list for a root that no longer exists)."""
    parent = process_table() if parent is None else parent
    kids = defaultdict(list)
    for p, pp in parent.items():
        kids[pp].append(p)
    res = {}
    for r in roots:
        if r not in parent:
            res[r] = []
            continue
        seen, stack = {r}, [r]
        while stack:
            for c in kids.get(stack.pop(), []):
                if c not in seen:
                    seen.add(c)
                    stack.append(c)
        res[r] = sorted(seen)
    return res


_UNITS = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}


def _private_bytes_macos(pids: list[int]) -> dict[int, int]:
    if not pids:
        return {}
    args = ["footprint", "-f", "bytes", "--noCategories"]
    for p in pids:
        args += ["--pid", str(p)]
    txt = subprocess.run(args, capture_output=True, text=True).stdout
    res = {}
    for line in txt.splitlines():
        if "Footprint:" not in line:
            continue
        head, tail = line.split("Footprint:", 1)
        ids = re.findall(r"\[(\d+)\]", head)
        tok = tail.split()
        if ids and len(tok) >= 2 and tok[0].isdigit() and tok[1] in _UNITS:
            res[int(ids[-1])] = int(tok[0]) * _UNITS[tok[1]]
    return res


def _private_bytes_linux(pids: list[int]) -> dict[int, int]:
    res = {}
    for p in pids:
        try:
            try:
                txt = Path(f"/proc/{p}/smaps_rollup").read_text()
                kb = sum(int(m.group(1)) for m in re.finditer(r"^Pss:\s+(\d+) kB", txt, re.M))
            except OSError:
                if not Path(f"/proc/{p}").exists():
                    continue
                txt = Path(f"/proc/{p}/smaps").read_text()  # older kernels
                kb = sum(int(m.group(2)) for m in re.finditer(r"^(Private_Clean|Private_Dirty):\s+(\d+) kB", txt, re.M))
            res[p] = kb * 1024
        except OSError:
            continue  # exited meanwhile, or not readable
    return res


def private_bytes(pids: list[int]) -> dict[int, int]:
    return _private_bytes_linux(pids) if sys.platform.startswith("linux") else _private_bytes_macos(pids)


def check_measurement() -> None:
    """Raise ToolMissing unless private memory of this very process can be read."""
    if not sys.platform.startswith("linux") and shutil.which("footprint") is None:
        raise ToolMissing("`footprint` not found (macOS ships it as /usr/bin/footprint); without it the private "
                          "memory of a process tree cannot be measured (RSS would be 1.5-2x too high, not used).")
    if private_bytes([os.getpid()]).get(os.getpid(), 0) <= 0:
        raise ToolMissing("cannot read private memory of this process (footprint output unparsable, or "
                          "/proc/<pid>/smaps_rollup and smaps unreadable)")


def tree_bytes(roots: list[int]) -> dict[int, int]:
    """{root: private bytes summed over the root and all its descendants}, one measurement call for all roots."""
    trees = tree_pids(roots)
    allp = sorted({p for v in trees.values() for p in v})
    per = private_bytes(allp)
    return {r: sum(per.get(p, 0) for p in v) for r, v in trees.items()}


# ------------------------------------------------------------------ files
def atomic_write(path: Path, text: str) -> None:
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    r = subprocess.run(["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True).stdout.strip()
    return bool(r) and not r.startswith("Z")


def driver_pid(qdir: Path) -> int | None:
    """Pid of a live driver for qdir, else None."""
    try:
        pid = int((qdir / "driver.pid").read_text().strip())
    except (OSError, ValueError):
        return None
    if not pid_alive(pid):
        return None
    cmd = subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True).stdout
    return pid if "runq" in cmd else None


def normalize_job(raw: dict, base: Path, src: str) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("job is not an object")
    name = raw.get("name")
    if not isinstance(name, str) or not NAME_RE.match(name):
        raise ValueError(f"bad or missing name {name!r} (use letters, digits, . _ -)")
    cmd = raw.get("cmd")
    if isinstance(cmd, str) and cmd.strip():
        cmd = ["/bin/sh", "-c", cmd]
    elif isinstance(cmd, list) and cmd and all(isinstance(x, (str, int, float)) for x in cmd):
        cmd = [str(x) for x in cmd]
    else:
        raise ValueError("cmd must be a non-empty list or string")

    def as_list(v):
        if v is None:
            return []
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return [str(x) for x in v]

    cwd = Path(os.path.expanduser(str(raw.get("cwd") or base)))
    if not cwd.is_absolute():
        cwd = base / cwd
    env = raw.get("env") or {}
    if not isinstance(env, dict):
        raise ValueError("env must be an object")
    return {
        "name": name, "cmd": cmd, "cwd": str(cwd), "kind": str(raw.get("kind") or "default"),
        "est_gb": float(raw.get("est_gb", 1.0)), "prio": int(raw.get("prio", 50)),
        "after": as_list(raw.get("after")), "done": as_list(raw.get("done")),
        "env": {str(k): str(v) for k, v in env.items()}, "retries": int(raw.get("retries", 0)), "_src": src,
    }


def load_defs(qdir: Path) -> tuple[dict[str, dict], list[str]]:
    """({name: job}, problems) from jobs/*.json in file-name order; the first definition of a name wins."""
    defs, problems = {}, []
    jdir = qdir / "jobs"
    for f in sorted(jdir.glob("*.json")) if jdir.is_dir() else []:
        try:
            data = json.loads(f.read_text())
        except (OSError, ValueError) as e:
            problems.append(f"{f.name}: unreadable ({e})")
            continue
        for raw in data if isinstance(data, list) else [data]:
            try:
                j = normalize_job(raw, f.parent, f.name)
            except (ValueError, TypeError) as e:
                problems.append(f"{f.name}: {e}")
                continue
            if j["name"] in defs:
                problems.append(f"{f.name}: duplicate job name {j['name']} (kept the one in {defs[j['name']]['_src']})")
                continue
            defs[j["name"]] = j
    return defs, problems


def done_satisfied(d: dict) -> bool:
    return bool(d["done"]) and all(glob.glob(os.path.join(d["cwd"], os.path.expanduser(p))) for p in d["done"])


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def est_of(ov: dict, kind_peaks: dict, done_peaks: dict, d: dict) -> float:
    """A job's memory estimate. An override for its kind wins (and may lower it). Otherwise the base is the declared
    est_gb until a job of the kind has finished cleanly, then that kind's largest finished peak plus 10% (so a declared
    estimate that came out too high comes down by itself: a smoke run that saved extra data once declared 8 GB for runs
    that peaked at 3.7 GB). Any peak measured in this queue, finished or still running, only raises it; a running job's
    ramp-up samples never lower it."""
    o = ov.get("est_gb") or {}
    if d["kind"] in o:
        return float(o[d["kind"]])
    base = round(done_peaks[d["kind"]] * 1.1, 3) if d["kind"] in done_peaks else d["est_gb"]
    return max(base, float(kind_peaks.get(d["kind"], 0.0)))


def settings(ov: dict) -> tuple[float, float, int, float]:
    budget = float(ov.get("budget_gb", DEFAULT_BUDGET_GB))
    kill = float(ov.get("kill_gb", budget * 1.2))
    return budget, kill, int(ov.get("max_parallel", DEFAULT_MAX_PARALLEL)), max(0.05, float(ov.get("sample_s", DEFAULT_SAMPLE_S)))


def admit(cands: list[tuple[str, float]], running: list[float], budget: float, maxpar: int) -> dict[str, str]:
    """cands = [(name, est)] in priority order; running = estimates of running jobs. {name: 'start' | reason}."""
    res, used, n = {}, sum(running), len(running)
    for name, e in cands:
        if n >= maxpar:
            res[name] = f"wait: max_parallel {maxpar}"
        elif n and used + e > budget:
            res[name] = f"wait: {used:.2f} + {e:.2f} GB > budget {budget:.2f} GB"
        else:
            res[name] = "start" + (f" (alone, est {e:.2f} GB above budget {budget:.2f} GB)" if not n and e > budget else "")
            used += e
            n += 1
    return res


# ------------------------------------------------------------------ driver
class Driver:
    def __init__(self, qdir: Path, sample_s: float | None = None):
        self.q = qdir
        self.sample_override = sample_s
        self.st = {"jobs": {}, "kind_peaks": {}, "done_peaks": {}, "next_seq": 1, "measured_gb": 0.0}
        self.procs: dict[str, subprocess.Popen] = {}
        self.warned: set[str] = set()
        self.last_ov: dict = {}
        self.last_mem_log = 0.0
        self.stop_logged = False

    def log(self, msg: str) -> None:
        line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
        print(line, flush=True)
        with (self.q / "queue.log").open("a") as f:
            f.write(line + "\n")

    def warn_once(self, key: str, msg: str) -> None:
        if key not in self.warned:
            self.warned.add(key)
            self.log("!! " + msg)

    def overrides(self) -> dict:
        p = self.q / "overrides.json"
        try:
            ov = json.loads(p.read_text()) if p.exists() else {}
            if not isinstance(ov, dict):
                raise ValueError("not an object")
            self.last_ov = ov
            self.warned.discard("ov")
        except (OSError, ValueError) as e:
            self.warn_once("ov", f"overrides.json unreadable ({e}); keeping the last good values")
        return self.last_ov

    def save(self) -> None:
        self.st["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        atomic_write(self.q / "state.json", json.dumps(self.st, indent=1) + "\n")

    # ---- start up
    def reconcile(self, defs: dict) -> None:
        self.st = read_json(self.q / "state.json", self.st)
        self.st.setdefault("jobs", {})
        self.st.setdefault("kind_peaks", {})
        self.st.setdefault("done_peaks", {})
        self.st.setdefault("next_seq", 1)
        for name, rec in self.st["jobs"].items():
            s = rec["status"]
            if s == "running":
                rec["status"], rec["pid"] = "pending", None
                self.log(f"ORPHAN {name} was running when the previous driver ended; restarting (attempt {rec['attempt'] + 1})")
            elif s in ("failed", "blocked"):
                rec["status"], rec["fails"] = "pending", 0
            elif s == "done" and name in defs and defs[name]["done"] and not done_satisfied(defs[name]):
                rec["status"] = "pending"
                self.log(f"REDO {name}: marked done but its done paths are missing")

    def register(self, defs: dict) -> None:
        for name, d in defs.items():
            rec = self.st["jobs"].get(name)
            if rec is None:
                rec = self.st["jobs"][name] = {"status": "pending", "attempt": 0, "fails": 0, "peak_gb": 0.0,
                                               "cur_gb": 0.0, "seq": self.st["next_seq"]}
                self.st["next_seq"] += 1
            rec["kind"], rec["prio"] = d["kind"], d["prio"]

    # ---- one loop iteration
    def step(self) -> bool:
        """Returns False when the driver should exit."""
        ov = self.overrides()
        budget, kill, maxpar, _ = settings(ov)
        defs, problems = load_defs(self.q)
        for pr in problems:
            self.warn_once("def:" + pr, "job file problem: " + pr)
        self.register(defs)
        jobs, kp, dp = self.st["jobs"], self.st["kind_peaks"], self.st["done_peaks"]
        for name, p in list(self.procs.items()):
            if p.poll() is not None:
                self.finish(name, p.returncode, defs.get(name))
        for name, rec in jobs.items():
            d = defs.get(name)
            if d and rec["status"] == "pending" and done_satisfied(d):
                rec["status"] = "done"
                self.log(f"DONE (earlier) {name}")
        for pr_name, n in (ov.get("priority") or {}).items():
            if pr_name in jobs:
                jobs[pr_name]["prio"] = int(n)
        changed = True
        while changed:  # a failed or blocked dependency blocks its dependents
            changed = False
            for name, rec in jobs.items():
                d = defs.get(name)
                if d and rec["status"] == "pending":
                    bad = [a for a in d["after"] if jobs.get(a, {}).get("status") in ("failed", "blocked")]
                    if bad:
                        rec["status"], changed = "blocked", True
                        self.log(f"BLOCKED {name} (dependency {bad[0]} {jobs[bad[0]]['status']})")
        running = [n for n, r in jobs.items() if r["status"] == "running"]
        measured = 0.0
        if running:
            byt = tree_bytes([jobs[n]["pid"] for n in running])
            for n in running:
                gb = byt.get(jobs[n]["pid"], 0) / GIB
                rec = jobs[n]
                rec["cur_gb"] = round(gb, 3)
                rec["peak_gb"] = max(rec["peak_gb"], round(gb, 3))
                if gb > 0:
                    kp[rec["kind"]] = max(kp.get(rec["kind"], 0.0), round(gb, 3))
                measured += gb
            now = time.time()
            if now - self.last_mem_log >= 60 or measured > budget:
                self.last_mem_log = now
                self.log("MEM " + ", ".join(f"{n}:{jobs[n]['cur_gb']:.2f}" for n in running)
                         + f" = {measured:.2f} GB (budget {budget:g}, kill {kill:g})")
            if measured > kill and len(running) == 1:
                self.warn_once(f"alone:{running[0]}:{jobs[running[0]]['attempt']}",
                               f"{running[0]} alone measures {measured:.2f} GB > kill {kill:g} GB (not stopped)")
            if measured > kill and len(running) > 1:
                victim = max(running, key=lambda n: (jobs[n]["t_start"], jobs[n]["seq"]))
                self.kill_requeue(victim, measured, kill, [n for n in running if n != victim])
                running.remove(victim)
        self.st["measured_gb"] = round(measured, 3)
        stop, pause = bool(ov.get("stop")), bool(ov.get("pause"))
        if stop and not self.stop_logged:
            self.stop_logged = True
            self.log("STOP requested: starting nothing new; exiting when the running jobs end")
        skip = [str(s) for s in ov.get("skip") or []]
        cands = []
        for name, rec in jobs.items():
            d = defs.get(name)
            if not d or rec["status"] != "pending" or any(name.startswith(s) for s in skip):
                continue
            if any(jobs.get(a, {}).get("status") != "done" for a in d["after"]):
                continue
            if rec.get("hold_for"):
                if any(jobs.get(h, {}).get("status") == "running" for h in rec["hold_for"]):
                    continue
                rec["hold_for"] = None
            cands.append(name)
        cands.sort(key=lambda n: (jobs[n]["prio"], jobs[n]["seq"]))
        if not stop and not pause:
            run_est = [max(est_of(ov, kp, dp, defs[n]) if n in defs else 0.0, jobs[n]["cur_gb"]) for n in running]
            dec = admit([(n, est_of(ov, kp, dp, defs[n])) for n in cands], run_est, budget, maxpar)
            for n in cands:
                if dec[n].startswith("start"):
                    if "alone" in dec[n]:
                        self.log(f"!! {n}: {dec[n]}")
                    self.start(n, defs[n], est_of(ov, kp, dp, defs[n]))
        self.save()
        if self.procs:
            return True
        if stop:
            self.log("QUEUE STOP: " + self.summary())
            return False
        if not pause and not [n for n in cands if jobs[n]["status"] == "pending"]:
            left = [n for n, r in jobs.items() if r["status"] == "pending"]
            self.log("QUEUE STOP: " + self.summary() + (f"; {len(left)} pending that cannot run now: {left}" if left else ""))
            return False
        return True

    def summary(self) -> str:
        c = defaultdict(int)
        for r in self.st["jobs"].values():
            c[r["status"]] += 1
        return ", ".join(f"{c[s]} {s}" for s in ("done", "failed", "blocked", "pending", "running") if c[s]) or "no jobs"

    def start(self, name: str, d: dict, est: float) -> None:
        rec = self.st["jobs"][name]
        attempt = rec["attempt"] + 1
        (self.q / "logs").mkdir(exist_ok=True)
        env = os.environ.copy()
        env.update(d["env"])
        env["RUNQ_DIR"], env["RUNQ_JOB"] = str(self.q), name
        rec["attempt"] = attempt
        try:
            with (self.q / "logs" / f"{name}.{attempt}.log").open("w") as lf:
                p = subprocess.Popen(d["cmd"], cwd=d["cwd"], env=env, stdin=subprocess.DEVNULL, stdout=lf,
                                     stderr=subprocess.STDOUT, start_new_session=True)
        except OSError as e:
            rec["status"], rec["exit"] = "failed", None
            self.log(f"FAILED {name} attempt {attempt}: cannot start ({e})")
            return
        self.procs[name] = p
        rec.update(status="running", pid=p.pid, t_start=time.time(), cur_gb=0.0, peak_gb=0.0, hold_for=None)
        self.log(f"START {name} attempt {attempt} pid {p.pid} prio {rec['prio']} est {est:.2f} GB")

    def finish(self, name: str, rc: int, d: dict | None) -> None:
        rec = self.st["jobs"][name]
        del self.procs[name]
        mins = (time.time() - rec["t_start"]) / 60
        rec.update(exit=rc, pid=None, cur_gb=0.0, elapsed_s=round(mins * 60, 1))
        self.log(f"END {name} attempt {rec['attempt']} exit {rc} {mins:.2f} min peak {rec['peak_gb']:.2f} GB")
        if rc == 0 and (not d or not d["done"] or done_satisfied(d)):
            rec["status"] = "done"
            dpk = self.st["done_peaks"]
            dpk[rec["kind"]] = max(dpk.get(rec["kind"], 0.0), round(rec["peak_gb"], 3))
            return
        rec["fails"] += 1
        why = "nonzero exit" if rc != 0 else "exit 0 but its done paths are missing"
        if d and rec["fails"] <= d["retries"]:
            rec["status"] = "pending"
            self.log(f"RETRY {name} ({why}; failure {rec['fails']} of {d['retries'] + 1} allowed)")
        else:
            rec["status"] = "failed"
            self.log(f"FAILED {name} ({why})")

    def kill_requeue(self, name: str, measured: float, kill: float, others: list[str]) -> None:
        rec, p = self.st["jobs"][name], self.procs[name]
        self.log(f"KILL {name} attempt {rec['attempt']} pid {p.pid}: measured {measured:.2f} GB > kill {kill:g} GB "
                 f"with {len(others) + 1} jobs running; requeued behind {others}")
        try:
            if os.getpgid(p.pid) == p.pid:  # our own session leader; never signal a foreign group
                os.killpg(p.pid, signal.SIGTERM)
            p.wait(60)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.wait()
        except (ProcessLookupError, PermissionError):
            pass
        del self.procs[name]
        rec.update(status="pending", pid=None, cur_gb=0.0, hold_for=others)

    # ---- main loop
    def run(self) -> int:
        check_measurement()
        me = os.getpid()
        other = driver_pid(self.q)
        if other and other != me:
            raise UsageError(f"a driver for {self.q} is already running (pid {other})")
        defs, _ = load_defs(self.q)
        self.reconcile(defs)
        preflight_orphans(self.st)
        atomic_write(self.q / "driver.pid", f"{me}\n")
        (self.q / "logs").mkdir(exist_ok=True)

        def on_term(signum, frame):
            self.log(f"QUEUE INTERRUPTED by signal {signum}; running jobs keep running in their own process groups")
            raise SystemExit(143)

        signal.signal(signal.SIGTERM, on_term)
        budget, kill, maxpar, _ = settings(self.overrides())
        self.log(f"QUEUE START pid {me}: {self.q}, budget {budget:g} GB, kill {kill:g} GB, max_parallel {maxpar}, "
                 f"{len(defs)} jobs")
        try:
            while self.step():
                sample = self.sample_override or settings(self.overrides())[3]
                t_end = time.time() + sample
                while time.time() < t_end:
                    if any(p.poll() is not None for p in self.procs.values()):
                        break
                    time.sleep(min(0.1, sample))
        finally:
            self.save()
            if (self.q / "driver.pid").exists() and (self.q / "driver.pid").read_text().strip() == str(me):
                (self.q / "driver.pid").unlink()
        return 0


def preflight_orphans(st: dict) -> None:
    """Refuse while a job from an earlier driver is still alive (it would run twice and double the memory)."""
    for name, rec in st.get("jobs", {}).items():
        pid = rec.get("pid")
        if rec.get("status") == "running" and pid and pid_alive(pid):
            raise UsageError(f"job {name} (pid {pid}) from an earlier driver is still running; wait for it to end or "
                             f"stop its process group (kill -TERM -{pid}), then start again")


def preflight_orphans_state(qdir: Path) -> None:
    preflight_orphans(read_json(qdir / "state.json", {}))


# ------------------------------------------------------------------ commands
def need_qdir(a) -> Path:
    q = Path(a.qdir).expanduser().resolve()
    if not (q / "jobs").is_dir():
        raise UsageError(f"{q} is not a queue directory (no jobs/); create it with: runq.py init {a.qdir}")
    return q


def cmd_init(a) -> int:
    q = Path(a.qdir).expanduser().resolve()
    (q / "jobs").mkdir(parents=True, exist_ok=True)
    (q / "logs").mkdir(exist_ok=True)
    ov_path = q / "overrides.json"
    ov = read_json(ov_path, {}) if ov_path.exists() else {}
    budget = a.budget if a.budget is not None else ov.get("budget_gb", DEFAULT_BUDGET_GB)
    ov.update(budget_gb=budget, kill_gb=a.kill if a.kill is not None else ov.get("kill_gb", round(budget * 1.2, 3)),
              max_parallel=a.max_parallel if a.max_parallel is not None else ov.get("max_parallel", DEFAULT_MAX_PARALLEL),
              sample_s=ov.get("sample_s", DEFAULT_SAMPLE_S))
    atomic_write(ov_path, json.dumps(ov, indent=1) + "\n")
    print(f"queue ready in {q}\n  overrides: {ov}\nnext:\n"
          f"  runq.py add {a.qdir} --name N --cmd \"...\" --kind K --est-gb X   (or write {q}/jobs/*.json)\n"
          f"  runq.py plan {a.qdir}      dry run\n  runq.py start {a.qdir}     detached driver\n"
          f"  runq.py status {a.qdir}    table;  runq.py set {a.qdir} budget_gb=6;  runq.py stop {a.qdir}")
    return 0


def cmd_add(a) -> int:
    q = need_qdir(a)
    path = q / "jobs" / f"{a.name}.json"
    job = {"name": a.name, "cmd": a.cmd, "cwd": str(Path(a.cwd).expanduser().resolve()) if a.cwd else os.getcwd(),
           "kind": a.kind, "est_gb": a.est_gb, "prio": a.prio, "after": a.after, "done": a.done or [],
           "retries": a.retries}
    normalize_job(job, q / "jobs", path.name)  # validate
    if path.exists():
        raise UsageError(f"{path} already exists (job names are unique)")
    defs, _ = load_defs(q)
    if a.name in defs:
        raise UsageError(f"job name {a.name} already defined in {defs[a.name]['_src']}")
    atomic_write(path, json.dumps(job, indent=1) + "\n")
    print(f"wrote {path}")
    return 0


def cmd_run(a) -> int:
    return Driver(need_qdir(a), a.sample_s).run()


def cmd_start(a) -> int:
    q = need_qdir(a)
    check_measurement()
    pid = driver_pid(q)
    if pid:
        raise UsageError(f"a driver for {q} is already running (pid {pid})")
    preflight_orphans_state(q)
    with (q / "driver.out").open("a") as out:
        p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "run", str(q)]
                             + (["--sample-s", str(a.sample_s)] if a.sample_s else []),
                             stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
    atomic_write(q / "driver.pid", f"{p.pid}\n")
    time.sleep(0.5)
    if p.poll() is not None:
        raise UsageError(f"the driver exited at once (code {p.returncode}); see {q / 'driver.out'}")
    print(p.pid)
    print(f"driver started detached; log {q / 'queue.log'}", file=sys.stderr)
    return 0


def merge_overrides(old: dict, key: str, val) -> None:
    if val is None:
        old.pop(key, None)
    elif isinstance(val, dict) and isinstance(old.get(key), dict):
        for k, v in val.items():
            if v is None:
                old[key].pop(k, None)
            else:
                old[key][k] = v
    else:
        old[key] = val


def cmd_set(a) -> int:
    q = need_qdir(a)
    ov_path = q / "overrides.json"
    ov = read_json(ov_path, {}) if ov_path.exists() else {}
    for kv in a.pairs:
        if "=" not in kv:
            raise UsageError(f"expected key=value, got {kv!r}")
        k, v = kv.split("=", 1)
        try:
            val = json.loads(v)
        except ValueError:
            val = v
        merge_overrides(ov, k, val)
    atomic_write(ov_path, json.dumps(ov, indent=1) + "\n")
    print(json.dumps(ov))
    return 0


def cmd_stop(a) -> int:
    a.pairs = ["stop=true"]
    return cmd_set(a)


def view(q: Path):
    """(ov, st, defs, problems) for status and plan; job state from state.json with fresh done/blocked evaluation."""
    ov = read_json(q / "overrides.json", {})
    st = read_json(q / "state.json", {})
    defs, problems = load_defs(q)
    recs = {n: dict(r) for n, r in st.get("jobs", {}).items()}
    for n, d in defs.items():
        recs.setdefault(n, {"status": "pending", "attempt": 0, "peak_gb": 0.0, "cur_gb": 0.0, "seq": 10**6 + len(recs),
                            "prio": d["prio"]})
    for n, r in recs.items():
        if r["status"] == "pending" and n in defs and done_satisfied(defs[n]):
            r["status"] = "done"
    for n, n_pr in (ov.get("priority") or {}).items():
        if n in recs:
            recs[n]["prio"] = int(n_pr)
    return ov, st, defs, problems, recs


def cmd_status(a) -> int:
    q = need_qdir(a)
    ov, st, defs, problems, recs = view(q)
    kp, dp = st.get("kind_peaks", {}), st.get("done_peaks", {})
    dpid = driver_pid(q)
    print(f"driver: {'alive, pid ' + str(dpid) if dpid else 'not running'}   queue: {q}")
    budget, kill, maxpar, _ = settings(ov)
    print(f"budget {budget:g} GB, kill {kill:g} GB, max_parallel {maxpar}"
          + ("   [STOP]" if ov.get("stop") else "") + ("   [PAUSE]" if ov.get("pause") else ""))
    print(f"{'name':32s} {'kind':14s} {'status':9s} {'est':>6s} {'peak':>6s} {'min':>6s}")
    tot_est = 0.0
    for n, r in sorted(recs.items(), key=lambda kv: (kv[1]["prio"], kv[1].get("seq", 0))):
        d = defs.get(n)
        est = est_of(ov, kp, dp, d) if d else 0.0
        mins = (time.time() - r["t_start"]) / 60 if r["status"] == "running" and r.get("t_start") else (r.get("elapsed_s") or 0) / 60
        if r["status"] == "running":
            tot_est += max(est, r.get("cur_gb", 0))
        print(f"{n[:32]:32s} {r.get('kind', d['kind'] if d else '?')[:14]:14s} {r['status']:9s} {est:6.2f} "
              f"{r.get('peak_gb', 0):6.2f} {mins:6.1f}" + (f"  attempt {r['attempt']}" if r.get("attempt", 0) > 1 else ""))
    c = defaultdict(int)
    for r in recs.values():
        c[r["status"]] += 1
    print(f"totals: {dict(c)}; running estimate {tot_est:.2f} GB, measured {st.get('measured_gb', 0):.2f} GB "
          f"(state {st.get('updated', 'never')}); kind peaks {kp}")
    for pr in problems:
        print("!! job file problem:", pr)
    return 0


def cmd_wait(a) -> int:
    """Block until the driver exits (liveness from driver.pid, checked as in status), then print the status summary.
    Exit 0 all jobs done, 3 some job not done, 4 timeout (summary printed too). Never match the driver by name."""
    q = need_qdir(a)
    t0 = time.time()
    timed_out = False
    while driver_pid(q):
        if a.timeout is not None and time.time() - t0 >= a.timeout:
            timed_out = True
            break
        time.sleep(min(a.poll_s, 1.0) if a.timeout is None else min(a.poll_s, max(0.05, a.timeout - (time.time() - t0))))
    cmd_status(a)
    recs = view(q)[4]
    bad = {n: r["status"] for n, r in recs.items() if r["status"] != "done"}
    if timed_out:
        print(f"wait: timeout after {a.timeout:g} s, driver still running; {len(bad)} job(s) not done", file=sys.stderr)
        return 4
    if bad:
        print(f"wait: driver exited; not done: {bad}", file=sys.stderr)
        return 3
    print("wait: driver exited; all jobs done", file=sys.stderr)
    return 0


def cmd_plan(a) -> int:
    q = need_qdir(a)
    ov, st, defs, problems, recs = view(q)
    kp, dp = st.get("kind_peaks", {}), st.get("done_peaks", {})
    budget, _, maxpar, _ = settings(ov)
    alive = bool(driver_pid(q))
    skip = [str(s) for s in ov.get("skip") or []]
    running = [n for n, r in recs.items() if r["status"] == "running" and alive]
    cands, notes = [], {}
    for n, r in recs.items():
        d = defs.get(n)
        if r["status"] != "pending" or not d:
            continue
        if any(n.startswith(s) for s in skip):
            notes[n] = "skipped (overrides)"
        elif any(recs.get(x, {}).get("status") in ("failed", "blocked") for x in d["after"]):
            notes[n] = "would be blocked (a dependency failed)"
        elif any(recs.get(x, {}).get("status") != "done" for x in d["after"]):
            notes[n] = f"wait: after {[x for x in d['after'] if recs.get(x, {}).get('status') != 'done']}"
        else:
            cands.append(n)
    cands.sort(key=lambda n: (recs[n]["prio"], recs[n].get("seq", 0)))
    dec = admit([(n, est_of(ov, kp, dp, defs[n])) for n in cands], [est_of(ov, kp, dp, defs[n]) for n in running if n in defs],
                budget, maxpar)
    print(f"plan under budget {budget:g} GB, max_parallel {maxpar}; running now: {running or 'none'}"
          + ("; STOP set" if ov.get("stop") else "") + ("; PAUSE set" if ov.get("pause") else ""))
    for n in cands:
        print(f"{recs[n]['prio']:4d} {n:32s} est {est_of(ov, kp, dp, defs[n]):5.2f} GB  {dec[n]}")
    for n, why in notes.items():
        print(f"{recs[n]['prio']:4d} {n:32s} {why}")
    done = [n for n, r in recs.items() if r["status"] == "done"]
    if done:
        print(f"done already: {done}")
    for pr in problems:
        print("!! job file problem:", pr)
    return 0


def cmd_measure(a) -> int:
    check_measurement()
    if a.pid:
        print(f"{tree_bytes([a.pid]).get(a.pid, 0) / GIB:.3f} GB private (pid {a.pid} and descendants)")
        return 0
    cmd = a.cmd[1:] if a.cmd[:1] == ["--"] else a.cmd
    if not cmd:
        raise UsageError("usage: runq.py measure -- CMD ...   or   runq.py measure --pid P")
    t0, peak = time.time(), 0
    try:
        p = subprocess.Popen(cmd, start_new_session=True)
    except OSError as e:
        raise UsageError(f"cannot run {cmd[0]}: {e}")
    while p.poll() is None:
        peak = max(peak, tree_bytes([p.pid]).get(p.pid, 0))
        time.sleep(a.sample_s)
    print(f"peak private {peak / GIB:.3f} GB over {time.time() - t0:.1f} s wall, exit {p.returncode} "
          f"(sampled every {a.sample_s:g} s; a shorter spike can be missed)")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="runq.py", description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd_name", required=True)

    def qp(name, help_):
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("qdir")
        return sp

    s = qp("init", "create a queue directory and overrides.json")
    s.add_argument("--budget", type=float, help=f"GB of private memory (default {DEFAULT_BUDGET_GB})")
    s.add_argument("--kill", type=float, help="GB above which the newest job is stopped (default 1.2 x budget)")
    s.add_argument("--max-parallel", type=int)
    s.set_defaults(fn=cmd_init)
    s = qp("add", "write jobs/<name>.json")
    s.add_argument("--name", required=True)
    s.add_argument("--cmd", required=True, help="shell string, run by /bin/sh -c")
    s.add_argument("--kind", default="default")
    s.add_argument("--est-gb", type=float, default=1.0)
    s.add_argument("--prio", type=int, default=50)
    s.add_argument("--after", default="", help="comma-separated job names")
    s.add_argument("--done", action="append", help="path or glob relative to cwd (repeatable)")
    s.add_argument("--cwd", help="default: the current directory")
    s.add_argument("--retries", type=int, default=0)
    s.set_defaults(fn=cmd_add)
    s = qp("run", "run the driver in the foreground")
    s.add_argument("--sample-s", type=float, help="sampling interval, overrides overrides.json")
    s.set_defaults(fn=cmd_run)
    s = qp("start", "start the driver detached; prints its pid")
    s.add_argument("--sample-s", type=float)
    s.set_defaults(fn=cmd_start)
    qp("stop", "start nothing new; the driver exits when running jobs end").set_defaults(fn=cmd_stop)
    s = qp("set", "merge key=value (JSON) into overrides.json; null removes; dict values merge one level")
    s.add_argument("pairs", nargs="+")
    s.set_defaults(fn=cmd_set)
    qp("status", "table of jobs, totals, driver state").set_defaults(fn=cmd_status)
    s = qp("wait", "block until the driver exits, print the status; exit 0 all done, 3 not all done, 4 timeout")
    s.add_argument("--timeout", type=float, help="seconds; exit 4 if the driver is still running then")
    s.add_argument("--poll-s", type=float, default=1.0)
    s.set_defaults(fn=cmd_wait)
    qp("plan", "dry run: order and what would start now").set_defaults(fn=cmd_plan)
    s = sub.add_parser("measure", help="peak private memory of a command's whole process tree, or of a pid")
    s.add_argument("--pid", type=int)
    s.add_argument("--sample-s", type=float, default=0.5)
    s.add_argument("cmd", nargs=argparse.REMAINDER)
    s.set_defaults(fn=cmd_measure)
    a = ap.parse_args(argv)
    try:
        return a.fn(a)
    except UsageError as e:
        print(f"runq: {e}", file=sys.stderr)
        return 1
    except ToolMissing as e:
        print(f"runq: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
