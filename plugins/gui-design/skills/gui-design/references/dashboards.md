# Dashboards and inspection screens (Stephen Few's rules)

- Show only what the person needs to monitor or inspect, as summaries and exceptions, with context for every number, all inside one view. Everything else is one click away.
- Spend colour and weight only on what needs attention. Everything else is grey, flat, borderless, grouped by white space.
- Run the 13-point checklist (section 1) against a screenshot before reporting the screen done.

Source tags: Few = Information Dashboard Design (2006), section number; DI = Designing Interfaces; RUI = Refactoring UI. "agent note" is my build advice. Few wrote for business dashboards; the rules apply equally to a tool status panel, a mod control panel or a data inspector, with the translations in section 9.

Few's definition, in short: a single-screen display of the most important information needed to do a job, arranged so it can be taken in at a glance. If the screen is not monitored or inspected repeatedly, the weight of these rules drops, but the 13 checks still catch the usual damage. (Few, Introduction; 1.3.1)

---

## 1. The 13 mistakes as a screenshot checklist

Look at the rendered screen (not the code) and answer each. Any "yes" is a defect to fix.

| # | Question | Looks like | Fix (Few section) |
|---|---|---|---|
| 1 | Is data split over tabs/screens or does it need scrolling to see the main picture? | The key numbers sit under a fold, or each metric on its own tab, so comparison is impossible. | Put everything that must be compared on one view with no scrolling at the common window size. Detail on a separate screen is fine (3.1) |
| 2 | Is any number shown without a comparison? | "7,822" alone, or a gauge with ticks but no scale. | Add target, last period, or a sparkline; mute the context so the main number still leads (3.2) |
| 3 | Is any number too precise or detailed? | Cents, 10 decimals, seconds in a daily total. | Round to what a decision needs: "$3.8M" (3.3) |
| 4 | Is the measure the one that answers the question? | Actual and target shown when only the gap matters. | Show the variance (+9%, +$8k) directly (3.4) |
| 5 | Is the chart type wrong for the data? | Pie, bubble-area, radar, map with four regions, a graph where a lookup table is better. | Bars for comparing, lines for trends, table for exact lookup (3.5, 6.1) |
| 6 | Is variety there for its own sake? | A pie, a gauge, a bar and a radar for four similar numbers. | Same question gets the same chart type every time (3.6, 7.2) |
| 7 | Are charts badly built? | Legend you must look up, random slice order, 11 near-identical colours, 3D, heavy grid lines, bars of different colours with no meaning, paired bars far apart. | Label directly, sort by value, one colour unless colour means something, put compared bars side by side (3.7) |
| 8 | Do bar lengths lie? | Bars start at some value other than zero. | Bars always start at zero (3.8) |
| 9 | Is the layout arbitrary? | Logo and nav in the best corner, important data bottom-right, related charts far apart. | Order by importance and viewing sequence; compared items adjacent, preferably stacked so scales align (3.9) |
| 10 | Does everything have the same weight? | Every box bordered, every chart saturated, no clear first read. | Pick the one to three most important items and emphasise only those (3.10) |
| 11 | Is there decoration? | Fake dials, notebook paper, background maps, big logo, photos. | Delete it. Empty space is better than ornament (3.11) |
| 12 | Is colour used without meaning? | Many bright hues, red/green only for status, same colour meaning two things. | Section 7 below (3.12) |
| 13 | Is the screen unpleasant to look at? | Dark heavy fills, stretched charts, clashing tints. | Light off-white background, muted palette, simple layout (3.13, 7.3) |

Rules of thumb for the first read: the eye should reach the most important item first even if it is not in the biggest or brightest area; prominence must follow importance. (Few, 3.10)

---

## 2. At-a-glance rules

- Keep everything the person must see together inside one window, no scrolling, at the most common window size. People treat what is off screen as unimportant, and many never look. (Few, 3.1.2)
- Reduce the content to summaries and exceptions. A sum or average stands for a set; an exception list shows only what is out of range. (Few, 5.1.1)
- Do not go so far that only one traffic light is left. A person who owns something needs a baseline picture even when all is fine. (Few, 5.2.2.1)
- Group related data in titled sections and use tabs only when people will not need two tabs side by side; make key numbers in text stand out; simple line and bar charts beat dials, gauges and pies. (DI ch.2, Dashboard)
- Keep the number of top-level measures small. His real-time sample has just 6 and states that is plenty; a real-time view with too many measures overwhelms. His other samples run 6 to about a dozen with context. (Few, 8.3, 8.1, 8.2)
- Match vocabulary and level to the reader: weeks if they think in weeks; ratios only if they know ratios. (Few, 5.1.1)
- Keep to few "chunks": short-term memory holds about 3 to 9 chunks. A line chart can be one chunk, six separate numbers are six. Prefer graphics that bundle a pattern into one glance. (Few, 4.1)
- Never exceed about 5 distinct looks of one visual attribute (5 grey levels, 5 shapes, 5 sizes). Use simple shapes (circle, square, triangle, dash, cross). (Few, 4.2.6)
- Use the same appearance for the same meaning everywhere (axis colour, line weight, chart type, icon). A difference makes viewers hunt for a meaning that is not there. (Few, 7.2)
- Time series: put the recent past in fine detail and the far past coarser. Example: current month daily, previous 12 months monthly, previous years yearly. (Few, 5.2.2.1, multi-foci displays)
- Static layout, dynamic emphasis. Positions never rearrange with the data, so people learn where to look. Draw attention to the exceptional item by changing its colour or adding a mark, not by moving it. (Few, 5.2.2.2)
- Freeze live data on request. A pause button that visibly changes state (and reminds after a while) lets a person study a moment without the numbers moving. (Few, 8.3)

