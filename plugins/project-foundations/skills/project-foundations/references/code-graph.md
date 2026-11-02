# docmap code graph: `calls`, `deps`, `map`

Three on-demand views of a repository's Python code, built from the standard library's `ast` in one pass per run and never written to disk, so they cannot go stale. Other languages are not read: the commands say so instead of guessing.

## `calls NAME [--depth N]`
What a function, method or class calls inside the repository, and who calls it, with `file:line` and the calling function. NAME is `func`, `Class.method`, `module.func` or `path/to/file.py:Class.method`; more than five matches print the list to choose from. `--depth N` follows callees of callees and callers of callers (default 1). For a class, the calls of all its methods are included.

A call is **resolved** when its target follows from the code without running it:
- names defined or imported in the module, including `import pkg.mod as m; m.f()` and re-exports (`from pkg import f` where `pkg/__init__.py` imports `f` from a submodule);
- `self.m()` / `cls.m()` inside a class, looked up in the class and its base classes in the repository;
- `x = SomeClass(...)` followed by `x.m()` in the same function.

Everything else is kept apart and labelled:
- **by name only**: calls such as `obj.step()` whose receiver is unknown, with the repository definitions of that name it *could* be. The callers section lists such calls of the name elsewhere, too.
- **not guessed**: `.get()`, `.items()` and other dict/list/str method names; they are too common to list as candidates.
- **outside the repo**: calls into the standard library and installed packages, by their imported name (`json.dumps`, `numpy.zeros`).
- **(reference, not a call)**: the function is passed or stored (`COMMANDS = {"x": cmd_x}`, callbacks) rather than called there.

Not handled: dynamic dispatch (`getattr`, registries, decorators that replace a function), attributes assigned in `__init__` (`self.engine.run()`), return-type inference, `super()`, star imports, and closures reading an enclosing function's variables. When the graph says nothing, `where NAME` still lists every textual reference.

## `deps [PATH] [--mermaid]`
For the modules under PATH (a folder or file; default the whole repository): which in-scope modules each one imports, imports from the rest of the repository (`| outside:`), and who imports the folder from outside. `~` marks imports made inside a function (lazy). Import cycles are flagged twice over: cycles of top-level imports (these break at import time) and cycles that only close through function-level imports. `--mermaid` prints a `graph LR` block for a doc, lazy imports dashed and members of top-level cycles outlined in red.

## `map [PATH] [--budget TOKENS]`
A ranked map of the repository (or PATH) that fits a token budget (default 2000; about 4 characters per token). Each symbol is ranked by the number of distinct files that reference it, then by the number of references, then by how many modules import its module. The largest number of top-ranked symbols that fits the budget is shown, grouped by file (files with the highest-ranked symbols first), each with its line, signature and `[N files]`. The last line says how many symbols were left out.

The ranking follows Aider's repo map (definitions and references ranked to fit a token budget), with plain reference counts instead of PageRank so that each number can be checked with `calls`.

## Cost
Parsing dominates. On a 1470-module repository (about 290 000 lines), `map` takes about 3 s, `calls` about 3.5 s and `deps` about 2 s on an Apple-silicon laptop.
