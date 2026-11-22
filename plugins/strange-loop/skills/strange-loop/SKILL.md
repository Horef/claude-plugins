---
name: strange-loop
size-exception: the reflection procedure and kernel are read whole on every pass; only examples were left to cut (2026-11-17); move section 8's adoption steps to a reference to get back under
description: "Make skills, tools and project scaffolding improve themselves from use: record observations while working, run reflection passes that turn evidence into small verified changes, adopt a skill into the loop, grow a new skill or helper library, audit for bloat and drift. Use when a skill or tool slowed you down or misled you, when lessons are waiting (session digest), or when asked to improve, reflect on, adopt or create a skill."
---

# Strange loop

Skills, helper libraries and project docs are written by agents and used by agents, so the agent that uses them is the one best placed to improve them. This skill is the procedure by which it does, in any harness, without a person maintaining anything by hand. The person reads, reviews, answers questions and holds the few rules the loop may not change by itself.

It is called a strange loop (Hofstadter) because it applies to itself: this skill records its own observations, is reflected on by its own procedure and is checked by its own evals. Like Escher's *Drawing Hands*, the loop needs a level it does not draw: the fixed rules in "Kernel" below, the evals, git history and the owner. That level is what keeps self-modification from drifting into self-deception.

Work happens at three speeds:

| Speed | When | What | Cost |
|---|---|---|---|
| **Notice** | During any task that uses a skill | One line per lesson in that skill's `LEARNINGS.md` | Seconds |
| **Fix** | A plain error you have just verified (wrong path, renamed API, broken example) | Correct it, patch version, CHANGELOG line | Minutes |
| **Reflect** | Lessons are ripe (session digest, `loop.py status`) or the user asks | Turn observations into rules, code, checks or evals; prune; verify; version | One focused session |

**Invoked directly** (the person types `/strange-loop`, or asks "how are my skills doing?"): run `loop.py where`, then `loop.py sync` if there is a clone, then `loop.py status`. Report in a few lines: the units with ripe lessons, open lessons older than six months, anything waiting in the inbox. Offer the next steps (a reflection pass on a ripe unit, adding a skill, an audit, absorbing a pasted reply) and do the one the person picks. With an argument (`/strange-loop reflect <unit>`), go straight to that section. Without a clone (no `~/.config/strange-loop/genome`), explain the setup in two lines instead (README, Setup). Nobody has to invoke this skill for the loop to run: every skill carries its own Learning loop section, and in Claude Code the session-start hook syncs and shows the digest.

## 1. The hierarchy: where a lesson belongs

Every layer has the same shape: an instruction surface, a `LEARNINGS.md` for observations, a history (CHANGELOG, WORKLOG or DECISIONS) and, where possible, checks.

| Layer | Instruction surface | Lessons about… |
|---|---|---|
| Kernel | this skill (`strange-loop`) | how improvement itself works |
| Person | `~/.config/<skill>/…` defaults files, the user's profile/memory | the person's taste and conventions across all projects |
| Skill or tool | `SKILL.md`, its scripts and library | doing one kind of work well, anywhere |
| Project | `AGENTS.md`, `docs/` (project-foundations) | this repository's facts and rules |
| Folder | `README.md` or nested `AGENTS.md` | one part of a project |

**Things made *with* a skill are not the skill.** A figure drawn for one note, a report about one run, a script written for one course is an expression of the skill and belongs to the project that asked for it; only what generalises (rules, tools, reusable material, curated examples) belongs to the skill.

**Artifacts remember their origin.** Some skills are used once and leave lasting artifacts that shape every later session: project-foundations writes AGENTS.md and installs `docmap.py`, a figure skill leaves scripts in a project. Later sessions follow the artifact without loading the skill, so they cannot know where a lesson about it belongs. Therefore every lasting artifact a skill installs carries (1) a provenance line naming the skill and its version, in a place agents read anyway (AGENTS.md, a file header), and (2) the note command for lessons about it, addressed to that skill. Where the artifact runs as a tool, it also compares its version with the person's genome clone and says when a newer one exists, so improvements flow back down into old projects.

**Lessons flow up when they generalise and down when they specialise.** A project lesson that recurs in a second project is really a skill lesson: move it up. A skill rule that only ever matters to one project belongs in that project's `AGENTS.md`: move it down. A preference the person stated is a person-layer fact, not a skill rule, unless the skill is personal on purpose. Never put machine facts (paths, interpreters) above the project layer's `AGENTS.local.md`.

