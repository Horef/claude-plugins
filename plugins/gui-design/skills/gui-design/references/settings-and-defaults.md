# Settings, defaults and notices

**Summary (read this first)**
1. Design for the intermediate user: put what is used every session on screen, what is used weekly one click away, and the rare stuff two or three steps deep behind a sticky "more" expander. Never put a daily control beside a once-a-year one.
2. Remember and default instead of asking: run the command with the last or a sensible config, offer a separate "configure" path, and let the user undo or override. Every setting you add is a question you are asking; add one only if users care about the answer.
3. Don't interrupt: normal events get ambient status, not banners, dialogs or confirmations. Reserve a blocking prompt for truly irreversible or critical situations, and make everything else undoable.

Sources: Cooper et al., *About Face* 4th ed. (short name "About Face"); Podmajersky, *Strategic Writing for UX* ("Strategic Writing"). Wording rules for labels and help text live in `ux-writing.md`.

---

## 1. Pick the posture before you lay anything out

- Decide, per panel or feature, whether it is a **sovereign** surface (used for long stretches, kept open: data viewer, dashboard, run browser) or a **transient** one (opened briefly, task done, closed: a settings popover, a run picker, a small tool/mod panel). Posture is a behavioral choice, not a style choice. (About Face, Ch 9)
- Sovereign surfaces: aim at the intermediate user, use space generously (about three panes is a good ceiling), a muted palette with small accents (large colorful controls become garish after weeks), small dense controls, status in the margins, and every frequent action reachable in several ways. (About Face, Ch 9)
- Transient surfaces: one window, one view, nothing hidden. Big clear controls, labels that spell out verb plus object, no abbreviations, no secondary dialog. If you need a second dialog, the design needs review. (About Face, Ch 9)
- Transient surfaces remember their last size, position and settings, and carry no window-management chores. (About Face, Ch 9)
- A tool panel inside a bigger app is transient: do not give it tabs, nested dialogs or a wizard. If it needs those, split it into separate small panels, or move the persistent parts into a sidebar. (About Face, Ch 9, Ch 21)
- On the web, treat a sovereign app like a desktop app: one full-screen environment with panes, not page-to-page navigation. (About Face, Ch 9)
- One person's transient surface is another person's sovereign one. When you can't tell, check how often the user returns. (About Face, Ch 9)

## 2. Target the intermediate, not the first-timer or the expert

- Most users are perpetual intermediates: beginners move on quickly, and true experts are rare and drift back toward the middle. Optimize the default layout for that middle. (About Face, Ch 10)
- Do not bolt beginner help permanently into the layout. Use first-run hints or a short tour about scope and goals that fade after successful use. Exception: a surface used in a distracted or one-off way should favor the beginner. (About Face, Ch 10)
- Assume users are intelligent but busy. Explain cause and effect ("changes how many frames are skipped during replay"), not implementation internals. (About Face, Ch 10)
- Some users are tinkerers, but many are not and want to understand before clicking. Make how-to and policy information easy to find, without making it mandatory reading. (Strategic Writing, Ch 6, clarity criteria)

## 3. Decide what belongs on the page at all

Test each candidate setting in this order; drop it (or move it later) at the first "no".

1. **Can the app pick correctly 80% or more of the time?** Then pick it, show the result, and make it easy to override or undo. This beats asking every time. (About Face, Ch 8, "mostly right, most of the time")
2. **Will users actually care about the answer?** Ask only about decisions users have an opinion on. Don't expose internal knobs because they exist. (About Face, Ch 8, preference thresholds)
3. **Is it a command or a configuration?** If it is a command ("Load run", "Export CSV"), the command runs at once with the last or default configuration. Put tuning in a separate configure path. Users run a command roughly ten times per time they reconfigure it, so make them ask for configuration one time in ten, not dismiss it nine times in ten. (About Face, Ch 11, Ch 21)
4. **Is it personalization or configuration?** Decorating (theme, accent color, density) is safe. Moving or deleting persistent objects (reordering panels, removing menu items) damages navigation; offer it sparingly. (About Face, Ch 16)
5. **Does the user have to do it again next session?** If so, it is a remembered value, not a setting to re-enter. (About Face, Ch 8, Ch 12)

Do not add a setting to avoid a design decision. If users split 50/50 on an idiom (for example a side-by-side versus an overlay layout), support both idioms directly, ideally with no setting needed. (About Face, Ch 16)

## 4. Ordering and grouping

