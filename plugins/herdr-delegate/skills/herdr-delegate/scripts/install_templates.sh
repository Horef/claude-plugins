#!/bin/sh
# Install herdr-delegate's hc templates for the helper CLIs found on this machine.
# A thin wrapper: the templates are rendered from helpers.default.json (plus your overrides in
# ~/.config/herdr-delegate/helpers.json) by `helpers.py render`; see `helpers.py --help`.
# Never replaces a template without the generated-by line unless --force.
# Usage: install_templates.sh [--force]
set -eu
here=$(cd "$(dirname "$0")" && pwd)
command -v hc >/dev/null 2>&1 || { echo "hc (herdr-core) not on PATH: nothing to install"; exit 0; }
exec python3 "$here/helpers.py" render "$@"
