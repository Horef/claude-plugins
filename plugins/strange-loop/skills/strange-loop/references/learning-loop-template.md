# Learning loop section template

The `## Learning loop` footer every skill carries (strange-loop SKILL.md, section 8): short and self-contained, so it works when strange-loop is not installed (D12). `loop.py new` writes exactly this; replace `<name>`. `loop.py check` warns when a skill's footer (the section up to its own `### ` sub-sections) differs from this text, and `evals/test_loop.py` keeps it identical to what `new` writes.

Skill-specific hints (what counts as evidence, which moments to note) go in a `### Observations` sub-section after the footer, not in it.

````markdown
## Learning loop

This skill improves itself from use. When a step here misleads you, is missing, needs a workaround, or clearly pays off, record one line (`<kind>`: failure, friction, misled, missing, workaround, win or wish):

- If `~/.config/strange-loop/genome` exists, run this (in claude.ai, on the connected computer):
  `python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note <name> <kind> "<section>: <what happened, what would have helped>" --harness <harness> --context "<context>"`
- Otherwise, only if the person takes part in improving their skills (their standing instructions say so), end your reply with a block headed `Observations for <name>` holding the line `- <YYYY-MM-DD> [<kind>] <section>: <text> (<harness>, <context>)`; if not, add nothing about it, except one line when the skill clearly failed.
````
