# Judged cases: local-run-queue

Each case: a task, the rubric a blind judge applies, and where the case came from. Add a case for every `failure` observation.

## A sweep that must fit 8 GB
**Task:** "Run these 12 simulations locally (commands in `evals/fixtures/runs.txt`, calling `evals/fixtures/sim_worker.py`); my budget is 8 GB." One job spawns a child worker process that holds most of its memory.
**Good looks like:**
- Measures one job from `runs.txt` with `runq.py measure` (whole tree, private memory) before choosing parallelism; reports the peak.
- Sets budget 8 (or a scaled twin if running on a constrained eval machine) and a kill line above it; estimates from the measurement, not a guess.
- Starts the queue (or scaled twin) detached and confirms the driver is alive with `runq.py status`.
- Never quotes RSS or the parent process alone as the job's memory.
**Origin:** simple_complex_v1 A2-A6 queue (2026-11-05): estimate missed the NEURON worker.

## The queue uses half the budget
**Task:** Two queue snapshots under an 11 GB budget: (a) `evals/fixtures/q_half` — "Activity Monitor shows ~4 GB used for these runs, but the budget is 11 GB and only two jobs run. Can we run more?" (b) `evals/fixtures/q_ramping` — "Only ~1 GB shows used 10 s after starting; can we lower the 4 GB estimate so all four run?"
**Good looks like:**
- For `q_half`: compares the queue's per-kind `est_gb` override (`4.0`) with the measured peaks in the `END` lines (`1.91` / `1.88 GB`), and lowers the estimate live (`runq.py set ... est_gb=...`) without killing running jobs, using concrete numbers in the reply.
- For `q_ramping`: notes there are no `END` lines yet (jobs are still ramping up), and recommends `runq.py measure` on one full run or waiting for `END` peaks rather than lowering `est_gb` from ramp-up `MEM` lines.
- Explains that measurement is private memory (matches Activity Monitor) and admission uses estimates.
**Origin:** simple_complex_v1 (2026-11-05): smoke-run estimates (8 GB) twice the real peaks (3.7 GB); 2026-11-14 eval grading (distinguish finished peaks from ramp-up).

## Short jobs under default sampling
**Task:** "Queue these 20 short simulations (each takes ~6 s and ~1.5 GB) under a 4 GB budget."
**Good looks like:**
- Sets `sample_s` below the job length (e.g. `--sample-s 1` or `runq.py set ... sample_s=1`) instead of relying on the 10 s default, so each job is measured before it exits.
- Measures one job with `runq.py measure --sample-s` (or uses the measured estimate) and sets budget 4 with a kill line above it.
- Starts detached and checks `status` / `wait`.
**Origin:** O2 (2026-11-14 eval grading): 8 s jobs finished before the 10 s sample and recorded 0 GB estimates.

## Trigger: should fire
**Task:** "Run these calibrations in parallel but keep under 10 GB of RAM." / "Queue the remaining sweep runs overnight on my laptop." / "How many of these simulations can run at once on this machine?"
**Good looks like:** local-run-queue is loaded.

## Trigger: should not fire
**Task:** "Submit these jobs to the Slurm cluster." / "Why is my Python script slow?" / "Profile the memory of this function."
**Good looks like:** local-run-queue is not loaded.
