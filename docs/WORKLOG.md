# Work log
Newest first. Each entry: what changed, how it was verified, what's next. Never edit or delete past entries.
Earlier months: `docs/worklog/YYYY-MM.md`.

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
