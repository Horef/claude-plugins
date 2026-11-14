#!/usr/bin/env python3
"""Check mark strings against the DEVONthink text before any mark_record_text call (paper-premark, Workflow 5).

Usage: python validate_marks.py EXTRACT.json MARKS.json [--quiet]

EXTRACT.json is the file extract_record_content saves for large results: a JSON list of {"link", "text"}
(the page index, 0-based, is the `?page=N` in `link`). A dict holding such a list is accepted too. Several
entries for one page are joined with a newline, so a page that was extracted twice shows up as duplicates.

MARKS.json is the mark spec, a JSON list (YAML is read too when PyYAML is installed) of objects:
  page     0-based page index (optional; without it the string is searched on every page)
  string   the exact text to mark, with "\\n" at line breaks
  colour   red | green | yellow | blue | ref | skim (also accepted as `kind`; only used for the summary)
  comment  the comment to attach (optional; a blue mark without one is a warning)

Each mark is checked as DEVONthink will match it: NBSP is normalised to a space in text and string, then
text.count(string) must be exactly 1 on its page and on the whole document. FAIL when the string is empty,
contains a soft hyphen (U+00AD) or `***` (DEVONthink's redaction of URLs and e-mail addresses), does not
occur, occurs more than once, or sits on a page whose text shows every line twice (phantom text layer).
Warnings (no effect on the exit code): more than 8 red marks, blue without comment, unknown colour.

Prints one row per mark and a summary; when every mark would match, also the apply plan (one
mark_record_text call per colour, one at a time). Exit 0 when every mark would match, 1 when any would fail,
2 on unreadable input.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

NBSP = "\u00a0"
SHY = "\u00ad"
COLOURS = {"red", "green", "yellow", "blue", "ref", "skim"}
RED_LIMIT = 8


def load_pages(path: Path) -> dict[int, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        if not lists:
            raise ValueError("extract is a dict without a list of {link, text}")
        data = lists[0]
    pages: dict[int, str] = {}
    for i, item in enumerate(data):
        link, text = item.get("link", ""), item.get("text", "")
        m = re.search(r"[?&]page=(\d+)", link)
        if not m:
            raise ValueError(f"entry {i} has no ?page=N in its link: {link!r}")
        page = int(m.group(1))
        pages[page] = pages[page] + "\n" + text if page in pages else text
    return {p: t.replace(NBSP, " ") for p, t in pages.items()}


def load_marks(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yml", ".yaml"}:
        import yaml  # optional dependency, only for YAML specs
        data = yaml.safe_load(raw)
    else:
        data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("mark spec must be a list of objects")
    for i, m in enumerate(data):
        if not isinstance(m, dict) or "string" not in m:
            raise ValueError(f"mark {i} needs a 'string'")
    return data


def phantom_pages(pages: dict[int, str]) -> set[int]:
    """Pages where most lines occur at least twice: the interleaved duplicate text layer."""
    bad = set()
    for p, text in pages.items():
        lines = [ln.strip() for ln in text.split("\n") if len(ln.strip()) > 12]
        if len(lines) >= 6:
            c = Counter(lines)
            if sum(1 for ln in lines if c[ln] > 1) / len(lines) > 0.6:
                bad.add(p)
    return bad


def check(pages: dict[int, str], marks: list[dict]) -> tuple[list[tuple], list[str]]:
    phantom = phantom_pages(pages)
    rows, warnings = [], []
    reds = 0
    for i, m in enumerate(marks, 1):
        s = str(m["string"]).replace(NBSP, " ")
        page = m.get("page")
        colour = str(m.get("colour", m.get("kind", ""))).lower()
        problems = []
        if colour == "red":
            reds += 1
        if colour and colour not in COLOURS:
            warnings.append(f"mark {i}: unknown colour {colour!r}")
        if colour == "blue" and not str(m.get("comment") or "").strip():
            warnings.append(f"mark {i}: blue mark without a 'what to do' comment")
        if not s.strip():
            problems.append("empty string")
        if SHY in s:
            problems.append("soft hyphen (split around it)")
        if "***" in s:
            problems.append("*** redaction (end before it or start after it)")
        if not problems:
            if page is not None and page not in pages:
                problems.append(f"page {page} not in the extract")
            else:
                scope = [page] if page is not None else sorted(pages)
                on_page = sum(pages[p].count(s) for p in scope)
                total = sum(t.count(s) for t in pages.values())
                elsewhere = sorted(p for p, t in pages.items() if p not in scope and s in t)
                if on_page == 0:
                    hint = f"; found on page {', '.join(map(str, elsewhere))}" if elsewhere else ""
                    if any(SHY in pages[p] for p in scope):
                        hint += "; page text has soft hyphens"
                    problems.append("not found" + hint)
                elif on_page > 1:
                    problems.append(f"occurs {on_page}x on the page")
                elif total > 1:
                    problems.append(f"occurs {total}x in the document (also page {', '.join(map(str, elsewhere))})")
                if page is not None and page in phantom:
                    problems.append("phantom text layer on this page (every line twice)")
        rows.append((i, "-" if page is None else page, colour or "-", "; ".join(problems), s))
    if reds > RED_LIMIT:
        warnings.append(f"{reds} red marks (limit {RED_LIMIT})")
    return rows, warnings


def preview(s: str, n: int = 48) -> str:
    s = s.replace("\n", "\\n")
    return s if len(s) <= n else s[: n - 1] + "…"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Validate mark strings against a DEVONthink extract.")
    ap.add_argument("extract", type=Path)
    ap.add_argument("marks", type=Path)
    ap.add_argument("--quiet", action="store_true", help="print only failing rows and the summary")
    args = ap.parse_args(argv)
    try:
        pages = load_pages(args.extract)
        marks = load_marks(args.marks)
    except Exception as e:  # unreadable input is a distinct exit code
        print(f"error: {e}", file=sys.stderr)
        return 2
    rows, warnings = check(pages, marks)
    failed = [r for r in rows if r[3]]
    print(f"{'#':>3} {'page':>4} {'colour':<7} {'result':<6} string")
    for i, page, colour, problem, s in rows:
        if problem or not args.quiet:
            print(f"{i:>3} {page!s:>4} {colour:<7} {'FAIL' if problem else 'ok':<6} {preview(s)}" + (f"  <- {problem}" if problem else ""))
    for w in warnings:
        print(f"warning: {w}")
    print(f"{len(rows) - len(failed)}/{len(rows)} marks would match; {len(failed)} would fail; {len(pages)} pages in the extract")
    if rows and not failed:
        per = Counter(colour for _, _, colour, _, _ in rows)
        print(f"apply: {len(per)} mark_record_text calls ({', '.join(f'{"no colour" if c == "-" else c} {n}' for c, n in per.items())}), one at a time: "
              "wait for each result before the next (parallel calls on one PDF fail with 'saving failed')")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
