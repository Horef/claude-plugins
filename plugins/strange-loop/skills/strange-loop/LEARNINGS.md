# Learnings: strange-loop

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-10-30 [wish] §4 step 6: blind A/B judging is described but not tooled; a `loop.py judge <unit> <case>` that writes the packet (case, rubric, outputs shuffled, key kept aside) would make verification cheap enough to always do (claude-code-web, building 0.1.0)
- O2 2026-10-30 [friction] §2 where to write: each machine must point ~/.config/strange-loop/genome at its clone by hand, and claude.ai chats with a Mac connector see a different path; a setup step in the README covers it but nothing checks it (claude-code-web, building 0.1.0)
- O3 2026-10-30 [missing] §6 forgetting: `win` observations are per unit, not tied to the rule they protect, so pruning can't tell which rules earned their place; ACE/ExpeL use per-item helpful/harmful counters - consider rule ids or section anchors in wins (claude-code-web, building 0.1.0)
- O4 2026-10-30 [wish] §5: an adapter that turns `evals/cases.md` into `claude plugin eval` cases would give Claude Code users the with/without-plugin comparison for free; not built because the layout was read from docs, not tried (claude-code-web, building 0.1.0)
- O5 2026-10-30 [wish] §2: the seed observations in the other units came from reading, not use; the first real reflection should check how many of them use confirms, which measures how good "reading" evidence is (claude-code-web, building 0.1.0)

## Resolved
- O7 2026-10-30 [friction] §4 step 7 / loop.py: after 'loop.py note' the new id has to be fished out of LEARNINGS.md to pass to 'bump --obs'; a failed grep left a commit without its version bump (caught by reading the log). Wanted: 'bump --obs last' or 'note' printing the bare id (claude-code-web, scientific-figures 6.2.1) → 0.2.0
- O6 2026-10-30 [friction] §2 / loop.py digest: seed observations from adoption or reading count toward RIPE_OPEN, so a freshly adopted unit with 5 seeds shows in every session digest although none is confirmed by use; proposal for the owner (kernel): count only observations seen in use, e.g. exclude lines marked 'from reading', or require one ripe item (claude-code-web, first digest run) → rejected: the owner keeps the threshold as a basic reasonability check (2026-10-30)
