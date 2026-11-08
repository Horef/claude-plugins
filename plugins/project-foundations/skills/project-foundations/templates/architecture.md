Produces `docs/ARCHITECTURE.md`; read only when the project has boundaries or invariants worth stating (Step 2).

```markdown
# Architecture
Status: current (verified <YYYY-MM-DD>). Only what rarely changes; the file-level map is generated in docs/MAP.md.

## Overview
<The problem and the main data/control flow, possibly as a small text diagram.>

## Boundaries and invariants
- <"core never imports torch, NEURON or TwinProp at module level"> - enforced by `[tool.docmap.forbid]`
- <"every model output passes validation before it is accepted"> - enforced by tests in <file>

## Cross-cutting concerns
<Config, logging, cache keys, errors, persistence.>
```

A long design reference (rationale per component) can live alongside as `docs/design/*.md` split per component, so agents read one part instead of one huge file.
