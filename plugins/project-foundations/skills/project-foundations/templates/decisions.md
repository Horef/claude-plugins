Produces `docs/DECISIONS.md` - append-only, stable IDs; read when it is first written or when decisions are backfilled.

```markdown
# Decision log
Every choice between alternatives, and every gap the code or sources leave that we filled ourselves. IDs are permanent. To change a decision, add a new entry and set the old one's status to "superseded by" the new ID; do not rewrite it. If the new entry replaces only part of it, keep the status accepted and add "partly superseded by D<n>: <which part>" (`check` reads that as partial and warns about no citations of it).

## D1. <Decision title> (<YYYY-MM-DD>; status: accepted | provisional - confirm with owner | superseded by D7)
- **Context:** <the problem and constraints>
- **Decision:** <what we do>
- **Alternatives:** <option> - <why not>
- **Consequences:** <what this makes easy/hard; when to revisit>
- **Evidence / source:** <link, paper, benchmark, commit; research: established/plausible/unresolved>
```

`docmap.py update` inserts and refreshes an ID index after the intro paragraph; `check` warns when a doc cites a D-id that doesn't exist. Headings must match `## D<n>. <title>`. For many large independent decisions in a team service, one file per decision (`docs/decisions/NNNN-title.md`, MADR) also works; then set `indexes` in the config accordingly.
