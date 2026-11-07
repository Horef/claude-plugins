# Literature search and verification rules, by stage

Distilled for this skill from the sources below by a helper agent (Sonnet 5.5) on 2026-11-05. Not yet reviewed by the skill author. Paraphrase throughout; short quotation marks mark verbatim wording. Examples are constructed (a computational-neuroscience setting: looking up a membrane parameter, checking a mechanism claim) and their numbers are illustrative.

How the sources were read, so nobody trusts more than was checked:

- Read in full or nearly so: Coch ch. 4 main text (sections 4.1 to 4.6; **not** the online Technical Supplement), PRS (checklist and items 5, 8, 12, 13), P20 (the item checklist and the list of changes from PRISMA 2009; **not** the Explanation and Elaboration), Gar21, GP05, JB15, Gre09 (all but the web extra notes), Tri14, Pau13.
- Read in part: Hir (the published Res Synth Methods version could not be opened; I read the published abstract and the medRxiv preprint, sections Introduction to Discussion, not its final pages). Tri15 (abstract, Introduction and Materials and Methods only; its Results, with the numbers on how much variance the conditions explain, were **not** read, so no figure from them appears here).
- Known only through Coch and not read: PRESS checklist, TARCiS statement (Hirt 2024), Booth's non-PICO question frameworks.

## Source keys

- **Coch** Lefebvre et al., "Chapter 4: Searching for and selecting studies", Cochrane Handbook for Systematic Reviews of Interventions v6.5.1 (last updated March 2025). Cited by section number; "MECIR C19" etc. are the numbered expectations in its boxes.
- **PRS** Rethlefsen et al. 2021, "PRISMA-S: an extension to the PRISMA Statement for reporting literature searches in systematic reviews", Syst Rev, doi 10.1186/s13643-020-01542-z. Cited by checklist item (1 to 16). It is a reporting guideline, not a conduct guideline; I use its items as a list of what a log must hold.
- **P20** Page et al. 2021, "The PRISMA 2020 statement", BMJ, doi 10.1136/bmj.n71. Cited by item number.
- **Gar21** Garritty et al. 2021, "Cochrane Rapid Reviews Methods Group offers evidence-informed guidance to conduct rapid reviews", J Clin Epidemiol, doi 10.1016/j.jclinepi.2020.10.007. Cited as R1 to R26 (its Table 1 recommendations) and by section. Its own status: interim guidance, partly consensus, partly evidence.
- **Hir** Hirt et al. 2023, "Citation tracking for systematic literature searching: a scoping review", Res Synth Methods, doi 10.1002/jrsm.1635. 47 methodological studies. Page-level claims come from the preprint (doi 10.1101/2022.09.29.22280494); check them against the published version before quoting.
- **GP05** Greenhalgh & Peacock 2005, "Effectiveness and efficiency of search methods in systematic reviews of complex evidence: audit of primary sources", BMJ, doi 10.1136/bmj.38636.593461.68. One audit of 495 sources in one review (health-service innovation), not a general law.
- **JB15** Jergas & Baethge 2015, "Quotation accuracy in medical journal articles: a systematic review and meta-analysis", PeerJ, doi 10.7717/peerj.1364. 28 studies in the main analysis.
- **Gre09** Greenberg 2009, "How citation distortions create unfounded authority: analysis of a citation network", BMJ, doi 10.1136/bmj.b2680. One claim (in inclusion body myositis), 242 papers; the mechanisms generalise, the rates do not.
- **Tri14** Tripathy et al. 2014, "NeuroElectro: a window to the world's neuron electrophysiology data", Front Neuroinform, doi 10.3389/fninf.2014.00040. Cited by section.
- **Tri15** Tripathy et al. 2015, "Brain-wide analysis of electrophysiological diversity yields novel categorization of mammalian neuron types", J Neurophysiol, doi 10.1152/jn.00237.2015.
- **Pau13** Pautasso 2013, "Ten simple rules for writing a literature review", PLoS Comput Biol, doi 10.1371/journal.pcbi.1003149. Cited by Rule number. Experience-based advice from one author, not evidence; the weakest source here.
- **[syn]** marks a rule I assembled for an AI agent doing literature research. No source states it in this form; the sources named after it are what it rests on.

## How to use this file (workflow order)

The sources are written for human review teams, so the order below is theirs adapted to an agent.

1. Frame the question and the decision it serves, write criteria and the stop rule (A).
2. Design the search, run it, log it as you go (B). Chase citations from what you find (C).
3. Screen against the criteria and record why each full text was dropped (D).
4. Put every finding into the ledger before writing any prose (E).
5. Verify each ledger row against its source, with a checker that did not extract it (F).
6. Synthesise from the ledger only (G). Say what kind of review this was (H).

---

## A. Framing the question

**A1. Name the question type first; each type has a different search, evidence need and stop rule. [syn]**
Why: a parameter lookup needs conditions-matched primary measurements; a prior-art check is a claim of absence; a claim check needs no search. Using the wrong procedure wastes the day or overstates the result.
Concrete form:
- Value or parameter lookup: wants primary measurements with conditions (E); stop when several independent primary data sets under matching conditions agree or clearly disagree.
- Mechanism or state-of-field review: start from existing reviews (A9), then read primary papers on the points that are contested or load-bearing.
- Novelty or prior-art check: the answer is "not found in sources S on date D with queries Q", never "does not exist" (H4). Needs the widest search.
- Verifying a claim or citation: no search; open the cited source and run section F.
- Finding a method: PICO-style concepts fit poorly (A3); expect more iteration and more citation chasing (B6, C4).
Source: Coch 4.4.2 (PICO unsuited to methods and other non-intervention questions; "tailored approach"); Pau13 Rule 4 (choose the review type from the material and the time).

**A2. Write the decision the answer serves and what result would change it, before searching. [syn]**
Why: without it there is no way to say what is enough, and the search expands to fill the day. Rapid-review practice puts the question-setting with the people who will use the answer.
Concrete form: one sentence, "We need X to decide Y; if X is below/above Z we do W." Ask the person if it is missing.
Source: Gar21 R1 (refine question and eligibility criteria with the users so the review is fit for purpose, and consult them about changes); Pau13 Rule 1 (well-defined topic and audience).

