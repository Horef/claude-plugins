# Literature search and verification rules, by stage

Status: reviewed 2026-11-15 (restructure R1). An agent checked every rule for use by the skill (SKILL.md, `lit.py`, templates, eval cases) and for duplicates, and aligned the wording with the tool's vocabularies; 85 rules became 51, and merged or dropped ids are under "Retired ids". First distilled 2026-11-05 by a helper agent (Sonnet 5.5). The reason and the sources behind each rule are in `search-rules-sources.md`, under the same ids; read that file when you need the reason or the strength of a rule, not to follow it.

How to read a rule:

- **binding**: the procedure relies on it. SKILL.md does it, or `lit.py` or a template enforces it as a field, a vocabulary or a check. Follow it, or say in the hand-over that you did not.
- **guidance**: sound practice the procedure does not enforce. Apply it where the case fits.
- `[syn]` marks a rule assembled for an AI agent; no source states it in this form. Unmarked rules follow a source directly.
- The examples are from computational neuroscience (a membrane parameter, a mechanism claim); the rules are not specific to it.

Order of work: frame the question and write criteria and the stop rule (A); design the search, run it and log it as you go (B); chase citations from what you find (C); screen against the criteria (D); put every finding into the ledger before any prose (E); have a checker that did not extract a row verify it against its source (F); synthesise from the ledger only (G); say what kind of review this was (H).

## Most important 12

Ranked for an agent doing a one-day review of a parameter or a mechanism claim. The typical failures are a number without its conditions, a claim repeated from a review, a search that was not written down, and an absence stated as a fact.

1. Open the cited passage in the original paper before you rely on a claim; about one reference in four has some error, one in eight a serious one (F1).
2. Trace a review's claim to the paper with the data, and record the chain (F3, F4).
3. Put every finding in the ledger with value, units, conditions, locator, verbatim quote and evidence type before writing prose (E1, E2, E8).
4. Record the conditions and the measurement definition with each value, and match them to the claim (E2, F6).
5. Have a fresh checker verify each row, seeing only the claim, the source and the locator (F10).
6. Log every query as run, with source, date and hit counts, while searching (B8).
7. Write the question type, the decision, the criteria and the stop rule first (A1, A2, A4, A7).
8. Search more than one source, with synonyms and controlled vocabulary (B1, B3); where a missed paper would cost most, have the query reviewed by an agent that did not write it (B10, guidance).
9. Chase references backward always, forward on the key papers, and look for the contradicting papers on purpose (C2, C3, C8).
10. Count studies, not papers, and independent data sets, not citations (D3).
11. Record a reason for each full-text exclusion and have the exclusions checked (D5, D6).
12. Call it a rapid review, list the shortcuts, and claim only "not found in S on D", never "does not exist" or "the literature agrees" (H2, H3, H4).

Everything in this list is done by the procedure in SKILL.md except the query review inside item 8 (B10), which is guidance.

---

## A. Framing the question

- **A1** (binding; `lit.py init --type`). Name the question type first; each has its own search, evidence need and stop rule. `[syn]`
  - `value` (a parameter lookup): wants primary measurements with their conditions (E2); stop when several independent primary data sets under matching conditions agree or clearly disagree.
  - `review` (a mechanism, the state of a field): start from existing reviews (A9), then read primary papers on the contested or load-bearing points.
  - `novelty` (prior art): the answer is "not found in sources S on date D with queries Q", never "does not exist" (H4); needs the widest search.
  - `verify` (a claim or citation): no search when the reference is complete (DOI, title or file); open the cited source and run section F. An author-year reference ("Chen et al. 2026") is resolved first: search, check identity on page 1, ask the person if two papers fit.
  - `method`: the concepts are rarely clear, so expect more iteration and more citation chasing (B2, C3).
- **A2** (binding; `question.md` "Decision it serves"). Write the decision the answer serves and what result would change it, before searching: "We need X to decide Y; if X is below/above Z we do W." Ask the person if it is missing. `[syn]`
- **A4** (binding; `question.md` "Inclusion criteria"). Write the inclusion and exclusion criteria before the first query: population or preparation, the property and its operational definition, acceptable study types (direct measurement, model, review), date and language limits with reasons (A6), what counts as the same study (D3). Keep the scope to the few properties and conditions the decision needs. Note any later change to the criteria in `question.md`, with its date.
- **A6** (guidance). State every restriction and shortcut (date, language, study type, fewer sources) with its reason, and carry it into the final claim (H3). Use the ones that lose least for the question: a date cut is risky for parameter lookups, whose classic measurements are old and sometimes only scans; English only is acceptable for most neuroscience, say it; with fewer sources, chase citations and ask the person (B12); with fewer data items, keep the conditions (E2). `[syn on the mapping]`
- **A7** (binding; `question.md` "Stop rule"). Write the stop rule in advance, and use a test of the search, not a feeling: stop when a round of new terms or of citation chasing (C5) brings no new relevant record, or precision falls below a set cut-off, or the time or token budget ends (then say so, H3). Check that the search finds the key papers already known and also new relevant ones; chasing that returns mostly what the search already found means the search is probably adequate. Be more cautious where evidence is scarce.
- **A9** (guidance). Look for existing reviews first and use them as leads, not as evidence: their reference lists are a cheap way in, and their statements are secondary claims to trace (F3).

