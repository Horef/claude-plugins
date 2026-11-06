Produces `~/.config/project-foundations/defaults.md` (outside every repository); read only if the user wants conventions reused across projects.

`~/.config/project-foundations/defaults.md` - only if the user wants their conventions reused across projects:

```markdown
# Project-foundations defaults (<name>)
Read by the project-foundations skill in Step 0. Not part of any repository.

## Conventions
- Git: <host and account, e.g. git@github.com:<account>/<repo>.git>; <commit style>; push after committing.
- Never commit: <personal additions, e.g. an employer's internal documents>.
- <research, language or review conventions>

## Machines (copied into each checkout's AGENTS.local.md, never into tracked files)
- <machine>: <OS; agents used; memory budget; where heavy jobs run; quirks>
```
