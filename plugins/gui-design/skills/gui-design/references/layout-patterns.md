# Layout patterns: deciding how much is visible

- Put things in three layers by how often they are needed: always visible (frequent, status), one click away (secondary), and further away (rare, setup, help). Frequency of use decides the layer, not how interesting an item is.
- Choose the container by the job (table in section 3): tabs for exclusive modules, expanders for optional extras, list plus detail for browsing, drilldown for small screens, wizard only for rare multi-step tasks.
- Every hidden thing needs a visible handle (label, chevron, "More"), and good defaults must keep the common path to zero or one click.

Source tags: DI = Designing Interfaces (3rd ed.), chapter then pattern; Few = Information Dashboard Design; RUI = Refactoring UI. "agent note" marks my own build advice, not the book's. Streamlit/HTML names are suggestions: check the installed Streamlit version before using a newer widget.

---

## 0. Layers

The layer rule (what is always visible, one gesture away, further away) is in SKILL.md section 2 and in detail in `disclosure.md`. This file picks the container for each layer. Two extra checks from Designing Interfaces: if most people open a collapsed panel every time, make it open by default (DI ch.4, Collapsible Panels); questions most people never change are not asked up front, but the screen says where to change them later (DI ch.1, Deferred Choices).

---

## 1. Page-level patterns

### Center Stage
- **Use:** one screen has one main job (a table, a viewer, a form, an editor).
- **Skip:** a screen of equal peers (use cards) or a pure settings index.
- **Build:** main content at least twice the width of its side margins and twice the height of its top/bottom ones; tools and notes in smaller panels around it. Position is flexible; size does the work. HTML: `grid-template-columns: 220px minmax(0,1fr)`; Streamlit: `st.columns([1,3])`, or a sidebar with narrow controls. (DI ch.4, Center Stage)

### Visual Framework
- **Use:** any app with more than one page or panel.
- **Build:** one set of margins, title position, section style, colours, button placement, reused on every page, defined once (CSS variables, one helper function). What stays constant fades and what changes stands out. (DI ch.4, Visual Framework)

### Titled Sections
- **Use:** much content that should stay visible at once but needs structure.
- **Skip:** when the page is still overwhelming; then hide some sections (tabs, accordion).
- **Build:** short, memorable section names set off by weight, size or colour plus white space. If you cannot name a section briefly, regroup the content. A "Miscellaneous" section means grouping failed. (DI ch.4, Titled Sections)

### Grid of Equals / Cards
- **Use:** many peer items (runs, tools, mods, files) that should look equally important.
- **Skip:** items with a clear order of importance (use a ranked list) or tabular data to compare numerically (use a table).
- **Build:** same template per card, same size, same actions in the same place. On hover or selection change colour only; never resize or move the card. Cards must scale down to a single column. (DI ch.4, Grid of Equals; ch.7, Cards)

---

## 2. Containers that hide things

### Module Tabs
- **Use:** several modules of similar height where the reader needs only one at a time.
- **Rules:** fewer than 10, preferably a handful; stable set; one- or two-word labels; selected tab clearly marked (not by colour only); never wrap tabs onto two rows; move to a left rail if they do not fit. Do not use tabs when people compare modules side by side. Tabs also group poorly inside a form; use titled sections there. (DI ch.4, Module Tabs; ch.10, intro to patterns)
- **Build:** `st.tabs([...])`; HTML `role="tablist"`.

### Accordion
- **Use:** stacked modules of different heights where people may want two open at once.
- **Rules:** allow several open; show an arrow or chevron; remember open/closed state between sessions; the lower labels can scroll off screen if panels are tall, so keep panels short. (DI ch.4, Accordion)
- **Build:** `<details>` per section; Streamlit `st.expander(label, expanded=False)` for each, and keep the state in `st.session_state` if a rerun must not close it (agent note).

