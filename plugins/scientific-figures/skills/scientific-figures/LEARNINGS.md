# Learnings: scientific-figures

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O2 2026-10-30 [friction] §5 lint: the skill itself says the linter "does not see filled patches (icon boxes, bands) covering text" and that streamlines are not checked; both are known blind spots handled by looking. Candidates to codify as lint checks once use confirms they still bite (claude-code-web, adopting; from the skill text)
- O3 2026-10-30 [wish] description and §0: the skill is written for one person (his notes, DEVONthink, Anki, his neuron preference). To share it, the house style and loop can stay general while the person-specific parts (DEVONthink import rules, Anki, preferences) move to a referenced file or a person-layer defaults file. Owner's call (claude-code-web, adopting; from reading)
- O5 2026-10-30 [friction] §3 house style / benchmark round2: t1_saddle: the growing (vermilion) and decaying (blue) eigen-directions are both dashed, so they differ by hue only; in the grayscale copy only lightness separates them, against the §3 rule that every categorical colour has a second channel (claude-code-web, first render of the benchmarks outside the Mac)

## Resolved
- O7 2026-10-30 [failure] lib check.py, topng.py, benchmark: render/topng wrote into folders that may not exist: Playwright creates them, headless Chrome (the Mac's and CI's path) does not, and lecture1.py wrote to the claude.ai-only /home/claude/work; CI failed with 'Failed to write file' (github-actions, first CI run of the figure evals) → 6.2.2
- O6 2026-10-30 [failure] lib check.py: check.find/_find_playwright only looked in three hard-coded folders, so C.render and topng failed with 'no Playwright' in a container where node loads Playwright through NODE_PATH (lecture1.py crashed); now it also takes $SF_PLAYWRIGHT and asks node to resolve the module (claude-code-web, first eval run outside the Mac) → 6.2.1
- O4 2026-10-30 [missing] evals: the benchmark scripts on the Mac are the natural scripted eval, but nothing recorded which figures a change should be checked against or kept their last good renders for before/after comparison; `evals/run.py` now runs the builders, the renders are still not kept (claude-code-web, adopting) → 6.2.0
- O1 2026-10-30 [friction] §0 setup: every claude.ai chat tars the library on the Mac, stages it, unpacks it and later ships changes back as uniquely named archives; if `sciencefig` lived in a git repository (this genome or its own), any harness with network could clone or pip-install it and improvements would return as commits. Needs the owner to push the library and to check the asset licences (Servier CC BY is fine with credit; check each Bioicons item) (claude-code-web, adopting; from reading) → 6.2.0