- **Order by frequency.** Things used many times a day are immediately in reach; once or twice a day, one or two clicks away; the rest two or three clicks away. Rare features are not deleted, they leave the everyday workspace. (About Face, Ch 10)
- **Then by dislocation and risk.** Anything that changes the whole layout or view goes deeper. Anything irreversible is harder to trigger by accident. (About Face, Ch 10, Ch 11)
- **Commensurate effort.** Users accept more steps for a more valuable or complex result. Simple results must stay cheap. Complex ones may take more steps if they are rare. (About Face, Ch 10)
- Design for the probable, anticipate the possible. Do not put a control used a hundred times a day next to one used once a year. (About Face, Ch 11)
- Group by the user's task or topic, one level deep. Avoid deep hierarchies: use one level of grouping plus search. (About Face, Ch 12)
- Within a group, keep related controls adjacent and write them in parallel grammar. Give each group a name so that its members need not repeat a shared word. (Strategic Writing, Ch 4, controls)
- Give every control a unique name so help text, docs and support can point at exactly one thing. (Strategic Writing, Ch 4, controls)
- Put the user-facing wording of options in the user's terms: "Most recent first / Oldest first" beats "Descending / Ascending". (About Face, Ch 12)

### Tabs, sections and dialogs

- Tabs split one facility into pieces and add excise. They fit mutually exclusive supporting panes; a settings dialog is the classic fit. Use 5-6 at most, never stacked in rows, each holding one coherent topic. (About Face, Ch 12, Ch 21)
- Prefer several smaller dialogs to one huge one. Never cascade dialog from dialog. (About Face, Ch 21)
- A "More / Less" expander is fine for the rare half. Its open or closed state must persist across sessions. (About Face, Ch 10, Ch 21)
- Primary interactions belong in the main window. Use a dialog only for rare, confusing or dangerous things, or one object's properties. (About Face, Ch 21)
- A persistent modeless properties dialog should become a sidebar or task pane; changes apply live and are undoable, with no OK button. (About Face, Ch 21)
- Modal dialogs: OK and Cancel, with labels that never change on the fly (no Cancel turning into Close). Titles use a verb for a function ("Export run data") and the object name for properties ("Run 12"). (About Face, Ch 21)

## 5. Defaults and memory

- If the user did it once and it is worth doing, the app should remember it. Use the last-used value as the next default. (About Face, Ch 8)
- Remember options until the user changes them, and never re-offer a feature they turned off. (About Face, Ch 8)
- Remember more than the last choice. With two alternating values the "last" is always wrong, so remember per context: last folder per file type, last colormap per plot kind, last filter per run set. (About Face, Ch 8)
- Avoid the blank slate. Do a "good enough" first step (default plot, default run selection) and let the user refine it. Ask forgiveness, not permission. (About Face, Ch 11)
- Offer templates, galleries or presets instead of an empty configuration form. Use a wizard only for a device-style setup or a survey, never as a general entry route. (About Face, Ch 16)
- Specials in a dropdown ("Default", "Best fit", "Auto") remove the need to remember magic values. (About Face, Ch 21)
- Do not make users re-enter settings they already gave, and do not require fields just for completeness. (About Face, Ch 12, excise traps)

## 6. Dependent options and control choice

- When an option only applies given another, **disable** it rather than hiding it, so the layout stays stable and users learn it exists. Don't move or hide toolbar items users remember by position. (About Face, Ch 12)
- Say why it is disabled, in one short hint next to it ("Needs a recording selected"). (About Face, Ch 12, Ch 15, applied)
- Checkbox: a binary choice, and its text must still make sense when checked and when unchecked. Switch: a labeled on/off in a settings list. (About Face, Ch 21; Strategic Writing, Ch 4, controls)
- Radios: two or more mutually exclusive options with one always selected; good in a rare dialog, but prefer a dropdown on a surface used daily. (About Face, Ch 21)
- Bounded input beats validation: use dropdowns, spinners, sliders and lookups so errors cannot happen. A text field that accepts units ("5 ms") should echo the parsed value back. (About Face, Ch 21)
- Don't use one button that toggles its own label (play and pause). Show the state separately, or label the action with the verb for what happens next. (About Face, Ch 21)
- Do not style read-only output like an editable field. Links navigate; buttons act. Icon-only buttons need a tooltip. (About Face, Ch 21)

## 7. Help per row

- Each non-obvious setting gets one line of hint text under or beside it saying **what it changes**, not what it is called. Details go behind a "?" popover or link; the row itself stays short. See `ux-writing.md`. (About Face, Ch 16; Strategic Writing, Ch 4, descriptions)
- Put a grey input hint inside or under a field, and a unit or example where the format is not obvious. (About Face, Ch 16; Strategic Writing, Ch 4, text inputs)
- Use empty content areas for hints and first-run configuration rather than a separate wizard. (About Face, Ch 16)
- Tooltips: about a one-second delay, a short phrase, on every icon-only control. Reference help is for intermediates and should be one click away, not blocking. (About Face, Ch 16)

## 8. Reset, undo, preview

- Provide a "Restore defaults" path at the group level (and a global one) for any personalization. Ask for confirmation only when it discards many changes that cannot be restored. (About Face, Ch 16)
- Let users preview a visual change before it commits, and make it undoable. Name the undo action ("Undo change colormap") instead of a bare "Undo". (About Face, Ch 15, Ch 16)
- Keep a "bring back all dismissed dialogs" switch so a user who clicked "don't ask again" can recover. (About Face, Ch 12)
- Make every action reversible (undo, recycle bin, archive) so that confirmations aren't needed. (About Face, Ch 21)