### Collapsible Panels
- **Use:** optional or supporting content next to a main area; value differs by user and moment; panels unrelated to each other.
- **Rules:** one click opens, label with the module name or "More", chevron; when closed, give the space back to the main content; default open if most users open it. (DI ch.4, Collapsible Panels)
- **Build:** a "Details" or "Advanced" expander under the primary control. This is the default answer to "the interesting options are missing": put them here, closed, labelled.

### Movable Panels
- **Use:** signed-in dashboards with many modules that different users want in different arrangements.
- **Skip:** by default. Customisation costs build time and rarely pays off for a single-owner tool. Prefer fixed layout plus show/hide toggles. (DI ch.4, Movable Panels; agent note)

### Progressive Disclosure and Responsive Enabling
- **Use:** a long form or sequence where later parts depend on earlier answers.
- **Build:** show the next section only when the previous one is done (disclosure), or show all but disable the later ones (enabling). Disclosure is compact and good for short chains; enabling lets people see what is coming. Disabled controls need a visible reason ("Choose a model first"). (DI ch.4, Progressive Disclosure; Responsive Enabling; ch.2, Wizard)

### Popovers and dialogs
- **Use:** short help, a one-off input, a confirmation. Keep instructions in a user-triggered pop-up rather than on the page. (DI ch.10, Basics of Form Design; Few, 5.2.1.2)
- **Build:** `st.popover`, `st.dialog`, HTML `<dialog>`. Keep a dialog to one short task (agent note).

---

## 3. List and detail patterns

### Two-Panel Selector (split view)
- **Use:** a list of items with details; people look at one at a time; the window is wide enough.
- **Rules:** list on the left (or top), detail right (or below); one click selects; arrow keys move selection; highlight the selected row by colour and brightness; the list stays visible as a "you are here". (DI ch.7, Two-Panel Selector)
- **Build:** HTML grid with a fixed-width list; Streamlit `st.columns([1,2])` with `st.radio`/`st.dataframe` selection in the first and the detail in the second.

### One-Window Drilldown
- **Use:** narrow or small surfaces (mobile, narrow panes, terminals) where list and detail cannot sit together.
- **Rules:** a visible Back; Previous/Next links on the detail to avoid hopping back and forth. Costs: hard to compare items. (DI ch.7, One-Window Drilldown)

### List Inlay
- **Use:** a vertical list where details are short and users want to compare two or three items.
- **Rules:** click opens the row in place, click again closes; rows open independently. Too many open rows destroy the overview. (DI ch.7, List Inlay)
- **Build:** `<details>` in each row; Streamlit expander per row.

### Overview plus detail
- **Use:** a large object (long log, big chart, big table) where people need both the whole and a part.
- **Build:** a small overview with a draggable viewport box next to the detail; search results should move the view there. "Focus plus context": keep enough surrounding data visible to say where the focus sits. (DI ch.9, Navigation and Browsing)

### Very long lists
- **Build:** filter and search first; then pagination or "load more" with a count ("1 to 50 of 1,240"). Do not render thousands of rows. (DI ch.7, Pagination; ch.9, Searching and Filtering)

---

## 4. Settings, forms, wizards

### Settings Editor
- **Use:** any panel with more than a few options.
- **Rules:** random access, not a forced sequence; group under clear category names (card-sort the names); show current values at a glance, because people use settings to read them; the most-used settings first or as a shortcut strip; put a search box on top when there are many; follow the platform's place and style. Apply immediately for system-wide toggles; use Save/Cancel when changes are risky or interdependent; stay consistent within the app. (DI ch.2, Settings Editor)
- **Build:** left rail of categories (two-panel), or tabs when there is only a handful of groups; within a group, titled sections; one-line help under a control only when the label is not enough, otherwise a "?" popover.

