# Learnings: herdr-delegate

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-11-01 [win] Steps 2-7: two Kiro helpers (standard GUI phase in gui/ only, deep replay backend in src/) ran in parallel with two local runs; briefs with strict file scope + report file + 'no commit' made review and separate commits easy; both reports matched the diff and the independent re-check (claude-code, simple_complex_v1 GUI phases 1-2, 1 Nov 2026)
- O2 2026-11-01 [friction] Steps 4-5: a Copilot helper sat 21 min on a path-access prompt; hc wait --children never surfaced it because Copilot reports no status. With Copilot helpers, check hc read (or helpers.py prompt) on every wait timeout, and use a shorter --timeout (~300s). (claude-code, gui-design skill build, 5 parallel helpers)

## Resolved
