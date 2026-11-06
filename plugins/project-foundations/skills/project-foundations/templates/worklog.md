Produces `docs/WORKLOG.md` - append-only, newest first; read when it is first written or when migrating old history into it.

```markdown
# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

## <YYYY-MM-DD> - <short title>
Changed: <summary>. Decisions: <D ids, or none>.

| Verification command | Result |
|---|---|
| `<cmd>` | <result> |

Next: <one line>
```

Entry headings must contain a date (`2026-10-23` or `23 October 2026`) so `docmap.py rotate` can move past months into `docs/worklog/`. Migrated entries keep their original wording.