**A3. Break the question into a few concepts and fix their wording; use a framework only where it fits. [syn]**
Why: the concepts become the blocks of the query (B2). PICO is designed for interventions and is a poor fit for methods, mechanisms or measurement questions.
Concrete form: for a parameter lookup, typical blocks are the property (with its definition), the cell or tissue type, the species or preparation, and the measurement method. For a mechanism question: the entities and the relation. Do not make every aspect a block (B2).
Source: Coch 4.4.2 (PICO concepts; not suitable for methods and some other questions; options include another question breakdown, single concept, subconcepts, multi-stranded search).

**A4. Write the inclusion and exclusion criteria before the first query, including the definition of the thing measured.**
Why: criteria written after seeing the papers drift toward the answer you expect. For a measured quantity, two papers can use the same name for different protocols or calculations, so the definition is part of eligibility.
Concrete form: population or preparation, property and its operational definition, acceptable study types (direct measurement, model, review), date and language limits with reasons (A6), what counts as the same study (D3).
Source: Coch 4.3.1.1 MECIR C19 (searches are motivated directly by the eligibility criteria); P20 item 5; Pau13 Rule 2 (define exclusion criteria early); Tri14 2.3.3 (spike amplitude can be computed from threshold or from resting potential, evoked by different current steps: protocol, calculation and condition differences).

**A5. Keep the scope small: few interventions, comparators, outcomes (here: few properties and conditions) and the ones the decision needs.**
Why: scope is the main time lever, and a focused review is more useful than a broad one.
Source: Gar21 R2 to R4 (limit interventions, comparators and outcomes, with emphasis on those most important for decisions); Pau13 Rule 5 (keep the review focused).

**A6. State every restriction (date, language, setting, study type) and its reason; each one limits what may be claimed.**
Why: restrictions can drop studies and change the result. A neuroscience parameter is often first measured in older papers, so a date cut is risky for lookups. [syn on the neuroscience point]
Source: Coch 4.3.1.1 MECIR C19 (do not restrict by language or publication status; removing a language filter in English-only databases is not a substitute for searching others); Gar21 R5 to R7 and section 3.3.2 (date limits can lose studies and change meta-analytic results; English-only is a viable shortcut for conventional interventions, not where non-English studies are expected); PRS item 9.
Disagreement: Coch treats unrestricted searching as mandatory for Cochrane reviews; Gar21 allows justified restrictions for rapid reviews. For an agent doing a rapid review, restrict only with a written reason and carry the restriction into the final claim (H5).

**A7. Write the stop rule in advance, and use a test of the search, not a feeling.**
Why: Coch itself says deciding when a search is complete is hard and the stopping rules have had little formal evaluation, so the safest course is to fix a rule and report it.
Concrete form: stop when a round of new terms or a round of citation chasing (C5) yields no new relevant records; or precision falls below a set cut-off; or the time or token budget ends (then say so, H2). Check the search finds the key papers you already know and also finds new relevant ones. Be more cautious where evidence is scarce.
Source: Coch 4.4.11 (no-new-records and precision cut-offs; do not rely only on finding known key papers, which may mean the search is biased toward them; citation searching and reference checking as performance checks; scarce evidence calls for caution); capture-recapture and relative recall are named there but I did not use them.

**A8. Write the plan down and log every change to it. [syn]**
Why: iterative searching is normal, so the plan will change; what matters is that the change is visible.
Source: Gar21 R23 to R25 (protocol before the review; post hoc changes allowed if documented); P20 item 24c (describe amendments to the protocol).

**A9. Look for existing reviews first and use them as leads, not as evidence.**
Why: someone has probably reviewed the topic or a neighbour of it; their reference lists are a cheap way in. But a review's statement is a secondary claim that must be traced (F3).
Source: Pau13 Rule 2 (seek previous reviews; discuss their limits, find a new angle); Coch 4.3.5 MECIR C29, C30 (search within previous reviews; check reference lists of included studies and relevant reviews, mandatory).

---

## B. Search design

**B1. Search more than one source, and match them to the topic.**
Why: one database is a biased sample of the literature. Cross-disciplinary and specialised topics need extra sources.
Concrete form for this skill: at least two of PubMed, Semantic Scholar, OpenAlex, arXiv or bioRxiv (where the field uses them), plus the web, plus the person's own library (DEVONthink) where available. Add a source if the topic spans fields. [syn on the list]
Source: Coch 4.2.2 (MEDLINE alone is inadequate; searching beyond MEDLINE also reduces selection bias) and 4.3.1.1 (two or more databases lower the risk of missing studies; specialised or cross-disciplinary topics may need more); Gar21 R10 and R11 (rapid review: the core databases plus at most one or two specialised ones).

**B2. Build the query from concepts: synonyms joined by OR inside a concept, concepts joined by AND; few concepts; avoid NOT.**
Why: OR gives sensitivity inside a concept, AND ensures each concept is present. Outcomes and comparators are often absent from titles and abstracts or poorly indexed, so putting every aspect into the query loses records. NOT can silently remove relevant records.
Source: Coch 4.4.2 and MECIR C32.

**B3. Use free-text words and the database's controlled vocabulary together (MeSH in MEDLINE), with synonyms, spelling variants, acronyms and truncation.**
Why: indexing is incomplete and inconsistent, and so is authors' wording. In neuroscience one quantity travels under several names.
Concrete form: for "input resistance" add "R_in", "membrane resistance"; for a cell type add its accepted synonyms and acronyms; explode MeSH terms where appropriate. Check the term lists with a few known relevant papers. [syn on the examples]
Source: Coch 4.4.4 and MECIR C33; Tri15 Methods (common synonyms and abbreviations, such as "input resistance" often written "R_in"); Tri14 2.4 and 3.4 (neuron-type mapping fails when synonyms or acronyms are missing); Tri14 2.7 (they used MeSH terms for species, strain and preparation).

**B4. Aim for high sensitivity first and lower precision; let triage, not the query, do the narrowing. [syn on triage for agents]**
Why: reading titles and abstracts is cheap relative to the review, so a broad net is affordable; a narrow query is the commoner failure.
Source: Coch 4.4.3 (sensitivity versus precision; about 60 to 120 abstracts an hour; maximise sensitivity while striving for reasonable precision) and Key Points.
Disagreement: Coch assumes human abstract-reading time is cheap. An agent pays in tokens and context. Triage in tiers: titles, then abstracts of a shortlist, then full text of the few.

**B5. Treat the first query as a probe and refine it from what comes back.**
Why: term lists are built by iteration on the retrieved records.
Source: Coch MECIR C33 ("iterative process"); Coch 4.4.2 (iterative searches for complex questions).

