# UX writing for tool and data UIs

**Summary (read this first)**
1. Every piece of text has one job: tell the user what they can do or what just happened. Verb-first, in the user's own words, as short as the meaning survives: buttons 1-2 words, labels a noun phrase, hints and descriptions about 3 lines or fewer and about 40 characters wide.
2. Say what a control *changes* or what a state *means*, never restate the name. Put units, formats and an example where the input is ambiguous; give each state an exact name used everywhere.
3. Errors and empty states are instructions ("To do X, do Y"), not verdicts: no blame, no "invalid", no internal jargon, and always a way forward or a plain statement that there is none.

Sources: Podmajersky, *Strategic Writing for UX* ("Strategic Writing"); Cooper et al., *About Face* 4th ed. ("About Face"). Layout, grouping and when to show notices at all live in `settings-and-defaults.md`.

---

## 1. Five rules that apply to every string

1. **Purpose first.** Before writing, state what the user is trying to do at this spot and what the app needs from them. Draft long, then cut. (Strategic Writing, Ch 5, purposeful)
2. **Cut to the core meaning.** Nobody opens the app to read it. Try several word orders; the idea that matters most goes last in a long sentence, or first so it is scanned. (Strategic Writing, Ch 5, concise)
3. **Keep it human.** After cutting, read it aloud as the app "talking" and the button as the user "answering". If it sounds robotic, add back words. (Strategic Writing, Ch 5, conversational)
4. **Check clarity last.** Use the words the user already uses, even in a specialist tool; choose simple common words; avoid idioms and metaphors, which don't translate. (Strategic Writing, Ch 5, clear)
5. **Edit in place.** Judge text on the real screen, where wrapping and hierarchy change how it reads. (Strategic Writing, Ch 5, intro)

### How short

| Element | Target |
|---|---|
| Button | 1-2 words, never more than 3 (Strategic Writing, Ch 6, concise) |
| Label | A noun or adjective phrase, usually under 4 words |
| Hint or description | 3 lines or fewer, about 40 characters wide as a good scanning width; no more than about 50 (Strategic Writing, Ch 4, descriptions; Ch 5; Ch 6) |
| Tooltip | One short phrase (About Face, Ch 16) |
| Status line | One short clause, present tense or present continuous |
| Reading level | Below about 7th grade for general users; below 10th for professional ones. Measure with a readability calculator, adding a period to bare fragments first (Strategic Writing, Ch 6, accessible) |

If text will be localized, plan for only half to two-thirds of the space for English, since other languages run longer. (Strategic Writing, Ch 5, concise)

## 2. Buttons and actions

- Label with a verb that names the result, then the object only if it is ambiguous: "Load run", "Export CSV", "Pause replay". Not "OK", "Submit", "Yes". (Strategic Writing, Ch 4, buttons)
- The button should echo the title or dialog heading it belongs to, so a user who reads only the button still succeeds. (Strategic Writing, Ch 4, titles and buttons; errors)
- Put the key value on the button when a number matters: "Delete 3 runs", "Export 12,480 rows". (Strategic Writing, Ch 4, buttons)
- Order: the primary action first or most prominent. In menus and lists, nouns are fine, but each entry must be distinct. (Strategic Writing, Ch 4, buttons)
- A button that flips its label as state changes (Play/Pause) misleads; show the state separately or label the next action. (About Face, Ch 21)
- A button for an action with a hard-to-reverse result says exactly what will happen ("Delete 3 runs"), and its cancel twin does too ("Keep runs"). Never change the label of Cancel to Close dynamically. (About Face, Ch 21)
- "Next" or "Continue" on the step that actually commits is misleading; name the commitment ("Start analysis"). (Strategic Writing, Ch 6, unambiguous results)
- Links navigate; buttons act. Icon-only buttons get a tooltip and an accessible name. (About Face, Ch 21; Strategic Writing, Ch 6, accessible)

## 3. Titles and headings

- A page or panel title is a noun phrase naming the context ("Replay") when it hosts several tasks, or an imperative verb ("Choose a run") when it hosts a single task. (Strategic Writing, Ch 4, titles)
- A dialog title: verb for a function ("Export run data"); the object name for properties ("Run 12"). (About Face, Ch 21)
- Use sentence case consistently unless an existing UI already uses title case; decide once and apply it everywhere. (Strategic Writing, Ch 2, capitalization)

## 4. Labels and controls