---

## 3. Grouping and arrangement

- Group by what the person does with the data: a business function, an entity (one machine, one project), or one use (compare income and cost). Ask how the data will be used before placing anything. (Few, 7.1.1)
- Put group members next to each other. Proximity is the fastest grouping cue. (Few, 7.1.2; 4.3.1)
- Separate groups by the least visible means: white space first; if tight, a faint thin rule or a very light fill. Muted lines still group strongly. (Few, 7.1.3; 4.3.3)
- Encourage meaningful comparisons: put values in one chart or table, side by side, linked by a shared colour, with ratios or variances where useful. (Few, 7.1.4)
- Prevent meaningless ones: do not use the same colour for unrelated things; space them apart. If yellow means "caution" in one chart and "June" in another, readers will link them. (Few, 7.1.5)
- Prime area: top-left and centre. Put the always-important measures there. The bottom-right gets least attention; put muted controls and secondary items there. (Few, 5.2.2.2)
- Placement guides scan direction: closer horizontally encourages left-to-right scanning, closer vertically top-to-bottom. (Few, 4.3.1)
- Emphasise the current period. Giving all four quarters equal weight when the manager cares about the current one is a defect. (Few, 8.1, critique 1)

---

## 4. What to cut

Delete in this order, then look again. (Few, 5.2.1.1)

1. Decoration and anything imitating a physical object.
2. Colour variation that encodes nothing (rainbow bars).
3. Borders and fills used only to separate sections, when white space would do.
4. Gradients, 3D, shadows on data.
5. Grid lines in charts and tables, background bands and complete frames around the plot area (keep one horizontal and one vertical axis).
6. Instructions and descriptions that are needed once. Provide a help button or popup. (Few, 5.2.1.2, 8.1)
7. Navigation and data-selection controls that take prime space; shrink and mute them. (Few, 5.2.1.2)
8. Data that does not serve the task: raw transactions, extra precision, never-used measures. Fewer data pixels raise the weight of the rest. (Few, 5.2.2.1)

Then mute what must remain (light grey, thin) and make it uniform. (Few, 5.2.1.2)

---

## 5. Choosing text, table or graph

- A single value, alone: plain text with label. Graphics only slow it down. (Few, 6.1; 6.2.3)
- Value with judgement: add a bold/colour cue; then a target; then the variance. Move to a graph only when comparisons across many items or a trend matter. (Few, 6.1)
- Exact lookup of many values: table. Shape of change, comparisons, patterns: graph. Do not use a graph for lookup or a table for trend. (Few, 6.1)
- Tables: right-align numbers; no cell grid; faint row guides only if the eye loses its row. (Few, 5.2.1.2; 8.1 critique 1)
- Compare categories: bars (horizontal bars with sorted values read best and fit labels). Time series: lines. Part-to-whole: still bars. Avoid pie, radar, bubble, 3D, and shapes whose area carries the value, since people misjudge areas and angles by a wide margin. (Few, 3.5, 4.2.5)
- Bars start at zero, always. Use a connecting line only where the points really follow one another (time); a line across unrelated categories implies a change that does not exist. (Few, 3.8; 8.1 critique 3)
- Label directly instead of a legend. Sort by value unless there is a natural order. Same unit on the same axis. (Few, 3.7)
- Map only when location carries meaning. Four regions with no spatial story belong in a table. (Few, 3.5)

### Bullet graph (replaces gauges and meters)
- One linear bar for the key measure, one short marker for the comparison (target or last year), and background bands for bad / ok / good. Bands differ in lightness of one hue, not in hue, so colour-blind readers can see them; at most 5 bands, usually 3. (Few, 6.2.1.1)
- Stack several vertically in a narrow column; the marker crossing the bar is a form people spot at once. (Few, 6.2.1.1)
- Build: HTML/SVG: a track `div` with 3 background bands, an inner bar, and an absolutely positioned marker; Streamlit: `st.progress` for a simple bar, or an Altair/Plotly layered chart; always set the axis from zero.

### Sparkline (history beside a number)
- A tiny word-sized line chart with no axes and no scale, usually 12 months or 30 days, showing the shape. Optionally a pale band for the acceptable range and a dot on the final value. (Few, 6.2.1.6)
- Better than an up/down arrow, which does not say over what period. (Few, 6.2.1.6)
- Build: Streamlit `st.dataframe` with `column_config.LineChartColumn` for per-row history; `st.metric` plus a small chart in the same column; HTML inline `<svg>` polyline of 80 to 120 px width. (agent note)

