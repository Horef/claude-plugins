# Learnings: research-assistant

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open

## Resolved

- O3 2026-11-08 [friction] Hypothesis ids are hard-coded as H<n> (ra.py sections(..., 'H')). In simple_complex_v1 the cell wirings are already named H3, H5t, so 'H3' meant both a hypothesis and a wiring; Sergiy only noticed at gate 2. Would help: a configurable hypothesis prefix (e.g. 'Hyp' or per-question letter) chosen at framing, with a check that it does not collide with names already used in the project. (simple_complex_v1) → 0.2.0
- O2 2026-11-07 [friction] 3 Hypotheses: the template's heading holds the hypothesis in one line, but the pilot needed a longer 'statement' field and a 'Not taken forward' section (the S1 extension, a rival outside the project's scope); both added by hand. Add both to templates/research/hypotheses.md. (claude-code, simple_complex_v1 pilot) → 0.2.0
- O1 2026-11-07 [wish] 1 Frame: the pilot needed a 'What is already known' section in question.md (earlier RESULTS on the same question) so the plan does not repeat runs, and a 'Questions for gate 1' list; both written by hand. (claude-code, simple_complex_v1 pilot) (template sections added before release) → 0.1.0
