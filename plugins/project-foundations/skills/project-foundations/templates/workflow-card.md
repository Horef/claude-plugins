Produces `docs/workflows/<task>.md`; read when writing a workflow card for a repeated multi-file task.

````markdown
# Workflow: <repeated task>

Status: current (verified YYYY-MM-DD)

- **When to use:** <one line describing the task>
- **Rough cost:** <wall time / compute / token budget>

## Files to read

Read only these ranges instead of whole files (`docmap.py check` verifies paths, line ranges and churn):

- `<path/to/file.py:10-45>` — <what lives here and what to change>
- `<path/to/config.yaml:1-30>` — <parameters that govern this task>

## Commands

```bash
<exact command 1>
<exact command 2>
```

## Expected outputs

- `<output path or artifact>` — <shape, count or metric range that means success>

## Failure signs and fixes

| Sign | Likely cause | Fix |
|---|---|---|
| <error or symptom> | <root cause> | <exact fix or recovery command> |
````
