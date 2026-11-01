# Terminal panels, TUIs, help and status text

**Three most important rules**
1. Design the text for a person first: say what just happened, what state things are in now, and what to do next, in as few lines as it takes (CLIG, Output; Philosophy: Saying just enough).
2. Colour and symbols carry meaning only when used sparingly: if everything is coloured, nothing stands out (CLIG, Output).
3. In a fixed-height pane, assume the reader sees only what fits and never scrolls: put the status and next action in the visible part, put detail behind a key, a file or a command (CLIG, Output: pager and debug log to file; the fixed-pane reading is mine).

**Scope warning.** The CLI guidelines say they do not cover full-screen programs like editors. Everything below about panes, TUIs and fixed height is my transfer by analogy; the text-level rules (messages, errors, help, colour) are directly from the guide. Items marked *(transfer)* are analogies.

---

## 1. Output for humans first

- Human-readable output is the default; machine-readable output (`--json`, `--plain`) is an extra switch, never the thing the person sees by default (CLIG, Output: human-readable output is paramount).
- Detect whether output goes to a terminal; only then use colour, animation, prompts and layout tricks. Piped or logged output gets none of them (CLIG, Output; Interactivity).
- When a table must stay readable on screen but breaks one-record-per-line, offer a plain mode for scripts (CLIG, Output: `--plain`).
- Do not print developer-only information by default (internal states, stack traces, log-level labels). Put it behind verbose or in a log file (CLIG, Output).
- Stdout is the result, stderr is messaging. In a GUI-embedded terminal panel *(transfer)*: the pane shows result and status; diagnostics go to the log file that the status line points to.

## 2. Brevity: say just enough

- Too little: a silent run that makes the person wonder if it hangs. Too much: pages of debug text hiding what matters. Both give the same failure, lost clarity (CLIG, Philosophy: Saying just enough).
- Success: print a brief confirmation, not nothing and not a log. "Err on the side of less" (CLIG, Output).
- Start with the outcome, then detail. One line per fact. No decorative banners, no repeated headers (CLIG, Output; *(transfer)* for the banner rule).
- Group repeated errors of the same type under one explanatory line instead of printing many similar lines (CLIG, Errors: signal-to-noise).
- No chatty progress for fast operations; show something within about 100 ms for slow ones so it never looks dead (CLIG, Robustness: responsive is more important than fast).
- Progress: show it when something takes a while; a bar stuck in one place looks like a crash, so also show something that keeps moving (elapsed time, count, spinner) (CLIG, Robustness: progress).
- Animations only when output is an interactive terminal, so logs do not fill up with progress frames (CLIG, Output).

## 3. Say what happened, what the state is, what to do next

Use this three-part pattern for any action result:

1. **What just happened** (when state changed): "Saved 3 items to profile.json" tells the person what the system now holds (CLIG, Output: if you change state, tell the user).
2. **Current state** (easy to look up): a one-line status always visible or one key/command away, similar to `git status` (CLIG, Output: make it easy to see the current state).
3. **Next step**: suggest the command or key that follows, so the person learns the tool by using it (CLIG, Output: suggest commands the user should run; Philosophy: Ease of discovery).

Errors (CLIG, Errors):
- Rewrite expected errors for humans: say what went wrong, then the fix, ideally as a runnable command ("Can't write to X. Run `chmod +w X`").
- Say the most important thing where the eye lands first, and use red for it sparingly. In a scrolling log that is the last line; in a fixed pane it is the status line or first visible line *(transfer)*.
- Unexpected failure: show a short message plus a path to a debug log and how to report it; do not dump the traceback (CLIG, Errors).
- Guess-and-ask for typos ("Did you mean `ps`?"), do not silently run the guess when the action changes state (CLIG, Help: suggest corrections).
- Validate input early and fail before doing anything (CLIG, Robustness).

Confirmation levels for risky actions (CLIG, Arguments and flags: dangerous actions):
- mild: do it, or one-key confirm;
- moderate: confirm, and offer a dry run;
- severe: require typing the name of the thing. Offer a flag equivalent so it stays scriptable.

Always show how to leave: show "q quit" or Ctrl-C works, and long operations remain interruptible (CLIG, Interactivity: let the user escape).

## 4. Help text and status text

Help (CLIG, Help):
- Default (no args, or `-h`): concise. Contents: one-line description, one or two examples, the most common flags, and a pointer to full help. Full help on `--help`.
- Lead with examples; people read them before anything else. Show real output if short.
- Order by frequency: common commands and flags first.
- Use bold headings for scannability, without raw escape characters when piped.
- Link to the web docs, give a support path.

