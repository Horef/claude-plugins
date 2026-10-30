---
name: strange-loop
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

## 1. The hierarchy: where a lesson belongs

Every layer has the same shape: an instruction surface, a `LEARNINGS.md` for observations, a history (CHANGELOG, WORKLOG or DECISIONS) and, where possible, checks.

| Layer | Instruction surface | Lessons about… |
|---|---|---|
| Kernel | this skill (`strange-loop`) | how improvement itself works |
| Person | `~/.config/<skill>/…` defaults files, the user's profile/memory | the person's taste and conventions across all projects |
| Skill or tool | `SKILL.md`, its scripts and library | doing one kind of work well, anywhere |
| Project | `AGENTS.md`, `docs/` (project-foundations) | this repository's facts and rules |
| Folder | `README.md` or nested `AGENTS.md` | one part of a project |

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
- Before adding, read the open list: if it is the same lesson, append ` ×N` (or increment it) instead of a new line. Recurrence is the main evidence the loop has.
- Never paste secrets, private data or long logs; link or summarise.
- Don't stop the user's task to reflect. Note, finish the task, mention the notes in one line at the end.

**Where to write** (first that works):
1. `python <this skill>/scripts/loop.py note <unit> <kind> "<text>" --where "§5" --harness <name> --context "<project>"`. It finds the writable source checkout (the *genome*: `$STRANGE_LOOP_GENOME`, `~/.config/strange-loop/genome`, or the marketplace repo you are in), deduplicates, and falls back to `~/.config/strange-loop/inbox.md`.
2. Without a shell but with file access: edit the genome's `LEARNINGS.md` directly in the format above.
3. With neither (a chat-only harness, a read-only uploaded skill): end your reply with a block headed `Observations for <unit>` containing the lines, so the person can carry them over or a later agent can absorb them.

Installed copies (`~/.claude/plugins/…`, uploaded skill zips) are overwritten on update: never treat them as the place to write.

## 3. Change classes (who may change what)

Like the game Nomic, the loop distinguishes rules that play can change from rules that need more consent to change, and the procedure for changing rules is itself a rule.

| Class | Examples | Bar | Version |
|---|---|---|---|
| **Fix** | wrong command, renamed function, broken link, typo that changes meaning | You verified the correction by running or reading the source | patch |
| **Learn** | a new heuristic, a clarified step, a new helper function, a new check | A ripe observation (seen ×2, or one `failure`/`misled` with a verified cause) and evals still pass | minor |
| **Restructure** | split or merge sections, move detail to references, change scope or triggers, remove rules | A reflection pass with before/after evals; say what was removed and why | minor or major |
| **Kernel** | the rules in "Kernel" below, ripeness thresholds, this table | The owner's explicit approval; agents propose with evidence from at least two units | major |

Preference rules (the person said so) are changed only by the person. Mark them where they could be mistaken for taste, e.g. "(owner preference)".

## 4. Reflect: the pass

Do one unit per pass. Work on the genome checkout, on a branch if the repository uses PRs.

1. **Gather.** `loop.py status <unit>`; read its `LEARNINGS.md` (open and the last few resolved), `SKILL.md`, `CHANGELOG.md` and `evals/`. Read the WORKLOG or chat notes the observations cite if they are available.
2. **Baseline.** `loop.py eval <unit>` and note the result. No evals yet? Write the first cases now, from the observations (section 5), before changing anything.
3. **Triage** each open observation into exactly one outcome:
   - *codify*: becomes code (a helper, a lint, a `check`) - preferred whenever the lesson is mechanical, because instructions are advisory and code is not ("a rule broken twice becomes a check");
   - *rule*: becomes or sharpens one instruction, written where the agent will be when it matters;
   - *case*: becomes an eval case (always, for a `failure`), with or without another outcome;
   - *move*: belongs to another layer or unit (section 1) - note it there, resolve it here as moved;
   - *wait*: not enough evidence yet - leave it open;
   - *reject*: wrong, already covered, or conflicts with an owner preference - resolve it with the reason.
4. **Change by deltas.** Edit the smallest span that carries the lesson. Keep wording that works; never rewrite a whole skill from memory in one go (summarising rewrites lose hard-won specifics: "context collapse"). New detail goes into a referenced file when the main file is near its budget.
5. **Pay for growth.** Check the budgets (section 6). If the unit grew, find what to shrink: detail that can move to `references/`, prose a check now enforces, rules every model already follows (test by removing them on an eval case), duplicates.
6. **Verify.** Run the evals again. For judged cases, compare old and new outputs blind: give a fresh subagent (or a second session) the case, the rubric and outputs A and B in random order, without saying which is new. Ship only when the new version is at least as good on every case and better on the cases its observations came from - per case, not on average, so a fix for one kind of task cannot quietly break another. If you cannot run a check here, say so and mark the change provisional in the CHANGELOG.
7. **Record.** `loop.py bump <unit> minor "<what changed and why>" --obs O3,O7` (moves the observations to Resolved, prepends the CHANGELOG entry, bumps `plugin.json`). Reject or move entries by editing them into Resolved with `→ rejected: <reason>` or `→ moved: <where>`. Then `loop.py check`, commit, push or open a PR as the repository's rules say.
8. **Turn the loop on itself.** If the pass was awkward (a step here was unclear, the script lacked a command, the triage felt wrong), record that in this skill's own `LEARNINGS.md`.

