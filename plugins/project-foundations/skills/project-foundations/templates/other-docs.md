Produces `CHANGELOG.md`, `docs/RESULTS.md`, `docs/plans/<slug>.md` and `docs/reviews/…`; read when one of these modules is chosen in Step 2.

- `CHANGELOG.md`: Keep a Changelog - `## [Unreleased]` with `### Added / Changed / Fixed / Removed`.
- `docs/RESULTS.md`: numbered sections `## N. <run name> (<date>, run id, commit, config)` - setup, numbers with units, interpretation labelled established/plausible/unresolved, open problems. Corrections are new sections. The generated index lists them.
- `docs/plans/<slug>.md`: a `Status:` line in the first lines, in the forms `check` reads: `Status: proposal (<date>)`, `Status: current (verified <date>; in progress)`, `Status: historical (done <date>)`, `Status: historical (abandoned <date>: <why>)`; then Objective, Non-goals, Steps, Verification, Risks.
- `docs/reviews/…`: findings B/Q/M with severity, evidence, fix; a resolution log at the top; `Status: current (verified <date>)` until every finding is resolved, then `Status: historical (resolved <date>)`.
