# Learnings: course-lecture-notes

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O5 2026-11-06 [friction] Workflow 7: anki_blocks.py stopped 3 times on Gemini MAX_TOKENS (blocks 1.6, 5.5, 8.7, all >2.2k chars, after a rejected first attempt); rerun always succeeded. An automatic retry on MAX_TOKENS, or splitting long blocks, would let the batch finish unattended. (claude-code, 76901 Lecture 4)
- O6 2026-11-08 [friction] Workflow 6: a transcript-only session (no slides PDF) has no PDF to annotate, and step 1 assumes slides exist; say what to do when only a transcript is given (link the book section instead, record 'none' in SOURCES) (claude-code, 769001)
- O7 2026-11-14 [friction] Check for an existing study guide sits in step 6 (SKILL.md:80), after the writing; should be step 1 (eval grading 2026-11-14)

## Resolved
- O1 2026-10-30 [wish] Goals 2 / Math: evals: Goals 2 and the Math rules are checkable by script (no 'see block'/'as above'/'in the figure', no Unicode math symbols, no single-backslash \[, a 'where:' after each display equation, '---' between blocks); a small lint over the generated Markdown would catch breaks before the owner pastes blocks into Anki. From reading, not use (claude-code-web, adopting into the genome) → 1.6.0
- O3 2026-11-05 [workaround] Workflow 1/6: Claude Code had no DEVONthink MCP tools; osascript (tell application id "DNtp") did get record with uuid, import ... to group, set tags, create record in annotations group + set annotation. Gotcha: 'txt' is a reserved DEVONthink term, so a variable named txt fails to compile. A short osascript recipe in the skill would save the rediscovery (claude-code, 769001) → 1.5.0
- O4 2026-11-05 [friction] Workflow 7: anki_blocks stopped at a block because one generated card ('Receptive Field') duplicated a card in another course's deck (AnkiConnect checks duplicates collection-wide); the rest of that block's cards were added, so rerunning would re-add them. Worked around with --from <next block>. The skill could say how to handle a duplicate stop (skip the block, or have the pipeline skip duplicate notes instead of stopping) (claude-code, 769001) → 1.4.0
- O2 2026-11-05 [misled] Workflow 7: the text says anki_blocks.py runs with --quiet; passing --quiet on the command line fails (unrecognized argument); the flag is internal, the command is just NOTE DECK (claude-code, 769001) → 1.4.0
