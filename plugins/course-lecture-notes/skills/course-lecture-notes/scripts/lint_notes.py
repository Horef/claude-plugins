#!/usr/bin/env python3
"""Lint a course-lecture-notes study guide for the rules a script can check.

Usage: lint_notes.py NOTES.md

Checks every `### N.M Title` block (the unit anki_blocks.py sends to Anki: it ends at the next heading of any
level or at a `---` line), against SKILL.md "Goals" item 2 and the "Math" section:
  cross-reference            "see block", "as above", "in the figure", "previous block"... (CROSS_REFS below)
  unicode-math               Greek letters, arrows, math operators, ×, ·, ±, superscript digits... (write LaTeX)
  single-backslash-display   `\\[` or `\\]` with one backslash: Markdown strips it and MathJax never sees it
  missing-where              a display equation (`$$...$$`) whose next paragraph does not start with "where:"
  missing-separator          a block with no `---` line between it and the previous block

A display equation that is followed, after at most two short lines of reason, by another display equation is
treated as a derivation step and is exempt; the last equation of the chain still needs its "where:".
Text outside blocks (title, lecture map, Part headings, self-test) is not checked. Skipped everywhere: code
fences, inline code, inline SVG, link targets.

Output: one line per problem, `block N.M line L: rule: excerpt`. Exit 1 if there is any problem, 0 if clean,
2 if the file cannot be read or the command line is wrong.
"""
import re
import sys
from pathlib import Path

HEADING = re.compile(r"^###\s+(\d+(?:\.\d+)+)\s+(.*)$")  # same as anki_blocks.py
FENCE = re.compile(r"^\s*(```|~~~)")

# Phrases that tie a block to another block, a figure elsewhere, or the position on the page. Case-insensitive.
CROSS_REFS = [
    r"\bsee (?:also )?(?:the )?(?:block|section|part|figure|fig\.|equation|eq\.|above|below)\b",
    r"\b(?:cf\.?|refer to|recall from|recalled from) (?:the )?(?:block|section|part|figure|fig\.)",
    r"\bas (?:(?:was|we|already|is|are) )?(?:shown |stated |derived |discussed |seen |mentioned |noted |described |defined )?(?:above|below|before|earlier|previously)\b",
    r"\b(?:shown|seen|described|defined|derived|discussed|explained|mentioned|stated|given|listed|introduced|covered) (?:above|below|earlier|previously)\b",
    r"\b(?:we|you) (?:saw|derived|showed|discussed|introduced|defined|met|covered) (?:earlier|previously|before)\b",
    r"\b(?:equation|formula|figure|diagram|plot|graph|table|model|result|rule|definition|example|derivation|list|text|paragraph|block|section)s? (?:above|below)\b",
    r"\bthe (?:above|below)[- ](?:mentioned|stated|described|derived|equation|formula|figure|result)\b",
    r"\bin the (?:figure|plot|diagram|graph)\b",
    r"\b(?:in|from|see|cf\.?) (?:figure|fig\.) ?\d",
    r"\b(?:previous|preceding|earlier|prior|next|following|later|last) (?:block|section|part|derivation|example|step)\b",
    r"\bin the (?:previous|preceding|earlier|prior|next|following|later|last) (?:equation|figure)\b",
    r"\bblocks? \d+(?:\.\d+)?\b",
    r"\b(?:in|from|of|see|recall) (?:part|section) \d+\b",
]
CROSS_REF_RES = [re.compile(p, re.I) for p in CROSS_REFS]

# Unicode math that SKILL.md Math requires in LaTeX ($\alpha$, $\le$, $\times$, $x^2$, $\mu$m ...).
MATH_RANGES = [
    (0x00B1, 0x00B3), (0x00B5, 0x00B5), (0x00B7, 0x00B7), (0x00B9, 0x00B9),
    (0x00BC, 0x00BE), (0x00D7, 0x00D7), (0x00F7, 0x00F7),
    (0x0370, 0x03FF),  # Greek
    (0x2032, 0x2034),  # primes
    (0x2070, 0x209F),  # superscripts and subscripts
    (0x2100, 0x214F),  # letterlike (ℓ, ℏ, ℝ ...)
    (0x2190, 0x21FF),  # arrows
    (0x2200, 0x22FF),  # mathematical operators (∑ ∫ ≤ ≥ − ∞ ...)
    (0x27C0, 0x27EF), (0x2980, 0x2AFF),
    (0x1D400, 0x1D7FF),  # mathematical alphanumerics
]

