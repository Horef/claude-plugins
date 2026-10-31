# Learnings: paper-premark

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-10-31 [wish] Workflow 5: every run hand-writes the same small script (parse the extract_record_content file into per-page text, check text.count(s)==1, normalise NBSP, flag soft hyphens and ***). A scripts/validate_marks.py taking the extract JSON and a mark spec would remove that and could carry an evals/run.py that needs no DEVONthink. (adoption, read while adopting from the claude.ai upload; not yet used)
- O2 2026-10-31 [wish] Workflow 4: 'strings cannot span pages' may be out of date: the current mark_record_text schema says a multi-line PDF occurrence yields one count and one annotation per page. Test once on a page break before keeping the split-at-page-break rule. (adoption, compared with the tool schema in Claude Code, not tested on a PDF)
- O3 2026-10-31 [friction] Workflow 2: names claude.ai-only steps (export into a connected folder, device_stage_files) with no Claude Code route; there Bash can read the exported file directly. The skill should say which route applies in which harness. (adoption, read while adopting)
- O4 2026-10-31 [wish] Calibration loop: the calibration history lists papers by name inside SKILL.md and will keep growing; the lessons are already in the rules, so the per-paper log belongs in a references file or the project rubric, keeping SKILL.md short. (adoption, read while adopting; kept as found)
- O5 2026-10-31 [wish] Colour scheme: the hex palette is the owner's personal choice and sits in the body; scientific-figures keeps personal choices in a profile file (D9). Consider the same here so a second person could use the skill with their own colours. Owner decides. (adoption, read while adopting)

## Resolved
