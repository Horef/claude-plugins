Produces `docs/START_HERE.md` (or `START_HERE.md`); read when adding a human+agent landing page with a troubleshooting table.

```markdown
# Start here — <Project name>

Status: current (verified YYYY-MM-DD)

<Two sentences: what this project does and who this page is for (both humans and agents).>

## Quickstart

1. Check `AGENTS.local.md` (created from `AGENTS.local.example.md`) for this machine's interpreter and paths.
2. Run the smoke test: `<fast offline test command>`.
3. Orientation: `docs/BRIEF.md` (scope), `docs/STATUS.md` (current state), `docs/MAP.md` (code layout).

## Common tasks

Repeated tasks have workflow cards in `docs/workflows/` (files to read with line ranges, exact commands, expected outputs and failure signs):

- [<task 1>](workflows/<task-1>.md) — <one-line summary>

## What breaks, how to tell, how to fix

| What breaks | How to tell | How to fix |
|---|---|---|
| <common failure 1> | <exact symptom, log line or check output> | <exact fix> |
| <common failure 2> | <exact symptom, log line or check output> | <exact fix> |
```