## B. Search design

- **B1** (binding; `question.md` "Sources to search"). Search more than one source, matched to the topic: at least two of PubMed, Semantic Scholar, OpenAlex, arXiv or bioRxiv (where the field uses them), plus the web and the person's own library where available; add a source if the topic spans fields. Published, indexed papers are a biased subset, so also look at preprints, reference lists and, where the field has them, registries and grey literature, and record how far you went. `[syn on the list]`
- **B2** (binding). Build the query from a few concepts: synonyms joined by OR inside a concept, concepts joined by AND, no NOT. Do not make every aspect a block. For a parameter lookup the blocks are typically the property, the cell or tissue type, the species or preparation and the method; for a mechanism, the entities and the relation. Where the question has no clear concepts (methods, complex evidence), run several differently shaped searches: a concept search, single-concept searches, citation chasing on key papers. `[syn on the blocks]`
- **B3** (binding). Use free-text words and the database's controlled vocabulary together (MeSH in PubMed), with synonyms, spelling variants, acronyms and truncation: for "input resistance" add "R_in" and "membrane resistance"; for a cell type add its accepted synonyms and acronyms. Treat the first query as a probe: refine the term lists from what comes back and test them on a few known relevant papers. `[syn on the examples]`
- **B4** (guidance). Aim for sensitivity first and let triage, not the query, do the narrowing: titles, then abstracts of a shortlist, then full text of the few. Broad in the query, within a narrow question. `[syn on the tiers]`
- **B7** (binding; SKILL.md sections 0 and 2 give each source's syntax). Adapt the query to each source; do not paste one string everywhere.
- **B8** (binding; `lit.py search` and `lit.py cites` append the rows). Keep the search log from the first query, written while searching, never rebuilt afterwards: source, date, the exact string as run, filters, hits, new. For a web search note how many results were screened, and save copies of pages that may change. Add a line on why the search looks as it does (term choices, dropped concepts). In the report give the date of the last search, and search again for recent and in-press papers before the hand-over if time has passed.
- **B10** (guidance). Have the main source's query reviewed before it is run, by an agent that did not write it: it gets the question, the concept blocks and the query, checks coverage (missing synonyms, missing controlled terms), Boolean logic, field tags, over-tight limits and source fit, and proposes additions; log what changed. `[syn on the checklist]`
- **B12** (guidance). Ask the person for known key papers, groups and keywords at the start. `[syn]`

## C. Citation chasing

- **C2** (binding; `lit.py cites --refs`). Chase backward (the papers a seed cites) from every included paper and every relevant review.
- **C3** (binding; `lit.py cites --citedby`). Chase forward (the papers that cite a seed) from the handful of key papers, with a citation index, more than one where available. Expand only while it keeps finding new things: chase harder where terminology is inconsistent or the evidence is spread across fields, less for a narrow, well-labelled question.
- **C5** (binding; the default stop rule). Repeat the chase with the new finds as seeds until a round adds nothing new, and count the rounds.
- **C8** (binding). Chase for disagreeing papers on purpose: a query block for the opposing finding or the failed replication, and a look at who cites the supportive papers critically. Contradicting and null findings go into the same ledger as the rest. `[syn]`
- **C9** (binding; the log rows of `lit.py cites`). Log the chase so it can be repeated: seed, direction (backward or forward), index, date, records, new, round. Use those words, not "snowballing". `[syn on the format]`

## D. Screening

- **D1** (binding). Merge the sources, remove duplicate records, then screen titles and abstracts over-inclusively: dropping a paper at the title stage is the cheapest way to lose evidence.
- **D2** (binding). Decide inclusion on the full text, not the abstract: abstracts omit the methods and conditions that decide eligibility.
- **D3** (binding). Count studies, not papers, and independent data sets, not citations. Link every report of the same data set (the original paper, a later paper, a review) into one record: compare authors, laboratory, species and preparation, n, dates and the exact values; name one primary report, say why, and keep the others for methods or extra values. Repetition is not corroboration. `[syn on the example]`
- **D5** (binding; SKILL.md section 3). Have a fresh screener check the exclusions: it gets the criteria and the list of excluded full texts with reasons, not the hypothesis or the preferred answer, and flags disagreements, which are resolved or left as awaiting a decision. `[syn on the agent form]`
- **D6** (binding; `lit.py screen`). Record a reason for every full-text exclusion, in one primary category. List the studies a reader might expect to see included, not every irrelevant hit.
- **D7** (guidance). Do not exclude a study only because its values are hard to use (in a figure, in running text); tag it. `[syn on the application]`
- **D8** (binding; `verified: abstract-only`, `to_fetch.md`). Use explicit statuses for the unfinished cases: abstract only, full text not obtained, awaiting a decision. A paper you could not open is never handled as one you read. `[syn on the list]`

## E. Extraction into the evidence ledger

- **E1** (binding). Write each finding into the ledger before writing any prose. `[syn]`
- **E2** (binding; `lit.py check` requires the columns). One row per finding: the claim, the value with units (error term and its type, n), the conditions, the source, the locator, a verbatim quote, the evidence type, the verification status. Record the definition or protocol behind the number, not only the name of the quantity: "input resistance", "spike amplitude" and "membrane time constant" are computed in different ways in different papers. Conditions for neuroscience values: `[syn on the list]`
  - species, strain, age (as reported), sex if reported;
  - preparation (in vitro slice, in vivo, culture, model), brain region, cell type and layer;
  - recording method (patch clamp or sharp electrode, whole-cell or perforated), temperature, solutions where given, junction-potential correction (yes, no, not reported);
  - the protocol used to measure the quantity and how it was calculated;
  - whether the value is from the control or from a manipulated condition.
- **E4** (guidance). Write "not reported" when the paper does not say; never leave a condition blank or fill it from a guess. `[syn]`
- **E5** (binding; evidence `inferred`). Keep the reported value as the paper gives it. A value you derived from it (a weight turned into an age, "room temperature" into a number, a unit change) is your assumption, not the paper's finding: put it in the note, or in its own `inferred` row, with the conversion written down. `[syn on the form]`
- **E6** (binding; column `locator`). Give a locator precise enough to find the passage in under a minute: the version read (preprint, accepted manuscript or published), section, page, table or figure. A DOI alone is not a locator. `[syn]`
- **E7** (binding; column `quote`, checked with `lit.py quote`). Copy the verbatim sentence that states the value and the one that states the condition; in methods sections they are often different sentences. Keep the original units and symbols, use ellipses only for omitted words, and mark a quote taken from an abstract or a snippet as such. `[syn on the form]`
- **E8** (binding; column `evidence`). Label the evidence type of every row: `measured` (the paper's own data), `modelled`, `cited` (the paper cites another for it: add the chain when traced, F3, or "untraced"), `inferred` (E5). `[syn on the labels]`
- **E9** (guidance). Read the methods section and the running text for conditions and values; do not take them from the abstract, from a table alone or from automatic extraction. Most values are in text or figures, not in tables, so plan the time. `[syn on the implication]`

## F. Verification

- **F1** (binding). Every claim-and-citation pair is unverified until the cited passage has been read in the original paper, not in an abstract, a review or a search snippet. That includes claims in reviews, claims you remember, and your own project's earlier notes and answers.
- **F3** (binding). Trace a review's claim to the primary source, step by step, and write down the chain. `[syn on the steps]`
  1. Find the reference the sentence cites. Open it.
  2. If it is a review, find that sentence's reference and open it. Repeat.
  3. Stop at the paper that reports data. Find the passage; copy it (E7).
  4. Record the chain (A cites B cites C) and the depth.
  5. If the chain ends in nothing, a hypothesis, a conference abstract or a model, record that and downgrade the claim.
- **F4** (guidance). Check for the named citation distortions, not only for a wrong number: bias (conflicting papers ignored); amplification (support built from papers with no primary data); diversion (the cited content given a changed meaning, such as "confirmed" for an effect seen in a few fibres); transmutation (a hypothesis cited as fact); dead-end citation (the cited paper does not address the claim); back-door invention (an abstract cited as a peer-reviewed paper); title invention (a title states results the paper does not report). Mark borderline readings as such.
- **F5** (binding; column `verified`, `lit.py check`). Give each checked row one verdict from the fixed set, with the passage that justifies it: `confirmed`; `corrected` (the source says something narrower, different or opposite: other conditions, a smaller n, a qualified statement; write what it does say); `not-found` (the passage is not in the source: a dead end); `indirect` (the source cites another paper for it: trace it, F3); `abstract-only` (the full text was not seen); `self-checked` (no fresh agent could be started and the extractor re-read the row itself: never `confirmed`; `lit.py check` warns wherever the synthesis cites it, and the hand-over says a fresh checker round is owed). A row is `unchecked` until then. `[syn on the labels]`
- **F6** (binding; a standard-tier checker judges it). Check that the source's conditions match the claim's: species, age, preparation and temperature; the control or baseline condition, not a drug, lesion or genetic change; and the measurement definition (E2). A correctly quoted value from juvenile mouse slices at room temperature does not support a statement about adult cortex in vivo.
- **F7** (guidance). Check the numbers: the unit and its prefix (megaohm and ohm, ms and s), the type of error term (SD, SEM, CI or "not stated"), what n counts (cells, animals, slices), and plausibility against other ledger rows under similar conditions; flag outliers for a second look. `[syn]`
- **F10** (binding). Give the check to a fresh checker that did not extract the row, and give it only the row's claim, value, conditions, source and locator, not the synthesis or the other rows. It opens the source itself, finds the passage independently if the locator is wrong, quotes it and returns a verdict (F5). The extractor does not review its own rows; when no fresh agent can be started, the label is `self-checked` (F5). `[syn on the agent form]`
- **F14** (guidance). Check retractions, corrections and expressions of concern for every source the answer relies on, in more than one place: retracted status is not displayed consistently. `[syn on the procedure]`

## G. Synthesis

- **G1** (binding; `lit.py check`: every `[L..]` resolves and no unverified row is cited). Give the answer to the decision first, written from `confirmed` or `corrected` rows only, each sentence tagged with row ids. A claim that could not be checked stays "unverified" in the answer and is not worded as established. `[syn]`
- **G4** (binding). Tabulate the values with their conditions and group them by conditions before comparing. Explain a spread from conditions and methods first, and do not pool values from incompatible conditions: give a range or a median with n, conditions and units for each condition group, not one "typical value".
- **G5** (binding; `synthesis.md` "Conflicts between sources"). When sources conflict, state both with their conditions and evidence type, and say what would settle it; never settle it by counting citations (D3). Say whether the conclusion survives leaving out the weakest or least-verified source.
- **G6** (binding; the hand-over gives the labels). Attach an evidence label to each conclusion: kind (measured, modelled, review statement, cited), match (same, different or unknown conditions), verification (confirmed by a fresh checker, extracted only, unchecked). Keep apart what primary data show, what reviews say and what you infer. `[syn on the labels]`
- **G7** (binding; `synthesis.md` "Gaps"). State the gaps: what you looked for, where and when, and what would close each (one measurement, one source, one person to ask), with its cost. Check recent and in-press papers before calling something a gap, and say what is likely missing because negative results are published and cited less. `[syn on "what would close it"]`

## H. Rapid versus systematic

- **H2** (binding). Call the work what it is, a rapid review, and keep the claims inside its shortcuts. A search built by citation chasing from a few seeds is an orientation, not a complete search: say it was seed-based. `[syn]`
  - Can claim: "In sources S, searched on date D with queries Q, the primary papers found and read report the following values under the following conditions"; that N rows were verified by a second reader and M were not; a narrative synthesis of what was found, with its conflicts; a list of gaps and of the searches that would close them.
  - Cannot claim: that the search was complete or the list exhaustive; that "no paper reports X" or that something is novel (H4); that "the literature agrees", unless the ledger shows several independent primary data sets under matching conditions; that a statement not traced to a primary source is established (F3); that the review is systematic.
- **H3** (binding; the hand-over's "what the search did not cover"). State every shortcut in the report: the sources searched, the dates, the limits, who or what screened (a language model: say which), who checked what, and what was not done (no second screening of full texts, no risk-of-bias assessment, restricted to X). Keep the log (B8) and the exclusion reasons (D6) with the report.
- **H4** (binding). A search that finds nothing supports "not found in S on D", not "does not exist". Novelty claims need the widest search and the narrowest wording: run the query set in several sources, chase from the closest papers (C3), search the neighbouring terms and the older literature, name the nearest prior work and report the closest miss. `[syn]`
- **H6** (guidance). Widen the work or ask the person when the quick answer is not safe: the answer drives a published claim or a costly experiment; the ledger shows strong conflict or thin evidence; the key sources could not be opened; the topic is hard to search. `[syn on the triggers]`

---

## Retired ids

Merged or dropped in the 2026-11-15 review; an old citation of the left id means the right one.

A3 → B2 · A5 → A4 · A8 → A4 · B5 → B3 · B6 → B2 · B9 → B8 · B11 → B1 · B13 → F14 · B14 → B8 · C1 → C9 · C4 → C3 · C6 → H2 · C7 → A7 · D9 → H3 · E3 → E2 · E10 → E9 · E11 → F10 · E12 → F5 · E13 → C8 · F2 → F1 · F8 → F6 · F9 → F6 · F11 → E6 · F12 → G1 · F13 → D3 · G2 → G6 · G3 → G4 · G8 → G7 · G9 → F1 · G10 → G1 · H1 → H2 · H5 → A6

Dropped: C10 (co-citation chasing: marked optional, and `lit.py` has no command for it) · D4 (piloting the screening form: calibration for a team of screeners; the exclusion check D5 does the job for one agent).
