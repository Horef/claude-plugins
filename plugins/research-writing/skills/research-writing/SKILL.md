---
name: research-writing
description: "Turn a body of research (results, run logs, figures, decisions) into a coherent write-up or paper draft in LaTeX: a one-paragraph message and its reader, a claims ledger tying each claim to its evidence and figure, a skeleton in argument order (not lab-notebook order), figures that each carry one claim, text written around them, then a loop of fresh reader agents whose questions are answered in the text, plus mechanical checks and a look at the rendered pages. Works for a full write-up after many results or incrementally as results arrive. Use when asked to write up results, draft a paper, report or thesis chapter, revise one that reads like a lab report, or add new results to an existing write-up."
---

# Research writing

Use this skill to turn research that already exists (results, logs, figures, decisions, notes) into a document other people read: a write-up for colleagues, a report, a thesis chapter, a paper draft. It is not for the research itself, for slides, or for single figures (use scientific-figures for those; this skill decides what each figure must show).

**The problem it solves.** An agent that did the work writes the document in the order the work was done (stage 0, stage 1, follow-up), puts figures where each step happened, and explains what it remembers rather than what the reader lacks. The result is accurate and about 80% there: it reads like a lab report, figure placement looks erratic, and readers come back with questions the text should have answered. The writer cannot see those gaps (the curse of knowledge; Pinker 2014 ch. 3), so the procedure builds the story from claims before any prose, and then uses readers who are not the writer to find the gaps.

Rules with sources: `references/writing-rules.md` (by stage; its "Most important 15" is the short version). Story techniques from the owner's model texts: `references/story.md`. Tools: `scripts/wr.py`. Template: `templates/writeup/`.

## 0. Setup

1. `SKILL` = this skill's folder (in Claude Code `${CLAUDE_PLUGIN_ROOT}/skills/research-writing`; in a genome clone `<genome>/plugins/research-writing/skills/research-writing`).
2. Tools: Python 3 (standard library), `latexmk` with LuaLaTeX (or pdfLaTeX) and `biber`, and `pdftoppm` (poppler) to look at pages. `wr.py` exits 2 when a tool is missing: that means not checked, never clean.
3. Read the person's profile if there is one: `~/.config/research-writing/profile.md` (format: `profile.example.md`): their readers, venues, house style, language, and which model tier they want for each step. It overrides the defaults here.
4. Ask, once, at the start (unless the profile or the request answers it): **who reads this, and what will they do with it** (decide the next run, judge the work, review it for a journal)? It sets the depth, the reader roles in step 6 and the target length.

## 1. Mode

| Mode | When | Start at |
|---|---|---|
| **New** | a body of results and no document | step 2 |
| **Revise** | a draft exists and reads like a lab report or leaves questions | step 2, built from the draft: its numbers stay, its order goes |
| **Add** | a new result arrives for an existing write-up | rerun the analysis that writes `values/` and run `wr.py check`: it lists every changed value with the sentences, facts and claims that use it, and `wr.py reword DIR` turns them into one task per sentence with its model tier (step 5); then step 2's ledger: add or change facts and claims, then only the sections and figures they touch (`wr.py where`); never append a section at the end (a "Questions from <date>" section is the symptom) |

The document lives in its own folder (`wr.py init DIR --title "..."`): `ledger.md`, `main.tex`, `preamble.tex`, `refs.bib`, `figures/`, `review/`, and `values/` once results have numbers. Figure scripts live with the project's other analysis code and write PDFs into `figures/`; the same scripts write the numbers the text quotes into `values/` (step 2).

