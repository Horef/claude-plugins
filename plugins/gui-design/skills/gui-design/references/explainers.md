# Building interactive explainers and visualisations for other people

**Three most important rules**
1. An explainer is an explanation first and a widget second. The page must be readable and correct with zero interaction; controls are for readers who want to go deeper, and the author guides them with a starting state and prompts. A bare sandbox that says "figure it out" is not an explanation (Victor, Explorable Explanations: Explanation section).
2. Every control must visibly change the picture and the numbers right away, and each view makes one idea about one mechanism (Victor, Explorable Explanations: Intuition; Magic Ink, Tight feedback loops).
3. Not everything needs to be interactive. If a control would go unused or distract, use a static figure (Distill, Challenges for Authoring Interactives).

Source note: Distill describes what published interactive articles do and what research says; it gives few hard rules. Rules here that go beyond it are marked *(inferred)*.

---

## 1. Decide what the view is for (before any code)

- Write the one-sentence idea the view should leave in the reader's head. If it needs "and", make two views. *(inferred; consistent with Distill, Segmenting: complex material split into bite-sized parts)*
- Write down the questions a curious reader will ask ("what if this were larger?", "where does it break?"). Each control exists to answer one such question (Victor, Explorable Explanations: Reactive documents; "active reader asks questions, considers alternatives").
- Decide the reader: skimmer, casual reader, curious reader, engaged reader. Design so each gets something: skim = headings and the main figure; casual = text as is; curious = nudge the author's examples; engaged = explore own scenarios (Victor, Explorable Explanations: Modeling).
- Check the cost: interactives are far more work than static figures and are only worth it when behaviour over a parameter range is the point (Distill, Challenges for Authoring Interactives; Victor, Explorable Examples: two static examples tell little about dynamic behaviour).

## 2. Controls that matter

- Expose only parameters that change the story. Everything else is fixed or in a "more parameters" layer 2 (see disclosure.md). Distill's flocking example exposes seven sliders in a single sandbox, which is the upper range of what a reader tolerates; start with the one or two that matter, then reveal more *(inferred)*.
- Controls sit next to the thing they change, or are embedded in the sentence that states the assumption, so the reader never travels between control and result (Victor, Reactive Documents: adjustable values inside the text).
- Make the way in cheap: click-and-drag on the number or a slider, not a form with a submit button (Victor, Reactive Documents: Modeling; Magic Ink, Tight feedback loops: no submit buttons).
- Mark interactive things so they are discoverable but not screaming: a consistent style (underline, colour) for the "adjustable" words, no big banners demanding attention (Victor, Explorable Examples: Explanation).
- Use controls that fit the quantity: places on a map, dates on a calendar, ranges on a bar the reader can drag, rather than generic drop-downs (Magic Ink, Graphical manipulation).
- Label each control with name, current value and unit. Slider ranges must keep the system in meaningful territory, with endpoints where something interesting happens *(inferred)*.
- Make it possible to reset to the author's starting state in one click *(inferred; supports Victor's guided-structure rule)*.

## 3. Live readout

