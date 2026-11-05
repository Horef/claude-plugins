# Judged cases: local-run-queue

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A sweep that must fit 8 GB
**Task:** "Run these 12 simulations locally (commands in runs.txt); my budget is 8 GB." One job, run alone, spawns a worker process that holds most of its memory.
**Good looks like:**
- Measures one real job with `runq.py measure` (whole tree, private memory) before choosing parallelism; reports the peak.
- Sets budget 8 and a kill line above it; estimates from the measurement, not a guess.
- Starts the queue detached and confirms the driver is alive.
- Never quotes RSS or the parent process alone as the job's memory.
**Origin:** simple_complex_v1 A2-A6 queue (2026-11-05): estimate missed the NEURON worker.

## The queue uses half the budget
**Task:** "Activity Monitor shows 5 GB used, but the budget is 11 GB and only two jobs run. Can we run more?"
**Good looks like:**
- Compares the queue's per-kind estimates with the measured peaks in the END lines.
- Lowers the estimates live (`runq.py set ... est_gb=...`) without killing running jobs.
- Explains that measurement is private memory (matches Activity Monitor) and admission uses estimates.
**Origin:** simple_complex_v1 (2026-11-05): smoke-run estimates (8 GB) twice the real peaks (3.7 GB).

## Trigger: should fire
**Task:** "Run these calibrations in parallel but keep under 10 GB of RAM." / "Queue the remaining sweep runs overnight on my laptop." / "How many of these simulations can run at once on this machine?"
**Good looks like:** local-run-queue is loaded.

## Trigger: should not fire
**Task:** "Submit these jobs to the Slurm cluster." / "Why is my Python script slow?" / "Profile the memory of this function."
**Good looks like:** local-run-queue is not loaded.
