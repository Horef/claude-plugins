Produces `CLAUDE.md` (always) and `.github/copilot-instructions.md` (if Copilot is used), plus the Kiro note; read when shims are written or repaired.

`CLAUDE.md`:

```markdown
@AGENTS.md

<!-- Claude Code-only additions below. Shared rules belong in AGENTS.md. -->
```

`.github/copilot-instructions.md` (if Copilot is used):

```markdown
Follow [AGENTS.md](../AGENTS.md) at the repository root; its rules are mandatory. Read it and `AGENTS.local.md` (this machine), then `docs/STATUS.md` and `docs/MAP.md`, before any change. Most important if it is not loaded:
- <the 3 rules whose violation does the most damage, e.g. never commit data/secrets; run tests and `python tools/docmap.py check` before committing; never force-push>
```

Kiro reads root `AGENTS.md` natively: don't create a steering file just to point at it. Create `.kiro/steering/<topic>.md` only for Kiro-specific additions. Don't restate rules in shims beyond the top-3 fallback.
