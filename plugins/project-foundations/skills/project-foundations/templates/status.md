Produces `docs/STATUS.md` - snapshot, overwritten each session (≤ ~80 lines); read when it is first written or rebuilt.

```markdown
# Status
Updated <YYYY-MM-DD>. Snapshot only - overwrite each session; history is in `docs/WORKLOG.md`.

## Workstreams
| Workstream | Where | State | Next |
|---|---|---|---|
| <a feature, an investigation, a research question, a write-up> | `<its folder or plan file>` | <one short phrase> | <smallest next step> |

Done: <finished workstream> (`<its folder or write-up>`); <another>.

## In flight
| What | Started | Health check | Expected end |
|---|---|---|---|
| <a long job> | <YYYY-MM-DD>, <job or run id> | `<command printing counts of successes and failures>` | <YYYY-MM-DD> |

## Works (verified)
| Capability | How verified |
|---|---|
| <thing> | `<command>` → <result>, <YYYY-MM-DD> |

## Doesn't work yet / known issues
- <issue> (<D/R/B id>)

## Next actions
1. <smallest next step> - <what it needs>

## Blockers
- <blocker> - <who/what unblocks it>
```

The In-flight section belongs to the compute module: drop it in projects without long jobs (`check` is silent without it, and warns about a row whose ISO expected end has passed). A health check counts successes and failures; a count of result files is not one (failed jobs write files too).

A finished workstream leaves the table for the "Done" line (its plan's Status becomes `historical (done <date>; results <ids>)`). `Updated` is the date of the snapshot, not of every line: `worklog --status` bumps it, so re-check `Works` and open-problem rows whose own dates are older than `verify_max_days` and re-date them (`check` warns about such Works rows).

STATUS keeps one line per workstream; detail moves to the workstream's own folder (`docmap.py check` warns about a bullet or a Workstreams-table row longer than `status_line_max_words`, and about a table row whose cell count differs from its header's: a stray `|` splits a cell). "Next actions" holds only the items that belong to no workstream; a workstream's own next step goes in its table row.

Anything added but not verifiable here (CI without a remote, tests in an env this machine lacks) goes under "Doesn't work yet / unverified", with what was verified instead.
