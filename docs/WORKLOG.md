# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

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