## 9. Cut excise

Excise is work that serves the tool rather than the task: cognitive (decoding), memory, visual (finding things) and physical (clicks, scrolling). (About Face, Ch 12)

- Navigation is mostly excise. Keep to one window with two or three views; limit adjacent panes to about three on desktop and two on tablet; avoid scrolling; avoid pages with more than two navigation areas plus one content area. (About Face, Ch 12)
- Give persistent landmarks (a stable title, current-run indicator, breadcrumb) and an overview so users know where they are. (About Face, Ch 12)
- Stylistic excise counts: decoration that makes users work out what is clickable. (About Face, Ch 12)
- Never need another window to affect the current one. Allow input wherever there is output (an editable value where it is shown) so users don't ask permission to edit. (About Face, Ch 12)
- In a sovereign surface even a small excise hurts; in a transient one more instruction is fine. (About Face, Ch 12)

## 10. Status, notices, confirmations: keep them quiet

**Most notices are noise. Count them.**

- Reflect status visually and in place, rather than reporting. Don't pop up for normal events; use ambient signals such as an icon state, a progress strip or a colored dot. Don't interrupt for minor problems either; a small status indicator is enough. (About Face, Ch 11, Ch 15)
- Modeless feedback first: inline marks, highlights, tooltips for detail, full detail on request. Make serious-trouble states extra visible because users stop watching. (About Face, Ch 15)
- Alerts that announce the obvious or the result of a requested action are pathological. Show the outcome on the main surface. (About Face, Ch 21)
- Never use a transitory dialog for an error or a confirmation. Gather background notices into one notification list or center. (About Face, Ch 21)
- A confirmation works only when it is unexpected. Routine ones get dismissed by reflex and so protect nothing. Prefer undo. Reserve a blocking confirm for truly critical, irreversible actions, and label its buttons with the verb ("Delete 3 runs", "Keep runs"), not Yes/No. (About Face, Ch 21)
- Don't confirm when the result is visible. Use a confirmation message only when the outcome is invisible or subtle, such as "Draft saved". (Strategic Writing, Ch 4, confirmation messages)
- Notifications must carry value and be urgent or time-appropriate; it is easy to overuse them, which makes users turn them all off. Plan how many a user could get per hour, and offer controls to limit them. (Strategic Writing, Ch 4, notifications)
- Long processes: give feedback once an operation exceeds about one second. Show alive and normal, how far along, and how much is left; offer Cancel (undoing partial work) and maybe Pause; show the progress in the main window when the process belongs there. (About Face, Ch 21)
- Positive feedback beats negative; silence for a failed minor action is acceptable. (About Face, Ch 21)

### Errors

- Most errors are the app's failure, not the user's. First **make the error impossible** (bounded widgets, lookups, autofill, remembered lists). (About Face, Ch 21, errors)
- Then **accept and reconcile**: let the input in, flag it modelessly (underline, highlight, hint), and keep a trail so it can be audited later. Flag missing data with inline marks, not a blocking stop. (About Face, Ch 21, errors; Ch 12, data entry)
- Clamp out-of-range numbers and show an inline hint explaining the substitution. (About Face, Ch 21)
- A blocking error is a last resort: polite, saying what happened, its scope, what the app did by default and what data (if any) was lost, plus buttons to fix it. (About Face, Ch 21)
- Three severities by interruption: inline (fix the field), detour (a different route to the goal), blocking (the way is closed; say when it might reopen). Choose the least interruptive that works. (Strategic Writing, Ch 4, errors)

## 11. Before you ship: checklist

- [ ] Each setting passes the section 3 test, and the page holds no knob the app could infer.
- [ ] Frequent items are visible; rare ones sit behind an expander with a remembered state.
- [ ] Every setting has a remembered or sensible default, plus a way back to defaults.
- [ ] Dependent options are disabled with a reason, not hidden.
- [ ] Rows have one short "what it changes" line; long detail sits in a "?" popover.
- [ ] No more than about three panes or three nested levels; tabs (if any) under six.
- [ ] Routine events produce ambient status, not toasts, banners or modals.
- [ ] Every destructive action is undoable, or confirms with a verb-labeled button.
- [ ] A progress and cancel path exists for anything slower than one second.

## Before / after (invented, scientific-tool UI)

**Replay panel.** Before: a modal "Replay settings" with 14 fields in two tabs, a "Replay started" toast, and a "Replay finished, are you sure you want to close?" confirm. After: Play, Speed and a run picker on the panel; Start, Stop and loop under a "More" expander that stays open once opened; the status strip reads "Replaying run 12 at 2×"; closing mid-run just stops and offers Undo. The panel posture is transient, so one view and no nested dialogs. (About Face, Ch 9, Ch 21)

**Filter defaults.** Before: every launch opens an empty filter form with all fields required. After: reopen with the last filter per run set, preselect "Last 7 days", and let an unfilled field mean "any". (About Face, Ch 8, Ch 12)
