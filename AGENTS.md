# claude-plugins - agent instructions

Sergiy Horef's Claude Code marketplace and the **genome** of his self-improving skills: the source copy of every skill and mod, which agents improve from use through the strange-loop procedure. It is **not** a place for project-specific notes: lessons about one project belong in that project's own docs.
Design and rationale: `plugins/strange-loop/README.md`; research behind it: `docs/RESEARCH.md`.

## Start of every session
1. `git status` (and `git pull --rebase` if there is a remote). Do not commit, discard or overwrite changes you did not make; ask.
2. Read `docs/STATUS.md`; skim the latest entry in `docs/WORKLOG.md`.
3. `python plugins/strange-loop/skills/strange-loop/scripts/loop.py status`: units and the lessons waiting in them.
4. Before changing behaviour covered by a decision: `python plugins/project-foundations/skills/project-foundations/scripts/docmap.py find <topic>`, then `... get D<n>`; never read `docs/DECISIONS.md` whole.

## Finding your way
- Each plugin is `plugins/<name>/` with `.claude-plugin/plugin.json` (name, version, description); skills are `plugins/<name>/skills/<name>/SKILL.md`; the listing is `.claude-plugin/marketplace.json`.
- A **unit** is a skill folder, or a mod's plugin root. Every unit has `LEARNINGS.md` (observations), `CHANGELOG.md` (versions) and `evals/` (`run.py` scripted, `cases.md` judged). `loop.py where` lists them.
- Skill helper code lives in the skill's `scripts/`; file docstrings say what each script does.

## Commands
- Unit evals: `python plugins/strange-loop/skills/strange-loop/scripts/loop.py eval <unit>` (exit 2 = not run, e.g. a library that lives on another machine; never report that as a pass).
- Genome check: `python plugins/strange-loop/skills/strange-loop/scripts/loop.py check --base origin/main`.
- Docs check: `python plugins/project-foundations/skills/project-foundations/scripts/docmap.py update`, then `... check` (configuration in `docmap.toml`). The genome runs the skill's own copy of docmap; there is no `tools/docmap.py` here.
- Mod tests (model-router) run inside Claude Code's function-hooks test runner; they are not run in CI.

## Rules for changing a unit
- Follow the strange-loop skill: observations go in `LEARNINGS.md` without a version bump; any other change to a plugin bumps its version with `loop.py bump`, which also writes the CHANGELOG entry and resolves the observations it cites. `check --base` fails on a changed plugin with an unchanged version.
- Change classes (fix, learn, restructure, kernel) and the kernel rules are in the strange-loop SKILL.md, sections 3 and 7. Kernel changes need the owner's approval.
- Never edit or delete an existing eval case in the same commit as the change it grades; adding cases is fine.
- Owner preferences in a skill (marked or obvious from context, e.g. house style) change only when the owner says so.
- Keep each SKILL.md under ~500 lines and its description under 1024 characters; move detail into files the skill references.
- Machine paths never go into tracked files: libraries that live elsewhere are found through environment variables or `~/.config/...` files, as `scientific-figures/evals/run.py` shows.

## Keeping the project maintained
| When you… | Update |
|---|---|
| finish a unit of work | `docs/STATUS.md` (overwrite) and a new entry at the top of `docs/WORKLOG.md` with commands and results |
| choose between alternatives about the genome itself | the next D entry in `docs/DECISIONS.md` |
| add a plugin | `plugin.json`, a marketplace entry, a row in `README.md`, and the unit files (strange-loop SKILL.md section 8) |
| change what a plugin does for its users | its README and the root `README.md` table |
| write or revise a doc in `docs/` | its `Status:` line |

- Before every commit: `loop.py check`, `docmap.py update` + `check`, the evals of the units you changed, `git diff --check`.
- Never describe planned or partial work as done; say how it was verified.

## Git
- One unit, one logical change per commit. Summary ≤ 72 characters, starting with the unit and version when one changes (`project-foundations 5.2.0: templates on demand`); body says why and cites O-ids and D-ids.
- Work on a branch and open a PR when the harness can; never force-push, rewrite pushed history or change repo settings without an explicit request.
