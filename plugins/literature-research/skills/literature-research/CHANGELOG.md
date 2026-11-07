# Changelog: literature-research

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.1.1 (2026-11-07)
- Semantic Scholar without a key (owner, 7 Nov): the shared keyless pool flips between 200 and 429 (measured: relevance search 429 on 8 of 8 calls, `/search/bulk` and paper lookups answering). Patient jittered retries (capped 30 s), relevance search gives up after two quick tries and falls back to `/search/bulk` sorted by citations, logged as such (a keyless search went from 223 s to 12 s).
- Full text (pilot to_fetch.md: 15 papers the owner fetched by hand, several free): new routes for bioRxiv/medRxiv (latest version via api.biorxiv.org), eLife (fixed PDF address; doi.org served HTML) and a Europe PMC DOI-to-PMCID lookup feeding the open-access XML route. Re-run on the 15: 4 now arrive without the owner (was 0); the rest are publisher sites that refuse scripts (J Neurosci, APS, OUP, Nature, Elsevier).
- DEVONthink through MCP (owner: every agent has it): SKILL.md uses `search_records` with the bare DOI and `get_imported_record_path`; new `lit.py fetch --file PATH` runs the page-1 identity check on a path found that way (all 15 owner-fetched records passed). Profile names where the owner saves fetched papers.
- evals: 48 offline tests (5 new).

## 0.1.0 (2026-11-06)
- Created at the owner's request (2026-11-04 to 06): literature research and claim verification as a building block (frame, search with a log, chase citations, screen, evidence ledger, fresh checkers, synthesis). Owner choices: sources PubMed, Semantic Scholar, arXiv, OpenAlex, the web, DEVONthink when reachable; paywalled papers from DEVONthink, else listed for the owner; output in docs/literature/<topic>/.
- `references/search-rules.md` distilled from Cochrane ch. 4, PRISMA-S, PRISMA 2020, Garritty 2021, Hirt 2023, Greenhalgh & Peacock 2005, Jergas & Baethge 2015, Greenberg 2009, Tripathy 2014, Pautasso 2013 (Copilot helper, Sonnet 5.5; reviewed). `scripts/lit.py` (Copilot helper; reviewed).
- Piloted on a real question (NMDA at dLGN -> L2/3 synapses, simple_complex_v1): 54 logged queries, 829 candidates, 15 ledger rows, a fresh checker from another model family (GPT-6 Luna) confirmed 6, corrected 1, rejected 1, found 1 indirect. Fixed from the pilot before release: DEVONthink and folder matches need DOI or a 0.9 title match plus a page-1 identity check (four wrong PDFs in the pilot); downloads must be real PDFs (Cloudflare pages were saved as PDFs); a Europe PMC full-text route; keys from DEVONthink names, never "nd"; bulk screening; PubMed boolean-query hint; S2 key message; SKILL.md says checkers confirm the file's identity first. `evals/run.py`: 43 offline tests pass; judged cases written, not yet run blind (provisional).
