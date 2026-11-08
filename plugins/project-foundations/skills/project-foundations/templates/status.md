Produces `docs/STATUS.md` - snapshot, overwritten each session (≤ ~80 lines); read when it is first written or rebuilt.

```markdown
# Status
Updated <YYYY-MM-DD>. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Workstreams
| Workstream | Where | State | Next |
|---|---|---|---|
| <a feature, an investigation, a research question, a write-up> | `<its folder or plan file>` | <one short phrase> | <smallest next step> |

## Works (verified)
| Capability | How verified |
|---|---|
| <thing> | `<command>` → <result>, <date> |

## Doesn't work yet / known issues
- <issue> (<D/R/B id>)

## Next actions
1. <smallest next step> - <what it needs>

## Blockers
- <blocker> - <who/what unblocks it>
```

STATUS keeps one line per workstream; detail moves to the workstream's own folder (`docmap.py check` warns about a line longer than `status_line_max_words`).

Anything added but not verifiable here (CI without a remote, tests in an env this machine lacks) goes under "Doesn't work yet / unverified", with what was verified instead.
