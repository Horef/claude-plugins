---
name: literature-research
description: "Literature research and claim verification for any research question: frame the question and the decision it serves, search several sources in parallel (PubMed, Semantic Scholar, arXiv, OpenAlex, the web, DEVONthink when on the owner's Mac) with a reproducible search log and citation chasing, record every finding in an evidence ledger (value, units, species, preparation, source, page, verbatim quote, evidence type) before any prose, have fresh checkers re-read each cited passage, then synthesise the answer with conflicts and costed gaps. Use for parameter lookups, mechanism or state-of-the-field reviews, novelty or prior-art checks, verifying a claim or citation, and finding methods; not for writing the final paper (use research-writing)."
---

# Literature research

Use this skill to answer a research question from the literature and to check claims against their sources: a parameter value with its conditions, the state of a mechanism, whether an idea is new, whether a citation says what it is cited for, how others did a method. The output is an evidence ledger and a short synthesis that a person can check line by line. It is not for writing the paper that uses the answer (research-writing does that) and not for running analyses.

**The problem it solves.** An agent asked a literature question answers from memory, cites a review for a number measured in another species, and states "not found" as "does not exist". About one citation in four in the published literature has some error and one in eight a serious one (JB15 in `references/search-rules.md`), and claims grow by being cited without data (Gre09). The procedure therefore writes every finding into a ledger with its conditions and a verbatim quote before any prose, and has fresh checkers, who did not extract it, re-read each cited passage.

Rules with sources, by stage: `references/search-rules.md` (its "Most important 12" is the short version; rule ids such as F3 below point into it). Tools: `scripts/lit.py`. Templates: `templates/literature/`.

## 0. Setup

1. `SKILL` = this skill's folder. `lit.py` needs Python 3.10+; `pdftotext` (poppler) for full text; on macOS, DEVONthink through `osascript`. A missing tool gives exit 2: that source or step is not available, never "nothing found".
2. Read the person's profile if there is one, `~/.config/literature-research/profile.md` (format: `profile.example.md`): default sources, where their papers live (DEVONthink databases, a project's `references/papers/`), how to get paywalled papers, API keys in the environment, model tiers per step.
3. DEVONthink, two ways in. If the agent has DEVONthink MCP tools (`search_records`, `get_imported_record_path`, ...), use them: they need no automation permission. Otherwise `python3 SKILL/scripts/lit.py devonthink-status`; if it is not reachable (not this machine, not running, automation not allowed), say so once and continue with the other sources. The automation permission belongs to the terminal app the agent runs in (System Settings > Privacy & Security > Automation): a helper in another terminal may reach DEVONthink when the lead cannot.
4. Without `S2_API_KEY`, Semantic Scholar shares one busy public pool: the same call flips between 200 and 429. `lit.py` retries patiently and, when relevance search stays busy, falls back to `/search/bulk` (most-cited first, not relevance-ranked; whitespace is AND, `|` is OR, `"…"` a phrase), which the log records. Write keyless S2 queries in that syntax; if S2 still fails, rely on OpenAlex and say so in the log.

## 1. Frame the question (search-rules A)

`lit.py init docs/literature/<topic> --question "..." --type value|review|novelty|verify|method` creates the folder: `question.md`, `search_log.md`, `candidates.jsonl`, `ledger.md`, `verify/`, `synthesis.md`, `sources.bib`, `to_fetch.md`. Fill `question.md` before searching:
- the question in one sentence, its **type**, and the **decision it serves** (what changes depending on the answer);
- **inclusion criteria**: species, age, brain area and layer, preparation (slice, in vivo, culture), measurement definition, years; what would make a paper irrelevant;
- **sources** (default: PubMed, Semantic Scholar, arXiv, OpenAlex, the web; DEVONthink when reachable) and a **stop rule** (for example: two backward-and-forward rounds bring no new relevant paper, or 4 hours of search).
Show it to the person when they are available: it is the cheapest place to change the question.

## 2. Search, log, chase (B, C)

- Build each query from the question's concepts with synonyms (and MeSH terms for PubMed). PubMed joins every word with AND, so a natural-language query usually returns nothing: write short boolean queries (`thalamocortical AND NMDA AND "layer 2/3"`), one concept combination at a time; run it on each source with `lit.py search DIR <source> "<query>"`. Every run appends a row to `search_log.md` (source, query, filters, hits, new): never search without logging.
- Chase citations from the key papers: `lit.py cites DIR <key> --refs` always, `--citedby` for the papers that carry the answer, and look on purpose for papers that contradict the emerging answer (C8).
- A project's `references/` folder is where papers already used are saved; it is not a search space, but check it before fetching a paper again.