Transfer to GUI help text and in-panel hints *(transfer)*:
- One-line hint under or next to a control, plus a "more" affordance, mirrors concise help vs full help (this is layer 2 vs layer 3 in disclosure.md).
- Hints say what the control does and give one example value, not a paragraph.
- Keyboard hints in a footer line, most-used keys first, limited to what fits on one line; the rest behind `?`. (Pattern from the "most common first" rule.)

Status lines *(transfer)*:
- One line, fixed place, same grammar every time: state, subject, count or time, and next action. Example shape: "Idle · 142 items · press r to refresh".
- Present-tense for state ("Syncing 3/12"), past tense for completed events ("Saved profile.json").
- Change the colour of the status for state changes only (ok / working / problem), not for every message.

## 5. Colour and symbols

- Colour has intention: one colour = one meaning (red = error, yellow = warning, dim = secondary). Do not use colour for decoration (CLIG, Output).
- Never carry meaning by colour alone; pair with a word or symbol (CLIG, Output: symbols where they clarify; accessibility is my addition).
- Switch colour off when the output is not a terminal, when `NO_COLOR` is set and non-empty, when `TERM=dumb`, or when `--no-color` is passed (CLIG, Output).
- Symbols and emoji help distinguish several kinds of items or catch attention, but too many make output cluttered or toy-like (CLIG, Output).
- Dim text for secondary information (paths, ids, timestamps) lets the main line stand out *(transfer; follows from intent-of-colour rule)*.
- Increase density with compact, learnable formats (the way `ls -l` packs permissions): the first look ignores most fields, later looks pick out more (CLIG, Output: information density). Do this only for expert-facing columns, not the headline.

## 6. Density in a fixed-height pane (transfer)

The guide itself covers streaming output, not panes. These rules apply its signal-to-noise and pager ideas to a pane with limited rows.

- Budget rows explicitly: e.g. 1 status row, 1 hint row, rest content. Count them against the smallest supported pane height *(working default; no source figure)*.
- Never rely on scroll to reveal essential information. If content exceeds the pane, the first rows must be the summary and the call to action. Use a pager-like view (`less` style, with `-F`-like auto-exit if it fits) or a "details" key for the rest (CLIG, Output: pager).
- Truncate with a marker, not silently: "… 14 more (press d)". Truncate in the middle for paths so the filename stays visible *(transfer)*.
- Wrap or truncate at the pane width, never let long lines break the layout. Test at the narrowest width (CLIG, Output: the table split-into-lines example shows the width constraint).
- Do not redraw the whole pane on every tick; update only the changed line. Flicker and cursor jumps look broken (CLIG, Robustness: subjective robustness).
- Keep the layout stable: fixed columns, fixed status row, so the eye finds things in the same place each time *(transfer)*.
- Collapse lists to counts with a key to expand ("3 warnings"), as in disclosure.md layer 2.

## 7. Conversation and discovery

- Treat the session as a conversation: show the intermediate state of a multi-step process, confirm before something scary, suggest corrections (CLIG, Philosophy: Conversation as the norm).
- Make features discoverable in place: examples, suggested next commands, hints in errors. A terminal can borrow GUI discoverability (CLIG, Philosophy: Ease of discovery).
- Prompt only when input is interactive; always provide a flag or argument equivalent, and a `--no-input` path for automation (CLIG, Arguments and flags; Interactivity).
- Be consistent with existing patterns (key names, flag names) unless they harm usability; if you break convention, do it knowingly (CLIG, Philosophy: Consistency; Chaos).

## 8. Agent checklist for terminal and help text

- [ ] Default output readable by a human with no flags; machine form behind a flag.
- [ ] Success message exists and is one line; state changes are named.
- [ ] Every error says what happened and what to do; no raw traceback shown by default.
- [ ] Status and next action visible without scrolling at the smallest pane height.
- [ ] Colour has at most 3-4 meanings *(working default)*; every coloured message also has a word/symbol; `NO_COLOR` respected.
- [ ] Nothing happens silently for longer than about 100 ms without a visible sign of life.
- [ ] Long output is truncated with a count and a key/command to see the rest, or goes through a pager.
- [ ] Destructive actions are confirmed at the right level and have a dry-run or flag path.
- [ ] Help: examples first, common options first, full help one step away, link to docs.
- [ ] Exit / cancel path is shown or standard (Ctrl-C works).
