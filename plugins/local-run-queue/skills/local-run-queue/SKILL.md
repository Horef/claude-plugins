---
name: local-run-queue
description: "Run many local simulation or analysis jobs in parallel under a private-memory budget: measure each job's whole process tree (macOS footprint, Linux PSS; never RSS), admit jobs by estimates taken from measured peaks, stop and requeue the newest job above a kill line, chain dependent jobs, survive restarts and the launching agent's exit, and change budget, priorities or estimates while it runs. Use when a batch of local runs (sweeps, calibrations, simulations) must fit a machine's memory, when parallel runs need a memory estimate, or when a previous queue over- or under-used memory."
---

# Local run queue

Use this skill to run a batch of local jobs (simulations, calibrations, sweeps, analyses) as many at a time as the machine's memory allows, without the agent or the person watching. It is for one machine and its memory budget. It is not for cluster jobs (use the scheduler there), for jobs limited by CPU or GPU rather than memory, or for one short run.

**Why it exists.** Agents keep getting the memory of local runs wrong, in both directions, and each error cost hours on a real project:
- **RSS instead of private memory.** RSS counts shared libraries in every process and reads 1.5-2x too high. Activity Monitor's "Memory" column and `footprint` (macOS) or PSS (Linux) are the right numbers.
- **Missing the workers.** A simulator that spawns a worker process (NEURON, multiprocessing pools, MPI ranks) puts most of its memory in the child. Measuring the parent alone gave half the real value.
- **Smoke runs that differ from the real runs.** A smoke run that also saved its input data measured 8 GB; the real runs peaked at 3.7 GB, and a queue sized from the smoke ran serially for hours.
- **Jobs that die with the agent.** A queue launched by a helper agent died when the helper's terminal was closed.

`scripts/runq.py` handles all of these; the steps below are how to use it.

## Steps

`SKILL` is this skill's folder (in Claude Code under `~/.claude/plugins/cache/<marketplace>/local-run-queue/<version>/skills/local-run-queue`). `runq.py` needs only Python 3.10+; on macOS it uses `footprint` (built in).

1. **Find the budget.** The person's memory budget for local runs is a machine fact: look for it in the project's `AGENTS.local.md` (or equivalent) and ask once if it is not there. Note what else runs on the machine. Budget (admission) and kill line (protection) are two numbers: for example budget 8 GB, kill 9.8 GB.
2. **Measure one real job of each kind.** `python3 SKILL/scripts/runq.py measure -- <the exact command of a real job>` prints the peak private memory of the whole process tree and the wall time. Use the real configuration (same outputs saved, same data sizes), not a lighter smoke variant; if you must shorten it, shorten time, not data. Memory usually peaks late (when workers load their inputs): let it run past that point. Record the numbers where the project keeps run notes.
3. **Write the queue.** `runq.py init QDIR --budget B --kill K`, then one job per run: `runq.py add QDIR --name N --cmd "..." --kind K --est-gb X --prio P [--after A,B] [--done 'outputs/N/*/manifest.json']`. Put QDIR next to the outputs (it holds the log, state and per-job logs), never inside a folder a run overwrites.
   - `kind` groups jobs with the same memory profile; the queue learns each kind's estimate from its measured peaks.
   - `done` names the files a finished job leaves; on restart, jobs whose files exist are skipped, so a crash or a stop loses only the running jobs.
   - A step that decides later jobs (a calibration whose result sets the next run's parameters) is a job that writes new job files into `QDIR/jobs/`; the queue picks them up while it runs.
4. **Check, then start detached.** `runq.py plan QDIR` shows the order and what would start now. `runq.py start QDIR` launches the driver in its own session, so it survives the terminal or agent that started it. After starting, confirm with `runq.py status QDIR` that the driver is alive; if you started it from a helper agent, check again after the helper exits.
5. **Watch and adjust without restarting.** To wait for the queue to end, run `runq.py wait QDIR [--timeout SECONDS]` (in Claude Code with `run_in_background`, so the harness notifies you when it exits). It blocks until the driver exits, prints the status summary, and exits 0 if every job is done, 3 if some are not, 4 on timeout. Never wait with a `pgrep`/`ps` loop on the driver's name: it matches its own shell and never ends. `runq.py status QDIR`; `tail -f QDIR/queue.log` (START, END with each job's peak, MEM lines). Change things live with `runq.py set QDIR key=value`: `budget_gb`, `kill_gb`, `max_parallel`, `est_gb='{"kind": GB}'` (set an estimate from measured peaks; a higher measured peak still raises it), `priority='{"name": 5}'`, `skip='["prefix"]'`, `pause=true`, and `runq.py stop QDIR` (start nothing new; exit when the running jobs end). If the person sees less memory in use than the budget, compare the queue's estimates with the END lines' peaks: the estimates are what admission uses.
6. **Report.** For the person: what ran, each kind's measured peak against its estimate, total wall time, failures and retries, and where the outputs are. Record any new measured peak in the project's notes so the next queue starts from it.

## How the queue decides

- **Admission by estimate:** a job starts when the running jobs' estimates (each at least its current measured use) plus its own fit the budget, and fewer than `max_parallel` run; lower `prio` first. First-fit can let a small low-priority job start ahead of a large waiting one; raise the large job's priority if that matters.
- **Protection by measurement:** every `sample_s` the queue measures each job's whole tree (macOS `footprint`, Linux PSS). Above `kill_gb` with more than one job running, it stops the newest job's process group and requeues it (a new attempt, not counted as a failure). A single job above the line is only logged: nothing smaller can run.
- **Estimates:** per kind, an override from `est_gb` if set wins. Otherwise the declared `est_gb` is used until one job of the kind finishes cleanly; from then on its peak plus 10% replaces the declared value, so a too-high guess corrects itself. Any higher peak measured while jobs run raises the estimate; samples taken while a job is still ramping up never lower it.

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note local-run-queue <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for local-run-queue` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