## 3. Screen (D)

Titles and abstracts first, over-inclusively; then full text. `lit.py screen DIR <key> in|out "<reason>"` records every full-text exclusion with its reason; for the hundreds of off-topic hits a broad search brings, write a TSV of decisions and use `lit.py screen DIR --from FILE`, or `--rest out "<reason>"` once every relevant one is marked in. Count studies, not papers: the same data reported twice is one data set (D3).

## 4. Read and fill the ledger (E)

Get the full text with `lit.py fetch DIR <key>`: DEVONthink first, then the project's papers folder, then open access (the candidate's OA link, arXiv, bioRxiv/medRxiv at the latest version, eLife, OpenAlex locations, then Europe PMC's open-access full text found from the DOI). With DEVONthink MCP tools, look the paper up yourself first: `search_records` with the bare DOI as the query (hits carry `doi`; fall back to the title), `get_imported_record_path` for the file, then `lit.py fetch DIR <key> --file PATH`, which runs the same page-1 identity check (exit 1: not this paper). Never edit files inside a `.dtBase2` package; `lit.py text` caches outside it.

A paper none of these has goes to `to_fetch.md` for the person (title, DOI, why it is needed); continue with its abstract and mark the rows `abstract-only`. Publisher sites (J Neurosci, APS, OUP, Nature, Elsevier) refuse scripted downloads even for free papers, so to_fetch.md is still the way for those; put the DOI link in each row and give the person's paper folder (profile) where they should save them. Extract text with `lit.py text <pdf>`.

One ledger row per finding, before any prose: the claim in one sentence, the **value with units**, the **conditions** (species, age, layer, preparation, temperature, method, the measurement's definition), the source key, the **locator** (page, figure, table), a **verbatim quote** of the passage, and the **evidence type**: `measured` (the paper's own data), `modelled`, `cited` (the paper cites another for it: trace it, F3) or `inferred` (our conversion or reasoning: show it in the note). A claim taken from a review is traced to the paper with the data; record the chain in the note.

## 5. Verify with fresh checkers (F)

Each ledger row is checked by an agent that did not extract it and sees only the row's claim, value, conditions, source and locator, not the synthesis. It first confirms that the file is the cited paper (title and first author on page 1: the pilot found four wrong PDFs matched by title words), then runs `lit.py quote <pdf> "<quote>"`, reads the passage, and sets `verified` to `confirmed`, `corrected` (with the right value or conditions), `not-found` or `indirect` (the source cites someone else). Give checkers a different model family from the extractor where possible; a light tier is enough for confirming quotes, a standard tier for judging conditions. Their reports go in `verify/`. Rows not confirmed do not carry the answer.

## 6. Synthesise (G, H)

`synthesis.md`: the answer first, in a sentence the decision can use, each sentence tagged with ledger ids (`[L3, L7]`); then a table of the values with their conditions; conflicts and what explains them (conditions usually do, Tri14); gaps, each with what would close it (a measurement, a paper to fetch, an analysis) and its cost. Call the work what it is (a rapid review on the sources and dates in the log) and claim only what the search supports: "not found in PubMed and Semantic Scholar on 2026-11-06", never "does not exist".

`lit.py check DIR` until clean (ledger fields, vocabularies, sources in candidates, every `[L..]` resolves, no unverified row cited). `lit.py bib DIR` writes `sources.bib`.

## 7. Save and hand over

Papers used go to the project's `references/papers/` (copies of papers are not committed where the project forbids it) and, when DEVONthink is reachable and the person wants it, into their database; add a pointer to the project's paper notes. The handover says: the answer in one sentence, its evidence labels, the conflicts, the gaps with costs, the papers in `to_fetch.md`, and what the search did not cover.

## Who does each step (a suggestion; the profile overrides)

| Step | Suggested tier | Why |
|---|---|---|
| 1 Frame | deep, with the person | the question and the stop rule decide everything else |
| 2-4 Search, screen, extract | standard (a helper on another subscription suits it) | detailed instructions exist by now; many tool calls |
| 5 Verify | light for quotes, standard for conditions; another model family | the extractor reads what it expects |
| 6 Synthesise | deep | weighing conflicting evidence |

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note literature-research <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for literature-research` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
