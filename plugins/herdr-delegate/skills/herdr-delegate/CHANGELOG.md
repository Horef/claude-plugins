# Changelog: herdr-delegate

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.1.0 (2026-10-31)
- Created with `loop.py new`.
- Templates for Kiro v3 (approve for me), Copilot (assisted) and agy at three tiers, plus Gemini 4 Argon second-opinion templates; `scripts/install_templates.sh` installs only those whose CLI is present.
- `scripts/helpers.py`: picks a template by tier and quota priority (Kiro, Copilot, then agy; agy first for light), with out-of-quota marks that expire on the 1st of next month.
- Procedure, judge role and CLI quirks from live probes of all three CLIs in the setup session.