**B6. When the question has no clear concepts, use several differently shaped searches rather than one.**
Why: for complex or methods questions a single Boolean string misses much. Mix concept searches, single-concept searches and citation chasing on key papers.
Source: Coch 4.4.2 (multi-stranded search, iterative search, citation searching on key articles); GP05 Discussion (complex evidence cannot rely only on predefined strategies).

**B7. Adapt the query to each source; do not paste one string everywhere.**
Why: field tags, thesauri, truncation and proximity differ between databases.
Source: Coch MECIR C33 (strategies customised for each database; MEDLINE and Embase controlled vocabularies differ).

**B8. Keep a search log from the first query, written while searching, not rebuilt afterwards.**
Why: a log reconstructed afterwards is "nearly impossible", and a reader cannot judge a review without the exact strings.
Concrete form: one row per query: source and interface, date, exact string as run (copied, never retyped), fields, limits, number of hits, number screened. For web search, the number of results screened ("first 5 pages screened, n = 50"). Save local copies of web pages that may change.
Source: Coch 4.5 and MECIR C36 (sources, dates, who, which terms; save strategies as run; retyping introduces errors; web results are not reproducible, so keep copies); PRS items 1, 4, 8, 9, 13, 15 (database and platform, other online sources and how they were browsed, full strategies as run, limits, date of last search, record counts).

**B9. Record why the search looks the way it does: a short search narrative. [syn on format]**
Why: a reviewer of the search needs the reasons behind term choices and dropped concepts.
Source: Coch 4.5 (the search narrative describes the major decisions that shaped the strategy; correspondence on key decisions is recorded).

**B10. Have the search reviewed before it is run, by someone who did not write it.**
Why: errors in published search strategies are common. A checklist-based review improves search quality, including in rapid reviews.
Concrete form for an agent: a second agent gets the question, the concept blocks and the query and checks coverage (missing synonyms, missing controlled terms), Boolean logic, field tags, over-tight limits and source fit, and proposes additions; the first agent logs what it changed. I did not read PRESS, so the checklist items are mine. [syn]
Source: Coch 4.4.8 (peer review strongly recommended before running; PRESS; evidence it improves searches); PRS item 14; Gar21 R12 (peer review of at least one strategy, for example MEDLINE).

**B11. Search beyond the bibliographic databases: registries, preprints, grey literature, reference lists, experts. Record what you did and how far you went.**
Why: published, indexed papers are a biased subset. Web search results change with time and user, so they are the least reproducible part and need the most careful notes.
Source: Coch 4.3.5 (grey literature, previous reviews, reference lists) and 4.5 (web content changes; document how many results were screened); PRS items 3, 4, 6, 7 (registries, online sources, contacting experts, other methods); Gar21 R13 (in a rapid review limit grey literature and supplementary searching).

**B12. Ask the person for known key papers, groups and keywords at the start. [syn]**
Why: personal knowledge and contacts supplied about a quarter of the sources in the audit, at the lowest time cost.
Source: GP05 Results (23% of 495 sources known to or recommended to the team; "took little time"; 24% including serendipity and own networks, Table 1).

**B13. Check the retraction and correction status of every source you will rely on. [syn on procedure]**
Why: retracted and corrected papers circulate and are cited; displays of retracted status are not consistent across sources, so one source is not enough.
Source: Coch 4.4.6 and MECIR C48 (examine retraction statements and errata; retraction status is not always consistently displayed; reviews were often not corrected when included studies were retracted).

**B14. Report the date of the last search and say what was searched after it. [syn on agent form]**
Why: a search ages. Preprints and papers in press may already answer the question.
Source: PRS items 12 and 13 (updates; date of last search for each strategy); P20 item 6; Pau13 Rule 10 (papers in press; search again at revision stage).

---

## C. Citation chasing

**C1. Use the terms precisely: seed, backward, forward, co-cited, co-citing, iteration.**
Why: terminology in the field is inconsistent, and a log that says "snowballing" cannot be repeated.
Concrete form: seed = a paper known at the start or found eligible later. Backward = papers the seed cites. Forward = papers that cite the seed (needs a citation index). Co-cited = share citing papers with the seed. Co-citing = share references with the seed. An iteration = new seeds from the last round's finds.
Source: Hir Introduction (definitions; terminology heterogeneous and ambiguous).

**C2. Always chase backward from every included paper and every relevant review.**
Why: it is cheap and it was the most productive single method in the one audit that measured it.
Source: Coch MECIR C30 (check reference lists of included studies and relevant reviews: mandatory); GP05 Results (reference tracking supplied 44% of the 495 sources, the largest single yield, though its time cost could not be separated from appraisal).

**C3. Chase forward from the key papers with a citation index, and use more than one index.**
Why: forward chasing finds recent papers and reviews that keywords miss. Indexes complement each other. Google Scholar was costly to use.
Concrete form for this skill: Semantic Scholar and OpenAlex citation lists, plus one more index if available. Record which. [syn on tool names]
Source: GP05 Results (electronic forward tracking took about one day and found five reviews, three of them by no other method, and 12% of the empirical studies; roughly one useful paper per 15 minutes); Hir Discussion (every study that used more than one index found that they complemented each other; Scopus out-yielded Web of Science in one study; Google Scholar had a high administrative and time cost).

**C4. Chase harder when the topic is hard to search and less when the question is narrow and well-labelled.**
Why: the benefit is not uniform. Citation chasing helps most where terminology is inconsistent, evidence is complex or spread across fields, or sources are in obscure places.
Source: GP05 Discussion (complex, heterogeneous evidence; obscure locations); Hir Introduction and Discussion (complex interventions, topics without consistent terminology; less benefit for clearly defined PICO questions).
Disagreement: Hir found added value in 43 of 45 studies that assessed it, but warns that this probably overstates the benefit because of publication bias, and describes two studies in which it added nothing or almost nothing (one eligible paper from forward chasing of 40 included papers). GP05 found it the strongest method, in one review of complex evidence. Coch 4.4.2 lists it as an option, not a requirement, apart from reference lists (C30). Resolution: do backward chasing always, forward chasing on a handful of key seeds, and expand only if it keeps finding new things.

