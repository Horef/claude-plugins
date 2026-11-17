# Learnings: session-status-line

Observations from use, written by the agents that used this plugin; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O3 2026-11-17 [workaround] readAgy: agy login windows after the 0.8.1 fix (issue #89): agy cli logs 2026-11-16 18:00 to 2026-11-17 08:00 show 94 print-mode OAuth starts, 38 blocked ('open' not on PATH) and 56 not. Trigger is DNS loss ('lookup oauth2.googleapis.com: no such host', fits VPN switching). Likely sources of the unblocked ones: two Claude sessions started before the fix (Nov 13 default account, Nov 15 uni) still run the old hook until restarted, and stale uni project-scope installs at ~ (session-status-line 0.5.0, herdr-delegate 0.8.0; updated 2026-11-17). Not yet confirmed which one ran each read: agy's log does not record the caller (claude-code, claude-plugins)

## Resolved
- O2 2026-11-14 [failure] README.md:36 says no colour under 50% but context bar is always green (register.tsx:340,342); colours target 3:1 (register.tsx:25-27) where status text needs 4.5:1, orange #ea580c on off-white 3.13 (eval grading 2026-11-14) → 0.8.0
- O1 2026-11-09 [wish] rows: owner asked (2026-11-09) for row 1 = model, context, 5h, 7d; row 2 = helpers (Kiro, Copilot, agy); cost and the rest below; and agy's 5h/weekly limits, readable from agy -p /usage --output-format json (simple_complex_v1) → 0.5.0
