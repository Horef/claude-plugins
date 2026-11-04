# Writing rules, by stage

Distilled for this skill from the sources in `sources.md` by a helper agent (Sonnet 5.5) on 2026-11-04 and reviewed by the skill author. Paraphrase throughout; examples are constructed. Section F lists what `wr.py check` and fresh readers verify.


Distilled from the writing books and short guides in `text/` for the "research-writing" skill. All wording is paraphrase unless in quotation marks.
Examples are constructed in a generic computational-neuroscience setting (two inhibitory inputs, A and B, on a model cell), not taken from the sources. Numbers in them are illustrative.

## Source keys

- **Sch12** Schimel 2012, *Writing Science* (cited by chapter; sections 4.x etc. are his numbering).
- **MK17** Mensh & Kording 2017, "Ten simple rules for structuring papers" (cited by Rule number; Fig 1 and Table 1).
- **GS90** Gopen & Swan 1990, "The Science of Scientific Writing" (cited by the section heading).
- **Rou14** Rougier, Droettboom & Bourne 2014, "Ten simple rules for better figures" (cited by Rule number).
- **Nat** Nature guide to authors, "How to construct a Nature summary paragraph" (annotated example).
- **Pin14** Pinker 2014, *The Sense of Style* (chapters 2 to 5 read in full; the rest skimmed; ch. 6 on usage not used).
- **WB17** Williams & Bizup 2017, *Style: Lessons in Clarity and Grace*, 12th ed. (cited by Lesson; Lessons 3 to 9 and 12 used).
- **[syn]** marks a rule I assembled from several sources or inferred for the agent setting. No source states it in this form.

## How to use this file (workflow order)

The sources agree on an order of work, and it is the reverse of how a lab write-up usually grows.

1. Fix the message (section A) before drafting anything. "If you can't deal with the big issues, the small ones don't matter very much" (Sch12 ch.1).
2. Outline as claims: one informal sentence per planned paragraph, results as declarative headers, a figure list with one message each (MK17 R7, R9).
3. Draft fast. First drafts are allowed to break every rule here; the rules are for rewriting (Sch12 1.1; Pin14 ch.3).
4. Revise top-down: story, then sections, then paragraphs, then sentences (Sch12 ch.1; WB17 L8 quick tip: spend most time on beginnings).
5. Give the draft to a reader who is not the writer (section E), then run the checks in section F.

---

## A. Message, reader and story

**A1. Write the one-paragraph message first: opening, challenge, key results (2 or 3), conclusion.**
Why: a paper that cannot be summarised this way has several stories or none, and no later polish fixes that.
Concrete form: (1) the larger problem and why it matters, (2) the specific question, (3) at most 2 to 3 results, (4) what was learned about nature, which must answer (2) and speak to (1).
Each element must be easy to find: a reader of only the opening, challenge and resolution should get the paper.
Source: Sch12 ch.2 Exercise 2.2, ch.4 (end of 4.1); MK17 R1 (the "Rule of One"), R10 (if you cannot give the outline to a colleague in a few minutes, distil more).

**A2. Make the paper claim one central contribution and put it in the title.**
Why: readers meet the title far more often than anything else, and a year later they should still be able to state the contribution. Several equal contributions weaken each other.
Before: "Effects of two inhibitory inputs on current-step and stimulus responses in a model cell".
After: "Synaptic depression, not cell class, decides whether inhibition divides or subtracts the model's response".
Source: MK17 R1; Sch12 3.1 ("simple" is the essence of the idea, not a simplistic summary).

**A3. Take the content up the ladder data → information → knowledge → understanding, as far as the evidence supports.**
Why: raw numbers are readable only by a few experts. The write-up exists to deliver the understanding. "The data are not the story."
Source: Sch12 2.1.

**A4. Find the story bottom-up, then tell it top-down.**
Why: explore the data widely (outliers, odd shoulders, null effects) so the story comes from the data rather than being imposed on it. Then cut to the simple core and write from the claim downward.
Check that the simple story is simple and not simplistic. "Inconsistent across cases" is simplistic; the rule that explains the inconsistency is the story.
For an agent: the exploratory phase is for finding the claim. The paper's order comes from the claim, not from the exploration log.
Source: Sch12 2.1, 3.1 (the freeze-thaw example); MK17 R3.

**A5. Choose the story structure by how patient the reader is, and say so to yourself.**
Why: OCAR (opening, challenge, action, resolution) suits a patient specialist. Front-loaded versions (ABDCE, lead-development-resolution, lead only) suit busy readers.
Default for a write-up to colleagues that later becomes a paper: context, content, conclusion, with a one-paragraph preview of the results at the end of the introduction and the key result in the first screen.
Disagreement: Sch12 4.2 warns that a conclusion-first paper in a specialist journal can look like forcing data into a preset story. MK17 R3 warns the opposite, that content-first makes readers suspect a missing piece of context. Both accept a short results preview after the introduction (Sch12 7.3; MK17 R6).
Source: Sch12 4.1 to 4.2; MK17 R3.

**A6. Frame a knowledge gap in the introduction. Do not write a literature review.**
Why: a review builds the wall of what is known. An introduction points at the hole in it. Use prior work only to mark where knowledge stops.
Test: if citations open most sentences ("Smith (2003) found…"), you are still dumping data. Write the finding as the subject, with the citation after it.
Name the gap precisely. "Little is known about X" is usually false, is followed by a list of what is known, and is vague; a bounded gap ("sources are not clearly defined") is credible and sets the question (Sch12 6.2.1).
Source: Sch12 3.2, 6.2.1, 6.3; MK17 R6.

**A7. Establish the problem before presenting the solution.**
Why: readers who do not know they have a problem will not care about your tool, model or method. State the condition and the cost, and imagine the reader asking "So what?" after the condition. The answer is the cost.
Source: Sch12 6.2.2 (the "bizzwidget problem"); WB17 L7.

