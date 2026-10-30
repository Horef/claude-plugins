# Learnings: scientific-figures

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-10-30 [friction] §0 setup: every claude.ai chat tars the library on the Mac, stages it, unpacks it and later ships changes back as uniquely named archives; if `sciencefig` lived in a git repository (this genome or its own), any harness with network could clone or pip-install it and improvements would return as commits. Needs the owner to push the library and to check the asset licences (Servier CC BY is fine with credit; check each Bioicons item) (claude-code-web, adopting; from reading)
- O2 2026-10-30 [friction] §5 lint: the skill itself says the linter "does not see filled patches (icon boxes, bands) covering text" and that streamlines are not checked; both are known blind spots handled by looking. Candidates to codify as lint checks once use confirms they still bite (claude-code-web, adopting; from the skill text)
- O3 2026-10-30 [wish] description and §0: the skill is written for one person (his notes, DEVONthink, Anki, his neuron preference). To share it, the house style and loop can stay general while the person-specific parts (DEVONthink import rules, Anki, preferences) move to a referenced file or a person-layer defaults file. Owner's call (claude-code-web, adopting; from reading)
- O4 2026-10-30 [missing] evals: the benchmark scripts on the Mac are the natural scripted eval, but nothing recorded which figures a change should be checked against or kept their last good renders for before/after comparison; `evals/run.py` now runs the builders, the renders are still not kept (claude-code-web, adopting)

## Resolved
