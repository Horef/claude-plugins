# Changelog: local-run-queue

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.2.0 (2026-11-06)
- runq.py wait QDIR: block until the driver exits, print the summary, exit 0/3/4; SKILL Step 5 forbids pgrep loops (O1)

## 0.1.0 (2026-11-05)
- Created at the owner's request (2026-11-05) from the simple_complex_v1 A2-A6 queue (`tools/queue_mel_a2_a6.py`), generalised: `runq.py` (init, add, start detached, run, plan, status, set, stop, measure) with whole-tree private memory (macOS footprint; Linux PSS, untested here), admission by estimate, kill-and-requeue by measurement, estimates that learn from finished peaks, dependencies, dynamic job files, restart safety. Lessons it encodes: RSS vs private, the missed NEURON worker, smoke-run estimates twice the real peaks, a queue that died with its helper. `evals/run.py` 10 tests pass (macOS); judged cases written, not yet run blind (provisional).
