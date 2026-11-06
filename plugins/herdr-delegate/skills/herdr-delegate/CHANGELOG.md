# Changelog: herdr-delegate

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.5.0 (2026-11-06)
- pick argon prefers agy; check helper model for family; long jobs in own session before hc kill; prefer other-family reviewers (owner's request 2026-11-06) (O7, O9)

## 0.4.0 (2026-11-02)
- Unattended runs use Kiro (Copilot needs a present judge); Copilot waits use --timeout 300 plus hc read; launch with --cwd where the helper must run things; briefs steer quota cost (line ranges, lowest tier, one session per batch, capped look rounds) (O1, O2, O3, O4, O5)

## 0.3.0 (2026-11-01)
- helpers.py prompt finds approvals a Copilot helper waits on; leads check at 60-second check-ins

## 0.2.0 (2026-11-01)
- Copilot Fusion High and Max templates (opt-in, pick fusion); helpers.py and the installer read past VAR=value prefixes

## 0.1.0 (2026-10-31)
- Created with `loop.py new`.
- Templates for Kiro v3 (approve for me), Copilot (assisted) and agy at three tiers, plus Gemini 4 Argon second-opinion templates; `scripts/install_templates.sh` installs only those whose CLI is present.
- `scripts/helpers.py`: picks a template by tier and quota priority (Kiro, then Copilot, then agy at every tier), with out-of-quota marks that expire on the 1st of next month.
- `helpers.py login <provider>`: a no-expiry mark for a stale login; the skill says to ask the person to log in to Kiro, or fall back to the next helper when they're away.
- Procedure, judge role and CLI quirks from live probes of all three CLIs in the setup session.
