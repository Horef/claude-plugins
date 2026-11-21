# Changelog: session-status-line

Newest first. Entries are reconstructed from the conversation the mod was built in; dates are approximate. Later entries cite observations (O-ids in LEARNINGS.md) or evals.

## 0.10.0 (2026-11-21)
- cache countdown on the band and in status, warmer only keeps a live cache (waits for the next message after a lapse, /clear, /resume, compaction, /model; lifetime learned from turn.step cache writes, 5-minute caches not warmed), 50 min wait and 45 s retries for passing errors only, warm now one-shot, ⓘ options row with buttons; fixes from a Gemini 4 Neon review (O4)

## 0.9.0 (2026-11-21)
- cache warmer (owner request): /status-line warm and a 🔥 band button keep a waiting chat's prompt cache alive with a fork every 55 min after the last request, never added to the transcript; for/until/every/now, retry after a failed warm; tests/warm.test.tsx

## 0.8.1 (2026-11-16)
- agy quota read runs agy by full path with no browser opener (open, xdg-open, ...) on its PATH: with a login it could not refresh, every poll opened a browser login page (issue #89, fix by unzim; agy resolved once instead of a second fallback run)

## 0.8.0 (2026-11-15)
- README matches the code on context colour under 50% and states the 3:1 contrast bar (4.5:1 is unreachable on off-white and dark together); tests/behaviour.test.tsx checks the compaction counter (subagent exclusion, resume), a saved layout loading at the start, and the colours' contrast (O2)

## 0.7.1 (2026-11-13)
- separators between budgets, old readings keep their colour (marked ~), overage bold red, session row dim

## 0.7.0 (2026-11-13)
- grouped rows that wrap as needed (Claude, helpers, session), aligned helper columns, calmer look

## 0.6.0 (2026-11-11)
- Other Claude accounts' 5h/7d limits (readings files, label command, optional live read), Codex budget, Kiro Linux path, agy fallback only if present, per-reader labels

## 0.5.0 (2026-11-09)
- Three rows (Claude: model, context, 5h, 7d; helpers: Kiro, Copilot, Antigravity, extra; the rest); Antigravity's 5h/weekly and Argon weekly limits read from agy -p /usage; layout 'rows' (two = alias) (owner request 2026-11-09) (O1)

## 0.4.0 (2026-10-31)
- Outside budgets on the budget line: Kiro credits with overage charges and reset, Copilot premium credits and reset, Claude extra usage once credits are spent or a window is full; `Kiro log in` when its login is stale
- Read every five minutes in the background, shared across chats; `/status-line quotas on|off`; `debug` shows the readings
- Owner's request (2026-10-31); sources found by probing each CLI and API read-only

## 0.3.0 (2026-10-11)
- Two-line layout when one line does not fit (`/status-line auto|one|two`, remembered); `/status-line debug` reports version, surface and measured width
- Dedicated compaction counter, shown from 0, saved per chat so a resumed chat keeps it; precomputed and vetoed compactions are not counted
- Colours chosen for 3:1 contrast on white, off-white and dark backgrounds
- Desktop bar glyphs that draw at an even size; pace warning only when the limit would be hit well before the reset

## 0.2.0 (2026-10-06)
- Narrower row: dropped the session token totals, cache hit rate and tool count; limits shown without bars
- Added the pace warning, last-turn duration and files-edited count

## 0.1.0 (2026-10-04)
- First version: model with effort tag, context bar, session tokens, 5h and weekly limits with reset, cost