**A8. State the question, in the form "to learn X, we did Y". Do not give only a list of objectives.**
Why: objectives name the information to collect, not the knowledge to gain. The reader then has to guess the question and may suspect there was none.
Put the most important question first. Do not list goals in the order in which the work was done (validation first, science second).
Before: "Our objectives were to implement the input model, validate firing rates, and sweep the conductance of inputs A and B."
After: "To learn whether input B divides or subtracts the response to a stimulus, we drove the cell through an input model and swept inhibitory conductance. (We first checked the input model against measured firing rates.)"
Source: Sch12 7.2 to 7.5.

**A9. Decide whether the problem is conceptual (we do not know) or practical (we must act). Write the cost accordingly.**
Why: for a conceptual problem the small question borrows its importance from a larger question that the answer helps with. Say the larger question. For a practical problem name the harm.
Most simulation and analysis write-ups pose conceptual problems.
Source: WB17 L7.

**A10. Make the resolution as wide as the opening. Deliver what the opening promised.**
Why: an opening wider than the ending feels like a bait-and-switch. An opening narrower than the ending hides the paper from readers who would care. If forced to err, err slightly wide.
Source: Sch12 4.3 (hourglass), 5.6.

**A11. Decide who the reader is and what they already know. Write for the less informed plausible reader.**
Why: the writer is the person least able to judge this (curse of knowledge). A colleague who knows the model loses a clause; a newcomer who lacks it loses the paper. Over-defining costs little; under-defining can lose the reader for good.
Ground the concepts that sit in the middle of the abstraction ladder (specialist ideas that are neither widely known schemas nor raw facts) in either a familiar idea or a concrete fact.
Source: Sch12 3.1.1, 3.3, 15.1; MK17 R2; Pin14 ch.3.

**A12. List the questions a sceptical colleague will ask about each claim, and answer each where it arises.**
Why: unanswered questions are a common reason a competent draft feels incomplete. Typical ones: why this method or parameter, was it validated, could it be an artefact, compared with what, what does it mean for the larger question, does it generalise, what would falsify it.
MK17 gives example questions of this kind as paragraph openers ("To verify that there are no artifacts…", "What is the test-retest reliability…"). WB17 adds "So what?" (significance) and "Now what?" (next step). GS90 shows that gaps become visible once old and new information are placed correctly.
Procedure [syn]: build a claim-question ledger during outlining; each question is answered in the same paragraph, in a later section with a pointer, or consciously dropped.
Source: MK17 R7, R8, Table 1; WB17 L7; GS90 "Perceiving Logical Gaps".

