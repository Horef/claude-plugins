#!/usr/bin/env bash
# Create a throwaway 4-commit git repo where docs/STATUS.md claims pkg/export.py works
# even though pkg/export.py was deleted two commits ago. Usage: make_stale_status_repo.sh [DIR]
set -euo pipefail

DIR="${1:-$(mktemp -d)}"
mkdir -p "$DIR/docs" "$DIR/pkg"
cd "$DIR"

git init -q -b main
git config user.email "eval@example.com"
git config user.name "Eval Fixture"

cat > AGENTS.md <<'EOF'
# Fixture - agent instructions

Minimal repository for the stale-STATUS evaluation case.
EOF

cat > pkg/README.md <<'EOF'
# pkg/

Package modules for the fixture repo.
EOF

cat > pkg/__init__.py <<'EOF'
"""Fixture package."""
EOF

cat > pkg/export.py <<'EOF'
"""Export helper that will later be deleted."""


def export_pdf(path: str) -> str:
    return path
EOF

cat > docs/STATUS.md <<'EOF'
# Status

Updated: 2026-11-10

## Works (verified)
- `pkg/export.py` export to PDF works (verified).

## Doesn't work yet
- None yet.
EOF

cat > docs/WORKLOG.md <<'EOF'
# Work log

## 2026-11-10 - Initial export module
- Added `pkg/export.py` and verified PDF export.
EOF

git add -A
git commit -qm "Add pkg/export.py and initial STATUS"

git rm -q pkg/export.py
git commit -qm "Remove deprecated PDF export module"

echo "notes 1" > docs/NOTES.md
git add docs/NOTES.md
git commit -qm "Add scratch notes"

echo "notes 2" >> docs/NOTES.md
git add docs/NOTES.md
git commit -qm "Update scratch notes"

echo "$DIR"
