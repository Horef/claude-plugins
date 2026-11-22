"""Second-pass exact verification of simple_complex_v1 findings for neon.md."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJ = Path("/Users/sergiyhoref/Programming/Neuroscience/simple_complex_v1")
PY = "/Users/sergiyhoref/Programming/Neuroscience/envs/neuro/bin/python"
os.chdir(PROJ)
sys.path.insert(0, str(PROJ / "tools"))
import docmap  # noqa: E402


def main() -> None:
    files = docmap.tracked_files()

    print("=== A. EXACT DOCS AUDIT QUEUE BREAKDOWN ===")
    lc = docmap.lifecycle_docs(files)
    print(f"Total lifecycle_docs: {len(lc)}")
    by_state = Counter()
    by_group_state = Counter()
    for f in lc:
        st = docmap.doc_status(f)
        state = st[0] if st else "none"
        by_state[state] += 1
        parts = Path(f).parts
        if len(parts) == 2:
            grp = "docs/<root>"
        elif parts[1] == "writeups" and "review" in parts:
            grp = "docs/writeups/*/review/**"
        elif parts[1] in ("writeups", "research", "literature", "plans", "models"):
            grp = f"docs/{parts[1]}/**"
        else:
            grp = f"docs/{parts[1]}/"
        by_group_state[(grp, state)] += 1
    print("By state:", dict(by_state))
    for (grp, state), cnt in sorted(by_group_state.items()):
        print(f"  {grp:30s} {state:12s}: {cnt}")

    print("\n=== B. EXACT BARE-ID WARNING ROOT CAUSES ===")
    defs, ambiguous, cites = docmap.id_analysis(files)
    print(f"Total bare-id warnings (file, family): {len(cites)}")
    for (f, fam), ids in sorted(cites.items()):
        txt = docmap.id_text(f)
        causes = Counter()
        examples = []
        for n, ln in enumerate(txt.splitlines(), 1):
            clean = re.sub(r"https?://\S+", "", re.sub(r"`[^`\n]*`", "", ln))
            hit = set(docmap.ID_CITE.findall(clean)) & ids
            if not hit:
                continue
            scope = docmap.id_scope(f)
            slugs = sorted({s.rstrip("/").rsplit("/", 1)[-1] for i in hit for s in ambiguous[i] if s != "./"})
            if scope in {s for i in hit for s in ambiguous[i]}:
                continue
            # Would clean match slug? Already filtered out by id_analysis, so check raw line (before backtick strip)!
            if any(re.search(r"(?<![\w-])" + re.escape(s) + r"(?![\w-])", ln, re.I) for s in slugs):
                causes["slug_in_backticks_stripped"] += 1
                if len(examples) < 3:
                    examples.append(("slug_stripped", n, sorted(hit), ln.strip()[:120]))
            elif fam == "F" and any(re.search(rf"\b{re.escape(i)}\s*/\s*F0\b", clean) for i in hit):
                causes["F_ratio_with_spaces"] += 1
                if len(examples) < 3:
                    examples.append(("F_ratio_spaces", n, sorted(hit), ln.strip()[:120]))
            elif fam == "F":
                causes["F_standalone_harmonic_or_other"] += 1
                if len(examples) < 3:
                    examples.append(("F_other", n, sorted(hit), ln.strip()[:120]))
            else:
                causes["genuinely_unqualified_or_title"] += 1
                if len(examples) < 3:
                    examples.append(("unqualified", n, sorted(hit), ln.strip()[:120]))
        print(f"  [{fam}] {f:50s} {dict(causes)}")
        for tag, n, hit, snip in examples:
            print(f"        ({tag}) L{n} {hit}: {snip}")

    print("\n=== C. WHERE F1-F9 ARE DEFINED ===")
    for i in sorted(k for k in ambiguous if docmap.id_family(k) == "F"):
        print(f"  {i}: {sorted(defs[i])}")

    print("\n=== D. FIND WITH 1 QUOTED ARG VS 2 ARGS ===")
    p1 = subprocess.run([PY, "tools/docmap.py", "find", "twin families"], cwd=PROJ, capture_output=True, text=True)
    p2 = subprocess.run([PY, "tools/docmap.py", "find", "twin", "families"], cwd=PROJ, capture_output=True, text=True)
    print("find 'twin families' (1 arg):", p1.stdout.strip().splitlines()[-1] if p1.stdout.strip() else "empty")
    print("find twin families (2 args): ", p2.stdout.strip().splitlines()[-1] if p2.stdout.strip() else "empty")

    print("\n=== E. TEST F1/F0 REGEX ON ID_CITE ===")
    for sample in ["F1/F0", "F2/F0", "F1 / F0", "F1 / (F0 - blank)", "CP F2 0.24", "F1 modulation"]:
        print(f"  {sample!r:25s} -> ID_CITE matches: {docmap.ID_CITE.findall(sample)}")

    print("\n=== F. CHECK WRITEUP TITLES IN README / main.tex ===")
    for sub in sorted((PROJ / "docs/writeups").iterdir()):
        if sub.is_dir():
            rm = sub / "README.md"
            mt = sub / "main.tex"
            rm_h = rm.read_text(encoding="utf-8").splitlines()[0] if rm.exists() else None
            mt_t = None
            if mt.exists():
                m = re.search(r"\\title\{([^}]+)\}", mt.read_text(encoding="utf-8", errors="replace"))
                mt_t = m.group(1) if m else None
            print(f"  {sub.name}: README={rm_h!r} | tex={mt_t!r}")

    print("\n=== G. STATUS.MD TABLE COLUMN COUNTS ===")
    for n, ln in enumerate((PROJ / "docs/STATUS.md").read_text(encoding="utf-8").splitlines(), 1):
        if ln.startswith("|"):
            cols = [c.strip() for c in ln.strip().strip("|").split("|")]
            print(f"  L{n:2d}: {len(cols)} cols, {len(ln.split()):3d} words | {cols[0][:35]!r}")


if __name__ == "__main__":
    main()
