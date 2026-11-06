Produces `docs/STATUS.md` - snapshot, overwritten each session (≤ ~80 lines); read when it is first written or rebuilt.

```markdown
# Status
Updated <YYYY-MM-DD>. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

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

Anything added but not verifiable here (CI without a remote, tests in an env this machine lacks) goes under "Doesn't work yet / unverified", with what was verified instead.