## 2. Notice: recording observations

While using any skill that has a `## Learning loop` section, record a lesson when one of these happens:

| Kind | Means |
|---|---|
| `failure` | The output was wrong or broken, found by a check, a render, the user or you |
| `misled` | An instruction sent you the wrong way (outdated, ambiguous, contradicted by reality) |
| `friction` | It worked but took avoidable effort or tokens |
| `missing` | You needed a tool, rule, example or reference that wasn't there |
| `workaround` | You found a way around a limit (record the way, so it can become the default) |
| `win` | Something in the skill clearly paid off; protects it from being pruned |
| `wish` | Something you, the working agent, wanted: a view, a check, a source, a different workflow |

Format, one line, in the `## Open` section of the unit's `LEARNINGS.md` (the folder holding the skill's `SKILL.md`, or a mod's plugin root):

```
- O12 2026-10-30 [friction] §5 lint: filled patches over text go unnoticed until the render; a patch-overlap check would catch it (claude-code, cell-1542 notes) ×2
```

- Say the section, what happened, and **what would have helped**. Concrete beats general: the next agent must be able to act on it without your context.
- Before adding, read the open list: if it is the same lesson, append ` ×N` (or increment it) instead of a new line. Recurrence is the main evidence the loop has. The note command enforces this: when observations of the unit (any kind, open or resolved) are close to your text it lists them and writes nothing; rerun with `--same O<n>` (the same lesson: adds ×N, today's date and a short detail to that line; a resolved one is reopened as a new open line that carries its count) or `--new` (a different one). `loop.py show <unit> O<n>` looks an id up.
- A warning from a check that your change did not cause (a budget, a stale doc, a slow command) is an observation too: note it with the warning's text, so drift that no single session feels gets counted.
- A note written from **reading** a skill (adopting or reviewing it), not from using it, says so in its context (`--context "reading"`, or `adopting`); it counts like a note from use (section 6).
- Never paste secrets, private data or long logs; link or summarise.
- Don't stop the user's task to reflect. Note, finish the task, mention the notes in one line at the end.

**Where to write** (first that works):
1. **The note command**, the same in every skill, project and harness (in claude.ai, run it on the connected computer): `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note <unit> <kind> "<section>: <text>" --harness <name> --context "<project>"`. It writes into the person's clone of the genome (`$STRANGE_LOOP_GENOME`, then a marketplace above the current directory, win over the config file, so a fixture genome never writes into the real one; write commands print the absolute path), deduplicates, and falls back to `~/.config/strange-loop/inbox.md` when no clone is found.
2. Inside the genome clone itself, or with file access but no shell: edit the genome's `LEARNINGS.md` directly in the format above.
3. With neither (a chat-only harness, a cloud session on another repository, a read-only uploaded skill, a skill installed on its own), and only when the person takes part in improving their skills (their standing instructions say so): end your reply with a block headed `Observations for <unit>` and the lines in the format above, one block per unit. `loop.py absorb <file>` (or `-` for pasted text) adds such blocks to the genome later, so the person can paste a reply into any session that has the genome.

Installed and synced copies (`~/.claude/plugins/…`, skills synced from claude.ai, uploaded zips) are replaced on update: never write there, even though the files are writable. Fix only verified plain errors on the spot; the rest waits for a reflection pass.

A note in a clone is local until it is shared: `loop.py sync` commits observation-only changes, pulls everyone else's and pushes (section 11). If you wrote notes into a clone and auto-sync is off, run it at the end of the session.

## 3. Change classes (who may change what)

Like the game Nomic, the loop distinguishes rules that play can change from rules that need more consent to change, and the procedure for changing rules is itself a rule.

| Class | Examples | Bar | Version |
|---|---|---|---|
| **Fix** | wrong command, renamed function, broken link, typo that changes meaning | You verified the correction by running or reading the source | patch |
| **Learn** | a new heuristic, a clarified step, a new helper function, a new check | A ripe observation (seen ×2, or one `failure`/`misled` with a verified cause), or the owner's explicit request for that change (cite it: who, when, what), and evals still pass | minor |
| **Restructure** | split or merge sections, move detail to references, change scope or triggers, remove rules | A reflection pass with before/after evals; say what was removed and why | minor or major |
| **Kernel** | the rules in "Kernel" below, ripeness thresholds, this table | The owner's explicit approval; agents propose with evidence from at least two units | major |

Changes only to `evals/`, `LEARNINGS.md` or `CHANGELOG.md` take no version bump (`check --base` exempts them). Preference rules (the person said so) are changed only by the person. Mark them where they could be mistaken for taste, e.g. "(owner preference)".

## 4. Reflect: the pass

Do one unit per pass. Work on the genome checkout, on a branch if the repository uses PRs.

1. **Gather.** `loop.py status <unit>`; read its `LEARNINGS.md` (open and the last few resolved), `SKILL.md`, `CHANGELOG.md` and `evals/`. Read the WORKLOG or chat notes the observations cite if they are available. `status <unit>` lists fixes that did not hold: read their history (`show`); never repeat a remedy that missed. When a requested observation does not match the file (wrong id, already resolved, another count), check it with `loop.py show <unit> O<n>`, say so, and work from what is recorded.
2. **Baseline.** `loop.py eval <unit>` and note the result. No evals yet? Write the first cases now, from the observations (section 5), before changing anything.
3. **Triage** each open observation into exactly one outcome:
   - *codify*: becomes code (a helper, a lint, a `check`) - preferred whenever the lesson is mechanical, because instructions are advisory and code is not ("a rule broken twice becomes a check");
   - *rule*: becomes or sharpens one instruction, written where the agent will be when it matters; a rule that misled in one context but still holds elsewhere is narrowed ("only when ..."), not deleted;
   - *case*: becomes an eval case (always, for a `failure`), with or without another outcome;
   - *move*: belongs to another layer or unit (section 1) - note it there, resolve it here as moved;
   - *wait*: not enough evidence yet - leave it open, unless the owner asks for the change: an owner request makes a single observation ripe (section 3), cite it in the bump;
   - *reject*: wrong, already covered, or conflicts with an owner preference - resolve it with the reason.
4. **Change by deltas.** Edit the smallest span that carries the lesson. Keep wording that works; never rewrite a whole skill from memory in one go (summarising rewrites lose hard-won specifics: "context collapse"). When the new rule supersedes or contradicts an older one, edit or remove the older one in the same commit and say so in the CHANGELOG. New detail goes into a referenced file when the main file is near its budget.
5. **Pay for growth.** Check the budgets (section 6). If the unit grew, find what to shrink: detail that can move to `references/`, prose a check now enforces, rules every model already follows (test by removing them on an eval case), duplicates. Never meet a budget by paraphrasing or summarising text that works: compressing to fit a cap made GUARD's baselines forget earlier skills (Zhang et al. 2026).
6. **Verify.** Run the evals again. A blind judged run is required only for restructure-class changes and description changes; fix and learn changes rely on the scripted checks, and the judged cases stay as regression material (owner, 2026-11-14). For those judged cases, compare old and new outputs blind: give a fresh subagent (or a second session) the case, the rubric and outputs A and B in random order, without saying which is new (`loop.py judge <unit> <case> --old A --new B` writes that packet and keeps the key aside). Judged outputs vary between runs: make each output twice (`--old A1 --old A2 --new B1 --new B2`, a fresh judge per packet); the new version wins a case only if it wins both pairs. Ship only when the new version is at least as good on every case and better on the cases its observations came from - per case, not on average, so a fix for one kind of task cannot quietly break another. If you cannot run a check here, say so and mark the change provisional in the CHANGELOG.
7. **Record.** `loop.py bump <unit> minor "<what changed and why>" --obs O3,O7` (`--obs last` = the newest open observation) (moves the observations to Resolved, prepends the CHANGELOG entry, bumps `plugin.json`). Reject or move entries by editing them into Resolved with `→ rejected: <reason>` or `→ moved: <where>`. A candidate change dropped because evals or review got worse is noted on its observation, which stays open, as `[+<YYYY-MM-DD> tried: <change>; <why it failed>]`, placed before any `×N`, so later passes do not propose it again. Then `loop.py check` (an error blocks the commit), commit, push or open a PR as the repository's rules say. If the harness refuses the merge of your own PR (Claude Code's auto mode does, even with the owner's standing permission), leave the PR open with green checks and tell the owner; do not work around the refusal.
8. **Turn the loop on itself.** If the pass was awkward (a step here was unclear, the script lacked a command, the triage felt wrong), record that in this skill's own `LEARNINGS.md`.

## 5. Evals: how a unit knows it got better

Each unit has `evals/`:

- `evals/run.py` (optional): scripted checks that exit non-zero on failure - lints, a fixture project, a render that must succeed, unit tests of the helper library. Cheap, run every pass.
- `evals/cases.md`: judged cases (graded blind only for restructures and description changes, section 4 step 6), one `## <case name>` each, with **Task** (what a user asks, with any inputs), **Good looks like** (the rubric: 3-6 observable criteria) and **Origin** (the observation or failure it came from).

Good cases come from real use: every `failure` becomes a case, so the suite grows from the places where the skill actually broke. Keep cases small enough to run in one subagent turn. Never delete or weaken a case to make a change pass; retire a case only with a CHANGELOG line saying why it no longer applies.

- **Hard enough to matter.** A case that a capable agent passes *without* the skill carries no signal. Run new cases once with no skill loaded; keep those where the skill makes the difference, or note that the case guards against a regression.
- **Triggering is its own test.** The `description` decides whether the skill is used at all. Keep a few should-fire and should-not-fire prompts in `cases.md` under `## Trigger:` headings, and check them when the description changes.
- **Graders and the graded don't change together.** A reflection that changes a unit may *add* cases but not edit or remove existing ones in the same commit; a change to an existing case or to `run.py` is its own commit, citing why (`check --base` fails a commit that does both). This stops a loop from grading its own homework.
- **In Claude Code**, `claude plugin eval` compares runs with and without the plugin: read `references/harnesses.md` when you need that comparison or a CI threshold.

Signals rank: tests and deterministic checks > a rubric judged blind by a fresh agent > the working agent's own impression. A lower signal never overrules a higher one.

## 6. Budgets and forgetting

Always-loaded text costs every session and dilutes attention, so growth must be paid for. Defaults (`loop.py check` warns):

- Skill `description` ≤ 1024 characters and says *when* to use the skill; `SKILL.md` ≤ 25,000 bytes (bytes, since lines run up to 1.5 KB) and ≤ ~500 lines, detail in referenced files the skill names (progressive disclosure). If cutting would hurt, front matter `size-exception: <reason>` stops the warning; `status` shows it (owner, 2026-11-15).
- Project `AGENTS.md` ≤ ~120 lines (project-foundations).
- `LEARNINGS.md` open list ≤ ~15 entries; beyond that, a reflection pass is overdue.

**Slow costs need sensors.** Some decay is invisible from inside any one session (a log that grows a little each week, a search that takes a little longer): the working agent never sees the comparison, so it never writes the observation. When a unit's cost can grow with use, give it a measurement that becomes a check warning past a budget (project-foundations does this with `docmap.py stats` and `read_max_tokens`); warnings then reach the loop through the rule in section 2. A unit whose cost grows without a sensor is a `missing` observation.

Lessons also go stale: an open observation older than about six months (`loop.py check` warns) is either confirmed by new use or rejected as no longer relevant.

Reading notes ripen like notes from use: a problem found by reading (a contradiction, a broken command, a step that cannot work) is fixed promptly and proactively in the next pass, by the same change classes; one that would need a restructure still follows the restructure rules (owner, 2026-11-15).

Forgetting is part of learning: a rule that no eval case, real task (check or add one first) or owner preference needs is a candidate for removal in a Restructure pass, and so is a reference, template or script subcommand that `loop.py usage <unit>` shows unused for months (a rare path can be by design: which task would miss it?). A recorded `win` (`loop.py status <unit>`) protects a section, but a missing `win` is no evidence, since wins are rarely recorded. Removed text stays in git and the CHANGELOG says where it went.

## 7. Kernel: what the loop may not change by itself

1. **Evidence over taste.** Every non-fix change cites the observations or eval results that motivate it. Reading a skill and disliking it is an observation (`wish`), not a reason to rewrite it.
2. **Never game the measure.** Do not weaken, skip or delete a check, eval case or warning to make a change pass, and never fake a result. If a check is wrong, fixing the check is its own change with its own evidence.
3. **History is append-only.** LEARNINGS entries are resolved, not deleted; CHANGELOG entries are never rewritten; no force-push.
4. **The owner's explicit preferences win** over any agent's judgement, and safety, privacy and security rules are never relaxed by the loop.
5. **Honest status.** Unverified changes are marked provisional; partial work is not called done.
6. **Reversible steps.** One unit, one version, one commit per change; anything can be rolled back.
7. **Budgets hold** (section 6) unless the owner raises them.
8. **Outside code enters by the owner's choice.** Skills, scripts or libraries from outside the genome are adopted only when the owner asks, pinned to a commit and read first; never absorb them automatically.
9. **This list, the change classes and the ripeness thresholds change only with the owner's approval.**

## 8. Adding a skill or mod

**A new skill.** `loop.py new <name> --description "<what it does and when to use it>" --category general|personal` creates everything the loop and the checks expect: the plugin manifest (0.1.0), the marketplace entry, a row in the README's group, `SKILL.md` with frontmatter, a skeleton and the Learning loop section, `LEARNINGS.md`, `CHANGELOG.md` and `evals/cases.md` with trigger cases. `--mod` makes a hooks-only plugin instead. Then: write the skill in place of the `TODO(new)` placeholders (`check` warns until they are gone), write real eval cases, run `check`, commit and push (a new unit is a minor change under D10). When the person's harness has a skill-writing skill (Anthropic's skill-creator), use it for the content and its evals, but create the folder with `loop.py new` in the genome, never in an installed copy. A skill made in a chat without the genome is brought in later with `--from`.

**An existing skill** (a zip someone uploaded, a folder on a machine, another repository at the owner's request): `loop.py new <name> --description "..." --category ... --from <folder>` copies it in, adds the Learning loop section if missing, starts it at 1.0.0 "as found", and lists every copied file. Run it first with `--dry-run` (lists the files, writes nothing), sort them as below, then for real with `--exclude <glob>` for each expression, so expressions never enter the genome tree. Then:

1. **Take only the genome, not its expressions.** Go through the file list `new --dry-run` printed and sort every file: the instructions, tools and libraries, reusable material (with licences) and worked examples that are general come in; outputs of tasks done with the skill stay out - work made for a particular project, before/after renders, reports about past runs, scripts named or framed after one course or client, anything that writes to a task's output location. A task output that shows something no example covers is distilled into a general example named after what it shows, and verified to produce the same result.
2. Replace the placeholder eval cases with real ones; a skill with scripts gets an `evals/run.py`.
3. Keep the footer as `references/learning-loop-template.md` has it (`check` warns; `new` writes it); skill hints go under `### Observations`.
4. If the skill installs lasting artifacts into projects (files, templates, tools), give each a provenance line and the note command, as section 1 says (project-foundations' AGENTS.md template and `docmap.py` show how).
5. Seed `LEARNINGS.md` with what you noticed while adopting it - as notes, not as edits; the next pass fixes the problems among them like any other (section 6).
6. `loop.py check`.
7. Distribution follows the version: Claude Code updates an installed plugin when its `plugin.json` version changes, and claude.ai with "Sync automatically" re-syncs the marketplace; bump the version with every change so both see it. For a harness that only takes uploads, `loop.py pack <name>` writes `dist/<name>-<version>.zip`.

## 9. Growing a new capability

When the same weakness shows up across tasks and a rule will not fix it, a tool will. Read `references/growing.md` before building a new skill or helper library for such a weakness: the six steps that built scientific-figures, and the order to prefer (check, tool, example, sentence).

## 10. Auditing the whole system

Occasionally (or when asked "how is the system doing?"): `loop.py status` across all units (fixes held); `loop.py usage`; `loop.py check`; run the units' sensors where they apply (e.g. `docmap.py stats` in projects that use project-foundations), look for lessons stuck open for months (decide: wait or reject), units with no evals, skills over budget, rules duplicated across units (move the shared one up a layer), and observations about the kernel. Report the findings most important first, propose the passes, do the ones the user approves.

## 11. Closing the loop: how a lesson travels

Read `references/harnesses.md` when setting up a machine or a harness, or when a lesson seems lost: how notes travel up to the genome (note, sync, absorb) and changes come back down to every copy (bump, push, re-sync), harness by harness.

## Learning loop

This skill improves itself from use. When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line (`<kind>`: failure, friction, misled, missing, workaround, win or wish):

- If `~/.config/strange-loop/genome` exists, run this (in claude.ai, on the connected computer):
  `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note strange-loop <kind> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"`
- Otherwise, only if the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for strange-loop` holding the line `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; if not, add nothing about it, except one line when the skill clearly failed.

### Observations

Note an unclear reflection step, a missing script feature, a lost lesson. If the note lists close observations, rerun with `--same O<n>` or `--new`. Sections 3, 7 and the ripeness thresholds need the owner's approval.