**C5. Repeat the chase until a round adds nothing new, and count rounds.**
Why: most reviews stop after one round; three of the studies that went further found papers only in the second or third round.
Source: Hir Results and Discussion (most studies did one round or did not say; unique papers appeared in iterations two and three; the authors' own review needed three rounds, with round two finding a paper that served as a seed for round three).

**C6. Treat stand-alone citation chasing as a fast orientation method, not a complete search.**
Why: when compared with database searching, chasing from a few seeds rarely found as many relevant papers.
Concrete form: for a one-day review this is acceptable for finding a way into a field or a handful of primary papers, provided the report says the search was seed-based (H2).
Source: Hir Discussion (stand-alone chasing not sensitive enough for systematic or scoping reviews; may suit narrative, rapid or systematized reviews or hard-to-search topics).

**C7. Use chasing as a test of the database search.**
Why: if chasing returns mostly papers the search already found, the search is probably adequate; if it keeps finding new relevant papers, the search was not.
Source: Coch 4.4.11 (citation searching and reference checking as checks of performance).

**C8. Chase for disagreeing papers on purpose. [syn]**
Why: citations are biased toward supportive papers. In the one network analysed, papers conflicting with the claim were cited far less than supportive ones, and negative results rarely spread through later citations. A chase that follows the cited papers will therefore inherit the bias.
Concrete form: add a query block of the opposing finding or the failed replication; look at who cites the supportive papers critically; keep the contradicting papers in the ledger (E13).
Source: Gre09 (citation bias against critical primary data; the inherent property of negative results not being repeatedly cited, Discussion).

**C9. Log the chase. [syn on format]**
Why: otherwise it cannot be repeated or checked.
Concrete form: seed paper, direction, index or method, date, number of records, number new, iteration number.
Source: PRS item 5 (state whether cited or citing references were examined, the methods, and the base articles); Coch 4.5 (forward chasing happens late, so plan how to record it; TARCiS statement on terminology and reporting of citation searching, not read); Hir Discussion (reporting of chasing is unclear and not standardised).

**C10. Co-citation chasing is promising but produces too much; rank the output. Optional.**
Why: the few studies on co-cited references suggest good coverage, and all pointed to the need for relevance ranking.
Source: Hir Results (indirect chasing) and Discussion.

---

## D. Screening

**D1. Merge sources, remove duplicate records, then screen titles and abstracts over-inclusively.**
Why: dropping a paper at the title stage is the cheapest way to lose evidence.
Source: Coch 4.6.3 (typical process: merge, remove duplicates, examine titles and abstracts "over-inclusive" at this stage); PRS items 15 and 16 (record totals and deduplication method).

**D2. Decide inclusion on the full text, not the abstract.**
Why: abstracts omit the methods and conditions that decide eligibility. A paper can be eligible or not depending on the preparation or the definition.
Source: Coch 4.6.4 and MECIR C39 (inclusion decisions based on full texts when possible, after an initial screen of titles and abstracts).

**D3. Count studies, not papers: link every report of the same dataset into one record.**
Why: the same recordings appear in the original paper, a later paper and a review; counting each as a separate measurement turns one measurement into three. Do not throw away the secondary reports, which may hold methods or extra values.
Concrete form: compare authors, laboratory and setting, species and preparation, n, dates, and the exact values; name one primary report and say why. [syn on the neuroscience example]
Source: Coch 4.6.2 and MECIR C42 (collate multiple reports; criteria for matching; choose and justify the primary report; keep the secondary ones).

**D4. Pilot the screening form on a small sample before the real pass.**
Why: to find out whether the criteria are clear enough for two screeners to agree.
Source: Gar21 R14 and R15 (pilot with the same 30 to 50 abstracts, and 5 to 10 full texts, for the whole team).

**D5. Have a second pass check the exclusions, with a fresh screener. [syn on the agent form]**
Why: the cost of an excluded relevant paper is higher than that of an included irrelevant one, and one screener's errors are not visible to that screener.
Concrete form: the second agent gets the criteria and the list of excluded full texts with reasons, not the hypothesis or the preferred answer; it flags disagreement, which the first agent resolves or marks "awaiting classification".
Source: Coch 4.6.4 and MECIR C39 (two independent people for inclusion decisions; single screening of titles and abstracts is acceptable); Gar21 R14 and R15 (one screens, a second checks the excluded records); Coch 4.6.4 (content experts bring preformed opinions that can bias relevance judgements, so a second screener who is not an expert is an advantage).
Disagreement: Coch asks for two independent people at full-text stage and notes some studies find single screening adequate; Gar21 accepts one screener plus a check of the excluded ones as a rapid shortcut, and ranks dual independent screening second.

**D6. Record a reason for every full-text exclusion, in one primary category.**
Why: it shows the criteria were applied and lets a reader challenge a decision. Do not list every irrelevant hit, only the studies a reader might expect to see included.
Source: Coch 4.6.5 (list of excluded studies with the primary reason; keep it brief; do not list obviously ineligible studies); P20 item 16b (cite studies that might appear to meet the criteria and explain why they were excluded).

**D7. Do not exclude a study only because its values are hard to use; tag it. [syn on application]**
Why: excluding on unusable data biases the result. In neuroscience a large share of the measurements sit in text and figures, which are harder to extract than tables.
Source: Coch 4.6.3 MECIR C40 (do not exclude studies solely because outcome data are not reported in usable form; consider the effect of omission); Tri14 3.4 (they estimate only 5 to 10% of published electrophysiological data are in tables).

**D8. Use explicit statuses for the unfinished cases: awaiting classification, abstract only, full text not obtained, ongoing. [syn on the status list]**
Why: a paper you could not open must not be handled as one you read (E12, F12).
Source: Coch 4.6.3 (studies with incomplete or unobtainable data are tagged and listed as awaiting classification; ongoing and unreported completed studies are tagged).

**D9. If a language model does any of the screening, log it as an automation tool and do not count it as a second human-grade screener. [syn on the second half]**
Why: machine screening can cut the work by large amounts but can lose relevant records, and Coch (text from mid-2023) found no large, valid evaluations of LLM screening.
Source: Coch 4.6.6.2 (machine learning reductions in screening of 30% to over 90%, sometimes with up to a 5% fall in sensitivity; no sufficiently large and valid evaluations of LLM tools at the time of writing); P20 item 8 (report details of automation tools).

---

## E. Extraction into an evidence ledger

**E1. Write each finding into the ledger before writing any prose. [syn]**
Why: prose written from memory or from a skim mixes sources, drops conditions and cannot be checked. Pautasso's own advice is to take notes while reading, with quotation marks for verbatim text and the reference at once.
Source: Pau13 Rule 3 (notes while reading; quotation marks for provisional verbatim copying; record references at this stage to avoid misattribution); P20 items 9 and 10 (define data items and the method of collection).

**E2. One row per finding, with these fields: value, units, error term and its type, n, conditions, locator, verbatim quote, evidence type, status. [syn on the list as a whole]**
Why: each field answers a question a later reader will ask, or a question a checker needs (F).
Concrete form, conditions for neuroscience values:
- Species, strain, age (as reported, plus your conversion if any), sex if reported.
- Preparation (in vitro slice, in vivo, culture, model), brain region, cell type and layer.
- Recording method (patch clamp or sharp electrode, whole-cell or perforated), recording temperature, solutions where given, junction-potential correction (yes, no, not reported).
- The protocol used to measure the quantity and how it was calculated.
- Whether the value is from control or from a manipulated condition.
Source: Tri14 2.7 (extracted species, strain, electrode type, preparation type, liquid junction potential correction, age, temperature) and 2.3.3 (protocol, calculation, condition differences); Tri15 Methods (mean, error term and replicates when possible; three-way junction-potential coding; control or normotypic conditions only; recording solutions and pipette resistance listed as future additions); P20 items 10a and 10b (define all outcomes and other variables sought, including participant characteristics, and say what assumptions were made about missing or unclear information).

**E3. Record the definition or protocol behind the number, not only the name of the quantity.**
Why: "input resistance", "spike amplitude" and "membrane time constant" are computed in different ways in different papers. Tri14 could not detect all such cases because authors do not always say how they computed a value, and pooled values then carry unexplained variance.
Source: Tri14 2.3.3 (spike amplitude from threshold or from rest; investigators did not always define how input resistance and time constant were calculated); Tri15 Methods (excluded time-constant values far from the median because the definition varied).

**E4. Write "not reported" when the paper does not say; never leave a field blank or fill it from a guess.**
Why: a blank cannot be told from an oversight, and a guessed condition looks like a measured one. Tri14 and Tri15 used imputation in a statistical model; in a ledger that would hide the gap.
Source: Tri15 Methods (junction-potential correction coded as corrected, not corrected or not reported; mean or mode imputation was a model-fitting step, not a record of what the paper said); P20 item 10b (report assumptions about missing information). The rule itself is [syn].

**E5. Keep the reported value and any value you derived from it in separate columns, with the conversion written down.**
Why: derived values (a weight turned into an age, "room temperature" turned into a number, a unit change) are your assumption, not the paper's finding.
Source: Tri15 Methods (weight converted to age using vendor tables; "room temperature" assigned 22 degrees C; in vivo assigned 37 degrees C: the authors state these as their conventions); P20 item 13b (describe data conversions and other preparation). Separate columns [syn].

**E6. Give a locator precise enough to find the passage in under a minute.**
Why: a checker, or you next week, must open the same place. A DOI alone is not a locator.
Concrete form: DOI or PMID, version read (preprint or published), section, page, table or figure number. [syn]
Source: PRS item 5 (cite the base articles); JB15 Discussion list of proposals (place the reference next to the statement it supports; verify statements against the original paper).

**E7. Copy the verbatim sentence that states the value and the one that states the condition.**
Why: a number without its sentence cannot be checked and invites paraphrase drift. In methods sections the condition is often in a different sentence from the value.
Concrete form: quote marks, the original units and symbols, ellipses only for omitted words; mark any quote taken from an abstract or snippet as such. [syn on the form]
Source: Pau13 Rule 3 (quotation marks for verbatim text, reformulate in the final draft); Tri14 2.7 (conditions are taken from the methods section, not the results table).

**E8. Label the evidence type for every row: direct measurement, model or simulation, review statement, or cited from another paper.**
Why: a number a paper reports as its own measurement is different from a number it cites. A large share of citations are to papers other than the original, and a belief can grow by citations to papers that contain no data on it.
Concrete form: for "cited from another paper", add the chain to the primary source when you have traced it (F3), or mark "untraced". [syn on the label set]
Source: JB15 Methods (indirect or secondary references: citations to a review instead of the research article); Gre09 (amplification: citations to papers without primary data, such as reviews, grow the apparent support); Tri14 2.7 (preparation types include models).

**E9. Read the methods section for conditions; do not take them from the abstract, the table or a text-mining tool.**
Why: automated extraction of conditions was about 50% accurate on average and worse for continuous values like age and temperature, so it needed manual checking. This applies to a language model reading a PDF as much as to the rule-based pipeline tested there. [syn on the last sentence]
Source: Tri14 2.7 (mean accuracy of algorithmic metadata assignment about 50%, lower for age and temperature than for species and electrode type; all metadata checked manually).

**E10. Expect that most values are in running text or figures, not in tables, and plan the time. [syn on the implication]**
Why: a pass that reads only tables or abstracts will miss most of the data on a topic.
Source: Tri14 3.4 (they estimate 5 to 10% of published electrophysiological data are in tables; the rest in text or figures; scanned older papers were out of reach of their method).

**E11. Extract once on a piloted form, then have a second reader check the extraction, with a minimal set of data items.**
Why: extraction errors are common and the second reader finds them cheaply; fewer items means less to check.
Source: Gar21 R16 and R17 (single extractor with a second reviewer checking correctness and completeness; minimal data set; piloted form); P20 item 9 (number of reviewers per report).

**E12. Give every row a status: unverified, verified (by whom, how), contradicted, or could not check. [syn]**
Why: the synthesis (G) uses only verified rows for headline claims, and the reader sees how much of the answer rests on checked material.
Source: JB15 (error rates, F1); Coch 4.6.3 (statuses for incomplete studies).

**E13. Put contradicting and null findings in the same ledger. [syn]**
Why: they are the ones that would otherwise go missing; the field's citations favour supportive results (C8).
Source: Gre09 (citation bias); P20 items 14 and 21 (assess risk of bias due to missing results).

---

## F. Verification

**F1. Treat every claim-and-citation pair as unverified until you have read the cited passage, including claims in reviews and claims you remember.**
Why: quotation errors are common in the published literature. In the meta-analysis, about one reference in eight was seriously wrong and about one in four had some error. The lowest study estimate was 6.7%, so the problem is not confined to a few journals or authors. Heterogeneity was very high, so your own subfield may be better or worse.
Concrete form: JB15 pooled estimates, random effects: major errors 11.9% (95% CI 8.4 to 16.6), minor 11.5% (8.3 to 15.7), total 25.4% (19.5 to 32.4), I2 95% to 97%, 28 studies, all in medical journals. A citation to a paper the citing authors may not have read was thought to be common (the authors cite an estimate of 70 to 90% of citations copied from other reference lists for physics, from a different study).
Source: JB15 Results and Discussion ("What may be the reasons for quotation errors?").

**F2. Verify against the original paper, not a secondary one, and prefer the original over an abstract or a review.**
Why: this is the main recommendation for authors in the quotation-accuracy literature, and it is what separates a number you have seen from a number someone says they have seen.
Source: JB15 Discussion list of proposals for authors (verify statements against original papers, not indirect sources; prefer original material over abstracts and narrative reviews; place references close to the statement they support).

**F3. Trace a review's claim to the primary source, step by step, and write down the chain.**
Why: beliefs spread by citation through reviews. In the one network studied, a statement went from hypothesis to fact through citations alone, and some citations pointed to papers that did not address the claim at all.
Concrete form:
1. Find the reference the sentence cites. Open it.
2. If it is a review, find that sentence's reference and open it. Repeat.
3. Stop at the paper that reports data. Find the passage; copy it (E7).
4. Record the chain (A cites B cites C) and the depth.
5. If the chain ends in nothing, a hypothesis, a conference abstract or a model, record that and downgrade the claim.
Source: Gre09 Results (citation transmutation, dead-end citation, abstracts treated as papers) and its vocabulary table; JB15 (indirect references). The step list is [syn].

**F4. Check for the specific citation distortions, not only for a wrong number.**
Why: the failure is often not an error but a shift of meaning, and a checker needs names to look for.
Concrete form: bias (conflicting papers ignored); amplification (support built from papers with no primary data); diversion (the cited content is quoted with a changed meaning, for example "confirmed" for data that showed the effect in a few fibres); transmutation (a hypothesis cited as fact); dead-end citation (the cited paper does not contain the claim); back-door invention (an abstract cited as if it were a peer-reviewed paper); title invention (a title states experimental results the paper does not report).
Source: Gre09 (vocabulary of citation distortions; sections "Citation diversion" and "Invention"). The author notes that interpreting a text involves judgement and people may read it differently, so mark borderline cases as such.

**F5. Give each checked pair one verdict from a small fixed set. [syn on the labels]**
Why: a fixed set makes verdicts countable and comparable across checkers.
Concrete form: supported; partly supported (narrower, other conditions, smaller n, a qualified statement); unsupported (dead end); contradicted; indirect (the cited paper itself cites another); could not access. Add the passage that justifies the verdict.
Source: JB15 Methods (major error: the quotation is not at all in accordance with the claim, for example the source contradicted, failed to substantiate or was irrelevant to it; minor: partial; secondary references counted as minor); JB15 Discussion (a source may support the statement in the letter and still be inadequate for it).

**F6. Check that the conditions of the source match the conditions of the claim.**
Why: the same quantity has different values in different species, ages, preparations and temperatures. A paper that measured a value in juvenile mouse slices at room temperature does not support a statement about adult cortex in vivo, even if it is correctly quoted. In the work on pooled neuron data, experimental conditions explained a substantial part of the variation in literature values, and after accounting for them the data were far more reproducible between laboratories than previously thought, so many apparent conflicts are condition differences.
Source: Tri15 abstract; Tri14 2.7 (input resistance falls in neurons from older animals); Tri14 2.3.3 (condition differences).

**F7. Check the numbers: units and prefixes, the type of error term, the n, and whether the value is plausible. [syn]**
Why: a unit slip (megaohm and ohm, ms and s) or a mix of standard deviation and standard error changes a value by orders of magnitude or by the square root of n. Properties like input resistance and time constant vary over orders of magnitude between cell types, so a plausibility check needs the cell type's range, not a single number.
Concrete form: read the unit in the table header or the methods; say if the error term is SD, SEM or CI, or "not stated"; say if n counts cells, animals or slices; compare the value with other ledger rows under similar conditions and flag outliers for a second look.
Source: P20 item 13b (data conversions); Tri15 Methods (log-transformed input resistance, time constant, spike half-width and age because they span orders of magnitude; error term and replicate numbers extracted when possible, and often unavailable). The specific checks are [syn].

**F8. Check that the value is from the control or baseline condition the claim is about.**
Why: a paper that reports a value after a drug, a lesion or a genetic change does not give the baseline value.
Source: Tri15 Methods (measurements from control or normotypic conditions identified by manual curation).

**F9. Check the measurement definition against the claim (E3).**
Why: two papers can agree in wording and differ in the protocol or the calculation. Source: Tri14 2.3.3.

**F10. Give the check to a fresh checker that did not extract the row, and give it only the claim, the source and the locator. [syn on the agent form]**
Why: the person who extracted a value tends to read the passage as they expect. Authors are thought to read papers as they would like them to read. A checker that knows the expected answer inherits that.
Concrete form: the checker opens the source itself, finds the passage independently if the locator is wrong, quotes it, and returns a verdict (F5). It does not see the ledger's own conclusion or the other rows. The extractor does not review its own rows.
Source: JB15 Discussion (authors may interpret papers as they would like); Gar21 R16 and R19 (a second reviewer verifies extraction and judgements); Coch 4.6.4 (independent decisions reduce single-person bias).

**F11. Say which version you read: published, accepted manuscript or preprint, and whether you saw the full text. [syn]**
Why: preprint and published numbers can differ, and a paper seen only in an abstract or a search snippet has not been checked.
Source: Gre09 ("back door" invention: abstracts cited as peer-reviewed papers); JB15 (original material over abstracts); and see how this file handles Hir (preprint read, published version not).

**F12. A claim you could not check stays "unverified" in the answer and is not worded as established. [syn]**
Why: an unchecked claim that reaches the final text with a citation looks verified.
Source: JB15 (a quarter of references have some error); Gre09 (claims acquire authority through citation alone).

**F13. Do not count repetition as corroboration; count independent primary data sets.**
Why: 242 papers with hundreds of citations and over two hundred thousand citation paths supported a belief whose primary support was a few small papers, with the critical papers largely ignored. The same effect arises with several reports of one study (D3).
Source: Gre09 Results and Discussion (information cascade; unsound cascades may persist); Coch 4.6.2 (duplicate publication).

**F14. Check retractions, corrections and expressions of concern on every source you rely on (B13).**
Source: Coch 4.4.6 and MECIR C48.

---

## G. Synthesis

**G1. Write the answer from verified ledger rows only, and tag each sentence with row ids. [syn]**
Why: it stops prose from carrying claims that never passed through the ledger, and lets a reader or checker jump from a sentence to its quote.
Source: Pau13 Rule 3 (notes with references and quotation marks from the start); the id tagging is [syn].

**G2. Separate what primary data show, what reviews say, and what you infer.**
Why: the three have different strength, and a reader should not need to guess which is which. A review should also be critical, not a list: it should state what has been achieved, what is debated and what is open.
Source: Pau13 Rule 6 (not stamp collecting; critical; identify methodological problems and gaps; a reader should know the achievements, the debate and the outstanding questions). The three-way split is [syn].

**G3. Tabulate the studies and group them by conditions before comparing values.**
Why: the grouping decides what may be put side by side. A table of studies with their conditions is also the quickest way to see the gaps.
Source: P20 items 13a, 13c and 17 (decide which studies are eligible for each synthesis; tabulate results; present study characteristics).

**G4. Explain heterogeneity from conditions and methods first, and do not pool values from incompatible conditions.**
Why: a spread of reported values is often a spread of conditions. Averaging across species, ages or protocols gives a number nobody measured.
Concrete form: report a range or a median with n, the conditions, and the units, per condition group, not a single "typical value". If the data allow, say how much of the spread the conditions explain.
Source: Tri15 abstract (conditions explain a substantial part of reported variability; accounting for them shows that data are more reproducible than appreciated); Gar21 R21 (meta-analysis only when studies are similar enough to pool; narrative synthesis otherwise); P20 items 13e and 20c (explore and present causes of heterogeneity).

**G5. When sources conflict, state both, with conditions and evidence type, and say what would settle it. Do not settle it by counting citations.**
Why: a better-cited claim is not a better-supported one (F13).
Concrete form: also say whether the conclusion survives leaving out the weakest or least-verified source.
Source: Gre09 Discussion; P20 item 13f (sensitivity analyses to assess the robustness of the synthesis); JB15 Methods (leave-one-out analysis as an example).

**G6. Attach an evidence label to each conclusion. [syn on the labels]**
Why: it tells the reader how far to trust it without reading the ledger.
Concrete form, a three-part label: kind (direct measurement, model, review statement, secondary citation), match (same conditions, different conditions, unknown conditions), verification (verified by a second reader, extracted only, unchecked). Cochrane's rapid-review guidance uses GRADE for certainty in intervention reviews; I did not adapt GRADE itself.
Source: Gar21 R22 (grade certainty with a second reviewer verifying; limit to key outcomes); P20 items 15 and 22 (certainty of evidence).

**G7. State the gaps: what you looked for, where, when, and what would close each gap. [syn on the "what would close it"]**
Why: a gap is a result, and a gap with a cost (one experiment, one source, one person to ask) is more useful than a general call for more data. Check recent and in-press papers before calling something a gap.
Source: P20 items 23b and 23c (limitations of the evidence and of the review process); Pau13 Rule 6 (point out gaps) and Rule 10 (do not call an issue a gap if papers just appeared or are in press).

**G8. Say what is likely missing because of how literature is produced.**
Why: negative results are published and cited less, so a literature can look more consistent than the underlying facts. Search the registries and preprints, and say so when the search could not.
Source: Gre09 Discussion (negative results do not spread through citation); Hir Discussion (methodological studies with negative findings are probably under-published); P20 items 14 and 21 (reporting biases).

**G9. Treat your own project's previous notes, and your own earlier answers, as sources that need the same check. [syn]**
Why: a claim written down earlier looks like established fact when it is read again, which is how a hypothesis turns into a fact through repetition. Review authors are advised to stay objective about their own results for the same reason.
Source: Pau13 Rule 9 (be objective about your own work); Gre09 (transmutation). The extension to an agent's own notes is [syn].

**G10. Give the answer to the decision first, then the evidence (A2).**
Why: the person asked a question in order to decide something.
Source: Gar21 section 3.2 (reviews serve timely decision-making). Placement [syn].

---

## H. Rapid versus systematic

**H1. Know the difference, and call the work what it is.**
Why: a systematic review is defined by a pre-specified protocol, a search of several sources aimed at completeness, independent duplicate selection and extraction, appraisal, and full reporting. A rapid review streamlines or omits some of these to produce evidence for a decision in time. A one-day agent review is a rapid review at best.
Source: Coch 4.2.2 (thorough, objective, reproducible search of a range of sources; what distinguishes systematic from narrative reviews), 4.6.4; Gar21 section 3.2 (definition of a rapid review) and Table 1; Pau13 Rule 4 (narrative versus systematic versus meta-analysis).

**H2. What a one-day agent review can claim, and what it cannot. [syn]**
Why: its shortcuts are the ones the rapid-review guidance accepts, but only if they are stated and the claims stay inside them.
Can claim:
- "In sources S, searched on date D with queries Q, the primary papers found and read report the following values under the following conditions."
- That N rows were verified by a second reader and M were not.
- A narrative synthesis of what was found, with its conflicts.
- A list of gaps and of the searches that would close them.
Cannot claim:
- That the search was complete or that the list is exhaustive.
- That "no paper reports X" or that something is novel (H4).
- That "the literature agrees", unless the ledger shows several independent primary data sets in matching conditions.
- That any statement not traced to a primary source is established (F3).
- That the review is systematic.
Source: Gar21 R10 and R11 (core databases plus one or two specialised), R13 (limited grey literature), R16 and R17 (single extractor with a check; minimal data items), R21 (narrative synthesis), and its authors' statement that rapid reviews must be transparent about their methods; Coch 4.4.11 (searches can miss relevant studies).

**H3. State every shortcut you took, in the report, and adapt PRISMA to say so.**
Why: the credibility of a rapid review depends on its transparency about the shortcuts. No PRISMA extension for rapid reviews existed at the time of the guidance; it advises the general statement, adapted.
Concrete form: the sources searched, the dates, the limits, who screened what, who checked what, what was not done (no full-text second screening, no risk-of-bias assessment, restricted to X). Keep the log (B8) and the exclusion reasons (D6) with the report.
Source: Gar21 (reporting section after R26; use PRISMA as far as possible); PRS items 1 to 16; P20 items 7, 8, 9, 16b, 23c, 27 (full strategies, selection and data-collection processes, excluded studies, limitations of the process, availability of materials).

**H4. A search that finds nothing supports "not found in S on D", not "does not exist". Novelty claims need the widest search and the narrowest wording. [syn]**
Why: database searches miss relevant records, one database is a biased sample, and indexing and wording vary. An absence claim is only as strong as the search behind it.
Concrete form: run the query set in several sources, chase from the closest papers (C3), search the neighbouring terms and the older literature, try to name the nearest prior work, and report the closest miss.
Source: Coch 4.2.2 (MEDLINE alone not adequate), 4.4.11 (searches may miss relevant studies; check performance with known papers and citation searching); GP05 (protocol-driven searching supplied 30% of the sources in a complex review).

**H5. Use the shortcuts that lose least for the question, and avoid the ones that hurt that question.**
Why: shortcuts differ in cost by topic.
Concrete form:
- Date cut: risky for parameter lookups where the classic measurements are old and some papers are scans (A6).
- English only: acceptable for most neuroscience in English-language journals; say it.
- Fewer sources: compensate with citation chasing and with experts (B12).
- Single screener: add the exclusion check (D5).
- Fewer data items: keep the conditions (E2); they are what makes the value usable.
Source: Gar21 section 3.3.2 (date and language limits); Tri14 3.4 (older papers available only as scanned images could not be processed). The mapping is [syn].

**H6. Choose the review type by the decision and the time, and escalate when the evidence says the quick answer is not safe. [syn on the triggers]**
Why: a rapid review is a good fit for a time-limited decision. Triggers to widen the work or ask a person: the answer drives a published claim or a costly experiment; the ledger shows strong conflict or thin evidence; the key sources could not be opened; the topic is hard to search. Cochrane advises working with an information specialist or librarian from the outset; ask the person whether one is available.
Source: Pau13 Rule 4 (type of review depends on material, time, coauthors); Coch Key Points and 4.2.1 (information specialist); Gar21 section 3.2.

---

## Where the sources disagree (summary)

1. **Restrictions.** Coch MECIR C19 treats an unrestricted search (language, publication status) as mandatory; Gar21 R5 to R7 allow justified limits for speed. Resolution: restrict only with a stated reason and carry it into the claim (A6, H5).
2. **Dual versus single screening.** Coch 4.6.4 asks for two independent people at the full-text stage (single title and abstract screening is acceptable) and notes some studies find single screening adequate; Gar21 R14 and R15 accept one screener plus a check of exclusions. Resolution: one pass plus a fresh checker on the exclusions (D5).
3. **How much citation chasing.** GP05 found snowballing the largest source of papers in a complex review and said protocol-driven searching alone is not enough; Hir found a benefit in most studies but doubts the size, found two with no benefit, and found stand-alone chasing less sensitive than database search; Coch lists it as an option and a performance check, and makes only reference-list checking mandatory (C30). Resolution: C4 to C6.
4. **Sensitivity versus focus.** Coch 4.4.3 and Key Points want high sensitivity at low precision; Pau13 Rule 5 and Gar21 R2 to R4 want a focused, narrow scope. Resolution: broad in the query within a narrow question; narrow in screening and in what the report covers (A5, B4).
5. **Search peer review.** Coch strongly recommends it for every search; Gar21 asks for it for at least one strategy. Resolution: review at least the main source's query (B10).
6. **When to stop.** Coch 4.4.11 admits that the stopping rules are little evaluated; Pau13 Rule 10 adds a re-search at the end. Resolution: a written rule plus a late check of recent papers (A7, B14).
7. **What a wrong citation is.** JB15 counts citing a review instead of the original as a minor error; Gre09 treats citation to papers without primary data as a route to amplification. Resolution: keep "indirect" as its own verdict (F5), and trace it (F3).
8. **How strictly to read a supporting citation.** JB15 notes that studies applied different standards (for example counting a citation as correct if it gives examples of what the sentence claims), which partly explains their heterogeneity; Gre09 notes that readers may interpret a text differently. Resolution: record the verdict and the passage, so another reader can disagree (F5).
9. **Evidence on shortcuts.** Gar21 is interim guidance, partly from a survey of Cochrane entities, and itself says best practice is limited by the lack of evidence on some shortcuts. Treat its recommendations as a reasonable default, not as proof.

## Most important 12

Ranked for an agent doing a one-day review of a parameter or a mechanism claim in neuroscience. The typical failures are a number without its conditions, a claim repeated from a review, a search that was not written down, and an absence stated as a fact.

1. **Open the cited passage before you rely on a claim; about one reference in four has some error, one in eight a serious one (F1, F2).** Everything else rests on this.
2. **Trace a review's claim to the paper with the data, and record the chain (F3, F4).** Beliefs grow by citation without data.
3. **Put every finding in a ledger with value, units, conditions, locator, verbatim quote and evidence type before writing prose (E1, E2, E8).** Prose written from memory cannot be checked.
4. **Record the conditions and the measurement definition with each value, and match them to the claim (E2, E3, F6).** Conditions explain much of the spread in reported values.
5. **Have a fresh checker verify each row, seeing only the claim, the source and the locator (F10).** The extractor reads what it expects.
6. **Log every query as run, with source, date and hit counts, while searching (B8).** A log written afterwards is close to impossible.
7. **Write the question type, the decision, the criteria and the stop rule first (A1, A2, A4, A7).** They set what counts as enough.
8. **Search more than one source, with synonyms and controlled vocabulary, and have the query reviewed (B1, B3, B10).** One source and one wording are the usual reasons for a miss.
9. **Chase references backward always, forward on the key papers, and look for the contradicting papers on purpose (C2, C3, C8).** Chasing finds what keywords miss, and citations favour the supportive papers.
10. **Count studies, not papers, and independent data sets, not citations (D3, F13).** The same measurement reported three times is one measurement.
11. **Record a reason for each full-text exclusion and have the exclusions checked (D5, D6).** The costly error is a relevant paper wrongly dropped.
12. **Call it a rapid review, list the shortcuts, and claim only "not found in S on D", never "does not exist" or "the literature agrees" (H1 to H4).** The size of the claim must not exceed the size of the search.
