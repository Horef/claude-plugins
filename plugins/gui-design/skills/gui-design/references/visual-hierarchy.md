# Visual hierarchy: calm screens without boxes

**Top 3 rules.**
1. Decide the one thing the eye should land on, then make everything else quieter, instead of making that thing louder.
2. Build hierarchy from size, weight, colour tint and space; use a border or box only when none of those separates the groups. Pick every number from a small fixed scale.
3. Run the calm-screen checklist (section 11) on a screenshot before reporting done.

Source tags: RUI = Refactoring UI; DI = Designing Interfaces (3rd ed.); Few = Information Dashboard Design. Where a number is an adaptation of mine rather than the book's, it says "adapted". RUI shows its scales as figures that the text export lost, so the scale values below are my reconstruction that obeys the book's stated ratio rule.

---

## 1. Pick the hierarchy first

- Rank every element on the screen as primary, secondary or tertiary before styling. Give exactly one primary focus per view. A screen where everything is bold and bordered reads as noise. (RUI, Not all elements are equal; DI ch.4, Visual Flow: too many focal points dilute each one.)
- To make something stand out, first try to quieten what competes with it. Example: dim the inactive tabs instead of recolouring the active one; drop the background fill from a sidebar so the content area wins. (RUI, Emphasize by de-emphasizing)
- Do not rely on font size alone. Use weight and colour to rank text, which keeps the primary text at a sane size and the secondary text readable. (RUI, Size isn't everything)
- Text colours: three at most. Dark for primary, mid grey for secondary (dates, units, help), light grey for tertiary (footers, hints). (RUI, Size isn't everything)
- Font weights: two. Regular (400 or 500) for most text, bold (600 or 700) for emphasis. Never use a weight under 400 for small UI text; use a lighter colour or smaller size to de-emphasise instead. (RUI, Size isn't everything)
- Put the facts the owner checks every time in the top-left and centre of the view. Never spend that area on a logo, mode switches or settings buttons. (Few, 5.2.2.2; DI ch.4, Center Stage)
- Section titles are labels, not headlines. Keep them small (about body size, bold or small caps in a muted colour); the content under them should dominate. Do not let the HTML heading level set the size. (RUI, Separate visual hierarchy from document hierarchy)
- Streamlit note: `st.title`/`st.header` are large by default. For panel sections use `st.subheader` or a small `st.caption`-styled label, and do not stack a header, a subheader and a caption above one control.

## 2. Label / value presentation

- Show data without a label when the format explains it (an email, a price, a date). Add the unit into the value instead: "12 left", "3 bedrooms". (RUI, Labels are a last resort)
- When a label is needed (several similar values scanned side by side, as in a dashboard), keep the value dominant: label smaller, lighter colour or lighter weight. (RUI, Labels are a last resort)
- Flip it for spec-sheet style pages where the reader scans for the label: label darker than the value, and do not mute the value much. (RUI, Labels are a last resort)
- Right-align numeric columns so digits line up; left-align text. Do not centre numbers. (RUI, Align with readability in mind; Few, 8.1 critique of example 1)
- Round to the precision the decision needs. "$3.8M" beats cents on a monitoring view. (Few, 3.3)
- Never write a value as a bare number. Add the comparison it needs: target, previous value, or a tiny history. (Few, 3.2)

## 3. Actions: hierarchy beats semantics

- One primary action per view: solid, high-contrast fill. Secondary actions: outline or low-contrast fill. Tertiary and rare actions: styled like links. (RUI, Semantics are secondary)
- A destructive action that is not the main thing on the screen gets the quiet treatment. Make it big and red only on the confirmation step. (RUI, Semantics are secondary)
- Group buttons that act on the same thing, 2 to 5 per group; give the primary one a stronger look than its peers. Never mix actions with different scope in one row. (DI ch.8, Button Groups; Prominent "Done")
- Verb labels that say what happens ("Save settings", "Delete 3 runs") beat "OK"/"Submit". (DI ch.8, Prominent "Done" Button; Smart Menu Items)
- Navigation and data-selection controls are not data. Make them small and muted, away from the prime area. (Few, 5.2.1.2)

## 4. Spacing

- Start with too much space and remove until it looks right. Starting tight and adding just reaches "not bad". (RUI, Start with too much white space)
- Compact is allowed, but choose it on purpose (monitoring and inspection views). Decide density per view and write it at the top of the file. (RUI, Dense UIs have their place)
- Space is the cheapest separator. Increase the gap between groups before adding a line or fill. (RUI, Use fewer borders; Few, 7.1.3)
- The gap around a group must exceed the gaps inside it, or the grouping is ambiguous. For label + input: label-to-input gap smaller than input-to-next-label gap. (RUI, Avoid ambiguous spacing; DI ch.4, proximity)
- Spacing scale (adapted, in px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. No two neighbours closer than about 25%, so choosing is easy: if one step is not enough, take the next. (RUI, Establish a spacing and sizing system)
- Do not size things as a % of the window unless they should scale. Give a sidebar a fixed width; let the main area flex. Give cards and forms a max-width and shrink them only when the window forces it. (RUI, Grids are overrated)
- Do not fill the window. If the content needs 600px, use 600px and leave the rest empty. Split into columns rather than widening a form. (RUI, You don't have to fill the whole screen)
- Align related controls on one left edge and keep vertical gaps uniform inside a form. (DI ch.10, Basics of Form Design)

## 5. Type

- Type scale (adapted, in px): 12, 14, 16, 18, 20, 24, 30, 36, 48. Pick from it only. Use px or rem, not nested `em`, so computed sizes stay on the scale. (RUI, Establish a type scale)
- Body and label text: about 12pt (16px) is the usual body size and 10pt (13px) is the floor for anything people must read; footnotes can go to 9pt. For dense panels the smallest step on the scale (12px) is the limit. (DI ch.5, Size; RUI scale starts at 12px)
- One neutral sans-serif family (system font stack is fine). A second face only for headings, if at all. No ornamental or display faces in controls. (RUI, Use good fonts; DI ch.5, Typography; Few, 7.3.3)
- Paragraph width: 45 to 75 characters (about 20 to 35em). Keep prose narrow even inside a wide panel. (RUI, Keep your line length in check)
- Line-height: about 1.5 for normal narrow text, up to 2 for very wide lines, 1 for large headings. (RUI, Line-height is proportional)
- When mixed sizes share a line (title left, small actions right), align on the baseline, not the centre. (RUI, Baseline, not center)
- Left-align text. Centre only headlines or one to three short lines. All caps only for short labels, with added letter-spacing. (RUI, Align with readability in mind; Use letter-spacing effectively)
- Numbers in a table: prefer a font with tabular digits or monospace so columns align; check 0/O and 1/l are distinguishable. (DI ch.5, Numbers; agent note)

## 6. Fewer boxes, fewer borders

- Before adding a border, try in this order: more space, a slightly different background tint on one of the two areas, a soft shadow. (RUI, Use fewer borders)
- If an element already has a different background from its neighbour, delete its border. (RUI, Use fewer borders)
- Do not nest boxes. A bordered card inside a bordered panel inside a bordered page is the classic "too many boxes" failure. Maximum one level of visible enclosure per region. (DI ch.4, Titled Sections: boxes turn into noise when large, close together or deeply nested; Few, 5.2.1.1)
- Where lines remain, use light grey and thin strokes, and use the same colour and weight everywhere. Different line styles invite the reader to find a meaning. (Few, 5.2.1.2, 7.2)
- No grid lines in tables when space does the job. If rows need guidance, use a very faint row tint or a faint 1px rule. (Few, 5.2.1.1 and 5.2.1.2)
- No gradients, textures, 3D, drop shadows on bars, or photo-realistic widgets. (Few, 5.2.1.1)
- Streamlit note: `st.container(border=True)` is a box. Use it for at most one level and for real "cards" (separately actionable things). For plain grouping use a subheader plus space.
- Border radius: pick one value for the app (square = formal, small = neutral, large = playful) and never mix. (RUI, Choose a personality)

## 7. Colour

- Build the palette up front: 8 to 10 greys; one primary colour with 5 to 10 shades; a few accents (red, amber, green, plus one highlight) with 5 or more shades each. Define the shades once as variables. Do not call `lighten()`/`darken()` ad hoc. (RUI, You need more colors than you think; Define your shades up front)
- Greys: start from a very dark grey, not pure black; tint them slightly warm or cool and keep that tint consistent by adding saturation toward both ends. (RUI, Greys don't have to be grey)
- Most of the screen is grey. Colour marks what needs attention or what can be clicked. Keep bright, fully saturated colour for items that must stand out. (Few, 4.2.7, 7.3.1; DI ch.5, saturated vs unsaturated)
- Use a very pale off-white page background instead of pure white to soften contrast. (Few, 7.3.1)
- Contrast: body text at least 4.5:1, large text (about 18px+) at least 3:1. (RUI, Accessible doesn't have to mean ugly)
- Grey text on a coloured panel looks washed out. Hand-pick a text colour with the same hue as the panel, adjusted in lightness and saturation. Do not just lower opacity. (RUI, Don't use grey text on colored backgrounds)
- Dark text on a light tint of the colour instead of white text on a saturated fill keeps the colour quiet while staying accessible. Use that for badges, alerts and tags. (RUI, Accessible doesn't have to mean ugly)
- Lighter shades need more saturation than the base, or they look dull. To brighten a colour, rotate the hue toward yellow/cyan/magenta by at most about 20 to 30 degrees. (RUI, Don't let lightness kill your saturation)
- One hue, one meaning. If red means "failed" in one place, nothing else on the screen uses red. Same colour in two places signals "related". (Few, 7.1.5, 7.2)
- Do not use colour alone for status. Add a shape, an icon, a word, or a difference in lightness. About 1 in 10 men cannot separate red and green. (RUI, Don't rely on color alone; DI ch.5, Color; Few, 6.2.2.1)
- Categorical colours: at most about 5 that must be told apart quickly. Few says short-term memory cannot hold more than about 9 hues. (Few, 4.2.6)
- Accent trims make bland screens look finished with no illustration: a thin coloured top edge on a card, a coloured left edge on an alert, a short underline under a title. Use one accent colour. (RUI, Add color with accent borders)

## 8. Dark mode (derived, not a dedicated chapter in the sources)

- Define every colour as a variable per theme and re-check the 4.5:1 / 3:1 contrast in each theme; a colour that works on white (yellow, light green) often fails on off-white, and the reverse holds for dark. (RUI, Accessible doesn't have to mean ugly; agent note)
- In dark themes, raise a surface by making it lighter than the page, since lighter reads as closer. A shadow barely shows on dark, so elevation comes from lightness. (RUI, Even flat designs can have depth)
- Use a dark grey page, not pure black, and an off-white text, not pure white. (RUI, You need more colors than you think; Few, 7.3.1)
- A dark background is a good choice when large blank areas would glow too much on a tablet. (DI ch.5, Color)
- Do not invert an image or a chart by filter. Give charts their own light-on-dark palette (same hue meanings, lighter tints). (agent note)

## 9. Depth, only if needed

- Keep one shadow set of about five sizes. Small shadow for buttons and cards, medium for dropdowns, large for dialogs: the closer to the user, the larger. Choose by z-position, not by taste. (RUI, Use shadows to convey elevation)
- Flat design can still show depth: a lighter fill for raised, darker for inset; a short hard-edged offset shadow. (RUI, Even flat designs can have depth)
- Do not tinker with light-source realism. It adds noise. (RUI, Emulate a light source)

## 10. Empty states

- Treat the empty state as a designed screen: one sentence saying what will appear here, one primary action to create the first item, optionally a small illustration. (RUI, Don't overlook empty states)
- Hide tabs, filters and toolbars that do nothing until data exists. (RUI, Don't overlook empty states)
- Never show a blank panel, an empty table with headers only, or a raw "None". Name the cause ("No runs yet", "Filter hides all 128 rows. Clear filter"). (RUI, Don't overlook empty states; DI ch.1, Instant Gratification)

## 11. Make a dense screen calm: checklist

Run this on the finished screen, in order. Stop when it looks calm.

1. Squint at a screenshot. Is there one obvious first place to look? If not, quieten two other things.
2. Count font sizes (target 4 or fewer on a panel), text colours (3), weights (2), accent colours (1 plus status colours).
3. Count visible borders and filled boxes. Remove each one and see if grouping survives; keep only the ones that fail. (RUI, Use fewer borders)
4. Is any help text, description or legend always visible that is needed once? Move it behind a small "?" popover or a collapsed section. (Few, 5.2.1.2; DI ch.4, Progressive Disclosure)
5. Is any control used rarely, shown at full size? Demote to link style or hide behind a "More" menu. (RUI, Semantics are secondary; DI ch.8, Hover or Pop-Up Tools)
6. Any value without context or with excess precision? Fix (section 2).
7. Any label repeated on every row? Use a column header once or drop the label. (RUI, Labels are a last resort)
8. Squint test in grayscale: do the primary item and any alert survive when colour is removed? (DI ch.5, Color)
9. Resize narrower: does text clip or overflow its box? Fix by wrapping or truncating with a tooltip, never by shrinking the font under 12px.

## 12. Process rules that prevent rework

- Design one real feature (one panel with real data) before the shell (nav, sidebar, header). Navigation decisions need a few features to exist first. (RUI, Start with a feature, not a layout)
- Do the first pass in grey. Add colour last. Space, contrast and size must carry the hierarchy before colour helps. (RUI, Detail comes later)
- Build the simple version, look at it, then iterate in short cycles. Do not design every edge case up front. (RUI, Don't design too much)
- Do not draw UI for features you have not built. (RUI, Be a pessimist)
- Write the scales as constants at the top of the file (spacing, type, colours, radius, shadows) and use only them. (RUI, Limit your choices)
