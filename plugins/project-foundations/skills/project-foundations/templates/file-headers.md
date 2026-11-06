Produces the header docstring/comment of every code file; read in Step 4.3 and Upgrade 2.

Python - a module docstring:

```python
"""<One line: what this module is for. Shown in docs/MAP.md and the folder README.>

<How to use it: the main classes/functions and how to call them (or the command line).>
<Contracts: inputs/outputs, units, shapes, side effects, invariants; cite D/R ids for choices.>
"""
```

Other languages: the first comment line (after any shebang) is the summary, followed by usage lines. Do not hand-write "used by" lists: they go stale; the generated tables and `docmap.py uses/where` provide them. Describe only what the code shows; if a file's purpose is unclear, say so in the docstring ("Purpose unclear: …") and add an open question to BRIEF.