### Small multiples, tables of graphs
- Put the same small chart per item, same scale, in a grid or table, so patterns across items are visible. (Few, 6.2.6.3; DI ch.9, Small Multiples)

---

## 6. Highlighting what matters

- Emphasise by contrast with the norm, not by loudness alone: a different hue, a stronger intensity, a thicker line, an enclosing box, or an added mark next to the item all draw the eye. An added mark (dot, check, asterisk) only appears when needed, so it pops. (Few, 5.2.2.2; 6.2.2.1)
- Always-important items: use static emphasis (position, size). Only-now-important items: use dynamic emphasis (colour change, added mark) driven by the data. (Few, 5.2.2.2)
- Restrict what counts as important. If too many items are highlighted, nothing is. A good screen has zero to a few highlighted items at a time. (Few, 5.2.2.2)
- Use one colour in varying intensity for degree of urgency; colour-blind viewers can read intensity. (Few, 5.2.2.2)

---

## 7. Alerts and colour

- At most two alert levels, ideally one. One conspicuous alert type works better than several. (Few, 6.2.2.1)
- Show the alert only when something is wrong. A permanent green "OK" light draws no attention and adds noise; an item that appears only on exceptions is perceived as an added mark. (Few, 6.2.2.1)
- Use a simple shape (circle or square) for the alert; for two levels, one hue in two intensities (light red and dark red) rather than red/yellow/green, which fails for about 10% of men and 1% of women. (Few, 6.2.2.1; 3.12)
- Up/down markers: a triangle or arrow, with the bad direction a fully saturated red and the good direction a pale green, so lightness differs as well as hue. (Few, 6.2.2.2)
- Standard palette: soft, natural, muted greys, browns, blues, greens. A bold palette is kept for items that must grab attention. (Few, 4.2.7)
- Name the state in words or a shape as well as colour ("Late", "Failed"), so colour is never the only signal. (Few, 6.1 redesign; DI ch.5, Don't rely on color alone)
- Do not use red as decoration; where it appears it must mean "look here". (Few, 8.2: the only hues are muted section names plus alert red)
- Bad-state number readability: avoid a dark red fill behind the number you most need to read. Put the colour on a mark next to the number or use dark text on a light tint. (Few, 8.1, critique 1; RUI, Accessible doesn't have to mean ugly)

---

## 8. Interaction: a launch pad

- A glance screen does not need to contain everything. Provide drill-down and slicing from it. (Few, 7.4)
- Start the drill-down by clicking the data itself (a bar, a row, a number), not a separate button. Saves space and is obvious. (Few, 7.4)
- Use one consistent launch gesture across the screen. (Few, 7.4)
- Exact values on hover or click, not printed on every mark. (Few, 7.4; DI ch.9, Datatips)
- Do not fragment data that should be compared into radio-button-selected views (one quarter at a time, one product at a time). Slicing is right when the person looks at one subset at a time; wrong when they should compare. (Few, 3.1.1; 8.1 critiques 3 and 5)
- Test with real data and the real user. Present one best design, not a menu of options; fix what the use shows. (Few, 7.5)

---

## 9. Translating to our GUIs (agent note)

| Few's term | In a tool/mod panel or inspector |
|---|---|
| Key measures upper-left | Status line at the top: state, last run, count of errors, current model or file |
| Exceptions | A list of "needs attention" items shown only when it is not empty |
| Context | Previous value, limit, or sparkline next to each number |
| Alert icon | One small coloured dot plus word, only on failure |
| Launch pad | Click a row or number to open the detail drawer or a second tab |
| Instructions behind help | `?` popover or "How to read this" expander, closed |
| Freeze | A "Pause updates" toggle for auto-refreshing views |
| White-space grouping | `st.columns` with `st.divider` only if needed; sections with a small label |
| Off-white background, muted palette | CSS variables; avoid pure white and pure black |

Streamlit mapping: `st.metric(label, value, delta)` for number plus comparison (read the delta colour carefully: set `delta_color="off"` when up is not good); `st.columns` for the top strip of 3 to 6 metrics; `st.dataframe` with `column_config` (`LineChartColumn`, `ProgressColumn`) for ranked rows with sparklines; `st.expander` for detail; a small Altair chart with no grid for trends. In HTML use CSS grid, one `<table>` with no vertical rules, and inline SVG for sparklines and bullets.

## 10. Review script before reporting done

1. Render the screen at the usual window size and take a screenshot. Read it, do not infer from code.
2. Without reading, say aloud what you saw first. Does it match the item that matters most? If not, fix the hierarchy.
3. Walk the 13 checks.
4. Count: measures on the main view (aim for about 6 to 12 with context), distinct colours (grey plus one accent plus alert), chart types per question (one).
5. Search for numbers with no comparison, decorative elements, always-on instructions, grid lines, borders that white space could replace.
6. Resize narrower. Nothing may overflow, clip or overlap its box. (Few, 3.1.2; RUI, You don't have to fill the whole screen)
7. Squint or convert to grayscale. The alert and the primary item must still stand out. (DI ch.5, Color)
