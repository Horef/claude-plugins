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
| **Add** | a new result arrives for an existing write-up | step 2's ledger: add or change claims, then only the sections and figures they touch; never append a section at the end (a "Questions from <date>" section is the symptom) |

The document lives in its own folder (`wr.py init DIR --title "..."`): `ledger.md`, `main.tex`, `preamble.tex`, `refs.bib`, `figures/`, `review/`. Figure scripts live with the project's other analysis code and write PDFs into `figures/`.

## 2. Message, reader and claims ledger (before any prose)

Fill `ledger.md`:
- **Message**: one paragraph: the larger problem, the specific question, two or three results, what was learned, which answers the question and speaks to the problem (Schimel ch. 2; Mensh & Kording rule 1). If it will not fit one paragraph, there are two documents.
- **Reader**: who, what they know, and the questions they arrive with.
- **Claims**: one row per claim, in the order of the argument: the claim as one sentence that states a finding, its status (`established`: shown in our runs or a cited paper; `plausible`: argued, not tested; `open`), its evidence (the results entry or run id), the figure that shows it, and its **condition**: what it was tested under (a parameter strength, a dataset, a regime; `all` when none applies). A write-up that mixes a headline condition with follow-ups at others misleads unless every claim says which.
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
- Every number comes from the evidence named in the ledger. A number you cannot trace is left out and listed for the person.

## 5. Build, check, look

```bash
python3 SKILL/scripts/wr.py build DIR    # latexmk; undefined references, citations, missing files, overfull lines
python3 SKILL/scripts/wr.py check DIR    # ledger vs text, figures cited before they appear and on the same or next page, bold caption titles, ledger conditions, acronyms, long paragraphs, placeholders; then notes that do not fail it (figure heights; decimals in a figure PDF that differ by rounding from the text near it)
python3 SKILL/scripts/wr.py pages DIR    # PNG per page and a contact sheet
```

Fix until `check` reports no problems, read its notes (a figure over the height budget; a number in a figure that the text gives differently), then look at every page: is each figure near its first citation, readable at print size, saying what its title says? Section F of `writing-rules.md` lists the checks a script cannot do; the readers in step 6 do most of them.

## 6. Fresh readers: the question loop

The writer cannot find what the reader lacks. Readers who have only the PDF can.

1. `wr.py readers DIR --round N --roles pi,reviewer,newcomer,outsider,editor` writes one brief per role into `review/round-N/`. The **editor** reads for the prose, not the science: sentences that are fragments, ambiguous, unnatural or that refer to something not named; the other readers ask about content and miss these. Adapt the roles to step 0's reader (a thesis committee, a journal's referees). Each reader gets **only the PDF**: no project files, no ledger, no conversation.
2. Launch one fresh agent per brief, in parallel. **Mix model families**: at least one reader comes from a different family than the writer (for example a Gemini helper started through herdr-delegate's argon templates) when one is available; three times a non-Claude reader caught factual errors that Claude readers missed (O1, O6, O12). When none is available, run the readers as usual and say in the round's notes that no outside-family reader was used; this never blocks the flow. Readers' answer files start with the `Status:` line the brief gives, so docmap accepts them.
3. Sort the questions into `review/questions.md`. Readers ask the same thing in different words, so group them by theme, one row per theme with the readers' ids (a first round can bring 150+ questions; the pilot's 170 became 22 themes): `| R<round>.<k> | theme | raised by | outcome | status |`, outcome one of **text** (the editor's sentence notes are fixed directly and need no row) (answered where it arose: name the paragraph), **limits** (a real limit: the Discussion says so), **analysis** (needs a new run or computation: the person decides), **reject** (the document already answers it clearly; say where, and ask whether the answer is where the reader needed it). Questions several readers ask come first; a weakest link that every reader names is a change to the message, not to a paragraph (update the ledger first). Expect readers to find gaps in the science as well as the prose: those become **limits** or **analysis**, never softened wording.
4. Revise by the outcome, rebuild, re-check.
5. Stop when a round produces no new **must** questions, or after three rounds; the remaining **analysis** items go to the person as a list with what each would cost.

`wr.py status DIR` shows claims by status and the questions still open.

## 7. Deliver

The handover says: the message in one sentence; where the PDF is; the reader rounds run and what changed; the open analysis questions; numbers or claims not verified; the tier each step ran at. Keep the ledger and `review/` with the document: the next revision starts from them.

## Who does each step (a suggestion, not a rule)

Steps differ in the judgement they need. Defaults, which the person's profile or request overrides; before a submission, raise every step one tier.

| Step | Suggested tier | Why |
|---|---|---|
| 2 Message and ledger, 3 skeleton | deep, with the person | the story is decided here |
| 4 Figures and text to the skeleton | standard | detailed instructions exist by now |
| 5 Checks | script, plus light for number tracing | mechanical |
| 6 Readers | standard or above, mixed families | a weak reader asks shallow questions |
| 6 Sorting and revising | deep | judgement about what the document must answer |

## Learning loop

This skill improves itself from use (strange-loop). When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line with the note command (in claude.ai, run it on the connected computer):

```bash
python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note research-writing <failure|friction|misled|missing|workaround|win|wish> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"
```

Every question a reader of the finished document (the person, a colleague, a referee) asks that the reader loop did not raise is worth a note (kind `failure`): it shows what the loop's readers missed. It writes into the person's clone of the genome, which is shared at the next sync. If that fails (no `~/.config/strange-loop/genome`, no shell) and the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for research-writing` holding lines `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; otherwise add nothing about it, except one line when the skill clearly failed. Edit the `LEARNINGS.md` next to this file only when this folder is inside the genome clone itself: installed and synced copies are replaced on update, and a note written there is lost. Fix only plain errors on the spot, after verifying them; everything else waits for a reflection pass.