### Forms
- **Rules:** as few fields as possible (derive what you can); group in titled sections; if long, show only the first section and reveal the others; optional parts hidden by default; one column with aligned left edges; top-aligned labels for narrow widths; mark required or optional using one rule across the app; show field width matching expected length; validate next to the field as soon as a mistake is clear, say what is wrong and how to fix it; confirm success and say what happens next. (DI ch.10, Basics of Form Design; Error Messages)
- **Input Hints:** a short example or format note below a field, shown always only when the format is non-obvious. (DI ch.10, Input Hints)
- **Build:** `st.form` groups inputs so the script reruns once on submit; Streamlit error text with `st.error` placed under the field, not in a modal.

### Wizard
- **Use:** a long or branching task that the owner does rarely and wants guided (install, import, first setup).
- **Skip:** frequent tasks, expert users, anything that can be a short form. A two-step wizard is silly, 15 steps is tedious. (DI ch.2, Wizard)
- **Rules:** Back and Next always; show where you are (step n of m); allow going back to change choices; use Good Defaults so most steps are "Next". On one page you can use numbered titled sections or progressive disclosure instead.

### Good Defaults, Deferred Choices
- **Rules:** prefill from earlier input, the previous session, the clipboard, the current time or place; do not prefill sensitive or consent-style fields; do not prefill just to avoid a blank. Let people skip questions and say where to change it later. (DI ch.10, Good Defaults and Smart Prefills; ch.1, Deferred Choices)

---

## 5. Actions

### Button Groups, Prominent Done
- **Rules:** 2 to 5 related buttons per cluster, identical size and style, except the primary one which is stronger; clusters with different scope are separated; place a cluster beside the thing it acts on (left or right; avoid the blind spot below tall lists). The commit button gets a verb label, is a real button, and sits just after the last field. (DI ch.8, Button Groups; Prominent "Done" Button)

### Hover or Pop-Up Tools, Action Panel
- **Use:** per-row actions in a list that would otherwise repeat several buttons on every row.
- **Rules:** appear instantly on hover, no animation, no layout shift; highlight the row. Hover does not exist on touch, so provide a tap target or a row menu too. Use an Action Panel (a block of grouped commands beside the selection, changing with selection) when there are too many actions for hover. (DI ch.8, Hover or Pop-Up Tools; Action Panel)

### Smart labels
- **Build:** buttons name the target: "Delete run 14", not "Delete". Disable when nothing is selected. (DI ch.8, Smart Menu Items)

### Preview
- **Use:** before an action that is slow, hard to undo, or hard to predict (bulk edit, delete many, write config).
- **Build:** show a summary or diff of what will change, with a commit button on the preview and a way to change inputs. (DI ch.8, Preview)

### Loading, progress, cancel
- **Rules:** under 0.1 s needs nothing; 0.1 to 1 s is fine without a signal; over about 1 s show a spinner or progress; over about 2 s with a result to wait for, show progress and a Cancel. State what is happening, how far along, and how to stop. Do not lock the rest of the UI. (DI ch.8, Spinners and Loading Indicators; Cancelability)
- **Build:** `st.spinner` for short, `st.progress` plus text for long; for live data add a Freeze/Pause control that visibly changes state while frozen. (Few, 8.3)

---

## 6. Data patterns

### Dynamic Queries (sliders and filters with live feedback)
- **Use:** exploring a table or chart by number ranges, categories or toggles.
- **Rules:** controls sit beside the data; the data updates as the control moves; slider for one number, two-handle slider for a range, radio/dropdown for one-of-many with "All", checkboxes for subsets, text field for exact values. Show the range ends so the control explains the data. Do not react per keystroke if it slows typing. (DI ch.9, Dynamic Queries; Searching and Filtering)
- **Build:** Streamlit reruns on change, so cache heavy work (`st.cache_data`) or gate with a form button when a rerun takes over a second (agent note).

### Datatips and Data Spotlight
- **Use:** put exact values behind hover or click instead of labelling every mark; dim the rest to spotlight one series.
- **Rules:** tip appears at the pointer, is small, dense, covers little; may link to detail; a fixed side panel works too and keeps the value visible. Use a spotlight when many lines overlap. (DI ch.9, Datatips; Data Spotlight)

