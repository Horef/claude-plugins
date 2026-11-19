# Learnings: model-router

Observations from use, written by the agents that used this plugin; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open

## Resolved
- O5 2026-11-19 [misled] history: a run cut short by quota or a lost connection can only be marked weak, so it pushes the advice up (design-review on deep: 2 of 4 weak from quota, owner removed them by hand 2026-11-19); wants a 'cut short' verdict the advice skips (claude-code, diagnosing a relative's empty helper stats) → 0.24.0
- O4 2026-11-19 [failure] rules: switching Helpers on mid-chat re-registers the plan tool but never sends rule 6 (toldHelpers stays ''), so the model is offered 'helper' without instructions until a new chat (claude-code, diagnosing a relative's empty helper stats) → 0.24.0
- O3 2026-11-19 [failure] helpers: the pane says helpers are ready when the chat is not in a Herdr terminal (no HC_TERMINAL_ID); every helper step then silently becomes a subagent and no helper run is recorded, so the stats stay empty with no reason shown (register.tsx hcOnPath/fallback ~2722) (claude-code, diagnosing a relative's empty helper stats) → 0.24.0
- O1 2026-10-30 [wish] history: the router already learns tier defaults from reruns; its per-tier rerun statistics are exactly the kind of evidence strange-loop wants. Writing a one-line observation when a tier suggestion is applied (or a step needed two reruns) would let reflection passes on skills see which ones are routed too low (claude-code-web, adopting into the genome) → 0.18.0
- O2 2026-10-30 [friction] code headers: `hooks/*.ts` and `tests/*.tsx` start with imports, so project-foundations' docmap check reports "no header comment"; the genome exempts them for now. Add a one-line purpose comment to each when the files are next changed (claude-code-web, setting up the genome) → 0.9.2
