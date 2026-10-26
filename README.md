# Claude plugins

Sergiy Horef's mods and skills for Claude Code, in one marketplace. Each one lives in its own folder under `plugins/`.

| Plugin | What it does |
| --- | --- |
| [model-router](plugins/model-router) | Plans multi-step tasks, routes each step to a model tier (Haiku / Sonnet / Opus), asks you to approve the plan, shows cost and savings, reruns weak steps one rung up and learns better tier defaults from history. |

## Install

At the prompt of a Claude Code session (desktop app or terminal):

```
/plugin install model-router --marketplace Horef/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```bash
claude plugin install model-router --marketplace Horef/claude-plugins
```

Update later with `/plugin update`.

## Notes

The mods use Claude Code's function-hooks API, which is in early access and may change between releases; they need a recent Claude Code.
