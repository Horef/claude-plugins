# Changelog: strange-loop

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.6.0 (2026-10-30)
- Slow costs need sensors: section 6 asks every unit whose cost grows with use for a measurement that becomes a check warning past a budget; section 2 makes warnings an agent did not cause into observations; section 10 runs the sensors in audits. (O10)

## 0.5.0 (2026-10-30)
- Setup: claude.ai and Cowork add the genome as a GitHub marketplace with Sync automatically (documented in claude.com/docs/plugins), and Claude Code receives the synced skills, so hand-uploaded zips are no longer needed; strange-loop is still installed locally for its hook. Section 8 step 6: distribution follows the plugin.json version; pack remains for upload-only harnesses. (O9)

## 0.4.0 (2026-10-30)
- Adoption takes the genome, not its expressions: section 1 says things made with a skill belong to the project that asked for them; section 8 step 1 sorts every file before copying it in and distils task outputs into general examples; section 9 says examples become evals only once generalised. New judged case from this failure. (O8)

## 0.3.0 (2026-10-30)
- loop.py link symlinks the genome's skill folders into a local harness's skills folder (live, edits land in the genome; real folders are left alone); README setup is now a per-harness table (Claude Code plugins, local agents via link, claude.ai via pack). 10 unit tests.

## 0.2.0 (2026-10-30)
- loop.py: resolutions '→ rejected: <reason>' and '→ moved: <where>' now parse and are checked (the skill documented them, the parser accepted only versions - found when recording the owner's answer on O6); 'bump --obs last'; 'pack' writes an upload zip for claude.ai. 9 unit tests. (O7)

## 0.1.0 (2026-10-30)
- First version: the notice / fix / reflect procedure, the layer table, change classes, kernel rules, evals guidance, adoption and growth patterns; `loop.py` (note, status, digest, check, eval, bump, absorb, where) with unit tests; a session-start digest hook for Claude Code. Design informed by the research summary in `docs/RESEARCH.md` of the genome.