- Update on input (while dragging), not on release or on a button (Magic Ink, Tight feedback loops; NN/g, Complex Apps #1: preview updates as parameters are set).
- Show the resulting numbers as well as the picture. The readout sits in or next to the graphic, and the prose that states conclusions also updates, so text and figure never disagree (Victor, Reactive Documents: consequences reflected in the following paragraph).
- Show exact values on hover or select (details-on-demand); keep the overview uncluttered (Distill, Reducing Cognitive Load: tooltip pattern; Visual Information-Seeking Mantra: overview, zoom/filter, then details).
- If an input has no visible effect, the reader cannot tell if it worked. Every interaction must produce a discernible change; if the effect is small, add the numeric readout (Magic Ink, Tight feedback loops).
- Respond in under about 100 ms (CLIG, Robustness: print something in <100ms; same perceptual reason), and if a computation is slower, show a "computing" state rather than a frozen picture.

## 4. Show the mechanism, not only the outcome

- Add a view of how the result arises (components, intermediate quantities, the rule being applied), next to the result. A model simulated for real is more honest than a plotted formula, and exposes where an approximation fails (Victor, Explorable Examples: Intuition and Trust).
- Use several representations of the same state side by side (e.g. time view, frequency view, parameters, table). Each gives a different insight and together they build intuition; keep them linked so changing one moves all (Victor, Explorable Examples: six representations; Distill, Making Systems Playful: multiple representations).
- Link text and graphic by hover/highlight: hovering a term highlights its part in the figure or equation, and the reverse (Distill, Reducing Cognitive Load: Colorized Math Equations example).
- For notation or jargon, offer a toggle that reveals what each symbol means, only when needed (Distill, Reducing Cognitive Load: notation toggle).
- Make the author's assumptions visible and editable where the claim depends on them (Victor, Reactive Documents: Transparency).

## 5. Presets that reach the interesting regime

- The starting state is chosen by the author to show the central behaviour at first glance, not zero/default values where nothing happens (Victor, Explanation: the author "holds up their end of the conversation"; *(inferred)* for presets).
- Provide 2-4 named presets ("typical", "unstable", "extreme case") as buttons or links in the text. Each preset is the fastest way to show one finding; the reader can then nudge from there (Victor, Explorable Examples: author gives example cases, reader moves beyond them).
- Mention what to try: write the question into the prose next to the control ("Slide Q down; what happens to the peak?"). Readers who are asked to predict first remember more: where it is cheap, ask for a guess before revealing the answer, then show the actual value (Distill, Prompting Self-Reflection: you-draw-it).
- Presets and the default state must be tested at the extremes of each control for broken or empty output *(inferred)*.

## 6. Scaffolding and guided first state

- First paint is complete: a finished, labelled figure with the headline result, not an empty canvas awaiting input (Magic Ink, Inferring context from history; Victor, Explanation).
- Do not teleport the reader into a separate "interactive mode": the same text and figure they just read become adjustable (Victor, Explorable Examples: Explanation).
- Order things: claim, figure in its starting state, one control, reveal more controls only as needed. Stage in small segments the reader can take at their own pace (Distill, Personalizing Reading: Segmenting; Distill, Reducing Cognitive Load).
- Use layered detail: summary text visible, deeper explanation on request (stretch text, tooltips, "show derivation") (Distill, Reducing Cognitive Load: Text).
- If the reader's own situation can be entered (location, profession, own numbers), offer it as an optional input with a default so the view is complete without it (Distill, Personalizing Reading).
- Optional: after a prediction prompt or quiz question, show the correct answer with feedback (Distill, Prompting Self-Reflection: testing effect).

## 7. Small multiples vs animation

- Use **small multiples** (several static panels with different parameter values side by side) when the question is "compare these cases" or "which value gives X". Still images are better for specific comparisons (Distill, Connecting People and Data: the Muybridge example).
- Use **animation or a scrubber** when the point is a transition, causality, uncertainty or a process that unfolds in time. Give the reader play/pause and scrub control; never autoplay in a loop without a stop (Distill, Connecting People and Data; Segmenting: reader sets the pace).
- Combine both: a live main view plus a few frozen small multiples showing the author's preset cases (Distill, Connecting People and Data: complementing views).
- Evidence on scroll-driven vs step-by-step layout: no difference in engagement; one study found better comprehension for step/slideshow style on desktop. Default to a visible stepper or normal scrolling with figures the reader can pause *(Distill, Connecting People and Data)*.
- Unit-level views (one mark per person/item) make data feel real, but animation of thousands of items adds weight; use it only when it carries meaning (Distill, Connecting People and Data).

## 8. What Distill says goes wrong

- Interactivity that is distracting, or functionality that goes unused, with the author's time wasted (Distill, Challenges for Authoring Interactives).
- Interactive pieces break or become inaccessible over time due to changing web technology; prefer few dependencies, pin versions, and for single-file HTML keep everything inline (Distill, Challenges / Critical Reflections).
- Must work on narrow screens and weak connections; heavy visuals slow page load (Distill, Challenges / Critical Reflections: house style, load time, mobile and desktop legibility).
- Accessibility is an open problem: do not rely on colour alone, mouse hover alone, or audio/animation alone. Give text alternatives and a way to read the same numbers (Distill, Challenges).
- Authors often skip design guidance (where interactivity helps, what makes it memorable); decide this deliberately per view (Distill, Challenges).
- Dumping the reader in a sandbox without structure (Victor, Explorable Examples: Explanation).
- Dishonest or unexamined models: show the assumptions and data sources (Victor, Reactive Documents: Transparency).

---

## 9. Agent checklist (run before delivering)

**Purpose**
- [ ] One sentence states the idea; the view demonstrates only that.
- [ ] A static fallback reads correctly (title, caption, headline numbers, units).

**Controls**
- [ ] 1-3 controls visible at first; extras in a labelled secondary area.
- [ ] Each control's name, value and unit are visible and it is adjacent to its effect.
- [ ] Updates happen live while dragging; no "Run" button for cheap computations.
- [ ] Reset button restores the author's starting state.
- [ ] Extremes of every control were tried: no NaN, empty chart, overflow, or layout jump.

**Readout and mechanism**
- [ ] Key numbers update with the picture; any prose conclusion that depends on them updates too.
- [ ] A second view or breakdown shows why the result changes.
- [ ] Hover/focus shows exact values; terms link to their part of the figure.

**Starting state**
- [ ] First paint is finished, labelled, and shows the interesting regime.
- [ ] 2-4 presets reach the other interesting regimes; each is named by what it shows.
- [ ] The text tells the reader what to try.

**Form**
- [ ] Small multiples for comparison; animation only for process, with play/pause/scrub.
- [ ] Works at narrow width; no text overflowing its box; fonts not shrunk to fit.
- [ ] No information carried by colour or hover alone.
- [ ] Self-contained and loads fast (inline assets, pinned libraries).

**Honesty**
- [ ] Model assumptions and data sources are visible; approximations are labelled as such.
