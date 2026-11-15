# Moving files between you and DEVONthink

Read when: you work in claude.ai, or Claude Code is not on his Mac (steps 5 and 6 need a file to cross). Moved from SKILL.md step 0 (restructure R6, 2026-11-15). DEVONthink is used only through its MCP tools: no AppleScript, no other route.

**Moving a file between you and DEVONthink** (steps 5, 6) depends on the harness:

| Harness | How |
|---|---|
| Claude Code (on the Mac) | write the file locally (e.g. `/tmp/<course>/`) and `import_file` it with that path; `export_record` to a local path and read it directly |
| claude.ai | write to `/mnt/user-data/outputs/`, `device_commit_files` it into a connected folder (e.g. `~/Scripts/_to_delete/`), then `import_file`; `export_record` into a connected folder, then `device_stage_files` |

For figures imported as PNGs in claude.ai, the connected folder is `~/Downloads/<course>-figures/`; a `_to_delete/` staging folder in any connected folder works for large notes.