## 5. Evals: how a unit knows it got better

Each unit has `evals/`:

- `evals/run.py` (optional): scripted checks that exit non-zero on failure - lints, a fixture project, a render that must succeed, unit tests of the helper library. Cheap, run every pass.
- `evals/cases.md`: judged cases, one `## <case name>` each, with **Task** (what a user asks, with any inputs), **Good looks like** (the rubric: 3-6 observable criteria) and **Origin** (the observation or failure it came from).

Good cases come from real use: every `failure` becomes a case, so the suite grows from the places where the skill actually broke. Keep cases small enough to run in one subagent turn. Never delete or weaken a case to make a change pass; retire a case only with a CHANGELOG line saying why it no longer applies.

- **Hard enough to matter.** A case that a capable agent passes *without* the skill carries no signal. Run new cases once with no skill loaded; keep those where the skill makes the difference, or note that the case guards against a regression.
- **Triggering is its own test.** The `description` decides whether the skill is used at all. Keep a few should-fire and should-not-fire prompts in `cases.md` under `## Trigger:` headings, and check them when the description changes.
- **Graders and the graded don't change together.** A reflection that changes a unit may *add* cases but not edit or remove existing ones in the same commit; a change to an existing case or to `run.py` is its own commit, citing why. This stops a loop from grading its own homework.
- **In Claude Code**, `claude plugin eval` runs cases in its own layout (`evals/<case>/prompt.md` plus graders, at the plugin root) several times with and without the plugin and reports the difference; use it when you need that with/without comparison or a CI threshold. Its graders are deterministic (regex, tool used, file exists) or a short LLM judge, so write the case so its outcome lands in a file or a regex-checkable line.

Signals rank: tests and deterministic checks > a rubric judged blind by a fresh agent > the working agent's own impression. A lower signal never overrules a higher one.

## 6. Budgets and forgetting

Always-loaded text costs every session and dilutes attention, so growth must be paid for. Defaults (`loop.py check` warns):

- Skill `description` ≤ 1024 characters and says *when* to use the skill; `SKILL.md` ≤ ~500 lines, detail in referenced files the skill names (progressive disclosure).
- Project `AGENTS.md` ≤ ~120 lines (project-foundations).
- `LEARNINGS.md` open list ≤ ~15 entries; beyond that, a reflection pass is overdue.

Lessons also go stale: an open observation older than about six months (`loop.py check` warns) is either confirmed by new use or rejected as no longer relevant.

Forgetting is part of learning: a rule with no recorded `win`, no eval that needs it and no owner preference behind it is a candidate for removal in a Restructure pass. Removed text stays in git and the CHANGELOG says where it went.

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

## 8. Adopting a skill or mod into the loop

1. Put it in the genome: `plugins/<name>/.claude-plugin/plugin.json` (name, version, description), the skill in `plugins/<name>/skills/<name>/SKILL.md`, and a line in `.claude-plugin/marketplace.json`.
2. Add `LEARNINGS.md` (`loop.py note` creates it from the template), `CHANGELOG.md` whose newest `## X.Y.Z (date)` matches `plugin.json`, and `evals/` with at least one case.
3. Add a `## Learning loop` section to the skill (template below), adapted to where its users can write.
4. Seed `LEARNINGS.md` with what you noticed while adopting it, as `wish` or `friction` - not as edits. Your reading is weak evidence; use will confirm or reject it.
5. `loop.py check`.

Template for the skill's own section:

```markdown
## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, add one line to `LEARNINGS.md` next to this file - `- O<n> <date> [failure|friction|misled|missing|workaround|win|wish] <section>: <what happened, what would have helped> (<harness>, <context>)` - or run `loop.py note <name> <kind> "<text>"` from the strange-loop skill when this copy is read-only, or list them at the end of your reply under "Observations for <name>". Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
```

## 9. Growing a new capability

When the same weakness shows up across tasks (figures that look bad, a format that keeps breaking), a rule will not fix it; a tool will. The pattern that built the scientific-figures skill:

1. **Ask the agent that struggles what it lacks.** Its answer is a list of `missing` and `wish` observations: references to read, a way to see its output, a library of parts, a check.
2. **Get sources, distil them** into a short rule list with citations (books, papers, house style).
3. **Close the perception loop first.** An agent working blind needs a way to look at its result: render, run, lint, test. A loop with no perception cannot improve.
4. **Build the library from the worked examples**, not upfront: every helper exists because a figure needed it, and the examples become the benchmark (evals).
5. **Write the skill last**, as the index to the tools: when to use which, and the checklist.
6. Adopt it into the loop (section 8).

Prefer, in this order: a check that catches the mistake, a tool that makes it impossible, an example that shows the right way, and only then a sentence that asks for it.

## 10. Auditing the whole system

Occasionally (or when asked "how is the system doing?"): `loop.py status` across all units; `loop.py check`; look for lessons stuck open for months (decide: wait or reject), units with no evals, skills over budget, rules duplicated across units (move the shared one up a layer), and observations about the kernel. Report the findings most important first, propose the passes, do the ones the user approves.

## Learning loop

This skill observes itself like any other unit: its `LEARNINGS.md` is next to this file and `loop.py` is in `scripts/`. When a step of a reflection was unclear or the script lacked something, record it here with the kinds above. Changes to section 7 (Kernel), section 3 (change classes) and the ripeness thresholds in `loop.py` need the owner's approval.
