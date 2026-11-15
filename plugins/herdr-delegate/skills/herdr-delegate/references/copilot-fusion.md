# Copilot Fusion

Read when: the person asks for Copilot Fusion, `pick fusion` is used, or a `copilot-fusion-*` template misbehaves. Moved from SKILL.md "Helpers" (restructure R4, 2026-11-15).

Copilot Fusion (GA 2026-10-28; the details below are as researched 2026-11-01 and may be out of date) is opt-in: it is in no default order, and `pick fusion` (Max, then High) or a named template uses it. Per prompt it picks the models (Claude Opus/Sonnet 5.5, GPT-6 Luna/Sol/Astra), their effort, and single, cascade or critique. Researched 2026-11-01:

- Quality: the only independent number is Fusion Max 60 vs Claude Code with Opus 5.5 at *max* effort 61.7 (Artificial Analysis Coding Agent Index) at about half the cost and tokens. High and Standard are unmeasured; "High ≈ Sonnet 5.5 high" has no source. Trivial prompts go to GPT-6 Luna even on Max, and one simple question on Max went to Astra (2.5× Opus's price).
- Cost: no rate of its own; each model it uses is billed at list price (30% off until 2026-11-30). High and Max need Pro+ or above.
- CLI 1.0.105: the documented `--model fusion --fusion-tier` is rejected. The templates use `--model auto --auto-tier hydrafusion` (High) / `hydrafusion-max` (Max) with the `COPILOT_CLI_ENABLED_FEATURE_FLAGS=...` prefix (an unofficial flag workaround that may break on update; without it: "requires dynamic Auto tiers"). `--reasoning-effort` is refused. The status bar shows "Copilot Fusion · High".
- Use it for large, well-scoped coding steps where cost and speed matter more than knowing the model; review its diffs (discarded drafts' edits stay). Keep the pinned templates for anything that must be a known model.

## Re-verification, 2026-11-15

Offline, on this machine (Copilot CLI 1.0.112, newer than the 1.0.105 the notes were measured on):

| Dated note | Result |
|---|---|
| `--model fusion --fusion-tier` is rejected | Still no `--fusion-tier` (nor the word "fusion") in `copilot --help`: consistent. |
| Templates use `--model auto --auto-tier hydrafusion[-max]` | `--auto-tier <preference>` ("the Auto routing profile by its exact advertised ID, validated against the available catalog") and `--model auto` both exist in 1.0.112; the templates' command lines in `helpers.default.json` match the notes. Whether the IDs `hydrafusion` / `hydrafusion-max` are still advertised, and whether the `COPILOT_CLI_ENABLED_FEATURE_FLAGS` prefix is still needed, needs a logged-in session. |
| `--reasoning-effort` is refused | `--reasoning-effort <level>` is listed in help ("supported levels depend on the model"); refusal for Fusion not re-run: needs a live call. |

Need the network or a logged-in Copilot (not done):

- Artificial Analysis numbers (Fusion Max 60 vs Opus 5.5 max 61.7), "about half the cost and tokens".
- GA date 2026-10-28; "30% off until 2026-11-30" (expires in 15 days); "High and Max need Pro+ or above".
- Routing observations (trivial prompts to Luna, a simple question to Astra at 2.5× Opus's price).
- The status bar text "Copilot Fusion · High".