**A13. Keep data, inference and interpretation separate, and say which is which.**
Why: readers must be able to tell what you found from what you think. Data are the results; inference is what almost any practitioner would draw; interpretation is your thought about the larger problem. Label evidence strength.
Source: Sch12 8.2.1. (The existing write-up's "established / plausible / unresolved" labels follow this idea.)

**A14. Choose results by what the story needs. Archive the rest and keep a pointer.**
Why: reporting every analysis in the order it was run is the "autobiographical" structure. Cutting costs effort but the cut work is not wasted; it found the story.
Collapse detail into one summary plus a subordinate panel that shows why the detail can be ignored.
Source: Sch12 8.2.2; MK17 R3.

**A15. Do not introduce a new idea in the resolution. If one appears while writing, go back and plant it in the introduction.**
Why: readers see the final position as the take-home message, and a surprise there cannot be found by search or anticipated by the reader.
Source: Sch12 9.2.2.

---

## B. Structure of the whole paper and of each section

**B1. Order the paper by the logical structure of the argument, not by the order the work was done.**
Why: readers want the claim and the logic that supports it, not the path. The chronological habit comes from the writer's autobiographical context.
Source: MK17 R3, R7; WB17 L8 (quick tip: chronological order is easiest for the writer, so check for it); Sch12 8.2.1.

**B2. Outline with one informal sentence per paragraph. Each paragraph has a defined role in the story.**
Why: wordsmithing a paragraph that is later cut is wasted work, and the role of each paragraph is easiest to judge in the outline. Spend effort in proportion to readership: title, abstract, figures and outline first, then introduction and Discussion, then Methods.
Source: MK17 R9; WB17 L8 quick tip.

**B3. Turn the results into a sequence of declarative statements. These become the subsection headers and figure titles.**
Why: the headers read in order should state the argument. Each result is a premise for the next, like theorems.
Before: "Results of the contrast sweep"
After: "Strong activation of input B scales responses by about 0.9 with no offset"
If the journal forbids headers, use them as paragraph openers or delete them at the end.
Source: MK17 R7.

**B4. Write the abstract as a complete story: context narrowing to the gap, then "Here we", then results, then conclusion and broader significance.**
Why: most readers read only this. The usual error is to give results before the reader is ready for them. The result should fit the gap like a key in a lock.
Source: MK17 R5.

**B5. Write a summary paragraph on the Nature plan when a short standalone opening is needed.**
Slots in order: 1 to 2 sentences of basic introduction any scientist can follow; 2 to 3 sentences of background for related fields; 1 sentence stating the general problem; 1 sentence giving the main result ("here we show"); 2 to 3 sentences saying what the result reveals compared with what was thought before; 1 to 2 sentences placing the result in a wider context. Optionally 2 to 3 sentences of broader perspective. Up to about 300 words; the annotated example is about 190 words without the last slot.
Why: it makes a reader outside the subfield able to state problem, result and advance in one pass.
Compatible with MK17 R5; the Nature plan adds the explicit "compared with what was thought before" slot.
Source: Nat.

**B6. Build the introduction as a funnel of gaps, each paragraph ending on an "unknown".**
Why: field gap, then subfield gap, then the specific gap the paper fills. Each paragraph: orient (context), say what is known (content), land on the unknown (conclusion). Experienced readers judge the paper by judging the gap.
WB17 gives the same shape for any genre: shared context, then a "but" that turns it into a problem (condition plus cost), then the claim or solution. Put the claim in the stress position at the end of the introduction.
End the introduction with a compact paragraph on what the paper does and finds: more specific than the abstract, no new context, only a hint of the conclusion (MK17 R6; Sch12 7.3, "telegraphed OCAR").
Source: MK17 R6; Sch12 ch.6; WB17 L7.

**B7. Start the Results with a paragraph on the overall approach and any new method.**
Why: most readers skip the Methods, so this paragraph carries the gist of how the work was done.
Source: MK17 R7.

**B8. Write each results paragraph as question, evidence, answer.**
Shape: the first sentence or two set up the question the paragraph answers; the middle gives data and logic; the last sentence answers.
Why: it lets a reader check the logic one claim at a time and find where a suspect conclusion was drawn.
Before: "We ran 40 trials at five conductance levels. Figure 3 shows the f–I curves. The threshold moved by 0.3 nA with input A and 0.1 nA with input B."
After: "Do inputs A and B divide the f–I curve or only shift it? In 40 trials at five conductance levels (Fig. 3), both moved the curve to the right without changing its slope: A by 0.3 nA, B by 0.1 nA. Under somatic current steps, neither divides."
Place controls and validations where the argument needs them, each introduced by the doubt it removes (a validation parked in an early section reads as a method list).
Source: MK17 R7; Sch12 8.1, 8.2.3 (lead first, details after).

**B9. Show the data first, then the inference, with a word that marks the inference ("indicates", "implies").**
Why: when the data come first the reader sees the interpretation grow from them. A conclusion stated first and the data quoted afterwards feels like a plot imposed on the findings, even inside one sentence.
Before: "Responses are divisive, since the tuning curves are scaled copies of control."
After: "Each tuning curve with input B active is a scaled copy of its control curve (slope 0.9, intercept 0). This indicates a divisive effect."
Source: Sch12 8.2.1 (examples 8.5 and 8.6).

**B10. Report the size of an effect, then its statistics. Never report only "significant" or "not significant".**
Why: the story is in the amount. A p-value says the effect is not random variation, not how large it is. A large but noisy effect should not be called "no effect". A strong p with a small R² is a "weak but significant" relation.
Before: "Input B significantly reduced the response (p < 0.05)."
After: "Input B reduced the response by a factor of 0.9 (p < 0.05)."
Source: Sch12 8.2.4.

**B11. Decide whether to combine or separate Results and Discussion, and keep results and interpretation distinguishable either way.**
Why: fields differ. Combined sections suit sequential experiments, where each step depends on the one before, and strongly interleaved data and inference. Separate sections suit papers whose results are plain data.
Disagreement: MK17 R7/R8 assume separate sections with the first Discussion paragraph restating results. Sch12 8.2.1 says physical separation is optional and what matters is that the reader can tell data from interpretation.
Default for an agent: separate sections, with interpretation words in Results restricted to short, marked inferences.
Source: Sch12 8.2.1; MK17 R7, R8.

**B12. Write the Discussion as its own story: restate what was found by what it means, test the weak points, then widen to the field.**
Shape: first paragraph summarises the findings by their meaning (some readers skip the Results). Later paragraphs each take one strength or weakness and tie it to the literature. End with an informal way of seeing the contribution or with future directions.
Why: a reader should leave with the criticisms preempted and the contribution placed in context.
Either OCAR (restate the question, work through, resolve) or LDR (state the conclusion, support it, resolve) works.
Source: MK17 R8; Sch12 8.3.

**B13. End with a resolution that steps back through OCAR: restate the action, answer the question, tie the answer to the larger problem. Do not end with "more research is needed", with a limitation, with textbook truisms, or with what you did not achieve.**
Why: the final position is a power position and readers take what is there as the message. Qualifications belong earlier in the Discussion. A strong statement can still be bounded ("may offer a route").
Before: "…Further experiments are needed to establish whether the effect holds in vivo."
After: "…Under this input model, activating B divides responses, which suggests that how the input is delivered, not which input it is, decides division or subtraction."
A closing question is acceptable if it is concrete and grew out of the work, because it extends the conclusion instead of withdrawing it (Sch12 9.1.1).
Source: Sch12 ch.9 (9.2.1 to 9.2.3); MK17 R8.

**B14. Open every section, subsection and long paragraph with a short segment that ends in a point sentence naming the key themes. Repeat those terms in the body.**
Why: readers use these point sentences as the outline. Without them the unit seems to ramble and the reader reconstructs the point at the end.
Before: "We ran sweeps at five conductances. At 0.5 nS the curve moved little. At 2 nS it moved more. At 8 nS the cell stopped firing."
After: "Inhibition shifted the curve in proportion to conductance up to 2 nS and silenced the cell at 8 nS. At 0.5 nS the shift was small…"
Source: WB17 L8 (six principles); Sch12 ch.10, 11.
Related: MK17 R3 (first sentence of a paragraph defines context, last sentence gives the conclusion).

**B15. Write Methods overview-first: say what information was needed and how it was obtained, then give details.**
Why: Methods are read least and by different readers at different depths. A bare citation ("as in Turman et al.") or a bare procedure with no aim are both hard to use. Name known methods and state only the differences.
Source: Sch12 8.1; MK17 R9.

**B16. Avoid zig-zag. Cover each subject in one place, put similar ideas next to each other, and touch the central idea repeatedly.**
Why: each subject change costs the reader a loose thread, and readers hold few. A paragraph or section is a complete arc, not a fragment of one.
Source: MK17 R2, R4; Sch12 10 (nested arcs).

**B17. Tell the reader what principle orders the parts, and use a visible one.**
Why: readers look for chronological, coordinate (parallel items) or logical (premise before conclusion) order. If the order is chronological, it should be because time matters to the argument.
Source: WB17 L8; Pin14 ch.5 (schemes: zoom in, move through time or space, debate, hero and obstacles).

---

## C. Paragraphs and sentences

**C1. Make most paragraphs point-first: state the point in the first sentence or first two, then develop. Use point-last paragraphs on purpose, mainly for arguments, conclusions and transitions. Never write a paragraph whose point is nowhere.**
Why: a text of point-first paragraphs can be skimmed by its first sentences. Point-last paragraphs are about a quarter of a paper. End a long paragraph with a sentence that states what it established.
Source: Sch12 ch.11; WB17 L8; MK17 R3 (context sentence, content, conclusion sentence).
Disagreement: Pin14 ch.5 says there is no such thing as "the paragraph" as a unit, only a break that rests the reader and usually marks a branch of the text. Treat the paragraph rule as a working discipline, not as grammar.

**C2. Give each paragraph one point. Split a paragraph that carries two arcs.**
Why: "stream of consciousness" paragraphs link every sentence to the last but drift through unrelated topics. Splitting them and linking the pieces restores the arcs.
Source: Sch12 10.2, 11.3; GS90 ("each unit of discourse serves a single function").

**C3. Put in the topic position (the opening words) what the reader already has, or whose story this is. Put new information in the stress position (the end).**
Why: readers take the opening as the context and the end as the payoff. New material in the opening, old material at the end, makes the sentence read as being about the wrong thing and spends effort on locating its point.
Note: GS90 says this is a principle, not a rule. Old information does not have to open every sentence; it should open the sentences where linking matters.
Source: GS90 "The Topic Position", "The Stress Position"; Sch12 12.1 to 12.3; WB17 L5, L6; Pin14 ch.4 ("given before new").

**C4. Strip trailing words after the real point. Move qualifying phrases to the middle.**
Why: a sentence ending on "was seen" or "in all cases" stresses the wrong thing. The middle is the weakest position.
Before: "Adaptation slowed the response, as a lengthening of the decay constant was seen."
After: "Adaptation slowed the response: the decay constant lengthened from 40 to 65 ms."
Source: Sch12 12.5.2 (2–3–1 rule of emphasis); WB17 L6 (trim the end, shift peripheral ideas left, new information right).

**C5. Keep the subject close to its verb. Do not insert long parentheticals between them.**
Why: the reader waits for the verb to know what the sentence says, and treats everything in between as an interruption of minor importance.
Source: GS90 "Subject-Verb Separation"; Sch12 12.4; WB17 L6; Pin14 ch.4 (left-branching and centre-embedded phrases).

**C6. Make the main characters the subjects, and put actions in verbs.**
Why: readers judge a sentence clear when the subject names who or what the story is about and the verb names what happens. Characters can be abstractions, if they stay as subjects across several sentences and are familiar.
Procedure: underline the first 7 or 8 words; if there is no character, find it in a possessive, an "of" phrase or an adjective; list the actions hidden in nominalizations (-tion, -ment, -ance); rebuild with the character as subject and the action as verb.
Before: "Inhibitory-conductance application resulted in a reduction of response amplitude."
After: "When we applied inhibitory conductance, the response amplitude fell."
Source: WB17 L3, L4; Sch12 14.2, 14.3; GS90 "Locating the Action"; Pin14 ch.2 ("zombie nouns").

**C7. Replace fuzzy verbs (is, was, performed, conducted, showed a difference, took place) with the verb that carries the action.**
Before: "There was a difference between inputs A and B in threshold shift."
After: "Inputs A and B shifted the threshold by different amounts."
Source: Sch12 14.2, 14.3 (example 14.12).

**C8. Use the passive on purpose: to keep the right topic, or when the actor is unknown or irrelevant. Do not use it to hide who made a choice that matters.**
Why: all four main sources treat the passive as a tool for choosing the topic. The cost is a weaker story and a missing actor.
For an agent: say who or what chose a parameter, dropped a run, or fitted a curve ("we fixed tau at…"), because readers need that to judge the result. Hiding the actor in a report about an automated project is both unclear and, as WB17 L12 notes, a matter of ethics.
Source: Sch12 14.1; GS90 "The Topic Position"; WB17 L4, L12; Pin14 ch.2, ch.4.

**C9. Link each sentence to the one before: end one sentence on an idea and begin the next with it.**
Why: topic repeated on topic gives a list; end-of-one to start-of-next gives a story; end-on-end leaves the reader unsure.
Before: "Depressing synapses lose efficacy under sustained input. We used 10 Hz light pulses. Firing rose after each pulse train."
After: "Depressing synapses lose efficacy under sustained input. Our 10 Hz pulses are sustained input, so the synapses of input A depress. Depressed synapses give less inhibition between pulses, and firing rises."
Source: Sch12 ch.13; WB17 L5; GS90.

**C10. Keep a short consistent topic string through a paragraph. Do not vary subjects for variety.**
Why: a reader finds the subject of the paragraph in the repeated subjects. Readers tolerate (and welcome) the repeated topic.
Test: list the first words of every sentence. Do they name a small set of related ideas? Would the list make a title?
Source: WB17 L5 ("Alleged Monotony"); Pin14 ch.5; GS90.

**C11. Link paragraphs the same way: the first sentence of the next paragraph picks up the idea that ended the previous one.**
Why: a paragraph break says "new arc", and readers still expect the new one to build on the old. If the link fails, fix the earlier paragraph's ending as well as the later opening.
Source: Sch12 13.1; MK17 R4.

**C12. State the logical relation between statements, using connectives that mean what they say. Do not fake coherence with "thus", "therefore", "moreover".**
Why: readers look for the relation (contrast, example, cause, exception, elaboration, sequence) between every pair of statements. A missing or wrong connective leaves a logical gap or a wrong inference.
Test for each connective: delete it; does the sentence still follow? Use "but/however" only to contradict, "therefore/consequently" only to finish a line of reasoning, and sparingly.
Source: Pin14 ch.5 (coherence relations); WB17 L5 ("Faked Coherence"); GS90 "Perceiving Logical Gaps".

**C13. Use parallel form for parallel items and for comparisons. Change only the thing that differs.**
Why: parallel syntax is the "rule of one variable" for prose. Varying the wording of a comparison makes the reader wonder what else differs.
Source: MK17 R4; Pin14 ch.4, ch.5.
Disagreement on repeating words: MK17 R4 says to repeat the word. Pin14 ch.5 says never to vary wording inside a comparison, but allows a more generic pronoun-like label (bus, then vehicle) in quick succession when the same noun would sound monotonous or suggest a new actor. WB17 L5 says keep subjects consistent.

**C14. Define a term where it first matters, and spell out every abbreviation on first use. Avoid abbreviations and private labels that exist only for the project.**
Why: a term in the opening of a sentence is taken as known, so an undefined one becomes jargon; a term placed at the end of the sentence reads as a definition; mid-sentence it reads as a reminder. Abbreviations save the writer seconds and cost every reader minutes.
For agents: run IDs, stage numbers, decision numbers, file names and shorthand such as "DA/DN/SA/SN" are the most common private labels. Replace them with plain descriptions, and keep the IDs in a footnote or table.
Source: Sch12 15.1 (terms at beginning, middle or end); Pin14 ch.3; MK17 R2.

**C15. Be concrete. Say what happened in terms the reader can picture, and give an example with each abstraction.**
Why: readers understand and remember concrete wording better, and a definition without an example is little use. Two examples let the reader triangulate.
Before: "The inhibitory perturbation altered the response regime."
After: "Turning on input B cut each response by about 10%, at every contrast."
Source: Sch12 3.3; Pin14 ch.2 (classic style), ch.3.

**C16. Cut metadiscourse that only narrates the writer's activity ("we found that", "it is important to note", "this section describes"). Keep signposts the reader needs.**
Why: new results in your own paper do not need attributing to yourself. A preview of sections is a table of contents the reader cannot yet use. Flags such as "In conclusion", "However" and "Consequently" are worth keeping (Sch12 9.1, 10.1).
Prefer a question or a content statement over a roadmap. A final summary should restate the points in new words, not paste the section's first sentences.
Also condense redundancy and obvious modifiers, but never so far that the reader must decode: "take the space necessary" for a critical idea, and cut elsewhere (Sch12 ch.16, 11.3; Pin14 ch.3).
Source: Sch12 16.5; Pin14 ch.2; WB17 L4, L9.
Disagreement: WB17 L8 and MK17 R6 want the introduction to name its themes and results. Reconcile by naming them in content terms ("B divides, A raises"), not as a roadmap ("Section 5 covers input B").

**C17. Hedge only where the uncertainty is real, and say what the uncertainty is. Prefer a qualification or a number to a vague softener.**
Why: stacked hedges make the author look unwilling to stand behind the claim; unhedged claims that are not safe mislead. Intensifiers ("very", "highly") are hedges in disguise.
Before: "These results seem to somewhat suggest that input A may possibly be less divisive."
After: "In this model input A shifted the curve and did not change its slope (n = 40 runs). We did not test other input models."
Source: Pin14 ch.2; WB17 L9 (hedges and intensifiers) and L12; Sch12 9.2.3.

**C18. Judge sentence length by stress positions, not by a word count.**
Why: a sentence is too long when it has more points worth emphasising than it has places to emphasise them. A 100-word sentence can read easily; a 10-word one can be impenetrable.
Use semicolons or colons to create extra stress positions when a sentence must carry several points.
Source: GS90.
Disagreement: Sch12 favours short as a default; WB17 L6 recommends getting to a verb in a short subject so that the reader has momentum for a long tail. Both agree long sentences are fine if the structure is right.

**C19. In sentences that cite evidence, make the finding the subject, not the researcher or the log.**
Why: "X occurs (Smith 2003)" is about nature; "Smith found X" is about Smith. For an agent: the same applies to "Run 14 showed…" or "The notebook computed…".
Source: Sch12 6.3.

---

## D. Figures and how they join the text

**D1. Write the figure's one-sentence message before building it.**
Why: the message guides what to plot, what to leave out and how to emphasise; a figure without one is decoration or data dump.
Source: Rou14 R2 (Identify your message), R1.

**D2. One message per figure. If panels carry different messages, split the figure or subordinate the detail.**
Why: readers who skip to the figures take one takeaway per figure. The Schimel example puts the message in the top panel and a lower panel shows why the detail does not matter.
Source: Rou14 R2; MK17 R7; Sch12 8.2.2. The exact "one message" wording is [syn].

**D3. Title the figure with the conclusion of the analysis. Use the legend to explain how it was done.**
Why: readers often go from the abstract to the figures. Title plus legend should carry the argument for them.
Before: "Fig. 3. f–I curves under activation of inputs A and B."
After: "Fig. 3. Both inputs shift the f–I curve to the right and neither changes its slope."
Source: MK17 R7. Rou14 R4 agrees that the caption is not optional.

**D4. Write a full caption. It explains how to read the figure and gives what the plot cannot show.**
Contents [syn from Rou14 R4 and MK17 R7]: what is plotted (axes, units, what each colour or symbol is); sample size and what error bars or bands mean; how it was produced (model version, parameters that matter); where to look (the point of interest, pointed out again in words); the numbers the reader cannot read off the plot; abbreviations defined.
Why: think in advance of the questions a person at a poster would ask. Numbers that matter go in the text or on the figure, because bar heights and curves cannot be read to a value. Make the point of interest visually salient (colour or weight, the rest grey or black) and point to it again in the caption.
Source: Rou14 R2, R4, R6; MK17 R7.

**D5. Introduce each figure in the text by the question it answers. Then state the finding in words, with its amount, and cite the figure. Do not narrate the figure panel by panel.**
Why: "X was 42" without context leaves the reader asking why it matters. The text supplies the pattern, the figure supplies the evidence.
Source: Sch12 8.2.3; MK17 R7. The "no panel tour" wording is [syn].

**D6. Cite a figure in the text before it appears. Place it right after the paragraph that first cites it. Number figures in order of first citation.**
Why: a figure that appears before the reader knows its question has no frame, and a figure far from its text breaks the reading order. The sources say figures support the sequence of statements; the placement rules are [syn].
Source: MK17 R7 (sequence of statements supported by figures) [syn].

**D7. Do not mislead. Use the simplest plot that carries the message; use the full range or state the truncation; area, not radius, for size; avoid 3-D and pie charts; ask a colleague how they read it.**
Fit the figure to the medium and audience: a journal reader can study detail, a talk audience cannot (Rou14 R1, R3).
Source: Rou14 R7.

**D8. Use colour for a reason, keep colour mappings the same across figures, and avoid default colour maps like jet or rainbow. Choose sequential, diverging or categorical maps to fit the data and avoid colour pairs colour-blind readers cannot separate.**
Why: consistent encodings are parallel structure for figures. Defaults suit every plot and none well.
Source: Rou14 R5, R6, R8; consistency across figures [syn] from MK17 R4 and the red-for-red use in Rou14 Fig 3.

**D9. Remove chartjunk: extra gridlines, legends over data, over-precise ticks, decorative backgrounds, redundant labels.**
Why: each element not carrying information competes with the message. An element can be junk in one figure and the message in another (a shaded band that marks a range stated in the caption).
Message first, polish second: readability outranks beauty, and defaults are for exploration (Rou14 R9, R5).
Source: Rou14 R8.

**D10. When the contribution is a mechanism or model, draw it. A simple diagram is often the central figure.**
Why: Schimel's own most-cited paper rests on a cartoon of the interactions; simple ideas are often visual.
Source: Sch12 3.1; Rou14 R2.

**D11. In tables, put the context or ordering variable on the left and the quantity to compare on the right. Sort rows to expose the pattern.**
Why: readers meet context first and look for the new, interesting item on the right.
Source: GS90 (opening example of the temperature table).

**D12. Keep reading order inside a figure: panel letters in the order the argument uses them, left to right then top to bottom, and cite them in that order.**
Source: GS90 (left to right, context to news); Rou14 Fig 1 caption (layout follows reading direction). Panel-order rule is [syn].

---

## E. Revision from the reader's side

**E1. Assume readers know less of your project than you think, and that you cannot detect where, by effort alone.**
Why: knowing a thing well erases the memory of how hard it was to learn. The cure is feedback from outside, not trying harder.
Main failure modes (Pin14 ch.3): unexplained jargon and abbreviations; chunked abstractions that feel like concepts to you ("social avoidance" for a picture of mice avoiding each other); functional labels in place of what the thing is ("assessment word", "poststimulus event"); skipped steps that seem too obvious to state.
Source: Pin14 ch.3; MK17 R2; Sch12 11.3.

**E2. Get a reader who is not you. For an agent, use a fresh agent that has not seen the logs, notes or earlier drafts.**
Why: "Often it's enough that they are not you." A reader who has never seen the project is the only reliable detector of missing context.
Re-reading it yourself after a gap (a fresh session) helps too: you will ask "what did I mean?", which is the reader's question.
Source: Pin14 ch.3; MK17 R10. The fresh-agent setup is [syn].

**E3. Ask the test reader specific questions.** [syn from MK17 Table 1, R10; Pin14 ch.3; WB17 L5 Ex. 5.3, L8 quick tip]

1. After the abstract, say in one sentence what the paper claims. (Fails if MK17 R1 is broken.)
2. What do we not know that this paper fills in, and why does it matter? (MK17 R6, R8.)
3. Where did you think "why am I being told this?" or "so what?" (context or conclusion missing.)
4. Which terms, abbreviations or labels could you not define? Which steps could you not follow?
5. Where did you stop following or have to re-read? (A local flow problem.)
6. Which claim do you not believe yet, and what evidence would you want?
7. For each figure, what is the message from title and caption alone?
8. Retell the structure of the paper in a few minutes. What was the order of the argument?
9. At the end, what is the take-home message? Does it match the one the writer meant?

**E4. Do a reverse outline: extract the first and last sentence of every paragraph and the headers, then read them alone.**
Why: it should read as the argument. Gaps, repeated points and orphan paragraphs show up in a page.
Source: MK17 R9 (one sentence per paragraph) and R10; Sch12 ch.10 (do the arcs block out cleanly?); WB17 L8 quick tip. Procedure [syn].

**E5. Check stress and topics on the page: read aloud (tap on the last words of each sentence), and underline the first 7 to 8 words of each sentence to see whether they name a small set of related characters.**
Why: this finds misplaced stress, buried subjects, throat-clearing, tangled syntax and garden paths quickly.
Source: Pin14 ch.4; Sch12 12.2; WB17 L5, L6 (Exercise 6.3).

**E6. For each claim, ask "how do you know, compared with what, and what if it is wrong?", then check that the paper answers.**
Why: this is the reader's side of A12. Use Table 1 of MK17 to see which level fails: story, section, paragraph or local text.
Source: MK17 R8, Table 1 [syn].

**E7. Diagnose by what the reader reports (MK17 Table 1).** No one-sentence summary: central contribution unclear (R1). Does not "get" it: curse of knowledge (R2). Asks why it matters or what it means: context or conclusion missing (R3). Stumbles in one small section: flow, zig-zag, parallelism (R4). No elevator pitch: abstract (R5). Little interest: introduction (R6). Disagrees with the conclusion: results logic (R7). Unanswered questions: Discussion (R8). Cannot find the contribution despite your effort: time spent in the wrong places (R9). Test readers or reviewers reject it: iterate the story (R10).

**E8. Rewrite whole paragraphs rather than patching them, and do not get attached to the first version.**
Why: trashing and rewriting is often faster than editing.
Source: MK17 R10; Sch12 1.1.

**E9. Read feedback by its kind: vague or unenthusiastic feedback means the story did not land; specific feedback usually points at paragraph logic. Act on comments from more than one reader or those that make sense to you, not on every comment.**
Why: each reader has their own curse of knowledge and hobbyhorses, and committee prose is bad prose.
Source: MK17 R10; Pin14 ch.3.

---

## F. Rules a script or a fresh reading agent can check

Tags: **[S]** script (regex, parser, file structure); **[A]** fresh reading agent without project context; **[S+A]** script finds candidates, agent judges. Thresholds are starting points, not from the sources unless stated.

**Story and structure**
- F1 [A] Give the agent only title, abstract and section headers. Can it state the claim in one sentence, and is it the intended one? (MK17 R1, Table 1)
- F2 [S+A] The abstract contains context, gap, "Here we/we show", results, conclusion. Script looks for the "here we"/"we show" marker; agent labels each sentence. (MK17 R5; Nat)
- F3 [S] The summary paragraph or abstract is at most about 300 words. (Nat)
- F4 [S+A] The introduction names an unknown ("not known", "untested", "unclear") and the question appears as "to learn/determine whether…". Flag "our objectives were" without a question. (Sch12 7.2; MK17 R6)
- F5 [S] No "little is known" / "has not been studied" without a specific object. (Sch12 6.2.1)
- F6 [S+A] The last paragraph of the introduction states what was done and found. (MK17 R6)
- F7 [S+A] Every Results subsection header is a full declarative sentence stating a finding, not a topic label ("Results of run 3"). (MK17 R7)
- F8 [A] The first Results paragraph gives the overall approach. (MK17 R7)
- F9 [S+A] Chronology markers in Results and Discussion ("first we tried", "then we", "next we", "after that", "initially", "later") counted. Agent decides whether the order is the argument's or the work's. (MK17 R3; WB17 L8)
- F10 [A] Every claim in the abstract and the introduction's last paragraph maps to a Results subsection or figure, and every Results subsection supports a claim in that preview. (MK17 R5 to R7)
- F11 [A] The Discussion first paragraph restates the findings by meaning; the likely top five objections of a sceptical reviewer are answered in the Discussion. (MK17 R8)
- F12 [S+A] The last paragraph does not end on "further work/more research is needed", on a limitation, or on a new term absent from the introduction. Script lists terms in the last paragraph that never occur earlier. (Sch12 9.2)
- F13 [S+A] The conclusion returns to the opening's main concepts (shared key terms between first intro paragraph and last paragraph); the agent checks the width matches. (Sch12 4.3, 5.6)

**Paragraphs and sentences**
- F14 [A] For each paragraph, give the point using only its first sentence, then using the whole paragraph. Flag mismatches ("point-nowhere" paragraphs). (Sch12 11; MK17 R3)
- F15 [A] Each paragraph has one point. Flag paragraphs with two. (Sch12 10.2; GS90)
- F16 [S+A] Topic string: for each paragraph, extract the grammatical subjects of the sentences; flag paragraphs whose subjects fall into more than two unrelated groups. (WB17 L5)
- F17 [S+A] Linking: the first sentence of paragraph n shares a content word or idea with the end of paragraph n–1. Script flags no overlap; agent judges. (Sch12 13.1)
- F18 [S+A] Connectives: count "however/therefore/thus/moreover/hence" (flag more than about 3 per page, WB17 L5); agent checks each one's stated relation is true.
- F19 [S] Subject–verb distance: with a dependency parser, flag more than about 10 words between subject head and main verb. (GS90; Sch12 12.4)
- F20 [S] Sentences with more than about 8 words before the subject ("throat-clearing"). (WB17 L5)
- F21 [S] Nominalization density per 100 words (-tion, -ment, -ance, -ence, -ity) and "performed/conducted/carried out" + noun. Flag outliers within the document. (WB17 L3; Sch12 14.3; Pin14 ch.2)
- F22 [S] Metadiscourse patterns: "we found that", "it is important to note", "it should be noted", "as shown in Figure", "this section", "in this paper we" counted per page. (Sch12 16.5; WB17 L9; Pin14 ch.2)
- F23 [S] Hedge and intensifier density ("may", "might", "seem", "appear", "possibly", "somewhat", "very", "highly") and stacked hedges in one clause. (Pin14 ch.2; WB17 L9)
- F24 [S] Citation-as-subject pattern in the Introduction: sentences starting "Name (year)" or "Name et al." flagged. (Sch12 6.3)
- F25 [S] Do not use a sentence-length limit as a hard rule; use it only to rank candidates for the stress test. (GS90)

**Terms and numbers**
- F26 [S] Every all-caps token or abbreviation is expanded at first use, or is on an allowed list. (Sch12 15.1.2; Pin14 ch.3; MK17 R2)
- F27 [S+A] Project-private labels (run IDs, stage numbers, decision IDs, file names, parameter symbols) in the body text are flagged; each must be defined in plain words or moved to a footnote. [syn]
- F28 [S+A] One label per concept: the script builds a glossary of key nouns and flags near-synonyms used for the same thing, especially inside comparisons. (MK17 R4; Pin14 ch.5)
- F29 [S] "significant", "p <", "p =" in a sentence must come with an effect size, ratio or difference in the same sentence. (Sch12 8.2.4)
- F30 [S+A] Every number in the text traces to a table, figure or results file; the script lists numbers with no match. [syn]
- F31 [S+A] Results sentences containing inference words ("suggests", "implies", "indicates", "may reflect") are listed; the agent confirms the data precede them and they are marked as inference. (Sch12 8.2.1)

**Figures**
- F32 [S] Every figure and table is cited in the text at least once, and each citation resolves to a figure that exists. [syn]
- F33 [S] The first citation of Figure n comes before Figure n appears in the file, and figures are numbered in order of first citation. [syn]
- F34 [S] Each figure appears no later than the end of the section that first cites it, and no earlier than the paragraph that cites it. [syn]
- F35 [S+A] Each figure title is a full sentence with a verb, stating a finding (not "f–I curves for inputs A and B"). (MK17 R7)
- F36 [S+A] Each caption has: what is plotted with units, n, what error bars mean, how to read it, the point of interest. Script checks for "n =", "error bars/bands", units; agent checks the rest. (Rou14 R4)
- F37 [A] From title and caption alone, the agent states each figure's message; it must equal the message in the figure manifest, and the body text must support the same message. (Rou14 R2; MK17 R7)
- F38 [S] Plot code check: no jet/rainbow colormap, no default fonts too small to read, no 3-D or pie chart, axes labelled with units, full axis range or stated truncation. (Rou14 R5 to R8)
- F39 [S+A] The same variable, condition or colour is encoded the same way in every figure where they are compared. [syn]

---

## Where the sources disagree (summary)

1. **Conclusion first or last.** Sch12 4.2 (specialist journals: OCAR, conclusion last; lead-first can look like forcing the data) against MK17 R3 (C-C-C is default, but content-first risks scepticism), WB17 L7 to L8 (state the claim at the end of the introduction), Pin14 ch.5 (tell the topic and the point early) and Nat (state the main result in the first paragraph). Practical resolution: results preview at the end of the introduction; full conclusion at the end.
2. **Does thinking come before writing?** Sch12 ch.1 (quoting Montgomery) says clear thinking can come out of clear writing, so write to find the story. Pin14 ch.2 says classic style pretends the writer already saw the truth, though in practice everyone revises. MK17 R9 recommends formalising the logic before drafting. Resolution: outline the claim, then write, then let the writing correct the outline; ship only the revised, "already-knew-it" form.
3. **Paragraphs.** Sch12 and MK17 treat the paragraph as a unit with its own arc. Pin14 ch.5 says the paragraph break is a rest between branches, not a unit.
4. **Signposting.** Pin14 ch.2 dislikes roadmaps and "say what you'll say"; WB17 L8 asks for forecasts of themes at the end of each introduction; MK17 R6 asks for a summarising last introduction paragraph. Resolve by forecasting content, not structure.
5. **Repeating words.** MK17 R4 and WB17 L5 say repeat; Pin14 ch.5 allows a more generic stand-in in quick succession, but never inside a comparison.
6. **Combined or separate Results and Discussion.** Sch12 8.2.1 says either; MK17 assumes separate.
7. **Active or passive.** All four agree the passive is a tool. Pin14 ch.2 and WB17 L12 are harder on passives that hide the actor; Sch12 14.1.2 defends the passive for work done by unnamed helpers and for avoiding an awkward self-reference.
8. **Hypothesis versus question.** Sch12 7.1 says a question is the core and a hypothesis is optional (field culture decides). MK17 R5/R6 mention an open question or an untested hypothesis interchangeably. Use the question, add a hypothesis if the field expects one.
9. **Hedging.** Pin14 ch.2 distrusts hedges as a habit; WB17 L9 treats them as a signal of calibrated character; Sch12 9.2.3 forbids them as the last word. Hedge by choice, once, and give the reason.

## Most important 15

Ranked for a draft that is already competent but reads like a lab report. The typical symptoms are chronological order, no stated question, results with no stated meaning, project labels as subjects, figures with no message, and an ending that lists limitations.

1. **Write the one-paragraph message first and put its claim in the title (A1, A2).** Without it every other fix is cosmetic.
2. **Order the paper by the argument, not by the work log (B1, B2).** The commonest cause of "reads like a lab report".
3. **State the question and the gap with its cost ("So what?"), not a list of objectives (A6 to A8).** It converts a record of work into a story with a stake.
4. **Make each result a claim: a declarative header, then question, evidence, answer (B3, B8).** Readers see the premises of the argument in order.
5. **Give every section, subsection and paragraph an opening that ends in its point and key terms (B14, C1).** The whole paper becomes skimmable, and the point is never at the end of a page of detail.
6. **End with a resolution that answers the question and ties it back to the opening. Do not end on limitations or "more work" (B13, A10, A15).** Readers keep what they read last.
7. **Answer the reader's questions where they arise, with the claim-question ledger and explicit logical connectives (A12, C12, E6).** This is the cure for "explanations leave questions unanswered".
8. **Give every figure one message, state it in the title, write a full caption, and cite it before it appears (D1 to D4, D6).** This fixes erratic plot placement and makes figures carry the argument.
9. **Test on a reader who is not you, with specific questions (E1 to E3).** The curse of knowledge cannot be removed by effort alone.
10. **Put the old or linking information first and the new point last, and chain sentences stress-to-topic (C3, C4, C9).** Most of the "flow" in a draft comes from this.
11. **Make characters the subjects and actions the verbs; replace nominalizations and fuzzy verbs (C6, C7).** This removes most of the dense-report feel.
12. **Define terms; remove project-private labels, run IDs and undefined abbreviations from the body (C14, F26, F27).** Private labels are the agent's version of jargon.
13. **Separate data, inference and interpretation, and give amounts with statistics, not "significant" alone (A13, B9, B10).** This is also what makes the claims credible.
14. **Write a complete abstract and a funnelled introduction that ends with the results preview (B4, B6).** Most readers will meet little else.
15. **Cut metadiscourse and calibrate hedges, and keep who-did-what in the open (C16, C17, C8).** It removes padding and fixes the tone of overclaiming or timidity.
