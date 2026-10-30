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

[tool.docmap.facts]                   # generated docs/FACTS.md: one row per key value, read from its source
"default cell" = { file = "configs/cell.json", key = "id", note = "D27" }      # key = dotted path in JSON/TOML
"encoder preset" = { file = "src/mypkg/defaults.py", pattern = "^ENCODER = \"(.+)\"" }  # or a regex with one group

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