- A label names a thing with a specific noun phrase: "Sampling rate", not "Rate" or "Option 3". No jargon the user does not already use. (Strategic Writing, Ch 4, labels)
- Plan for dynamic values: specify number, date, unit and sign formats, and test with the longest and the empty value. Avoid short prepositions that translate badly. (Strategic Writing, Ch 4, labels)
- **Checkbox and switch text names a thing and must make sense checked and unchecked**: "Show gridlines", not "Hide gridlines" and not "Gridlines on/off" duplicated. (Strategic Writing, Ch 4, controls; About Face, Ch 21)
- Group related controls under one heading and drop the repeated word from the items: heading "Smoothing", items "Window size", "Method". (Strategic Writing, Ch 4, controls)
- Keep grammar parallel in a group (all noun phrases or all verb phrases) and give each control a distinct name, so help can point to one of them. (Strategic Writing, Ch 4, controls)
- Map to the user's words: "Most recent first / Oldest first", not "Descending / Ascending". (About Face, Ch 12)
- Same concept, same term, everywhere: a "run" is never also a "session" or a "trial" in another panel. Keep a small term list in the repo and grep for violations. (Strategic Writing, Ch 6, terminology; Ch 8)
- Every icon, field and image needs text a screen reader can say, and two controls must never share the same spoken name (ten "Bookmark" buttons are unusable). (Strategic Writing, Ch 6, accessible)

## 5. Text inputs, units and numbers

- If the value is known and likely right, **prefill** it instead of showing a hint. (Strategic Writing, Ch 4, text inputs)
- Otherwise: a visible label outside the field plus a hint inside. The hint can be an example ("e.g. 250"), a verb-first instruction ("Enter a time in seconds"), or the success rule ("0 to 1000 ms"). Pick the form that is clearest, even if it differs from the neighbor. (Strategic Writing, Ch 4, text inputs)
- Don't make hint-only fields: the label vanishes when typing starts. Beware hint text that looks like a prefilled value (use a lighter color, or an example prefix). (Strategic Writing, Ch 4, text inputs)
- Show the **unit** beside the field or in the label every time ("Duration (s)", or a "ms" suffix). If the field parses units ("5 ms"), echo the parsed result back. (About Face, Ch 21)
- Show numbers with context: "22% of 4 GB" plus a small bar beats a bare "0.88". Use one precision per quantity across the UI. (About Face, Ch 11)
- Specify the minus sign style, date format and thousands separator once and reuse them. (Strategic Writing, Ch 4, labels)
- When a typed value is out of range, clamp it and say so inline: "Set to the maximum, 500". (About Face, Ch 21)

## 6. Help text under a control: say what it changes

Don't restate the label. Describe the effect, in the order the user will experience it. Verb-first or an outcome clause works best.

- Pattern: **what changes** + (when useful) **when it takes effect** or **the consequence for results**.
- Put the common case in the line; send the rare or long explanation behind a "?" popover or a "Learn more" link. (Strategic Writing, Ch 4, descriptions)
- Avoid asterisks and fine print; they cost trust. Offer the full rules as an optional action instead. (Strategic Writing, Ch 4, descriptions)
- Sequence instructions in the order users do them: "In Settings, turn on Location", not "Turn on Location in Settings". (Strategic Writing, Ch 6, conversational)
- Chunk to about 3-6 words per scanned line and a block of no more than about 3 lines. (Strategic Writing, Ch 4, descriptions)

| Before (restates the name) | After (says what it changes) |
|---|---|
| Smoothing window: sets the smoothing window | Averages each point with its neighbors; larger windows hide fast changes |
| Downsample: enables downsampling | Plots every 10th sample; faster, but short spikes may disappear |
| Normalize: normalizes data | Scales each trace to 0-1 so runs with different gain can be compared |
| Lock axes: locks the axes | Keeps the same axis range when you switch runs |

### Tooltips and "?" popovers

- Tooltips: about a one-second delay, one short phrase, mandatory on icon-only controls ("Step forward one frame"). (About Face, Ch 16)
- A "?" popover is for the second sentence: why, when, trade-off, a link to the full docs. It never holds the only explanation of something the user must understand to proceed. (Strategic Writing, Ch 4, descriptions; About Face, Ch 16)
- Don't make tooltips the sole carrier of a label for a text-able control; keyboard and touch users won't see them. (Strategic Writing, Ch 6, accessible)

## 7. Status, transitions and confirmations

- **In progress**: present continuous with an ellipsis and a specific verb, no action needed: "Loading run 12…", "Decoding frames…", not "Please wait". (Strategic Writing, Ch 4, transitional text)
- **Done**: past tense of the *same verb*, short: "Run 12 loaded", "Export saved". Use only when the outcome is otherwise invisible or subtle; a visible change is its own confirmation. (Strategic Writing, Ch 4, confirmation messages)
- When something follows after done, say what and when: "Export saved. Files appear in your Downloads folder." (Strategic Writing, Ch 4, confirmation messages)
- Name states with one fixed vocabulary and show the state, not the history: "Replaying", "Paused", "Ready", "Needs recording". Define the set once; use the same words in the title bar, status strip and tooltips. (Strategic Writing, Ch 6, terminology; About Face, Ch 15)
- Show progress as proportion, with a time hint after about a second: "Decoding 4,200 of 12,000 frames · about 20 s left". Give Cancel. (About Face, Ch 21)
- A verification message states what was checked and the result: "Checked 12,480 rows; 0 gaps" over "Verification successful". Quote the quantity, not "OK".
- Silence is fine for routine success when the screen already shows it. (About Face, Ch 11, Ch 21)

