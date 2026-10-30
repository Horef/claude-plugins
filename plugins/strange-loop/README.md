# strange-loop

Skills, helper libraries and project docs that improve themselves from use, in any harness, without a person maintaining them by hand.

Most agent scaffolding is static: someone finds a process that works, packages it as a skill, and from then on a human has to notice what is wrong with it and rewrite it. Even "learning" setups usually keep the scaffolding fixed and give the agent one drawer to write notes into. But the agent that *uses* a skill sees what the author could not: the step that always misleads, the check that never fires, the helper it keeps writing by hand. strange-loop makes the scaffolding itself the thing that learns, and makes that learning safe enough to leave running.

## How it works, in one picture

```
            ┌────────────── the level the loop does not draw ──────────────┐
            │  kernel rules · evals · git history · the owner · model      │
            └──────────────────────────────▲───────────────────────────────┘
                                           │ every change is checked here
   use a skill ──► notice (1 line in LEARNINGS.md) ──► ripe? ──► reflect pass
        ▲                                                            │
        │      fix · rule · check · eval case · move up/down · reject │
        └──────────── new version (CHANGELOG, plugin.json) ◄──────────┘
   and the reflect procedure is itself a skill, with its own LEARNINGS.md
```

- **Notice** (seconds, during any task): when a skill misleads, lacks something, needs a workaround, or clearly pays off, the agent adds one line to that skill's `LEARNINGS.md`. A repeat of the same lesson increments its count instead of adding a line: recurrence is the evidence.
- **Fix** (minutes): plain errors that the agent has just verified (a wrong command, a renamed function) are fixed on the spot with a patch version.
- **Reflect** (one session, when lessons are ripe): one unit at a time, the agent triages every open lesson into code, a rule, an eval case, a move to another layer, a wait or a rejection. It edits in small deltas, pays for any growth by pruning, verifies against the unit's evals (blind A/B for judged cases), and records a new version.

Lessons also travel through a hierarchy (kernel → person → skill → project → folder): **up when they generalise** (a project lesson seen in a second project is a skill lesson), **down when they specialise**.

## Is this plausible?

Yes, within limits that are worth being honest about.

The model's weights do not change, so what can improve is everything around them: instructions, tools, libraries, checks and memory. Recent work shows this layer can improve substantially by itself. Agents that edit their own code and tools have more than doubled their scores on coding benchmarks (Darwin Gödel Machine, SICA). Evolving "playbooks" beat static prompts (ACE). Skill libraries grown by agents transfer to weaker agents (Voyager, SkillWeaver). The full survey is in [`docs/RESEARCH.md`](../../docs/RESEARCH.md).

The same research names the failure modes, and the design answers each one:

| Failure seen in the literature | What strange-loop does |
|---|---|
| Self-written skills give no average gain; LLM-written AGENTS.md lowered success and raised cost (SkillsBench, Gloaguen et al. 2026) | Changes need evidence from use (observations ×2, verified failures), not an agent's taste; reading a skill yields observations, not rewrites |
| An agent removed the markers that detected its own cheating (DGM); another tried to disable its sandbox (STOP) | Kernel rule: never weaken a check to pass. Graders and the graded never change in the same commit. Kernel changes need the owner |
| Whole-context rewrites collapse 18k tokens of hard-won detail into ~120 (ACE "context collapse") | Delta edits only; budgets force pruning to be deliberate and recorded |
| Prompts grow without bound when nothing prices them (SICA) | Size budgets on everything always loaded; growth must be paid for |
| Lessons go stale or get applied in the wrong domain (Ouroboros) | Staleness warning after 180 days; the layer table decides where a lesson belongs |
| Greedy acceptance on average score (GEPA, HGM) | Accept per case, not on average; git keeps every ancestor |

What it cannot do: verify itself completely. A system that grades its own homework drifts. So the loop is anchored to things outside it: deterministic checks, judged evals run blind by a fresh agent, git history, and you, who hold the kernel. This is not a weakness to be engineered away. It is the shape every working self-improving system has had.

## Why "strange loop"

In *Gödel, Escher, Bach*, a strange loop is a hierarchy that, by moving through its levels, arrives back where it started: a system that contains a representation of itself, and that representation affects the system. Here:

- the **reflection procedure is a skill** like the ones it improves; it has its own `LEARNINGS.md`, its own evals and its own versions, and step 8 of every pass turns the procedure on itself;
- the **skills shape the agents' work**, and the agents' work reshapes the skills.

Hofstadter is careful about one thing that matters here. Escher's *Drawing Hands* look like two hands drawing each other, but both are drawn by Escher's own hand, outside the picture. Every tangled hierarchy rests on an "inviolate level" that the loop does not touch. In strange-loop that level is the kernel (section 7 of the skill), the evals, git and the owner. The governance borrows from Peter Suber's game *Nomic*, which Hofstadter popularised: changing the rules is a move in the game, but the rules for changing rules need more consent than ordinary rules. Hence the four change classes: fix, learn, restructure, kernel.

Gödel's theorem supplies the reason for that level: a sufficiently rich system cannot prove its own consistency from inside. The loop's version of this is practical: the agent that made a change is not the judge of whether it is better.

## Layout

```
plugins/strange-loop/
  .claude-plugin/plugin.json
  hooks/hooks.json              Claude Code: session-start digest of ripe lessons (silent otherwise)
  skills/strange-loop/
    SKILL.md                    the procedure (notice, fix, reflect, evals, budgets, kernel, adoption, growth)
    scripts/loop.py             note, status, digest, check, eval, bump, absorb, where (stdlib only)
    evals/                      unit tests for loop.py (run.py) and judged cases (cases.md)
    LEARNINGS.md, CHANGELOG.md  this skill observes itself like any other
```

Every unit in the genome (each skill folder, or a mod's plugin root) has the same three files: `LEARNINGS.md` (open and resolved observations), `CHANGELOG.md` (versions, each citing the observations behind it) and `evals/`.

## Setup

1. Install from the marketplace (Claude Code):

   ```
   /plugin install strange-loop --marketplace Horef/claude-plugins
   ```

2. Tell the loop where your writable clone of this repository (the *genome*) lives, once per machine:

   ```bash
   git clone git@github.com:Horef/claude-plugins.git ~/Scripts/claude-plugins
   ```

   ```bash
   mkdir -p ~/.config/strange-loop && echo ~/Scripts/claude-plugins > ~/.config/strange-loop/genome
   ```

   Or set `STRANGE_LOOP_GENOME`. Without a genome, observations queue in `~/.config/strange-loop/inbox.md`, and `loop.py absorb` moves them in later. Agents working inside the genome checkout itself need no setup.

3. Other harnesses (claude.ai skills, Kiro, Copilot, Codex): upload or link the skill folders as usual. The protocol is plain Markdown. Without a shell, agents append observation lines directly or list them at the end of their reply under "Observations for <unit>".

## Commands

```bash
python loop.py status              # every unit: open lessons, which are ripe, budget use
python loop.py note scientific-figures friction "§5: lint missed a label under a band" --harness claude-ai --context "L7 notes"
python loop.py eval project-foundations
python loop.py bump project-foundations minor "Templates move to templates/*.md" --obs O3
python loop.py check --base origin/main   # CI: manifests, versions, changelogs, learnings; changed plugins must bump
```

A lesson is **ripe** when it was seen twice, or is a `failure` or `misled`, or its unit has five open lessons. The thresholds are kernel settings in `loop.py`.
