"""Install the model-router Herdr view and dock it as a right sidebar.

Copies main.js and mod.json next to this file into Herdr's mods folder, makes a personal copy of Herdr's
shipped `main` layout called `main-router` (shipped layouts are read-only) with a `router` column on the
right that shows the chat of the focused terminal, and binds cmd-shift-r to show or hide that column.
Safe to run again: it only adds what is missing, and refreshes the mod's files.

usage: python3 sidebar.py            (switches the window to main-router; cmd-shift-l switches back)
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path(os.environ.get("HERDR_APP_HOME") or Path.home() / ".config" / "herdr-app")
LAYOUT, COLUMN, KEY = "main-router", "router", "cmd-shift-r"
BLOCK = {
    "id": COLUMN, "type": "block", "size": {"px": 380}, "min": 280, "max": 720,
    "radius": 10, "border": {"width": 1, "color": "border"}, "content": {"mod": "model-router"},
}


def herdr(*args: str) -> None:
    subprocess.run(["herdr-app", *args], check=True, capture_output=True, text=True)


def find(node: dict, node_id: str) -> dict | None:
    if node.get("id") == node_id:
        return node
    for child in node.get("children", []):
        if (hit := find(child, node_id)) is not None:
            return hit
    return None


def main() -> int:
    if not HOME.is_dir() or shutil.which("herdr-app") is None:
        print(f"Herdr not found ({HOME} or herdr-app missing): nothing done.", file=sys.stderr)
        return 1
    mod = HOME / "mods" / "model-router"
    mod.mkdir(parents=True, exist_ok=True)
    for name in ("main.js", "mod.json"):
        shutil.copy2(Path(__file__).with_name(name), mod / name)
    print(f"mod installed: {mod}")

    path = HOME / "layouts" / f"{LAYOUT}.json"
    if not path.exists():
        herdr("do", "layout.clone", json.dumps({"name": "main", "as": LAYOUT}))
        print(f"layout {LAYOUT} made from main (cmd-shift-l switches layouts)")
    layout = json.loads(path.read_text())
    if find(layout, COLUMN) is None:
        body = find(layout, "work-body")
        if body is None:
            print(f"{path} has no work-body row: add {json.dumps(BLOCK)} where you want it.", file=sys.stderr)
            return 1
        body.setdefault("children", []).append(BLOCK)
        path.write_text(json.dumps(layout, indent=2) + "\n")
        print(f"router column added to {LAYOUT}")

    keys_path = HOME / "keys.json"
    keys = json.loads(keys_path.read_text()) if keys_path.exists() else {}
    bound = keys.setdefault("global", {})
    if KEY not in bound:
        bound[KEY] = f"layout.toggle:{COLUMN}"
        keys_path.write_text(json.dumps(keys, indent=2) + "\n")
        print(f"{KEY} shows or hides the router column")
    elif bound[KEY] != f"layout.toggle:{COLUMN}":
        print(f"{KEY} is already bound to {bound[KEY]}: bind layout.toggle:{COLUMN} to a key of your choice.")
    herdr("do", "layout.switch", json.dumps({"name": LAYOUT}))
    herdr("check", str(mod))
    print("done: the router view is the right column of the main-router layout")
    return 0


if __name__ == "__main__":
    sys.exit(main())
