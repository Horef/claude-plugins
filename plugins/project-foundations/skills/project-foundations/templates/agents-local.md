Produces `AGENTS.local.example.md` (tracked) and `AGENTS.local.md` (git-ignored); read whenever either is created, and in Upgrade 3a.

The example lists every key a machine needs; the local file holds this machine's values in the same `- key: value` form, so `docmap.py check` can warn about missing keys. A line tagged `[module]` belongs to that module: include it only when the project has chosen the module, and drop the tag. Agents create the local file when it is missing (`python tools/docmap.py local` prints what it can detect; ask the user for the rest) and update it when a machine fact changes. Add project-specific keys for anything outside the repo (sibling checkouts, data roots, cluster login). No secrets: agents read this file into their context. A machine's quirks the user wants agents to respect (an editor that rewrites tables, a passphrase-protected SSH key) go under `notes`.

```markdown
# AGENTS.local.md template

Copy to `AGENTS.local.md` (git-ignored) and fill it in for this machine; agents create and update it. One `- key: value` line per fact. Tracked files refer to these keys, never to their values. No secrets: agents read this file into their context.

- machine: <host name (OS, arch, CPUs, RAM)> - from `python tools/docmap.py local`
- python: <absolute path of the interpreter or toolchain the project uses (`python` for Python projects)> - what `python` in AGENTS.md means
- [compute] memory_budget: <peak RAM that local runs may use, e.g. "6 GB, never above 10 GB">
- [compute] compute: <where heavy jobs run and how to reach them, or "none">
- <one key per location outside the repo, e.g. upstream_checkout: <path to the read-only checkout>>
- notes: <quirks agents must respect here, e.g. the SSH key asks for a passphrase, so push unpiped>
```
