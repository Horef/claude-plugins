# Evidence ledger

One row per claim, written before any prose. `source` is a key in `candidates.jsonl` (status `in`).
evidence: measured | modelled | cited | inferred. verified: unchecked | confirmed | corrected | not-found | abstract-only | indirect (the source cites another paper for the claim).
Escape a pipe inside a cell as `\|`. A quote is required unless evidence is `inferred`.

| id | claim | value | conditions | source | locator | quote | evidence | verified | note |
|----|-------|-------|------------|--------|---------|-------|----------|----------|------|