**An existing write-up from before values** (no `\val` in its preamble; `check` says so): `wr.py upgrade DIR [--dry-run]` adds only what is missing (`\fact`, `\val`, `\valw` and the input of `values.tex` to its preamble, the ledger's Values, Facts and Accepted sections and facts column, `values.tex` to `.gitignore`; old files kept in `build/upgrade-*/`). Then one analysis script at a time writes `values/<script>.json`, and `wr.py numbers DIR` lists the typed numbers that are values: "likely" ones first (a count out of a value, `7 of \val{n}`, or the word after it matches the value's other places, name or unit), then same-digit coincidences; numbers that equal many values are only counted (`--all` lists them), and the ledger's Message, Reader and evidence cells are scanned too. A word that labels a set ("the three draws (a to c)") is not a count: accept it once in `## Accepted` (`` `'three draws` ``) rather than converting it. Convert only numbers an analysis can rerun; build and compare the PDF text before and after.

**One file or section files.** One `main.tex` serves most write-ups: targeted edits work by search and replace. Use section files when the write-up will pass about 15 pages or helpers will write sections in parallel: `wr.py init DIR --sections`, or `wr.py split DIR` for an existing one, puts each section in `sections/NN-slug.tex` and leaves the title, In short and the order in `main.tex`. `wr.py where DIR` maps each file to the claims, facts, figures and values in it, so Add mode knows which files a change touches; `check` adds that each section file is input once and each claim is made in one section.

## 2. Message, reader and claims ledger (before any prose)

Fill `ledger.md`:
- **Message**: one paragraph: the larger problem, the specific question, two or three results, what was learned, which answers the question and speaks to the problem (Schimel ch. 2; Mensh & Kording rule 1). If it will not fit one paragraph, there are two documents.
- **Reader**: who, what they know, and the questions they arrive with.
- **Claims**: one row per claim, in the order of the argument: the claim as one sentence that states a finding, its status (`established`: shown in our runs or a cited paper; `plausible`: argued, not tested; `open`), its evidence (the results entry or run id), the figure that shows it, and its **condition**: what it was tested under (a parameter strength, a dataset, a regime; `all` when none applies). A write-up that mixes a headline condition with follow-ups at others misleads unless every claim says which.
- **Facts and values** (for anything whose results will be rerun or extended; a one-off short report may skip them). Every number from an analysis is a **named value**: the analysis script writes it to `values/<script>.json` (`{"weight_10x_mean": {"value": 0.0351, "fmt": ".3f", "source": "runs/r12"}}`; a derived value is `{"expr": "a / b"}`), and the text, captions and In short say `\val{weight_10x_mean}`, so a rerun changes every place at once. A whole number up to 20 that the prose spells out ("six that fail") is `\valw{name}` (`\Valw` at a sentence start): the words are what goes stale. `\valw[none]{name}` prints "none" when the value is 0; `\valp{name}{draw}{draws}` (and `{is}{are}`) gives the singular when it is 1. Ledger rows quote values as `{{name}}` (`where` prints them filled in; a change lists the row), or stay number-free and point at facts. A **fact** is one result in one sentence ("every passing placement keeps at least 23% at each site"), in the ledger's Facts table with the values it uses, an optional **test** over them that must stay true (`min_site_share_pass >= 0.23`), its status (`holds`, `fails`, `open`, or `superseded by F7` when a new fact replaces it: the old row stays, so the ledger keeps how the result changed), condition and evidence. Each fact is stated once in the text, marked `\fact{Fn}`; other places refer back to it rather than restate it. Claims list the facts they rest on (`facts` column): a claim is only as current as its facts, and `check` flags one whose fact fails or whose test turned false with new values.
- **Figures**: one message each, named by the claim it carries.
- **Out of scope**: results that exist but do not serve the message, with where they live instead. Leaving them out is the point (Schimel 8.2.2).

**What will vary next?** If the document will grow (Add mode, a living write-up), decide now what new results will look like and where they will go, so a new claim lands in its place in the argument.

Show the ledger to the person before writing prose when they are available: it is the cheapest place to change the story.

## 3. Skeleton in argument order

In `main.tex`: title = the answer, not the topic; an **In short** box (or abstract) that is the message written as an abstract (below); section titles that are declarative findings ("Activating input B divides the responses", not "Stage 2 results"); under each, one `% DO:` comment per paragraph saying what it must do, with its `\claim{Cn}`. The order is the argument's: question, then each claim with its evidence, then what it means. The order in which the work happened belongs nowhere except, if needed, one sentence in Methods.

Shape the skeleton with these (details and exemplars in `references/story.md`, T1-T16):
- **Question and deciding test first** (T1): the opening says what result would answer the question, before any method.
- **Key terms shown before they are used** (T5): a small toy figure or box of what each answer would look like, placed before the first result.
- **A running example** (T7): one configuration every figure shows first; the others enter as one change from it.
- **Surprises posed as puzzles** (T8): expected, observed, candidate explanations, the test that decides. A section that ends on a puzzle hands over to the one that solves it.
- **One answer figure** (T10) for the headline question, and a closing schematic of the mechanism when there is one.
- **Validate the tool first** (T15) when the work rests on a model; controls and side checks go to an appendix with a one-sentence pointer (T12).
- **Close the loop** (T16): the last paragraph answers the opening question. Plant early whatever the ending needs; the resolution introduces nothing new (Schimel 9.2.2).

**Layout.** Main text, Methods, references, then `\supplementary` (a new page titled Supplementary Information, sections, figures and tables numbered S1, S2): history of the work, controls, side checks and detail figures go there, each with a one-sentence pointer from the main text.

**The In short is an abstract**, not compressed notes: two or three short paragraphs (context and the open question; what was done and what was found, with the key numbers; what it means and its main limits), every term understandable without the rest of the document, every source named ("Smith's model", not "the published model"), every claim with its where ("not shown at these synapses in layer 2/3", not "not shown"). The `% DO:` comments and the technique names above (T1...) are instructions for the writer: they never appear as sentences.

## 4. Figures first, then the text around them

- **Figures**: one claim each; the caption's first sentence (bold) states the finding; then what is plotted, n and error bars, where to look. One encoding for one thing across all figures (the same colour for the same class or condition everywhere); figures outside that encoding's domain (anatomy, the input model, methods) get their own colours, not gray, and keep them wherever the same thing reappears: a main-text summary of supplementary figures uses the supplement's colours (`wr.py check` notes a figure drawn in grey only when others use colour). Fix a figure's colours in its script, never by hand. A mechanism gets a schematic. Use the scientific-figures skill to draw and lint them; vector PDF.
- **Figure height**: at most about 0.55 of `\textheight` unless it is the answer figure; tall figures leave half-empty pages or land far from their citation. `wr.py check` reports each figure's height.
- **Text**: replace each `% DO:` with its paragraph: the question it answers, the evidence (with `\figref`, which records where the figure is first cited), the answer. Point in the first sentence; data before inference; every term defined where first needed; project-private labels (run ids, stage numbers, internal names) replaced by what they are; amounts with their uncertainty; each claim's status shown with `\status{...}` where a reader could mistake a plausible claim for an established one; each section stating the condition of its claims (the ledger's column). Place each figure right after the paragraph that first cites it.
- **Voice.** The rules for short sentences and points first are about clarity, not compression: write full sentences with subject and verb, never fragments ("Partly, in a narrow regime."); link each sentence to the last (old information first, new at the end; connectives such as *but*, *so*, *because*, *in contrast*: `writing-rules.md` C3, C9, C12); let a question introduce a test ("Is the selectivity inherited from the inputs?") and a sentence close a paragraph with what it established. Give each paragraph of a long section a bold run-in head that names its point (`\lead{The members were wrong.}`), and long sections subsections. A writer who gets only the skeleton gets these rules in the brief, and the lead reads the first two pages before anything else is judged.
- **Name every outside source where it is used** (owner preference): who found it, in what preparation, with the citation in the same sentence: "the ratio Kloc and Maffei (2014) measured at thalamocortical synapses onto mouse V1 layer 4 cells", never "the measured ratio" or "the literature". `wr.py check` notes sentences that say measured, reported, known, in vivo and the like without a citation.
- Every number comes from the evidence named in the ledger, as `\val{name}` when it is a named value (`check` notes a bare number that equals one, or rounds to one). A number you cannot trace is left out and listed for the person.

## 5. Build, check, look

```bash
python3 SKILL/scripts/wr.py build DIR    # latexmk; undefined references, citations, missing files, overfull lines
python3 SKILL/scripts/wr.py check DIR    # ledger vs text, figures cited before they appear and on the same or next page, bold caption titles, ledger conditions, acronyms, long paragraphs, placeholders; then notes that do not fail it (figure heights; decimals in a figure PDF that differ by rounding from the text near it)
python3 SKILL/scripts/wr.py pages DIR    # PNG per page and a contact sheet
python3 SKILL/scripts/wr.py where DIR [C3 F2 fig:x name]   # which file and line holds each claim, fact, figure, value
python3 SKILL/scripts/wr.py numbers DIR [name ...] [--strong]   # every typed number (text and ledger) that is or may be a value
python3 SKILL/scripts/wr.py reword DIR   # after a rerun: one task per sentence using a changed value, with its tier
```

`build` and `check` regenerate `values.tex` from `values/*.json` first. **When results change** (a rerun, Add mode), `check` lists each value that differs from the last confirmed one with its source, every sentence that uses it (marked when it is in the In short), the facts that name it and the claims resting on them, and each fact whose test is now false; a derived value that changed with it is listed in the same entry, so one cause is one entry. Give each value its `source` (the run or output file it comes from): `where C3` lists the values behind a claim with their sources, and a note names values in use without one. `\val` already updated the number; the words around it ("every draw", "about half", "the two lost") may not fit. `wr.py reword DIR` writes `review/reword-<date>.md`: one task per sentence with the changed values (old -> new, a derived value with the value that caused it) and the fact tests, tagged **number-only** (light model, or nothing to do), **words** (quantity words or typed numbers within 8 words of the changed value, or a count moving to or from one without `\valp`: standard) or **conclusion** (a fact test turned false, the In short, a title or a ledger claim: deep or the person). A sentence or caption over 400 characters is handed over as the clause around the change; ledger tasks show the row with the new values filled in. Give each task alone to its tier, asking for the smallest edit and never a typed number a `\val` gives; read the conclusion ones yourself. Rewrite what no longer fits, set a failed fact to `fails` and revise its claims, then `wr.py confirm DIR <name>` (or `confirm DIR` for all, after reading the whole text). `confirm` also records each fact's sentence and test, so a fact reworded later is listed with the claims resting on it until `confirm DIR F<n>`: a claim written for the old wording may no longer follow. The notes list values and facts that nothing uses.

Fix until `check` reports no problems (a result the person has decided to keep, such as a longer In short, goes in the ledger's `## Accepted` section with a piece of its text in backticks and who decided; `check` then lists it as accepted instead of counting it), read its notes (a figure over the height budget; a number in a figure that the text gives differently), then look at every page: is each figure near its first citation, readable at print size, saying what its title says? Section F of `writing-rules.md` lists the checks a script cannot do; the readers in step 6 do most of them.

## 6. Fresh readers: the question loop

The writer cannot find what the reader lacks. Readers who have only the PDF can.

1. `wr.py readers DIR --round N --roles pi,reviewer,newcomer,outsider,editor` writes one brief per role into `review/round-N/`. The **editor** reads for the prose, not the science: sentences that are fragments, ambiguous, unnatural or that refer to something not named; the other readers ask about content and miss these. Adapt the roles to step 0's reader (a thesis committee, a journal's referees): a role of your own needs its description, `--role referee2="a referee for <journal>: ..."`; `wr.py` refuses a role it cannot describe. Each reader gets **only the PDF**: no project files, no ledger, no conversation.
2. Launch one fresh agent per brief, in parallel. **Mix model families**: at least one reader comes from a different family than the writer (for example a Gemini helper started through herdr-delegate's argon templates) when one is available; three times a non-Claude reader caught factual errors that Claude readers missed (O1, O6, O12). When none is available, run the readers as usual and say in the round's notes that no outside-family reader was used; this never blocks the flow. When no fresh agent can be started at all, the round is **owed**: say so in the handover and run it when agents are available. A writer who role-plays the readers in its own context has not run the round: it is a smoke test, labelled so, and does not count toward the stopping rule in 5. Readers' answer files start with the `Status:` line the brief gives, so docmap accepts them.
3. Sort the questions into `review/questions.md`. Readers ask the same thing in different words, so group them by theme, one row per theme with the readers' ids (a first round can bring 150+ questions; the pilot's 170 became 22 themes): `| R<round>.<k> | theme | raised by | outcome | status |`, outcome one of **text** (the editor's sentence notes are fixed directly and need no row) (answered where it arose: name the paragraph), **limits** (a real limit: the Discussion says so), **analysis** (needs a new run or computation: the person decides), **reject** (the document already answers it clearly; say where, and ask whether the answer is where the reader needed it). Questions several readers ask come first; a weakest link that every reader names is a change to the message, not to a paragraph (update the ledger first). Expect readers to find gaps in the science as well as the prose: those become **limits** or **analysis**, never softened wording.
4. Revise by the outcome, rebuild, re-check.
5. Stop when a round produces no new **must** questions, or after three rounds; the remaining **analysis** items go to the person as a list with what each would cost.

`wr.py status DIR` shows claims by status and the question rows still open (any row whose status cell says `open`, even "done / open (analysis)").

## 7. Deliver

The handover says: the message in one sentence; where the PDF is (`DIR/<name>.pdf`, the copy `build` makes of `build/main.pdf`, which the readers read); the reader rounds run and what changed; the open analysis questions; numbers or claims not verified; the tier each step ran at. Keep the ledger and `review/` with the document: the next revision starts from them.

## Who does each step (a suggestion, not a rule)

Steps differ in the judgement they need. Defaults, which the person's profile or request overrides; before a submission, raise every step one tier.

Tiers: **light** is mechanical work with a clear rule (a small, cheap model), **standard** is following detailed instructions (a mid-size model), **deep** is open judgment (the strongest model, more thinking).

| Step | Suggested tier | Why |
|---|---|---|
| 2 Message and ledger, 3 skeleton | deep, with the person | the story is decided here |
| 4 Figures and text to the skeleton | standard | detailed instructions exist by now; with section files, one helper per section in parallel, each briefed with its section's ledger rows (`wr.py where`), then the lead reads the whole for flow |
| 5 Checks | script, plus light for number tracing | mechanical |
| 6 Readers | standard or above, mixed families | a weak reader asks shallow questions |
| 6 Sorting and revising | deep; a light pre-pass may cluster the questions by quoted page and keyword first | judgement about what the document must answer |

## Learning loop

This skill improves itself from use. When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line (`<kind>`: failure, friction, misled, missing, workaround, win or wish):

- If `~/.config/strange-loop/genome` exists, run this (in claude.ai, on the connected computer):
  `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note research-writing <kind> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"`
- Otherwise, only if the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for research-writing` holding the line `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; if not, add nothing about it, except one line when the skill clearly failed.

### Observations

Every question a reader of the finished document (the person, a colleague, a referee) asks that the reader loop did not raise is worth a note (kind `failure`): it shows what the loop's readers missed.
