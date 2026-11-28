Produces `CHANGELOG.md`, `docs/RESULTS.md`, `docs/plans/<slug>.md` and `docs/reviews/…`; read when one of these modules is chosen in Step 2.

- `CHANGELOG.md`: Keep a Changelog - `## [Unreleased]` with `### Added / Changed / Fixed / Removed`.
- `docs/RESULTS.md`: numbered sections `## N. <short title> (<YYYY-MM-DD>)` — each opens with a short provenance block (run/commit, config or its hash, command, date, output path), then setup, numbers with units, interpretation labelled established/plausible/unresolved, open problems. Corrections are new sections. The generated index lists them. `docmap.py check` warns when an entry lacks provenance fields (configurable via `results_provenance` / `results_provenance_since`).
  ```markdown
  ## 1. <short title> (2026-11-15)
  - **Run:** `<run id>` | **Commit:** `<git sha>` | **Config:** `<path or hash>` | **Date:** `2026-11-15`
  - **Command:** `<exact command>`
  - **Output:** `<output path or artifact>`
  ```
- `docs/plans/<slug>.md`: a `Status:` line in the first lines, in the forms `check` reads: `Status: proposal (<date>)`, `Status: current (verified <date>; in progress)`, `Status: historical (done <date>; results <ids>)`, `Status: historical (abandoned <date>: <why>)`; then Objective, Non-goals, Steps, Verification, Risks.
- `docs/reviews/…`: findings B/Q/M with severity, evidence, fix; a resolution log at the top; `Status: current (verified <date>)` until every finding is resolved, then `Status: historical (resolved <date>)`.
