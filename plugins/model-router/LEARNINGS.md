# Learnings: model-router

Observations from use, written by the agents that used this plugin; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-10-30 [wish] history: the router already learns tier defaults from reruns; its per-tier rerun statistics are exactly the kind of evidence strange-loop wants. Writing a one-line observation when a tier suggestion is applied (or a step needed two reruns) would let reflection passes on skills see which ones are routed too low (claude-code-web, adopting into the genome)
- O2 2026-10-30 [friction] code headers: `hooks/*.ts` and `tests/*.tsx` start with imports, so project-foundations' docmap check reports "no header comment"; the genome exempts them for now. Add a one-line purpose comment to each when the files are next changed (claude-code-web, setting up the genome)

## Resolved
