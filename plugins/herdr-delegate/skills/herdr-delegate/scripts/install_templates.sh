#!/bin/sh
# Install herdr-delegate's hc templates for the helper CLIs found on this machine.
# Never overwrites an existing template (prints "kept"); pass --force to replace.
# Usage: install_templates.sh [--force]
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
dest="${XDG_CONFIG_HOME:-$HOME/.config}/herdr-core/templates"
force=${1:-}
command -v hc >/dev/null 2>&1 || { echo "hc (herdr-core) not on PATH: nothing to install"; exit 0; }
mkdir -p "$dest"
for f in "$here"/templates/*.md; do
  name=$(basename "$f" .md)
  cli=$(sed -n 's/^command: \([^ ]*\).*/\1/p' "$f")
  if ! command -v "$cli" >/dev/null 2>&1; then echo "skip   $name ($cli not installed)"; continue; fi
  if [ -e "$dest/$name.md" ] && [ "$force" != "--force" ]; then echo "kept   $name (exists)"; continue; fi
  cp "$f" "$dest/$name.md"; echo "wrote  $name"
done