SINGLE_BACKSLASH_DISPLAY = re.compile(r"(?<!\\)\\[\[\]]")  # \[ or \] that is not the tail of \\[2pt]
WHERE = re.compile(r"^\W*where\s*:", re.I)
SVG_OPEN = re.compile(r"<svg\b", re.I)


def is_math_symbol(ch: str) -> bool:
    o = ord(ch)
    return any(a <= o <= b for a, b in MATH_RANGES)


def mask(line: str) -> str:
    """Blank out inline code and link/image targets, which are not prose."""
    line = re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), line)
    return re.sub(r"\]\([^)]*\)", "]", line)


def excerpt(text: str, limit: int = 80) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def split_blocks(lines):
    """Return ([(id, heading_line_no, [(line_no, text)])], line numbers of '---' rules)."""
    blocks, cur, seps = [], None, []
    in_fence = in_svg = False
    for no, raw in enumerate(lines, 1):
        if FENCE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if in_svg or SVG_OPEN.search(raw):
            in_svg = "</svg>" not in raw.lower()
            continue
        if raw.strip() == "---":
            seps.append(no)
            cur = None
            continue
        m = HEADING.match(raw)
        if m:
            cur = (m.group(1), no, [])
            blocks.append(cur)
        elif raw.startswith("#"):
            cur = None
        elif cur is not None:
            cur[2].append((no, raw))
    return blocks, seps


def display_equations(body):
    """[(first_index, last_index)] of `$$` display equations in body, a list of (line_no, text)."""
    out, start = [], None
    for i, (_, text) in enumerate(body):
        n = len(re.findall(r"(?<!\\)\$\$", mask(text)))
        if start is None:
            if n >= 2 and n % 2 == 0:
                out.append((i, i))
            elif n % 2 == 1:
                start = i
        elif n >= 1:
            out.append((start, i))
            start = None
    return out


def check_where(body, equations):
    problems = []
    for k, (s, e) in enumerate(equations):
        nxt = [j for j in range(e + 1, len(body)) if body[j][1].strip()]
        if nxt and WHERE.match(body[nxt[0]][1].strip()):
            continue
        if k + 1 < len(equations):
            between = [j for j in nxt if j < equations[k + 1][0]]
            if len(between) <= 2 and not any(WHERE.match(body[j][1].strip()) for j in between):
                continue  # derivation step: equation, short reason, next equation
        problems.append((body[s][0], "missing-where", "display equation not followed by a 'where:' line"))
    return problems


def lint(text: str):
    blocks, seps = split_blocks(text.splitlines())
    problems = []  # (line_no, block_id, rule, excerpt)
    prev = None
    for bid, hline, body in blocks:
        if prev is not None and not any(prev < s < hline for s in seps):
            problems.append((hline, bid, "missing-separator", "no '---' line between this block and the previous one"))
        prev = hline
        for no, raw in body:
            line = mask(raw)
            spans = sorted((m.start(), m.end()) for rx in CROSS_REF_RES for m in rx.finditer(line))
            last_end = -1
            for a, b in spans:  # one problem per phrase, even when several patterns match it
                if a >= last_end:
                    problems.append((no, bid, "cross-reference", line[a:b]))
                    last_end = b
            if SINGLE_BACKSLASH_DISPLAY.search(line):
                problems.append((no, bid, "single-backslash-display", excerpt(line.strip(), 60) + "  (use $$...$$)"))
            seen = sorted({ch for ch in line if is_math_symbol(ch)})
            if seen:
                problems.append((no, bid, "unicode-math", " ".join(seen) + "  in: " + excerpt(line.strip(), 50)))
        for no, rule, ex in check_where(body, display_equations(body)):
            problems.append((no, bid, rule, ex))
    problems.sort(key=lambda p: (p[0], p[2]))
    return problems, len(blocks)


def main(argv) -> int:
    if len(argv) != 2 or argv[1] in ("-h", "--help"):
        print("usage: lint_notes.py NOTES.md", file=sys.stderr)
        return 2
    try:
        text = Path(argv[1]).read_text(encoding="utf-8")
    except OSError as e:
        print(f"lint_notes: cannot read {argv[1]}: {e.strerror}", file=sys.stderr)
        return 2
    problems, n = lint(text)
    for no, bid, rule, ex in problems:
        print(f"block {bid} line {no}: {rule}: {ex}")
    if n == 0:
        print("lint_notes: no '### N.M Title' blocks found", file=sys.stderr)
        return 1
    print(f"lint_notes: {n} block(s), {len(problems)} problem(s)", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
