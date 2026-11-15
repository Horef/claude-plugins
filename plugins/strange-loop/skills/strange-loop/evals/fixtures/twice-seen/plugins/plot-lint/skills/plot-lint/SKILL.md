---
name: plot-lint
description: "Lint figure layouts before rendering. Use when checking a figure for overlaps."
---

# Plot lint

## 1. Run the lint
`python3 scripts/lint.py figure.json` lists overlapping labels. A figure is a JSON file with `texts` and `patches`,
each a box `{"x", "y", "w", "h"}`; patches have `"filled": true|false`.

## 2. Checklist before rendering
- Run the lint and fix every overlap it lists.
- Check by eye that no label sits on a filled patch: the lint does not see patches.

## Learning loop

Record lessons with the strange-loop note command (strange-loop section 2).
