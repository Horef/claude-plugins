# Learnings: literature-research

Observations from use, written by the agents that used this skill; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open
- O1 2026-11-07 [failure] lit.py text/quote: cache_path uses the PDF stem in the cache file name; a DEVONthink file named after a 250-character abstract sentence (Hull 2009) exceeds the file-name limit, so a helper had to copy the PDF to /tmp. Truncate or hash long stems. (claude-code, simple_complex_v1)
- O2 2026-11-07 [friction] 2 Search log: in a 53-query survey 7 arXiv queries hit HTTP 429 and were neither retried long enough nor logged (lit.py logs nothing after a failed search, by design); PRISMA-S wants every search reported. Log failed searches as a row with 0 results and the error, and retry arXiv like keyless S2 (it asks for 3 s between calls). (claude-code, research-assistant survey)

## Resolved
