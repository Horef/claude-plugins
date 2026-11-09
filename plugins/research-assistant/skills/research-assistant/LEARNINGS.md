# Learnings: research-assistant

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O4 2026-11-08 [friction] 6 audit: ra.py stage() needs the audit's status field to be exactly 'pass'; the Argon checker wrote 'pass. <reasons>' and status stayed '6 audit' with 0 check problems. Would help: accept 'pass' as the first word, or have check say the status value is not pass/disagreement. (simple_complex_v1)
- O5 2026-11-09 [missing] 7 Write-up: ra.py has no state after '7 write-up (ready for hand-over)': once the write-up is revised and pushed the question still reads as stage 7. Would help: a closing step (ra.py close DIR <writeup path/commit>) that logs the hand-over in log.md and makes status say 'closed'. (simple_complex_v1 NB pilot)
- O6 2026-11-09 [missing] 7 Write-up: hand-over to an existing write-up is research-writing's Add mode, but nothing carries confirmatory/exploratory and the pre-registered rules into its ledger; done by hand (C5, C5a confirmatory; C5b exploratory, written 'not planned before the runs'). Would help: ra.py handover printing one ledger row per verdict section with tag, condition and sources. (simple_complex_v1 NB pilot)
- O7 2026-11-09 [missing] 5 Run: a side literature question arose mid-run (is gOSI 0.3 a good threshold?) and exploratory extras (threshold counts, shuffle test, Allen comparison) were approved after gate 3; the skill has no slot for either. Handled as decisions.md NB-Q2 + docs/literature/gosi_threshold. Would help: a sub-question rule: a literature-research run linked from decisions.md; exploratory analyses declared as such in plan.md before running, kept out of the verdict rules. (simple_complex_v1 NB pilot)
- O8 2026-11-09 [win] whole loop: gates + rules copied verbatim before runs + cross-family audit worked: NB-H3 (a pre-registered null) was rejected cleanly, the audit reproduced every number and caught 2 small slips, and the write-up could state which readings were planned. Sergiy's gate answers took minutes each. (simple_complex_v1 NB pilot)

## Resolved

- O3 2026-11-08 [friction] Hypothesis ids are hard-coded as H<n> (ra.py sections(..., 'H')). In simple_complex_v1 the cell wirings are already named H3, H5t, so 'H3' meant both a hypothesis and a wiring; Sergiy only noticed at gate 2. Would help: a configurable hypothesis prefix (e.g. 'Hyp' or per-question letter) chosen at framing, with a check that it does not collide with names already used in the project. (simple_complex_v1) → 0.2.0
- O2 2026-11-07 [friction] 3 Hypotheses: the template's heading holds the hypothesis in one line, but the pilot needed a longer 'statement' field and a 'Not taken forward' section (the S1 extension, a rival outside the project's scope); both added by hand. Add both to templates/research/hypotheses.md. (claude-code, simple_complex_v1 pilot) → 0.2.0
- O1 2026-11-07 [wish] 1 Frame: the pilot needed a 'What is already known' section in question.md (earlier RESULTS on the same question) so the plan does not repeat runs, and a 'Questions for gate 1' list; both written by hand. (claude-code, simple_complex_v1 pilot) (template sections added before release) → 0.1.0
