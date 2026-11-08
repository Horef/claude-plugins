# docmap configuration reference

Every key `tools/docmap.py` reads from `[tool.docmap]` in `pyproject.toml` (or the top level of `docmap.toml`). Defaults are in `DEFAULTS` at the top of the script. In globs, `*` also matches `/`.

```toml
[tool.docmap]
exclude = ["references/*"]            # never mapped (vendored copies, large reference material)
readme_exempt = []                    # folders that need no README
docstring_exempt = []                 # files that need no header doc
link_exempt = ["docs/archive/*"]      # markdown whose relative links are historical
lifecycle = ["docs/*.md"]             # docs that must open with a Status line (generated/append-only logs are exempt)
lifecycle_exempt = []                 # e.g. ["docs/briefs/*"] if briefs are throwaway
lifecycle_strict = false              # true: missing/stale Status lines fail CI (switch on once every doc has one)
verify_max_days = 60                  # a "current" doc older than this is due for re-verification
proposal_max_days = 30                # an open proposal older than this: decided? supersede it
map_files_max = 150                   # MAP.md lists files up to this many code files; beyond, folders only
read_max_tokens = 8000                # warn when a file agents read whole (AGENTS, STATUS, WORKLOG, MAP) is bigger
read_total_max_tokens = 12000         # warn when those files together are bigger (the cost of a session start)
status_line_max_words = 80            # warn when a bullet or paragraph line in STATUS is longer: one short line per workstream, detail in its folder
id_scan_exempt = ["docs/archive/*", "docs/worklog/*", "docs/WORKLOG.md", "backlog/*"]   # markdown where ids are neither defined nor checked for bare citations
id_cite_exempt = []                   # ids that may be cited bare anywhere: exact ids or regexes that match a whole id, e.g. ["L\\d", "A1"]

[tool.docmap.facts]                   # generated docs/FACTS.md: one row per key value, read from its source
"default cell" = { file = "configs/cell.json", key = "id", note = "D27" }      # key = dotted path in JSON/TOML
"encoder preset" = { file = "src/mypkg/defaults.py", pattern = "^ENCODER = \"(.+)\"" }  # or a regex with one group
"calibrated weights" = { files = "configs/generators/*_weights_*.json", keys = "^[abc]_h3_" }  # a glob: one row per (file, top-level key)
"morphology" = { files = "configs/enc/*.json", key = "spatial.sigma" }          # a glob + a dotted key: one row per file

[[tool.docmap.forbid]]                # one block per architectural rule
source = "mypkg"
except = ["mypkg.adapters"]           # where the import is allowed
imports = ["torch", "neuron"]
reason = "core runs without heavy backends"

[tool.docmap.runs]                    # research projects: run index from run manifests (JSON)
manifests = "outputs/**/manifest.json"
out = "docs/RUNS.md"
columns = { run = "run_id", created = "created_utc", commit = "project_git.revision", config = "config_hash" }
# columns map a header to a dotted key in the manifest; the second column is the sort key (use the date)
# Also available (see DEFAULTS in the script): agents_max_lines (default 150), indexes (heading patterns for the ID
# indexes), portable / portable_exempt (files scanned for machine-specific paths), portable_allow (paths that are facts
# about other code, e.g. an upstream's hard-coded "/home/someone"), local / local_example (file names)
```

Facts from many files: `files` is a glob over the tracked JSON or TOML files, matched with `fnmatch` like every other glob in docmap (`*` also crosses `/`, so `configs/*.json` includes subfolders). With the optional `keys` (a regex, `re.search`) each matching top-level key is one row, named `<fact name>: <key>`; a key that occurs in several files is named `<fact name>: <key> (<file stem>)` so every label is unique. With the optional `key` (a dotted path, as for a single file) each file is one row named `<fact name>: <file stem>`. Rows are sorted by file, then key. Use `file` + `key` (or `pattern`) for one value; the forms can be mixed in one table. A glob that matches nothing shows a `NO FILES MATCH` row, a file that cannot be parsed shows `UNPARSEABLE FILE`, a missing `key` shows `MISSING KEY`, and values are flattened to one line.

Ids: `check` finds the id families a doc defines (`A1`, `H3`, `NB-H1`): as `##`-`####` headings, as line-start bullets (`- A1.`, `- A1:`) or in the first column of a table headed `id`. A family counts in a file only with at least two ids defined there, or its `<family>1`. An id defined in two or more folders (a folder under `docs/<group>/<slug>/` is one scope; otherwise the file's folder) is ambiguous, and `check` warns, once per citing file and family, about every file that cites such an id bare. It does not warn when the citing file is in one of the defining scopes, when the line names one defining scope's slug, when the id matches `id_cite_exempt`, or when the file matches `id_scan_exempt` or is superseded or historical; tagged ids (`NB-A1`), ranges like `L2/3`, code spans, URLs, generated blocks, code fences and HTML comments are not citations. Tag folder-local ids with the folder's short tag. `python tools/docmap.py ids` lists the families, where each is defined, the ambiguous ones first, and who cites them bare.

Budgets: `read_max_tokens` applies to each file agents read whole at session start; `read_total_max_tokens` to the sum of all of them. `check` warns on either, `stats` shows both. To shrink a WORKLOG that is over budget although every entry is from the current month: `python tools/docmap.py rotate --keep N` keeps the newest N entries and moves the rest to `docs/worklog/YYYY-MM.md` (plain `rotate` moves only earlier months).
