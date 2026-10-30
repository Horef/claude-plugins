# Learnings: project-foundations

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O3 2026-10-30 [friction] Step 3: the templates (about 250 lines) load every time, also in Audit mode where none is written; moving them to `templates/*.md` read on demand would roughly halve SKILL.md again. From reading, not use: confirm before restructuring (claude-code-web, adopting into the genome)
- O4 2026-10-30 [friction] Step 4 / docmap check: in a plugin marketplace repo (Horef/claude-plugins) the one-README-per-code-folder rule asks for READMEs in `plugins/`, `plugins/x/skills/`, `scripts/`, `evals/`; needed `readme_exempt` globs. A documented preset for skill/plugin repos would help (claude-code-web, setting up the genome)
- O5 2026-10-30 [friction] docmap check: TypeScript files whose first line is an import fail "no header comment"; existing mods (model-router) needed `docstring_exempt`. Fine as a rule, but the error could say what a header comment looks like for TS (claude-code-web, setting up the genome)
- O6 2026-10-30 [wish] Step 6 Audit: nothing measures whether AGENTS.md helps; research (Gloaguen et al. 2026, "Evaluating AGENTS.md") found LLM-written context files can lower success and raise cost. An audit step that tries one task with and without a doubtful rule would ground pruning in evidence (claude-code-web, research for strange-loop)

## Resolved
- O1 2026-10-30 [friction] Step 4: `docmap.py` lived inside SKILL.md (765 lines), so every install retyped it - expensive in output tokens and error-prone for a file that must be verbatim (claude-code-web, adopting into the genome) → 5.1.0
- O2 2026-10-30 [failure] docmap update: the DECISIONS index landed between D1 and D2 when the title and intro paragraph have no blank line between them, as in the skill's own template (claude-code-web, first run of evals/run.py) → 5.1.0
