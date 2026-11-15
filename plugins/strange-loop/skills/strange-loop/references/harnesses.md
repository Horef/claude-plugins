# The loop in each harness

Strange-loop SKILL.md sections 11 and 5, harness by harness.

## Closing the loop: how a lesson travels (section 11)

The genome is the GitHub repository; every other copy is either a clone that can write back or an installed copy that only receives.

**Upward, from use to the genome.**
- Local agents (Claude Code, Kiro, Copilot, Codex on a machine with a clone): `loop.py note` writes into the clone; `loop.py sync` commits observation-only changes, pulls (LEARNINGS files merge as a union through `.gitattributes`, so two machines never conflict; ids both machines used are renumbered, and an open line whose resolved copy exists is dropped) and pushes. With `~/.config/strange-loop/auto_sync` set to `on`, Claude Code's session-start hook does this by itself.
- claude.ai with the computer connected: the agent runs the note command on that computer through the connector; the next sync there shares it.
- Chat-only and cloud sessions without the genome: the `Observations for <unit>` block at the end of the reply; `loop.py absorb` brings it in from any session that has the genome.

**Inward, from the genome to every copy.** A reflection pass (SKILL.md section 4) changes a unit, bumps its version and pushes to the genome's main branch as its AGENTS.md allows. From there: claude.ai and Cowork re-sync the marketplace (Sync automatically), Claude Code receives the synced skills or updates its installed plugins, symlinked local agents read the clone after its next sync (pull), and CI checks every push.

What closes the loop is therefore one routine per machine (sync) and one rule per change (bump and push). A note that stays in a chat reply, or a clone that is never synced, is where a lesson gets lost: when you see either, say so.

## Claude Code: `claude plugin eval` (section 5)

- **In Claude Code**, `claude plugin eval` runs cases in its own layout (`evals/<case>/prompt.md` plus graders, at the plugin root) several times with and without the plugin and reports the difference; use it when you need that with/without comparison or a CI threshold. Its graders are deterministic (regex, tool used, file exists) or a short LLM judge, so write the case so its outcome lands in a file or a regex-checkable line.
