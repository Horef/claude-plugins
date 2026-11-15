# Changelog: model-routing

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.3.0 (2026-11-15)
- Needing the conversation beats model strength for a here step (it stays here, sub-agent only offered); rate steps by their work, not the chat's model; sub-agent questions about goals go to the person; rerun ladder ends at Fable high as in tiers.ts; Learning loop block back on the template; evals/run.py compares tier table, ladder and block with tiers.ts and the template (O1)

## 0.2.0 (2026-11-03)
- A here step's tier is a rating: the model and thinking columns are for sub-agents, a here step shows "this chat" as its model, and one rated above the chat's model is pointed out (owner's report, as model-router 0.13.0)

## 0.1.0 (2026-10-30)
- Created with `loop.py new`.
