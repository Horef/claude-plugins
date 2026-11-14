# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

## 2026-11-14 - CI runs every unit's evals; judged evals scoped; SKILL.md budget in bytes

- Owner-approved changes from the structure review (#4, #5), three commits on a worktree branch. (1) `ci: run every unit's scripted evals`: one new step loops over `loop.py where`, skipping the three units with their own steps. (2) strange-loop 1.3.0: blind judged run required only for restructure-class and description changes (sections 4 step 6 and 5, README). (3) strange-loop 1.4.0: SKILL.md budget 25,000 bytes next to the 500-line one (`SKILL_MAX_BYTES`, a `check` warning, KB in `status`; section 6, AGENTS.md).
- Verified: the loop step run locally (bash -e -o pipefail) on all 11 units, exit 0; with a stub `loop.py` returning 0/2/1 it prints pass / not run / error and exits 1; workflow YAML parsed with PyYAML. Budget test `test_skill_size_budget_is_in_bytes_and_only_warns` failed (no `SKILL_MAX_BYTES`) before the change, passes after; `loop.py eval strange-loop` exit 0 (27 tests); `check --base` 0 errors, 3 warnings (project-foundations 36.7 KB, scientific-figures 29.3 KB, strange-loop 27.4 KB).
- Unverified: the new CI step on GitHub. project-foundations' own `evals/run.py` still checks the 500-line limit only (existing eval case, own commit).

## 2026-11-14 - Genome pass with Fable helpers: reflection, audit, judged evals (partial)

- Fable 5.2 (personal account) helpers at low/medium/high (`helpers.py custom`); six in parallel hit the Pro 5h limit in ~10 min (7d 13% -> 27%). Owner: Fable only for forward-looking work; the rest moved to Copilot Sonnet, Codex, agy Gemini 4 Hydrogen high (owner rates ~Sonnet high; now the agy-standard model in the owner's config, O27).
- Reflection pass, PR #66 merged: herdr-delegate 0.12.0 (O24), literature-research 0.2.1 (O1), paper-premark 1.3.0 (O6), research-assistant 0.3.1 (O10), strange-loop 1.1.1 (O21). Commands: `loop.py eval` x5 exit 0; `loop.py check --base origin/main` 0/0; `docmap.py check` 0 errors; CI green. Plugins updated in both accounts.
- Audit: drift scan (13), Codex bloat (74), Hydrogen bloat (81), merged into 17 items (work folder `audit/merged.md`).
- Judged evals: 67/81 outputs, not graded. Observations: herdr-delegate O25 (helpers stop at their own router plan approval), O26 (`helpers.py prompt` misses Copilot path dialogs), strange-loop O23.
- Unverified / open: grading; structure review (Fable, paused).

## 2026-11-13 - project-foundations 5.12.0: citation exemption, stub modules

- O22, O23: `id_missing_exempt` silences "cites D57, which is not in DECISIONS.md" (the other exempt keys cover only the ambiguity check); Retrofit step 6a: free id prefix via `indexes`. Forwarding stubs (`sys.modules[__name__] = importlib.import_module('<literal>')`) count as imports of their target; "(via stub old.py)".
- Verified: `loop.py eval project-foundations` exit 0 (14 new cases, 9 fail on main's docmap.py); `loop.py check --base origin/main` 0/0; `docmap.py check` 0 errors; read-only run on the TwinProp fork. Not verified: `update` on a real stub project; Node ports.

## 2026-11-13 - herdr-delegate 0.11.0: default account without CLAUDE_CONFIG_DIR

- **herdr-delegate 0.11.0** (O23, from simple_complex_v1 on 2026-11-13): the rendered command of the default Claude account (`~/.claude`) is now `env -u CLAUDE_CONFIG_DIR claude ...`. Setting the variable to `~/.claude` made Claude Code read `~/.claude/.claude.json` and another Keychain entry, so the helper showed the theme picker and a login screen. `command_of` skips a leading `env -u NAME`; the orphan check matches both forms. Step 5 of SKILL.md: when an auto-mode lead's own `hc keys` approvals are refused, ask the person and prefer helpers with their own judge.
- Verified: `loop.py eval herdr-delegate` 0 failures; the two new `account_cases.py` checks fail on the old `helpers.py` and pass on the new; `loop.py check --base origin/main` 0 errors. The fixed form was also used live (three hand-patched templates, a helper started logged in at once).

## 2026-11-13 - session-status-line 0.7.1: easier to read at a glance

- Owner's screenshot of 0.7.0: Kiro 103% +$2.78 drawn plain (an old reading's dim washed out its red), helpers ran together. Owner chose to keep every number, no meters; asked for separators and colour by meaning.
- Dim `│` between budgets (on the terminal they fall on the column boundaries and line up), `┃` between groups on one line; old readings keep their colour with a dim `~` mark; overage bold red; session row dim.
- Commands: `claude plugin test plugins/session-status-line` 17 pass (new: old reading keeps colour); `loop.py eval session-status-line` exit 0; `loop.py check --base origin/main` 0/0.

## 2026-11-13 - model-router 0.23.0, herdr-delegate 0.10.0, session-status-line 0.7.0: installable on other machines

- Owner report: on another person's Mac the router listed Kiro/Copilot/agy (not installed) and said helpers.py was missing; the status line's helper row was too long for all accounts.
- model-router: no hard-coded helper fallback; with no helpers.py, no `hc` (checked with `hc --version`) or no helper CLI there are no helper steps (rule, plan schema, cards); the pane says helpers are optional and how to enable them (`/plugin install herdr-delegate@<marketplace>` from installed_plugins.json, hc, a CLI); path box behind "Set path by hand". (Sonnet subagent.)
- herdr-delegate: other Claude accounts discovered from claude-accounts readings and ~/.claude, ~/.claude-*, ~/.claude_* dirs with config markers, only when two or more exist; `account rm` records an exclusion; manual `add` overrides; templates rendered on pick/status/config. (Sonnet subagent.)
- session-status-line: grouped rows (Claude, `helpers`, `session`) each wrapping onto as many rows as needed; unlisted ids are helpers, so new providers need no code; terminal aligns helper columns; dropOrder applies to the band's height too; look: no status emoji or ◆, `ctx` label, effort `·H`, gaps instead of │ inside groups (owner chose the "labelled grid" mock-up).
- Commands: `claude plugin test` model-router 81 pass, session-status-line 16 pass; `loop.py eval` model-router, herdr-delegate, session-status-line exit 0; `loop.py check --base origin/main` 0/0; `docmap.py check` 0 errors.
- Unverified: layouts in the real terminal and desktop app; a fresh machine without helpers.

## 2026-11-11 - herdr-delegate 0.9.0, session-status-line 0.6.0, model-router 0.22.0: other Claude accounts and Codex

- Owner request: two Claude accounts on one Mac (personal, university Team plan for scientists; separate `CLAUDE_CONFIG_DIR`) should see each other's limits and use each other as helpers; add Codex; make status line and router general for other users. Shared contract (account key = sha256[:8] of the config dir or `default`; readings in `$XDG_CONFIG_HOME/claude-accounts/<key>.json` written by each account's status line) designed here, implemented by three Copilot helpers in parallel worktrees after a generality audit (Haiku).
- herdr-delegate 0.9.0: `helpers.py account add|rm|list` (kind=claude providers, `CLAUDE_CONFIG_DIR=... claude --permission-mode auto`), self-skip in pick, quota from readings, 7d-rise usage; Codex provider (`--no-daemon --approve-for-me`, models from `codex debug models`, quota from the wham endpoint or session files); provider order, units, login and usage readers are config, not code.
- session-status-line 0.6.0: writes its own account's readings, shows the other accounts (`uni 5h 21% 7d 30%`), `/status-line account-label`, optional live read with an unexpired token (never refreshed); Codex budget; per-reader labels; Kiro XDG path; agy fallback only when present.
- model-router 0.22.0: default helper orders from `helpers.py config` (installed, not this account), "(this account)" marks, units and labels from config, Claude and Codex effort flags, no-CLI case, XDG template path, genome note only where a genome exists.
- Commands: `loop.py check --base origin/main` 0/0; `loop.py eval` herdr-delegate, model-router, session-status-line exit 0; `claude plugin test` model-router 80 pass, session-status-line 16 pass; `docmap.py check` 0 errors; against a copy of the real config: `pick` from ~/.claude gives the uni helper, from ~/.claude-uni the personal one.
- Unverified: live read of another account's usage; paid-plan Codex windows; a launched Claude-account helper in hc; Kiro Linux data path.

## 2026-11-09 - project-foundations 5.10.1: supersession marks that name the replacement

- O19: upgrading simple_complex_v1 to 5.10.0 gave 4 false warnings where a line names the replacement more than 30 characters after the id ("D22, whose awake-preset decision is superseded by D34"; an audit table "D16 (by D20: ...)"). Now an id followed by "by <its replacement>" in the same clause or table cell counts as marked. The upgrade also surfaced 2 real stale citations the old whole-line skip hid.
- Commands: `loop.py eval project-foundations` 0 failures (2 new cases); `loop.py check --base origin/main` 0/0; `docmap.py check` 0 errors.

## 2026-11-09 - project-foundations 5.10.0: partial supersession, custom id families

- O17 (wonderful-agent, entitlements): any "superseded by D<n>" in a heading or Status line counted as full, so partly superseded decisions gave false warnings, and the "supersed" workaround hid real ones. Now full only from the status (heading `status:` field, a `Status:` line, or the older `(superseded by D7)` heading form); "partly superseded by D<n>: <part>" is partial and not reported; check skips only the id a line marks superseded, not the whole line. Templates show both forms.
- O18 (wonderful-agent, benefits-assistant): `get` and `ids` now follow the configured `indexes` (e.g. A1-A7 in docs/ANALYSES.md), and `ids` reads `## A1 — Title` headings.
- Code to the brief by a Copilot helper (Sonnet 5.5); review added back-compat for the older heading form and its eval.
- Commands: `loop.py eval project-foundations` 0 failures (new cases for O17, O18); `loop.py check` 0/0; `docmap.py check` 0 errors, 6 warnings (as before); `git diff --check` clean.
- Next: projects that run a Node port of docmap (wonderful-agent repos) need it re-ported from 5.10.0 or replaced by the Python script.

## 2026-11-08 - research-assistant 0.2.0: question tags and short names

- Owner's request (simple_complex_v1 pilot, gate 2): hypothesis ids H1-H4 read as the project's wiring names (H3, H5t). Option chosen: a per-question tag plus short names.
- `ra.py`: `init --tag NB` (refused when NB-H/A/Q ids already occur in the repo; word mentions shown), ids NB-H1/NB-A1/NB-Q1, headings are short names (at most 8 words; claim in 'statement'), status and the gate log print names, bare ids at gates and deviations are read as the question's, `retag DIR TAG` renames headings, id fields and log lines (fingerprints strip the tag, so approvals stay valid) and lists prose mentions. Untagged folders behave as before. Templates: `{pre}` ids, 'statement' and 'Not taken forward' (O2).
- Commands: `loop.py eval research-assistant` pass (new tagged_checks: clash refusal, tag H3 refused, untagged heading and long name reported, bare ids at G2, names in log and status, retag keeps gates and fingerprints, prose untouched); retag tried on a copy of the pilot folder (7 ids renamed, fingerprint valid, 34 prose mentions listed); `loop.py check` 0/0; `docmap.py check` 0 errors.
- Next: retag the pilot folder in simple_complex_v1 (NB) and fix its prose by hand.

## 2026-11-08 - literature-research 0.2.0: Semantic Scholar key and pacing

- Owner's S2 key: stored in the macOS Keychain (item S2_API_KEY) and exported by ~/.zshenv (owner's own edit; the agent's edit of a shell startup file was refused by the permission check). herdr-core's server lacks the variable, so `lit.py` also reads the Keychain item itself.
- `lit.py`: all Semantic Scholar calls paced to one per 1.1 s across processes (lock + timestamp file under ~/.cache/literature-research); keyed calls retry like keyless ones and relevance search falls back to bulk on 429 (keyed relevance search answered 429 repeatedly on 2026-11-08 while a bogus key got 403 and keyed bulk 200).
- Commands: `loop.py eval literature-research` → 49/49 (new case: two processes, 6 calls, gaps ≥ 1.0 s; 8 parallel stress runs min gap 1.101 s); live `lit.py search ... s2` without the variable → 5 results via the Keychain key; `loop.py check` 0/0; `docmap.py check` 0 errors.

## 2026-11-08 - model-router 0.21.0 and herdr-delegate 0.7.0: settings and helper usage

- Diagnosis: settings were written whole from each session's copy, so an older session overwrote newer settings (store showed defaults except hereEffort); lifetime and history merge on write and survived. Kiro "0 credits" came from one lead report of amount 0 sent without reading the screen; the other Kiro runs reported none.
- herdr-delegate 0.7.0 (here): `helpers.py usage <name>` reads Kiro `Credits: turn X • session Y` and Copilot `Session: N AIC used` / `AI Credits N` (formats measured on one-prompt runs); evals on captured screens. O15: kiro-light showed thinking medium despite --effort low.
- model-router 0.21.0 (Kiro standard helper, 16.14 credits read by the new command): settings merge on write, refresh at turn start and on Settings open; zero usage ignored and dropped on load; per-provider reported-run counts; rules use helpers.py usage. 74 tests pass.
- Commands: `claude plugin test plugins/model-router` → 74 pass; `claude plugin validate` → passed (old warnings); `loop.py eval` both units → 0; `loop.py check --base origin/main` → 0/0; `docmap.py check` → 0 errors.
- Not verified: two live sessions on one store (tests change the store behind the module instead).

## 2026-11-07 - Helper models as configuration

- herdr-delegate 0.6.0 (Kiro helper): helpers.default.json + ~/.config/herdr-delegate/helpers.json drive rendered templates; helpers.py config/render/set/custom/models; Copilot models via ACP. 0.6.1: pick skips not-offered models (copilot-argon). 0.6.2: Kiro credit multipliers cached.
- model-router 0.20.0 (Kiro helper): helper model/thinking pickers in Settings, Check models, helper advice with Apply, per-step custom templates under auto mode or kind choices. 65 tests.
- Real templates migrated (`helpers.py render --force`, backup kept); a helper's test once wrote the real config (env not persisted between shell calls), removed; herdr-delegate O12.

## 2026-11-07 - model-router 0.19 and herdr-delegate 0.5.1

- model-router 0.19.0 (Kiro standard helper): pane edits to a running plan wait in a draft until Send changes; helper thinking level on cards; auto mode thresholds as settings, 5 runs and 90%. 56 tests pass.
- herdr-delegate 0.5.1: pick/status run kiro-cli whoami and clear a stale login mark (O11).
- 0.18.0 seen loaded in the owner's session (plan status: version 0.18.0, no errors); settings mirror written with his tiers.

## 2026-11-07 - model-router 0.16-0.18 and course-notes lint

Owner's model-router batch and course-lecture-notes O1, on branch model-router/0.16; all four steps run on helpers (Copilot standard for c1 and r1, Kiro standard for r2, Kiro deep for r3) with briefs in a git-excluded .helper-briefs/ folder inside the repo (scratchpad paths trigger Copilot path prompts, herdr-delegate O10).
- course-lecture-notes 1.6.0: lint_notes.py; docmap.toml exempts eval fixtures from the link check.
- model-router 0.16.0 (persistence: load gate, merge on write, ~/.config mirror; helper order; coalesced mid-run notes), 0.17.0 (nested parts, count, helper and model, helper usage per provider), 0.18.0 (verdicts, kinds, learned advice with Apply, auto mode, open model list, genome note; O1). evals/run.py wraps the engine tests.
- Commands: `claude plugin test plugins/model-router` → 45 pass; `claude plugin validate` → passed (old icon/author warnings); `loop.py check --base origin/main`; `docmap.py check` → 0 errors.
- Kiro had been skipped since a `helpers.py login kiro` mark never expires (herdr-delegate O11); kiro-cli 3.1.0 template flags verified with a one-prompt run.

## 2026-11-06 - Second reflection pass: templates, reading notes, DEVONthink MCP

Second pass, owner's decisions on the proposals. Branch genome/reflection-2-2026-11-06.
- project-foundations 5.8.0: templates moved to templates/ (13 files), read per chosen module; SKILL.md 491 -> 251; evals 44 -> 48 checks, 0 failures before and after.
- strange-loop 1.1.0: `from_reading` / `reading_to_offer` in loop.py; status and digest list reading notes with no recurrence after three later use notes (now: course-lecture-notes O1). Owner: offer, never drop.
- paper-premark 1.2.0, course-lecture-notes 1.5.0: DEVONthink only through MCP (checked: `claude -p` with mcp__devonthink__* listed 63 tools and 3 databases); stop when unavailable; one harness table for file moves; step 7 follows the pipeline's figures and duplicate skip.
- Anki pipeline repo (outside the genome): owner's pending edits committed (100 tests OK), then duplicate skip and images on cards (132 tests OK). Not pushed; no real Anki/Gemini run.

## 2026-11-06 - Reflection pass over all units

Owner-reviewed reflection over all open observations (48). Done on branch genome/reflection-2026-11-06, one commit per unit; five units by Sonnet subagents, paper-premark and research-writing by Copilot helpers (Kiro needed a login).
- course-lecture-notes 1.4.0 (O2, O4 docs only; pipeline fix belongs to the owner's repo); scientific-figures 7.0.3 (O5, O9); local-run-queue 0.2.0 (O1); project-foundations 5.7.0 (O12); paper-premark 1.1.0 (O1, O4); herdr-delegate 0.5.0 (O7, O9, mixed families; new O10: helpers.py prompt misses Copilot's path-access dialog); research-writing 0.3.0 (O2, O5, O11, O13, mixed-family readers as a rule).
- Commands: `loop.py eval <unit>` for each → exit 0 (scientific-figures exit 0 under a matplotlib venv); `loop.py check --base origin/main` → 0 errors, 0 warnings; `docmap.py check` → 0 errors (2 pre-existing warnings: writing-rules.md cites decision ids that docs/DECISIONS.md lacks); `git diff --check` clean.
- Proposed to the owner, not done: project-foundations O3 templates on demand; DEVONthink harness routes (paper-premark O3, course-lecture-notes O3); strange-loop O5 expiry of reading-based notes. Model-router lifetime reset diagnosed, postponed.

## 2026-11-05 - model-router 0.15.0: here-step effort may raise the level

- Owner's request: let here-step effort raise the chat's level too, not only lower it.
- model-router 0.15.0: a started here step runs at its tier's effort, lower or higher than the chat's own (a deep step in an Opus-on-medium chat runs at high); the context limit applies both ways. Test changed in its own commit first and failed on 0.14.0.

| Verification command | Result |
|---|---|
| `claude plugin test plugins/model-router` | 15 pass |
| `loop.py check --base origin/main`; `docmap.py check` | 0 errors |

## 2026-11-05 - model-router 0.14.0: here-step effort experiment

- Owner's idea: a here step cannot change the chat's model, but the chat's effort can change per request. Built as an opt-in experiment because the cost of a change is uncertain: the mod API's docs (Claude Code 2.1.318) say a level that rides as a setting of the whole request makes the next request write the conversation to the cache again, and the owner found conflicting reports online, for a subscription in particular.
- model-router 0.14.0: Settings → Experiment → "Adjust effort of here steps" (off by default; off leaves the plan tool and rules as they were). On: the plan tool takes `start`, a started here step's requests go out at its tier's effort, never above the chat's own, only under a context limit (40k by default); the card says what was done and why; each change of level is logged with the next request's cache write and read tokens (store `effortLog`), totals in Settings.
- Tests were committed first (3 of 15 failed on 0.13.1). Type-check against the 2.1.318 API types: no new errors beyond the ones `main` already shows in that ad-hoc setup.
- Not verified: a real chat with the switch on; whether a switch rewrites the cache on the owner's subscription (that is what the log is for).

| Verification command | Result |
|---|---|
| `claude plugin test plugins/model-router` | 15 pass (4 new) |
| `claude plugin validate plugins/model-router` | pass (existing "no author" warning) |
| `loop.py check --base origin/main`; `docmap.py check` | 0 errors |

## 2026-11-04 - research-writing 0.1.0: write-ups and paper drafts as an argument

Owner request: write-ups read like lab reports (order of the work, erratic figure placement, questions left open). Built the skill, then piloted it before release.
- Sources (owner's copies from DEVONthink, converted with pdftotext/pandoc into a scratch folder, never committed): two helpers distilled them into `references/writing-rules.md` (Kiro, Sonnet 5.5) and `references/story.md` (Copilot, Opus 5.5; Kiro's login had expired); both reviewed.
- Tools: LaTeX template (LuaLaTeX, biblatex, cleveref, `\claim`, `\figref` recording first-citation pages, `\status`), `wr.py` init/build/pages/check/readers/status; poppler installed for page images.
- Pilot (simple_complex_v1 `docs/writeups/inhibition_wilson2012/`): ledger and skeleton by the lead, figures and text by a Kiro helper (14 pages, check clean), reader round 1 (3 Sonnet 5.5 subagents, 1 Gemini 4 Argon via agy; copilot-argon fell back to Sonnet silently), 170 questions sorted into 22 themes, revision (title and message narrowed to what the evidence supports, CIs, definitions), 15 pages, check clean.
- Commands: `python3 plugins/research-writing/skills/research-writing/evals/run.py` -> ok; `loop.py check --base origin/main` -> 0 errors.
- Not done: judged cases not run blind (provisional); a second reader round waits for the analyses the readers asked for.

## 2026-11-04 - gui-design 0.4.0 and project-foundations 5.6.0: design for what will vary next

Reflection pass on gui-design after five rounds of owner feedback on the simple_complex_v1 Replay page (owner approved merging directly).
- Triage: O9 (embedded viewer fills the window), O10 (one control per outcome), O11 (what will vary next), O12 (overlay colours), O13 (zoom and pan) → rules in SKILL.md sections 1-6 and `references/layout-patterns.md` §6; O14 (win) resolved with them; O3 (mod pane dump) waits.
- Owner asked to generalise "what will vary next?" beyond GUIs: project-foundations template, Conventions, "Design for what will vary next" (every project scaffolded or upgraded gets it; `DOCMAP_VERSION` 5.6.0 so old copies report the newer template; upgrade step 6b names it).
- Commands: `loop.py eval gui-design` → pass (before and after); `loop.py eval project-foundations` → pass; `loop.py check --base origin/main` → 0 errors; `docmap.py check` → 0 errors.
- Not done: the judged cases (4 new in gui-design) were not run blind; changes are provisional until they are.

## 2026-11-03 - model-router 0.13.1 and model-routing 0.2.0: here tiers as labels

- Owner's request after 0.13.0: make a here step's tier a label rather than a picker, and fix the same confusion in the model-routing skill.
- model-router 0.13.1: a here step shows "rated <tier>" as a label; sending it to a subagent brings the tier picker back. The tests were changed in their own commit first and failed on 0.13.0 (2 of 11).
- model-routing 0.2.0: the tier table's model and thinking columns are marked as sub-agent settings; a here step's tier is a rating, its model column reads "this chat", and a here step rated above the chat's model is pointed out. New judged case "A here step's tier" (judged cases not run).
- Not verified: the pane in the real terminal and desktop app.

| Verification command | Result |
|---|---|
| `claude plugin test plugins/model-router` | 11 pass |
| `loop.py eval model-routing` | 8 judged cases listed (not run) |
| `loop.py check --base origin/main`; `docmap.py check` | 0 errors |

## 2026-11-03 - model-router 0.13.0: a here step's tier is a rating

- Owner's report: a "here" step's tier (light/standard/deep) cannot change the open chat's model or thinking level, which could mislead both the user and the planning model. Chosen over removing the tier: keep it as a rating, since it is the default when the step is sent to a subagent and can flag a step too hard for this chat.
- model-router 0.13.0: rule 3 says a here step runs on this chat's model and thinking, and not to mark a step "light" to mean "do it quickly here"; the schema's tier description says the same; a here step's tier picker reads "rated <tier>"; a here step whose tier's model is above this chat's model gets a warning on its card (mini and full) and a note in the plan text the tool returns. `VERSION` in `logic.ts` was stale (0.11.0), now 0.13.0.
- Not verified: the pane in the real terminal and desktop app.

| Verification command | Result |
|---|---|
| `claude plugin test plugins/model-router` | 11 pass (1 new) |
| `loop.py check --base origin/main`; `docmap.py check` | 0 errors |

## 2026-11-02 - Reflection pass: gui-design 0.3.0, herdr-delegate 0.4.0, strange-loop 0.12.0

- Owner asked for the reflection pass after using the reworked simple_complex_v1 GUI, plus a rule from their replay screenshots (bare trial and set codes).
- gui-design 0.3.0: navigation controls counted apart from the page (O6); software WebGL in headless Chrome (O7, failed before, passes now); contact sheet through the browser when Pillow is missing (O1); rules for pickers and IDs and for many-page reworks (O8). O2 closed by O4; O3 (mod panes) waits.
- herdr-delegate 0.4.0: unattended runs use Kiro, Copilot waits with `--timeout 300` and `hc read`, `--cwd` where the helper runs things, briefs that steer quota cost (O1-O5; O5 from the owner's question about Kiro usage).
- strange-loop 0.12.0: a worktree of the configured genome is the genome (O16), `new --from` checks before writing and takes mod folders (O17), what to do when the harness refuses an own merge (O19). O18 needs a kernel change: proposed to the owner, not made. paper-premark: all five observations come from reading, not use, and two are owner decisions; left open.
- Eval checks were committed before each change and failed on the old code.

| Verification command | Result |
|---|---|
| `loop.py eval gui-design` | pass (new: nav count, WebGL, sheet without Pillow; 6 failures before the change) |
| `loop.py eval strange-loop` | 17 tests OK (2 new, failing before the change) |
| `loop.py eval herdr-delegate` | pass |
| `loop.py check --base origin/main`; `docmap.py check` | 0 errors |

## 2026-11-01 - gui-design 0.1.0: a skill for GUIs at the right density

Changed: new skill **gui-design** 0.1.0, so GUIs come out neither overwhelming nor thin (owner's request, with screenshots of the simple_complex_v1 replay viewer as the main negative example). SKILL.md (about 135 lines): job, task inventory, posture and surfaces first; the layer rule with budgets; pattern table; visual calm; wording; surfaces; build-lint-shoot-look loop; rework procedure; handover. References were distilled by Kiro and Copilot helpers from the owner's DEVONthink copies of Refactoring UI, Designing Interfaces, About Face, Few, Strategic Writing for UX, NN/g, Pajamas, Distill, Victor and CLIG, then reviewed and deduplicated. Tools: `scripts/shot.py` and `scripts/lint_ui.py` drive Chrome over the DevTools protocol with the standard library only. The owner's profile is at `~/.config/gui-design/profile.md` (outside the repo). Not verified: judged cases never run, no live Streamlit app shot yet, mod panes cannot be seen (O1-O3).

| Verification command | Result |
|---|---|
| `loop.py eval gui-design` | pass, 34 scripted checks (good and bad fixtures, light and dark, URL path, --click, --full) |
| `lint_ui.py .../replay_component.html --widths 1280` | 23 problems (small targets) and 20 controls on the first screen |
| `loop.py check --base origin/main` | 0 errors |

## 2026-11-01 - herdr-delegate 0.3.0: leads catch Copilot permission prompts

- Owner: a session using a Copilot helper left many approvals to them by hand while the Claude lead sat waiting. Copilot session 10465407 showed 14 prompts: 11 decided by its assisted judge, 3 compound shell scripts (heredoc writes, `curl` loops) passed up as `human_response`. Copilot reports no status to hc, so the lead's wait could not see them.
- Not fixed by flags: only `--allow-all-tools` pre-approves such scripts, which would turn the judge off.
- 0.3.0: `helpers.py prompt <name>...` reads each screen and prints a pending approval (exit 0) or nothing (exit 1); SKILL.md step 4: with a Copilot helper, wait `--timeout 60` and check at every check-in; step 5: Copilot's "don't ask again" options, keys to decline. First scripted eval (`evals/run.py`, three captured screens) and a judged case.
- Commands: live probe on `copilot-light` (rm + curl POST) → trust dialog, URL prompt and idle screen each detected correctly, prompt declined with `escape` (nothing deleted); `loop.py eval herdr-delegate` 3/3; `loop.py check --base origin/main` 0/0; `docmap.py check` 0/0.

## 2026-11-01 - herdr-delegate 0.2.0, model-router 0.12.0: Copilot Fusion as an opt-in helper

- Owner asked whether Copilot Fusion (GitHub's model router) fits the router's helper tiers, believing Fusion High ≈ Sonnet 5.5 high and Max ≈ Opus 5.5 medium/high. Research offloaded to a Kiro helper (kiro-standard); I spot-checked the CLI claims myself.
- Findings: Fusion is a router across Claude and GPT-6 models with per-step effort; the only independent figure is Fusion Max 60 vs Claude Code Opus 5.5 at max effort 61.7 (Artificial Analysis) at about half the cost; High is unmeasured. CLI 1.0.105 rejects the documented `--fusion-tier`; `--model auto --auto-tier hydrafusion[-max]` works with a `COPILOT_CLI_ENABLED_FEATURE_FLAGS` prefix (unofficial). Owner chose opt-in.
- herdr-delegate 0.2.0: `copilot-fusion-high`/`-max` templates, `pick fusion`, a SKILL.md section; `helpers.py` and `install_templates.sh` skip `VAR=value` prefixes. model-router 0.12.0: Settings → Helpers → Copilot Fusion (off / Max for deep / High + Max), inserted before the pinned Copilot helper (same quota); a mid-chat change sends the new orders as a router note.
- Commands: `copilot ... --auto-tier hydrafusion-max -p` → `syntheticModel: hydrafusion-max`; `hc run` of `copilot-fusion-high` → status bar "Copilot Fusion · High"; `install_templates.sh` wrote both; `helpers.py pick fusion` → copilot-fusion-max; `claude plugin test plugins/model-router` 10 pass (1 new); `loop.py check --base origin/main` 0/0; `docmap.py check` 0/0; `git diff --check` clean.
- Next: owner tries Fusion Max on a few real deep steps against pinned Opus 5.5 before turning it on in the router; the env-flag workaround may break on a Copilot update.

## 2026-11-01 - project-foundations 5.4.0: docmap worklog command, merge conflicts in generated content

- Reflection pass on project-foundations for O9 (parallel worktrees conflict on generated docmap tables) and O10 (WORKLOG/STATUS entries written by hand each session), both from simple_complex_v1 on 1 Nov; owner asked for a direct implementation (single observations, not ripe by count).
- Evals first (`7dc1a78`): 6 new scripted checks; against 5.3.1, 5 failed. The baseline showed generated blocks already heal on `update` (undocumented).
- 5.4.0: `docmap worklog TITLE BODY|- [--status]`; `update` reports healed and unhealable merge conflicts; `check` fails on leftover markers; SKILL.md parallel-agents rule and maintenance row (489 lines, unchanged).
- Commands: `python plugins/project-foundations/skills/project-foundations/evals/run.py` (0 failures); `loop.py check --base origin/main` (0/0); `docmap.py update`, `check`; the new docmap run against simple_complex_v1: `check` 0 errors. This entry was written with `docmap.py worklog ... --status`.

## 2026-11-01 - model-router 0.11.0: minimal view and a clearer Settings
Changed: model-router gets a **Minimal view** (new `compact` setting, a header button and a Settings row): two lines per step with no card, notice or explanatory text, so a long plan fits the terminal pane without scrolling (the owner could not scroll while the plan question was open, so most steps were out of reach). Settings groups now start with a coloured band, rows are spaced by a blank line, Done moved to the top of Settings, and in Minimal view the help texts go too. Owner's report with two screenshots, 2026-11-01. Not verified: how it looks in the real terminal; the test harness cannot dump the drawn text, so the layout was checked only by assertions on what is and is not drawn.

| Verification command | Result |
|---|---|
| `claude plugin test plugins/model-router` | 9 passed (2 new: minimal view toggles, is remembered and keeps every picker) |
| `claude plugin validate plugins/model-router` | passed with warnings |
| `loop.py check --base origin/main` | 0 errors, 0 warnings |
| `docmap.py update`, then `check` | 0 errors, 1 warning (worklog has older months) |
| `git diff --check` | clean |

Next: owner to look at it live (`/reload-plugins`, then the Minimal button); adjust spacing from what the real terminal shows. Uncommitted.