## 8. Empty states

- Say how to fill it, in the form "To do X, do Y", with the first step as a button when you can: "To compare runs, pick two in the list" + [Choose runs]. Not "No runs selected". (Strategic Writing, Ch 4, empty states)
- Make clear the emptiness is expected and not a failure. (Strategic Writing, Ch 4, empty states)
- Distinguish "nothing exists yet" (teach the first step) from "filter hides everything" ("No runs match 'rat-12'. Clear the filter") and from "failed to load" (an error with a retry). (About Face, Ch 16; Strategic Writing, Ch 4, errors)
- Use empty areas for first-run hints and starter content, not a modal tour. (About Face, Ch 16)

## 9. Errors

- Ask first whether the error can be made impossible or the input can be accepted and flagged (see `settings-and-defaults.md`, section 10); write a message only for what remains. (About Face, Ch 21)
- Instruct, don't blame. Verb-first and brief: "Enter a 10-digit number" rather than "Invalid input". Avoid "invalid", "illegal", "failed" and "you must". (Strategic Writing, Ch 4, errors)
- Choose the least interruptive form: **inline** (next to the field, short instruction), **detour** (instruction first, then reason, then a single button that does the fix, and that button repeats the instruction), **blocking** (say the way is closed and under what condition it reopens). (Strategic Writing, Ch 4, errors)
- Instruct, then explain, then repeat the action: the title is what to do, the body is a one-line reason, the button is the same verb. (Strategic Writing, Ch 4, errors)
- For professional or work tools, add concrete detail the user can use: the file name, the line or row, the value that was refused, whether any data was lost, what the app did by default. This answers "did I do something wrong, and is there more I should do?" Don't expose stack traces or internal IDs unless they help the user move forward (put those behind "Details"). (Strategic Writing, Ch 4, errors; About Face, Ch 21)
- Apologize only when the loss is the app's doing and the voice allows; never apologize for the user's input. (Strategic Writing, Ch 4, errors)
- If the user cannot move forward, say so plainly and name what they can do elsewhere. (Strategic Writing, Ch 4, errors; Ch 6)

| Before | After |
|---|---|
| Error: invalid recording path (code 0x2A) | Can't open this recording. Choose a folder that contains a .rec file. [Choose folder] |
| Replay failed | Replay stopped at 00:42 because the next frame is missing. Resume from 00:41, or pick another run. [Resume] [Pick run] |
| Parameter out of range | Value set to 500, the maximum for Window size |

## 10. Notifications (when you really need one)

- Title starts with the verb for the action needed; the description holds only nice-to-have detail. (Strategic Writing, Ch 4, notifications)
- State why it is worth interrupting now, and give the first action ("Run 12 finished. Open results"). If it is not urgent, it belongs in a list or status strip. (Strategic Writing, Ch 4, notifications; About Face, Ch 21)
- Plan how many one user can receive in a day, and give controls to limit them. (Strategic Writing, Ch 4, notifications)

## 11. Voice

- Voice is the stable way the product talks (word choice, how verbose, grammar, punctuation, capitalization); tone is how it flexes for an error versus a success. Same voice everywhere, tone varies. (Strategic Writing, Ch 2)
- For a research or tool UI: plain, calm, specific. Prefer concrete nouns and numbers to adjectives ("12,480 rows"); no exclamation marks in routine messages, no humor in errors, no emoji. (Strategic Writing, Ch 2, concepts, vocabulary, punctuation)
- Write one short voice note for the repo (vocabulary, verbosity, punctuation, capitalization) and a term list; check new text against both. (Strategic Writing, Ch 2; Ch 6)
- Avoid idioms and metaphors; if one is the best choice, keep a plain alternative for translation. (Strategic Writing, Ch 5, clear)

## 12. Review checklist

- [ ] Does each string say what the user can do or what happened, and nothing else?
- [ ] Buttons are 1-3 words, verb-first, and echo their title.
- [ ] Hints describe the effect, not the name; units and formats are stated.
- [ ] Every state has one fixed name; every concept has one term.
- [ ] Empty states say how to fill them; errors say what to do next and avoid blame.
- [ ] No string is longer than three lines at the narrowest width.
- [ ] Each icon, input and image has screen-reader text, and none repeat.
- [ ] Text was read aloud in context and reviewed on the real screen.

## Longer before / after (invented)

**Run picker.** Before: heading "Select", columns "ID / Ts / Dur", empty text "No data", button "Submit". After: heading "Choose a run"; columns "Run", "Started", "Length (min)"; empty text "To see results, record or import a run" with [Import run]; button "Load run".

**Replay status line.** Before: "Status: PLAYBACK_ACTIVE (buffering)". After: "Replaying run 12 at 2× · buffering…". On finish: "Replay finished at 03:10".

**Parameter row.** Before: label "Thr", hint "Threshold", no unit. After: label "Spike threshold (µV)", hint "Counts a spike when the signal rises above this. Lower finds more events, including noise.", prefilled with the last-used value.
