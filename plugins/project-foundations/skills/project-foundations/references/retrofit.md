# Retrofit procedure

For project-foundations' Retrofit mode (existing project without the scaffolding). Step numbers (Step 0-7) are SKILL.md's.

Templates: read one only when you create that file or restructure an existing one into its shape (the Template column of the module catalogue, `references/modules.md`): usually `agents.md`, `agents-local.md`, `status.md`, `worklog.md`, `decisions.md`; the others only for modules the project lacks. Moving existing content (steps 5-6) needs no template.

1. **Inventory** every instruction file and doc; build a table *rule or fact → where it appears → conflicts*.
2. **Classify and route** each piece: session rules → `AGENTS.md`; machine facts (absolute paths, interpreter, host, RAM budget, local checkouts, editor or SSH quirks) → `AGENTS.local.md`, with the key in `AGENTS.local.example.md`; a person's cross-project conventions → their defaults file; current state → STATUS; dated history and command/result tables → WORKLOG (verbatim, original dates); choices with reasons → DECISIONS (keep existing IDs and files); folder-specific rules → that folder's README (or nested AGENTS.md); how-to for humans → README or docs; finished specs → `docs/archive/`.
3. **Respect what works**: keep names and formats other docs or commits reference.
4. **Show the migration plan** (create / move / merge / shrink, canonical file named) before moving or deleting anything; wait for approval if the user is present.
5. **Move, don't retype**: `git mv` whole files; move sections verbatim with a script.
6. **Backfill only from evidence**: reconstruct decisions from commits or docs where the reason is recorded, marked `(reconstructed from <source>)`; otherwise open questions.
6a. **Id clashes**: if the existing docs already use bare `D<n>` ids of another ledger (a lab's or a fork's own decision numbers), give the new decision ledger a free prefix (`TD`, `PD`) through `indexes` (`references/docmap-config.md`, Ids) instead of numbering it `D1...`; otherwise `check` warns about every old citation. Exempt files only with `id_missing_exempt`.
7. **Check claims against the code**: STATUS or old instructions often describe work that doesn't exist. Correct the snapshot and say so.
8. Then do Step 4.
9. **Commit in reviewable steps**, each leaving the repo consistent (docs before the instruction file that references them).
