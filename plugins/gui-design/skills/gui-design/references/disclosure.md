# Layered disclosure for any GUI

**Three most important rules**
1. Put on screen only what most users need most of the time; everything else sits one labelled gesture away. Presence on the first screen *is* the signal "this matters" (NN/g, Progressive Disclosure).
2. At most two disclosure levels inside the tool (first screen, then one secondary level). A third level means the feature is too complex; simplify or chunk it, do not nest deeper (NN/g, Progressive Disclosure; Pajamas, Progressive disclosure).
3. Hiding must never remove capability or hide state that matters: every collapsed thing shows a visible hint of what is inside, and anything urgent (error, running job, destructive state) is never hidden (NN/g, Complex Apps #6, #8).

Items marked *(working default)* are numbers I propose; the sources give no figure. Everything else is from the cited source.

---

## 1. The three layers

| Layer | Reached by | Holds | Typical widgets |
|---|---|---|---|
| 1. Always visible | nothing | The answer or main object, the 1-3 controls used almost every time, current state/status, the primary action | headline number, chart, table, 1 primary button, a few key inputs |
| 2. One gesture away | one click/hover/focus, without leaving the screen | Secondary options, precise values, per-item details, explanations of a term, less common settings | expander, popover, tooltip, tab, drawer, row-expand, "Advanced" section |
| 3. Elsewhere | navigating away (page, dialog, docs, log file) | Rare, specialised or bulky material: full spec, raw data, long logs, full documentation, expert flows | detail page, modal, docs link, "Open log" |

Why the split exists: most users never need layer 2, so they avoid its complexity; experts avoid scanning past options they rarely use (NN/g, Progressive Disclosure). Layer 3 is not a third nested level. It is leaving the tool and does not count against the two-level limit. Reach it only from a labelled link in layer 2 (or layer 1 if it is a core destination).

### What goes in layer 1
- The thing the person came for: the result, the data, the status. Show the data itself, not a control panel for requesting it (Magic Ink, Show the data).
- Anything used on most visits. Decide by frequency of use, not by how easy it was to build (NN/g, Progressive Disclosure: split by frequency; if you cannot measure it, ask the owner or infer from the task).
- Everything the person needs to compare at once. Things used together with back-and-forth edits stay on one screen (NN/g, Progressive Disclosure: hotel example).
- Status that changes decisions: running, failed, stale, unsaved (NN/g, Complex Apps #8).
- One clearly primary action; secondary actions are visually lighter or in layer 2 (Pajamas, Progressive disclosure: distinguish primary from secondary).

### What goes in layer 2
- Advanced parameters, rarely changed settings, filters beyond the 1-2 common ones.
- Precision for something already summarised on layer 1: exact values on hover, row details, a definition of a term (Distill, Reducing Cognitive Load: details-on-demand; NN/g, Complex Apps #7).
- Options that only matter once a related option is on (see staged disclosure below).
- Rule: layer 2 must open **in place** or beside the context (popover, drawer, inline expand), so the person keeps the primary view and can compare (NN/g, Complex Apps #7).

### What goes in layer 3
- Full documentation, raw logs, full specification, one-off or expert flows, destructive admin actions.
- Never put something here that more than a small minority of visits need; that is the "buried" failure below.

---

## 2. Progressive vs staged disclosure: pick the right one

- **Progressive**: first screen = core features; secondary features are rarely visited; navigation is hierarchical (go down, come back). Use for settings pages, tool panels, inspectors, dashboards (NN/g, Progressive Disclosure: table).
- **Staged**: a linear sequence where each step shows only what belongs to that step; users normally do visit every step. Use only when the task splits into steps that barely depend on each other, such as a setup flow or "choose source, then options, then run" (NN/g, Progressive Disclosure: Staged Disclosure).
- Do not use staged disclosure where people go back and forth between the parts. Keep those parts on one screen (NN/g, Progressive Disclosure).
- Do not over-split. Think two screens before five: the hotel example improved by moving only the payment step off the exploratory screen (NN/g, Progressive Disclosure).
- **Conditional reveal** (a kind of staged disclosure): show a dependent option only after its parent is switched on, e.g. "Give permissions to" only after "Mark private" is chosen (NN/g, Complex Apps #6). In Streamlit: `if flag:` around the dependent widget. Keep the parent visible so the person can see that more exists.
- Wizards need an escape: let the person jump back or ahead without losing input (NN/g, Complex Apps #3).

## 3. How many levels

- Hard limit: 2 disclosure levels inside the tool. Designs with 3+ levels typically lose users (NN/g, Progressive Disclosure; Pajamas, Progressive disclosure).
- No expander inside an expander inside an expander. No tab strip inside a drawer inside a tab (extension of the rule; same reasoning).
- If you feel you need a third level: first cut features; if you cannot, group the advanced items into a few sensibly named sections so the person checks only one place (NN/g, Progressive Disclosure).
- Several secondary areas, each opened from a different control, are allowed but add controls to layer 1. Use at most a few and label each clearly (NN/g, Progressive Disclosure).
- Offer exactly one way to reach the secondary level. Several ways to the same place slow down the first screen (NN/g, Progressive Disclosure).

## 4. Signalling hidden content

- The trigger sits in a clearly visible, predictable place (NN/g, Progressive Disclosure: advanced button in a clearly visible spot).
- Label tells what is inside: "Filters (2 active)", "Advanced: scale, order, range", "Show 14 more rows". Avoid bare "More", "Options", "...", or a lone chevron, because they give no expectation of the content (NN/g, Progressive Disclosure: information scent).
- Use established controls: link, button, accordion header, "more actions" menu (Pajamas, Progressive disclosure).
- Collapsed does not mean silent: if a hidden section contains a non-default value, an error or a running process, show a count or badge on the trigger (NN/g, Complex Apps #8; the badge is my extension).
- Hover-only content is not enough on its own: also reachable by keyboard focus and click, and never the only place for critical info (Magic Ink, Tight feedback loops supports immediate visible response; accessibility reasoning is mine).
- Truncated text shows an ellipsis plus a way to the full text (Pajamas, Progressive disclosure: truncation and previews).
- Expanding shows an immediate visible change (Magic Ink, Tight feedback loops).
- Keep the person's place: opening a layer must not scroll the page or move what they were looking at.

## 5. Failure modes

### Too much visible (the "everything at once" failure)
- All options of all modes on one screen; a wall of boxes of equal weight; text blocks always open. NN/g: initial display must not hold too many options, or the truly important ones lose focus (NN/g, Progressive Disclosure).
- Uniform size and weight of everything gives one oppressive mass with no path for the eye (Magic Ink, Show the data).
- Decoration that carries no data (icons on every number, banners, boxes around boxes) hides the data; removing it makes the important thing stand out (NN/g, Complex Apps #8).
- Fix order: remove, then move to layer 2, then de-emphasise. Do not fix by shrinking fonts or squeezing panels.

### Too much hidden (the "thin" failure)
- The frequently used option needs a click every visit. NN/g: everything frequently needed must be up front so people go to the secondary level only on rare occasions (NN/g, Progressive Disclosure).
- The first screen shows controls but not the data, so nothing can be judged until a control is used (Magic Ink, Show the data; Interactivity considered harmful: interaction is navigation and costs effort).
- Capability that only exists in a hidden place nobody knows about. Fix with a labelled trigger and a hint on hover or in help (NN/g, Complex Apps #2: in-context cues).
- The first state is empty: the user must configure before seeing anything. Start with a sensible default state, or the last used state (Magic Ink, Inferring context from history: last-value prediction).
- The user cannot see detail for a number or item without leaving the page. Provide hover or expand detail (NN/g, Complex Apps #7).

### Balance rule
Keep it as simple as needed but not simpler: fewer things in layer 1, but never remove capability, only move it down one gesture (NN/g, Complex Apps #6: reduce clutter without reducing capability).

---

## 6. Tests an agent can apply to a screenshot or the code

Run these on every screenshot before declaring a view done.

1. **Five-second test.** What is the one thing this view is for? Is it the largest/most prominent item? If you cannot name it, layer 1 has no focus.
2. **Count layer-1 interactive controls** (inputs, buttons, selects, tabs). *(working default)*: more than about 7 outside a deliberate form means demote some to layer 2.
3. **Frequency audit.** List each visible control with "used on most visits? yes/no". Every "no" moves to layer 2. Every layer-2 item marked "yes" moves up (NN/g, Progressive Disclosure).
4. **Depth audit.** Starting from the first screen, count gestures to reach each feature. Common features: 0-1. Occasional: 1. Rare: 2 (a link to layer 3). More than 2 nested levels: flatten (NN/g, Progressive Disclosure).
5. **Trigger audit.** Read each collapsed header or button aloud without its content. Can you tell what is inside? If not, rename it (NN/g, Progressive Disclosure: information scent).
6. **Hidden-state audit.** Is there any error, warning, running job, non-default value or unsaved change inside a collapsed section? If yes, surface a badge or summary on the trigger.
7. **Everything-weighs-the-same test.** Squint: if all items have the same size, weight and colour, add hierarchy or remove items (Magic Ink, Show the data).
8. **Redundancy test.** Delete each decorative element in turn. If the information survives, delete it for good (NN/g, Complex Apps #8).
9. **Overflow test.** Resize to the smallest supported width. Text or numbers overflowing their box, clipped labels, or horizontal scroll inside cards mean layer 1 is too dense: reduce content, do not shrink the font. (Overflow check is mine; the cause tie to density is NN/g, Complex Apps #6.)
10. **Empty-start test.** Open the view fresh, with no input. Does it show something useful already (default state, last state, sample)? (Magic Ink, Inferring context from history.)
11. **Round-trip test.** Open layer 2, then close it. Does the primary view look exactly as before, and did the page not jump?
12. **Capability check.** Compare the feature list from the brief against what is reachable. Anything unreachable is the "too thin" failure.

## 7. Defaults for an agent writing the code

- Streamlit: main area = result; sidebar or the top row = the 1-3 common controls; `st.expander("Advanced: …")` for layer 2 (never nest expanders; Streamlit has rejected nested expanders, check the installed version); a docs/log link for layer 3; `st.popover` or `help=` for term explanations.
- Single-file HTML: `<details><summary>` for expanders (works without JS, keyboard accessible), `title`/focus tooltips for brief hints, one drawer or dialog for layer 3.
- Prefer defaults that produce a sensible first view. Persist the last used values (Magic Ink, last-value prediction).
- Let the user change a setting and see the effect immediately; avoid "apply" buttons where an update is cheap (Magic Ink, Tight feedback loops; NN/g, Complex Apps #1: preview as you set parameters).
