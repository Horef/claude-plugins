# Story techniques from the exemplars

From the owner's model texts (see `sources.md`), studied by a helper agent (Opus 5.5) on 2026-11-04 and reviewed by the skill author. Sections 1-4 analyse each exemplar; section 5 lists the techniques that transfer to a results write-up (T1-T16); section 6 what does not transfer; section 7 is the worked diagnosis of a real draft that motivated the skill. Page and line references point to the owner's copies.


The question behind these notes: why does a reader come away from some papers knowing what was found, and
from others only knowing what was done? And which of the techniques that cause this can an agent apply to a
results write-up for one owner and a few collaborators?

---

## 1. Thalamic single-synapse paper (Chen … Konnerth, Science 2026, pp. 1349–1354)

`src/thalamic_single_synapse.pdf`, 29 pp.: 6 pp. main text with 5 figures, then a supplement with Materials &
Methods and figs S1–S8.

**Shape of the argument.**
- **Abstract**: one paragraph, in the order question → method → finding → significance. The finding is one
  plain contrast: thalamocortical (TC) spines, but not corticocortical (CC) spines, lacked a postsynaptic Ca2+
  signal. The significance sentence ties it back to Hubel & Wiesel (H&W).
- **Intro paragraph 1** states the H&W model as a *testable prediction*, not as background. With the
  preferred orientation, the aligned dLGN inputs fire together; with the orthogonal one, they fire in sequence.
- **Intro paragraph 2** names the controversy (mouse dLGN may already be tuned). It ends with a sentence that
  says what measurement would settle it ("Resolving this discrepancy requires …"). By the end of page 1 the
  reader knows the question, the rival answers and the decisive experiment.

**Results as a puzzle chain.** There are three short headed sections, and each figure answers what the
previous one raised:
- Fig 1: imaging single spines in vivo shows the expected untuned TC inputs are missing. This is the surprise.
- Fig 2: rabies tracing shows the inputs come mainly from the untuned dLGN core. That rules out the "they
  were tuned all along" explanation, and leaves another possibility: TC synapses give no Ca2+ signal.
- Fig 3 tests that directly with glutamate imaging, cortical silencing with SSFO, and dual-colour glutamate
  and Ca2+ imaging. TC spines release glutamate but show no Ca2+.
- Fig 4: the full input map. TC inputs are untuned; CC inputs are biased toward the soma's preference.
- Fig 5: the receptive-field arrangement. One panel (5H, alignment angle against preferred orientation,
  points on the diagonal) answers the prediction made in intro paragraph 1.

The chain is held together by bridge sentences of the form *this could be due to X; we therefore tested X*.
The reader never has to wonder why the next experiment is there.

**Figures.**
- Each figure opens with a cartoon of the experiment (1A, 2A, 3A, 5B), then an example image or trace, then a
  population summary with n and median. Panels read left to right in the order the text uses them.
