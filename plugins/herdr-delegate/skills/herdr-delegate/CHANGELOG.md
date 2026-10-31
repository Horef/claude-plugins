# Changelog: herdr-delegate

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.1.0 (2026-10-31)
- Created with `loop.py new`.
- Templates for Kiro v3 (approve for me), Copilot (assisted) and agy at three tiers, plus Gemini 4 Argon second-opinion templates; `scripts/install_templates.sh` installs only those whose CLI is present.
- `scripts/helpers.py`: picks a template by tier and quota priority (Kiro, then Copilot, then agy at every tier), with out-of-quota marks that expire on the 1st of next month.
- `helpers.py login <provider>`: a no-expiry mark for a stale login; the skill says to ask the person to log in to Kiro, or fall back to the next helper when they're away.
- Procedure, judge role and CLI quirks from live probes of all three CLIs in the setup session.
