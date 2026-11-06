# Learnings: local-run-queue

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-11-05 [wish] Steps 5 Watch: an agent waiting for the queue to end wrote 'while pgrep -f <driver.py>; do sleep; done', which matches its own shell's command line and never exits (lost ~4 h of notice). Add 'runq.py wait QDIR' (blocks until the driver pid exits, prints the summary) and tell agents to use it. (claude-code, simple_complex_v1)

## Resolved
