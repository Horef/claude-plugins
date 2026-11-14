# Learnings: session-status-line

Observations from use, written by the agents that used this plugin; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O2 2026-11-14 [failure] README.md:36 says no colour under 50% but context bar is always green (register.tsx:340,342); colours target 3:1 (register.tsx:25-27) where status text needs 4.5:1, orange #ea580c on off-white 3.13 (eval grading 2026-11-14)

## Resolved
- O1 2026-11-09 [wish] rows: owner asked (2026-11-09) for row 1 = model, context, 5h, 7d; row 2 = helpers (Kiro, Copilot, agy); cost and the rest below; and agy's 5h/weekly limits, readable from agy -p /usage --output-format json (simple_complex_v1) → 0.5.0