### Alternative Views
- **Use:** same data needing different lenses (table vs chart, raw vs rendered, list vs map).
- **Rules:** a small switch (segmented control) not a main nav; keep selection and scroll position when switching; remember the last choice. (DI ch.2, Alternative Views)

### Zoom and pan
- **Use:** any spatial drawing whose marks can get denser than about one per 5 px (a neuron with thousands of contacts, a map, a scatter of many points). Rotation alone is not enough.
- **Rules:** wheel or pinch zooms about the pointer (the point under it stays put); shift-drag or middle-drag pans, plain drag keeps its existing job (rotate, select); double-click resets; `−`/`+` and the zoom factor sit in the view menu, and "Reset view" resets zoom too. Scale marks and line widths by about √zoom (capped), and hide labels whose anchor left the panel. Compared panes share one view. Say the gestures in the panel's subtitle or `?`. (agent note, simple_complex_v1 replay viewer, 2026-11-03)
- **Build:** keep zoom and pan in the view state and include them in the cache key of projected coordinates; register the wheel listener with `{passive: false}` so `preventDefault` stops the page from scrolling; allow the zoom in the URL hash so screenshots can show it.

### Small Multiples
- **Use:** many series that must be compared. Repeat the same small chart with identical axes and scale. Limit the count (bin if 100). Caption what varies. (DI ch.9, Small Multiples; Few, 6.2.6.3)

---

## 7. Job to pattern

| Job | Pattern | Layer for extras |
|---|---|---|
| Show current state of a tool at a glance | Center Stage + a few numbers, see dashboards.md | details in Layer 2 popover |
| 3 to 7 equal-weight groups, one at a time | Module Tabs | none |
| Many optional settings | Titled Sections for the common ones + closed Collapsible "Advanced" | Layer 2 |
| Settings across more than 7 groups | Two-Panel Selector (left category rail) + search | Layer 2 |
| Browse items, see one in detail | Two-Panel Selector (wide) / One-Window Drilldown (narrow) | detail pane |
| Compare 2 or 3 items | List Inlay or side-by-side columns | Layer 1 |
| Many peer objects (tools, runs, files) | Grid of Equals cards | row click = detail |
| Per-row actions | Hover Tools + row menu, primary action visible | Layer 2 |
| Run something slow | Preview, then Loading Indicator + Cancel | log in expander |
| First-time or rare multi-step task | Wizard, or progressive-disclosure form | Layer 3 |
| Filter a dataset | Dynamic Queries beside the data | advanced filters collapsed |
| Exact values behind a chart | Datatips | table in expander |
| Same data, different lens | Alternative Views switch | none |
| Explainer/teaching page | Titled Sections in a reading column, interactive widget beside the text; one explanation visible, definitions in popovers (agent note) | Layer 2 |
| Rarely-needed destructive action | Link-style button + confirmation dialog | Layer 3 |

## 8. Anti-patterns that cause the two failures

**Too complex**
- Everything shown at once in boxes within boxes; explanation text under every control; more than one primary button; tabs plus accordions plus dialogs on the same screen. Pick one hiding device per level.
- Two ways to do the same thing visible at once.
- Controls with no safe exit: no cancel, no undo, no back. People will not explore. (DI ch.1, Safe Exploration)

**Too thin**
- Hiding a feature with no visible handle; removing options the owner uses weekly; showing a number with no context; no way to see raw detail; no explanation anywhere. Add a labelled layer-2 handle instead of deleting.
- A tab for each of three fields. Tabs cost a click, so use them only for content that is large enough to deserve a view of its own.

**Surface limits first (agent note).** Before choosing a pattern, list the surfaces and their limits: scroll or no scroll, width, whether dropdowns open inline, hover or touch, fonts. A pattern that needs scroll, hover or a wide pane fails where those are missing; fall back to drilldown and tap targets.
