Produces `AGENTS.md`; read when it is written (Bootstrap) or restructured (Retrofit, Upgrade 3 and 6b), and by Audit to compare a drifted one.

```markdown
# <Project name> - agent instructions

<One or two sentences: what this project is.> It is **not** <the main non-goal>.
Goal, scope and open questions: `docs/BRIEF.md`. Scaffolding: the project-foundations skill (version in `tools/docmap.py`, `DOCMAP_VERSION`).

## Start of every session
1. `git status` (and `git pull --rebase` if there is a remote). Do not commit, discard or overwrite changes you did not make; ask.
2. Read `AGENTS.local.md` (git-ignored): this machine's interpreter, paths, limits and quirks. If it is missing, create it from `AGENTS.local.example.md` with `python tools/docmap.py local` and the user's answers.
3. Read `docs/STATUS.md`; skim the latest entry in `docs/WORKLOG.md`.
4. Before changing behavior covered by a decision, find it with `python tools/docmap.py find <topic>` and read it with `python tools/docmap.py get D<n>`. Never read `docs/DECISIONS.md` or `docs/RESULTS.md` whole: they only grow.

## Finding your way
1. `docs/MAP.md` (generated): every folder and code file with a one-line summary.
2. The folder's `README.md`: purpose, folder rules, and a generated table of its files and who imports them.
3. The file's header docstring; `python tools/docmap.py show <path>` lists its symbols, signatures and importers.
4. Before changing a function or class: `python tools/docmap.py where <Name>` (definition, importers, every use); run the tests it lists. `calls <Name>` shows its callers and callees, `deps <folder>` how modules depend on each other, `map --budget 2000` the repo's most-used symbols.

## Environment and commands
- `python` means the interpreter named by `python` in `AGENTS.local.md` (<how the env is built, e.g. `conda env create -f env/environment.yml`>); never the base interpreter.
- Install: `<command>`. Tests (offline, fast): `<command>`. Docs check: `python tools/docmap.py check`.
- Limits: stay within `memory_budget` (AGENTS.local.md); ask before <heavy work>; heavy jobs run on <where; access details under `compute` in AGENTS.local.md>.

## Boundaries
- Read-only: <paths in the repo; checkouts outside it by their AGENTS.local.md key>. Never commit: <paths/patterns> (in `.gitignore`; never `git add -f`).
- Tracked files name AGENTS.local.md keys, never their values: no absolute paths, user or host names (`docmap.py check` flags home paths and the local file's paths).
- Import boundaries are enforced by `docmap.py check` (`[tool.docmap.forbid]` in `pyproject.toml`; listed in `docs/MAP.md`).
- <Sensitive-data rule, if any.>

## Conventions
- **Design for what will vary next.** Before building something that will keep being used (a screen, a config schema, a file format, a function's signature, a report or figure layout), ask what it will have to hold next: new parameters, conditions, item kinds, tests. Make it handle them from the data (iterate over fields, diff an item against its siblings, name values from their keys and units) rather than from a hand-written list of today's cases; where a special case stays, anything it does not list must still show or fail loudly, never vanish.
<Only project-wide rules an agent would get wrong. Folder-specific rules live in that folder's README.>

## Keeping the project maintained
Update in the same commit as the change that requires it:

| When you… | Update |
|---|---|
| add a code file | its header docstring/comment: first line = what it is for (shown in the map), then how to use it |
| add a folder with code | its `README.md`: a purpose paragraph whose first sentence stands alone |
| change what a file or folder is for | that first line / paragraph |
| add, move, rename or delete files | run `python tools/docmap.py update` |
| learn a fact about this machine (path, interpreter, limit, quirk) | `AGENTS.local.md` only; if every machine needs that key, add it to `AGENTS.local.example.md` |
| finish a unit of work | `docs/STATUS.md` (overwrite) and a new entry at the top of `docs/WORKLOG.md` with commands and results (`python tools/docmap.py worklog "TITLE" body.md --status` inserts it dated, rotates old months and sets STATUS's date) |
| choose between alternatives, or fill a gap | the next D entry in `docs/DECISIONS.md`; to reverse one, a new entry that supersedes it |
| add or change a module boundary | `docs/ARCHITECTURE.md` and `[tool.docmap.forbid]` |
| change user-visible behavior, CLI or config | `README.md` and `CHANGELOG.md` |
| run an experiment | `python tools/docmap.py runs`; a numbered section in `docs/RESULTS.md` citing the run id |
| start multi-session work | a plan in `docs/plans/` with a Status line |
| write or substantially revise a doc in `docs/` | its Status line: `current (verified <today>)`, `proposal (<today>)`, `superseded by <id>` or `historical`; a decided proposal is superseded by its D entry |
| change a default, preset or key number | its source (config/code); `docmap.py update` regenerates `docs/FACTS.md`. Docs cite FACTS.md rather than copying the value |
| supersede a decision | the old entry's heading says `superseded by D<n>`; fix the live docs that `check` then lists |
| find that this scaffolding itself (a template rule, the docs layout, a `docmap.py` check or command) misleads you, is missing something or costs too much | nothing here: send it to the skill that installed it, `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note project-foundations <kind> "<what happened, what would have helped>" --context <this project>` (if that fails and the person takes part in improving their skills, an `Observations for project-foundations` block in your reply); lessons about other skills go to that skill the same way |
| reach a milestone (a result merged, a phase closed) | a docs audit: `python tools/docmap.py docs`, re-read the oldest or affected docs against code, DECISIONS and RESULTS, fix them and re-date their Status lines |

- Before every commit: `python tools/docmap.py update`, then `python tools/docmap.py check` (CI runs it too). When `check` warns about old WORKLOG months, run `python tools/docmap.py rotate` (`rotate --keep N` also moves older entries of the current month).
- Never describe planned or partial work as done; say how it was verified.
- Keep this file short; add a rule only when an agent got something wrong.

## Git
- One logical, tested change per commit: <commit style>, summary ≤72 chars, body says why; cite D/R ids.
- Before committing: tests and docs check green, `git diff --check` clean, staged diff reviewed for never-commit files.
- After committing: `git push origin <branch>` (run unpiped if the SSH key prompts; never ask for or store the passphrase). If you can't push, say so.
- Never force-push, rewrite pushed history or amend pushed commits. Ask before anything destructive.
```
