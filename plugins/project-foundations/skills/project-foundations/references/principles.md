# Guiding principles

Why project-foundations works the way it does (moved from SKILL.md). Explain these if the user asks why.

1. **One source of truth for rules.** `AGENTS.md` is read natively by Claude Code, Copilot, Kiro, Codex, Cursor and others; every other instruction file is a thin pointer. Duplicated rules drift and contradict each other.
2. **Short always-loaded files.** Keep `AGENTS.md` under ~120 lines (`check` warns above 150). For each line ask "would an agent make a mistake without this?" Folder-specific rules go in that folder's README (or a nested `AGENTS.md`, below); procedures go in docs.
3. **Write what lasts, generate what changes** (SKILL.md, "How the documentation is layered").
4. **Evidence over claims.** Status lines say how something was verified (command + result). Never describe planned work as done; never present a mock or synthetic test as real validation.
5. **Enforce mechanically.** Instructions are advisory; `.gitignore`, tests, `docmap.py check` and CI are not. A rule broken twice should become a check.
6. **Append, don't rewrite history.** Decisions are superseded, not edited; worklog and results entries are never deleted (old months are moved, not removed).
7. **Leave things committable.** Each session ends with tests and `docmap.py check` green, docs updated, work committed (and pushed if there is a remote) - or an explicit note of what is not.
8. **Agents maintain it.** Every artifact here is meant to be created and kept current by agents following AGENTS.md, so a person only reads, reviews and answers open questions.
9. **Shareable without losing specificity.** Three places for facts: project facts (rules, boundaries, people and approvals, shared infrastructure such as a lab cluster) are tracked; this machine's facts (absolute paths, interpreter, host name, RAM budget, local checkouts, editor or SSH quirks) go in `AGENTS.local.md`; a person's cross-project conventions go in their defaults file (SKILL.md, Defaults). Tracked files name a local key ("the `python` interpreter in AGENTS.local.md"), never its value. A colleague who clones the repo gets every rule and fills in their own machine.
10. **Every document says whether it is still true.** Each doc under `docs/` (except the generated and append-only ones) opens with a Status line: `Status: current (verified YYYY-MM-DD)`, `Status: proposal (YYYY-MM-DD)`, `Status: superseded by <D-id or doc>` or `Status: historical`. `check` warns when a current doc's verification is old, when a proposal stays open, and when a live doc cites a superseded decision. `docmap.py docs` lists the audit queue, oldest verification first. This is what stops design proposals and reviews from turning silently into stale "facts".