- Nearly every Results sentence makes a claim and points to a panel, often down to sub-traces ("Fig. 3D,
  middle traces 1 to 4"). In the main text I counted about 53 main-figure pointers and 18 supplement pointers.
- Figure titles describe; the claim and the statistics sit in the caption and the text.

**Main text vs supplement.**
- A methodological obstacle appears in the main text only when the reader needs it, in one sentence (ChR2
  was replaced by SSFO).
- Controls and side material go to the supplement: muscimol silencing (S4), sensor pilots (S5), procedure
  (S6), other neurons (S7).
- The main text carries only the chain.

**Discussion.**
- Restates the unexpected result and gives a mechanism for it (no NMDA-receptor Ca2+ entry at TC spines).
- Reconciles it with the conflicting literature.
- Closes the loop to the H&W prediction in intro paragraph 1.

## 2. Hoffman & Prakash 2014, "Objects of consciousness" (Front. Psychol. 5:577)

`text/hoffman_objects_of_consciousness.txt`, 22 pp. A theory paper, so its lessons concern
*explaining*, not data display.

- **Familiar starting point.** It opens with a belief everyone holds (objects exist when unperceived:
  Piaget's object permanence, Einstein's moon), then lists how many fields rest on it. The reader agrees
  before being asked to doubt.
- **A sustained concrete metaphor before the formal argument.** The desktop interface comes first: an icon
  is useful without resembling the file. Only then comes the evolutionary-game argument that fitness beats
  truth. The metaphor gives the reader something to hold while the formal argument runs.
- **Intuition first, then definition, and it says so.** It describes an agent as three processes
  (perception, decision, action), shows a diagram (Fig 1), then gives Definition 1 with Markov kernels. It
  says outright that the intuitions are scaffolding and that the definition does the work.
- **An analogy to a known formalism** frames the main thesis: the Turing machine and the Church–Turing
  thesis.
- **Figures grow in steps.** Figs 1–8 go from one agent to two, to three, to a compact notation, a complete
  graph, directed joins and a simplified form. Each adds one thing.
- **Labelled claims.** Hypothesis 1, Hypothesis 2, Conjecture 3 can be referred to later.
- **The simplest case for concreteness.** A two-state example makes the asymptotic dynamics tangible.
- **Objections in the reader's voice.** Inline, rejoinders are posed as the reader would put them and then
  answered. At the end, *Objections and Replies* gives 23 numbered objections from readers and reviewers,
  each with an answer. It is a pre-emptive FAQ.
- **The conclusion** recaps the arc in three numbered steps and returns to the opening motif (object
  permanence).

## 3. Goetz & Häusser 2021 (PNAS 118:e2017339118), dendritic spikes and orientation tuning

`src/goetz_haeusser_2021.pdf`, 12 pp. A modelling paper about a single neuron, so it is the closest to the
owner's own work.

- **The questions are numbered in the intro.** The intro poses four mechanistic questions, and the Results
  answer them in order. The reader always knows which question is being answered.
- **Headings are claims.** Results sections are titled with their conclusion: AP output depends strongly on
  dendritic Na+ and NMDA spikes; strong but sparse inputs trigger dendritic spikes; the strongest ~1% of
  synapses set the orientation tuning. Figure titles are claims too ("Surprisingly few synaptic inputs are
  required…"). Reading only the headings and figure titles gives the whole paper.
- **The model is validated first.** Fig 1 overlays model and in vivo data (pink experiment, light-blue
  model) before any new result. The reader trusts the tool before it is used.
- **Definitions are shown before they are used.** Fig 2 defines and detects Na+ and NMDA spikes with
  examples. Every later figure uses those detectors.
- **Correlation, then causation, signposted.** Fig 3 shows AP-triggered averages (correlational); Fig 4
  deletes spikes (causal). The bridge sentence says so: in the previous figure we showed X; to show it
  causally we did Y.
- **Paragraphs are question-led.** Many open with a question ("How many dendritic spikes are involved…?",
  "Are all synapses equal…?") and close by raising the next one.
- **One colour code throughout.** Red is Na+ spike, orange is NMDA spike, grey is control, in every figure.
  The reader learns it once.
- **A reusable name for the idea.** The "iceberg effect" is named, then reused. The final schematic (Fig 6D)
  shows two icebergs in series and ties the paper together in one picture.
- **Side issues are handled in one sentence.** Alternative assumptions (e.g., synaptic clustering) are tested
  in the SI with a one-sentence mention. In the text there are about 54 main-figure pointers and about 14 SI
  pointers. Caveats are stated before a reviewer raises them ("our results do not rule out…").
- **The Discussion has claim headings** too, and it uses the result to explain a puzzle in the literature
  (the MK-801 finding).

## 4. Hofstadter, *Gödel, Escher, Bach* (`text/hofstadter_geb.txt`)

A book, not a paper. Its methods are worth studying because it makes very abstract material readable; most of
its *form* does not transfer. (The OCR drops fi/fl ligatures; line numbers refer to the .txt.)

- **The author's own diagnosis** (20th-anniversary preface, ~l.1–1190). Readers missed the core point, so he
  restates the thesis in one paragraph: how animate beings arise from inanimate matter, via strange loops.
  Lesson: if the thesis is not stated in one place, readers will not reconstruct it, however rich the book.
- **Every concept is presented twice** (Introduction, ~l.3030). Almost every concept first appears in a
  Dialogue as a concrete, visual allegory, and then in a Chapter as the abstract version. He cites the idea
  that a few dominant features should orient the reader at first sight. This is the concrete-before-abstract
  rule taken to its limit.
- **An annotated roadmap** (Overview, ~l.1266–1610). One paragraph per dialogue or chapter says what it does
  and how it connects, e.g. that a chapter explains the preceding dialogue as far as possible at that point.
- **A puzzle before the theory** (Ch I, ~l.3261). The chapter opens with a game ("can you produce MU?"),
  with rules, worked examples and non-examples (rules are one-way). Theorem, axiom and derivation are named
  only after the reader has played. He predicts the reader's experience and says the answer will come later.
- **A toy system that makes an abstract idea felt** (Ch II, ~l.3875, the pq-system). The chapter gives an
  exercise ("Try it") before the answer. It flags the central idea explicitly as central to the chapter and to
  the book: isomorphisms induce meaning.
- **The running example pays off** (Ch IX, ~l.13417, ~13963–14060). The MU-puzzle is solved about 220 pages
  later. A recap box for the reader's ease of reference restates the rules and the earlier observations, then
  gives the answer (no: the count of I's mod 3). The now-familiar example is used as the stepping stone into
  Gödel numbering. MU keeps returning in later chapters as a motif.
- **Short concrete headings** ("Inside and Outside the System", "Decision Procedures") and simple
  diagrams (Fig 11, the derivation tree).

---

## 5. Techniques that transfer to a results write-up

Each entry gives what it is, why it works, how an agent applies it, and which exemplar shows it.

**T1. Put the question and its operational test first.**
- *What:* State the question and say what result would answer it, before any methods.
- *Why:* The reader can judge every later section against that criterion.
- *How:* Write the opening paragraph as question, then rival answers, then the deciding measurement. For a
  divide-or-subtract question, say what plot would show each answer.
- *Shown by:* Thalamic intro paragraphs 1–2; Goetz's four numbered questions.

**T2. Order sections by the argument, not the chronology of the work.**
- *What:* The section order follows the logic of the claim, not the order in which things were done.
- *Why:* The reader wants the logic, not the history. Chronology buries the conclusion where the work
  happened to end.
- *How:* List the claims, order them so each one supports the next, and give each one a section. Steps that
  turned out to be dead ends, or are only controls, become one sentence or an appendix.
- *Shown by:* Thalamic Figs 1→5; Goetz validation → definition → correlation → cause → mechanism.

**T3. Claim headings and claim figure titles.**
- *What:* A heading or figure title states the finding, not the topic.
- *Why:* A skim of the headings alone gives the paper. Collaborators often read only those.
- *How:* Rewrite "Stage 2 results" as, e.g., "Input B scales the tuning curve down; input A leaves it unchanged". Use
  the same rule for figure titles and the first caption sentence.
- *Shown by:* Goetz section and figure titles. Note the thalamic paper keeps descriptive titles and puts the
  claim in the text, which works in Science's format but is weaker for skimming.

**T4. One guiding question per section, answered at the end, which hands over to the next.**
- *What:* A section opens with the question it answers and ends with the question that sends the reader on.
- *Why:* The open question is what pulls the reader to the next section.
- *How:* Open each section with its question. End it with the answer and the next question, or with a bridge
  of the form *this could be X; so we tested X*.
- *Shown by:* Goetz paragraph openers; thalamic bridge sentences; GEB Ch II signposting.

**T5. Define terms with a concrete picture before using them.**
- *What:* Each key term gets a concrete definition, ideally a toy figure, before any result uses it.
- *Why:* An abstract term met for the first time inside a result is decoded wrongly or not at all.
- *How:* For each term the question depends on, add a small panel or box showing it on toy data, placed
  before any result. For divide vs subtract, that means a rate-vs-rate or f–I cartoon of each, and an
  operating-point picture.
- *Shown by:* Goetz Fig 2 (spike detectors); Hoffman (intuitions, then Fig 1, then Definition 1); GEB (rules
  and examples, then terminology).

**T6. Concrete before abstract; the simplest case first.**
- *What:* Show one example cell, condition or trace before the population or the formalism.
- *Why:* The example gives the reader something to hold while the general case is argued.
- *How:* For each figure, use one representative example, then the summary. In the text, give the simplest
  case first ("for concreteness, consider…").
- *Shown by:* Thalamic example → population panels; Hoffman's two-state example; GEB's pq-system.

**T7. A running example.**
- *What:* One case (a configuration, cell or condition) is carried through the whole write-up.
- *Why:* Each new result is read as a change to something the reader already knows, rather than as a new
  object.
- *How:* Choose one default condition (one wiring, one strength). Make every figure show it first, and
  introduce variants only as changes from it.
- *Shown by:* GEB's MU-puzzle, solved in Ch IX with a recap; Goetz's single validated model cell.

**T8. Pose a surprise as a puzzle, then test it.**
- *What:* Present an unexpected result as a puzzle: say what was expected, show what happened, name the
  candidate explanations, and test them.
- *Why:* This turns a list of results into a story, and it pre-empts the reader's "why?".
- *How:* For each surprise, write it in that order: expected, observed, explanations, test.
- *Shown by:* Thalamic Fig 1 → 2 → 3; Goetz MK-801 in the Discussion.

**T9. Every claim points to a panel; each figure is one step.**
- *What:* Each sentence that makes a claim cites the panel that supports it.
- *Why:* The reader can check every claim, and the figures stay attached to the argument.
- *How:* Every claim sentence ends with a figure and panel reference. Place each figure right after the
  paragraph that first cites it. Within a figure, order panels as setup cartoon, then example, then
  population, then answer.
- *Shown by:* Thalamic (~53 pointers in 6 pp.); Goetz (~54).

**T10. One answer figure, plus a summary schematic.**
- *What:* One panel that answers the headline question, and a schematic of the mechanism at the end.
- *Why:* Readers remember one picture. The question in the title deserves its own plot.
- *How:* Design the answer panel first (for divide vs subtract, rate-with-inhibition against control rate,
  slope = a, one line per condition, with the reference experiment's data alongside). End with a mechanism cartoon.
- *Shown by:* Thalamic 5H; Goetz 6D.

**T11. One fixed colour code and one fixed vocabulary.**
- *What:* Each class or condition keeps one colour and one name throughout.
- *Why:* The reader decodes the code once and then reads every figure faster.
- *How:* Fix the colour map once and fix the names once (a term, not synonyms such as SST/SOM or PV−/SST).
  Add a legend key in Fig 1.
- *Shown by:* Goetz red, orange and grey.

**T12. Split main text from supplement.**
- *What:* The main text carries only the chain of claims; other material goes to an appendix.
- *Why:* Controls, pilots, parameter sweeps and reproduction steps are needed, but they break the chain.
- *How:* Move them to an appendix and cite them in one sentence from the main text ("location does not
  matter, App. B").
- *Shown by:* Thalamic figs S4–S7; Goetz SI Fig S8.

**T13. Answer objections before they are asked.**
- *What:* Answer the likely questions in the text, or in a short FAQ.
- *Why:* Readers' questions are predictable. Answering them in the text saves a meeting.
- *How:* Before finishing, list the five questions a collaborator will ask (why is X surprising? where does
  the number come from? does Y matter?). Answer each where it arises, or in a short "Likely questions"
  section.
- *Shown by:* Hoffman's 23 objections and the reader-voice rejoinders; Goetz "do not rule out".

**T14. A one-paragraph thesis and a roadmap.**
- *What:* The thesis stated in one paragraph, with a short roadmap of what each section does.
- *Why:* GEB's own preface shows that rich material without a stated thesis leaves readers lost.
- *How:* Under the title, write the answer in about three sentences. Follow it with a roadmap of 2–4 lines.
- *Shown by:* GEB preface and Overview; the thalamic abstract.

**T15. Validate the tool before using it.**
- *What:* Show that the model reproduces a known result before presenting new ones.
- *Why:* A model result is only as credible as the model.
- *How:* Make the first figure the model matching the reference data or protocol. Keep it short.
- *Shown by:* Goetz Fig 1 (model against in vivo data).

**T16. Close the loop.**
- *What:* The ending answers the opening question explicitly and names what remains open.
- *Why:* It completes the story and confirms that the question was answered.
- *How:* Make the last paragraph restate the question from the first one, give the answer, and list the open
  ends.
- *Shown by:* Thalamic Discussion → H&W; Hoffman's conclusion → object permanence; GEB MU → Ch IX.

## 6. What does not transfer, and why

- **Dialogues, characters, allegory (GEB).** Collaborators read a results write-up to extract findings
  quickly. A dialogue delays the claim and cannot be skimmed. Keep the function (a concrete image first) and
  use a toy figure for it, not a story.
- **Puns, wordplay, form mirroring content (GEB, e.g. the Crab Canon).** They are pleasurable but cost
  precision, and they do not survive translation into a slide or summary. The only weak transfer is a figure
  layout that mirrors the argument (panels in reading order) and a consistent colour code.
- **Withholding the answer** (GEB's MU delay; Hoffman's slow build). A paper reader reads the abstract and
  figures and may stop there. The answer goes first. The puzzle structure (T8) stays *within* a section,
  never across the document.
- **Digressions and breadth for its own sake** (GEB's music and Zen asides). A write-up has one question.
- **A long formal setup before any result** (Hoffman's definitions span pages). Acceptable in a theory
  paper; in a results write-up, methods should be just enough to read the next figure, with detail in an
  appendix.
- **Descriptive figure titles** (the thalamic paper). They are Science's house style; for a skimming
  collaborator, claim titles (Goetz) are better.
- **A 23-item objections list** (Hoffman). Right for a contested theory paper; for a write-up, 3–6 likely
  questions answered in place is enough.

---

## 7. A worked diagnosis (anonymised)

The draft that motivated the skill: a 14-page modelling write-up for colleagues, about 5,000 words and 9 figures, comparing
how two inhibitory inputs change a model cell's responses with what a published experiment reported. Accurate numbers,
honest limits, evidence labels on claims; it still read as a lab report. The pattern is common, so the diagnosis is kept
here without the project's specifics.

**What worked (keep):** a title that asked the question and a summary box that answered it (T14, partly); evidence labels
(established / plausible / unresolved) on each claim, better than either exemplar's practice; a specific Limits section; a
Reproducing section.

**Problems, in order of impact:**
1. **The order was the history of the work** (stage 0, stage 1, stage 2, follow-up, then "Questions from <date>") (T2). The
   mechanism that explained the main surprises arrived last, as answers to questions the owner asked after reading; a
   preliminary control took a third of the text before the experiment that matched the published one. *Fix:* lead with the
   answer and its mechanism; compress the control to one figure and a sentence; appendix for the rest.
2. **The title's key terms were defined near the end** (T5), with three different operationalisations used along the way and
   never shown. *Fix:* a toy figure of what each answer would look like, before any result.
3. **The answer was a table, not a plot** (T10). *Fix:* one answer figure (the model's rate-against-rate plot beside the
   reference pattern), plus a mechanism figure.
4. **The figures floated free of the text** (T9): none cited in the prose, several stacked before the bullets that
   interpreted them, captions that only described, no setup schematic. *Fix:* cite every claim to a panel, place each figure
   after its first citation, captions that open with the finding, a schematic of the setup.
5. **The surprises were stated, not posed and tested** (T8, T13): the two most interesting results appeared as bullets, with
   no expectation, candidates or test, which is exactly what the owner then asked about. *Fix:* expected, observed,
   candidates, test, for each.
6. **Too many configurations and no running example; names drifted** (T7, T11): two wirings, four factor sets, two strengths,
   several variants, private labels, two names for one class. *Fix:* one running configuration, the others as single changes;
   one name per thing; plain names for internal labels.
7. **Stage-name headings, no guiding questions** (T3, T4). *Fix:* claim headings, each section opening with its question.
8. **The end did not close the loop** (T16): it ended on a Q&A list. *Fix:* end the main text with the answer to the title's
   question, then implications and limits.

**What the reader round then found** (four fresh readers, only the PDF): the redrafted version fixed the structure, and the
readers' main objection moved to the science: the title claimed more generality than the evidence supported (one factor was
tested under only one of the two conditions). The message was narrowed in the ledger first, then in the title, summary and
discussion; untested factors were listed as such. This is the loop's intended effect: the writer cannot see an overclaim
that every outside reader names.
