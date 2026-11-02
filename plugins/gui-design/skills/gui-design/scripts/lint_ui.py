"""Mechanical lint for a GUI: load the page in headless Chrome and report faults you should not need to find by eye.

    python lint_ui.py PAGE [--widths 390,800,1280] [--themes light,dark] [--height 900] [--json]
                           [--wait-for CSS] [--settle MS] [--max-controls N] [--max-words N]
                           [--max-boxes N] [--max-notices N]

PAGE is an HTML file or a URL (a Streamlit app on http://localhost:8501 works: it waits until the DOM is
stable). Every width x theme is loaded fresh (dark = emulated prefers-color-scheme) and checked in-page
(checks live in lint_ui.js). A problem prints as `width theme: kind: selector: detail`; the same problem seen
in several combinations is merged into one line (`390,800 light,dark: ...`).

IFRAMES: the checks also run inside every displayed iframe the browser lets the page reach, i.e. same-origin and
srcdoc frames, nested up to 3 deep (a Streamlit `components.html` viewer is one). A problem inside a frame is
printed with the frame in front of its selector, `iframe#2 (title or src) > div.panel`, and carries a "frame" key
in --json. Each frame gets its own DENSITY line: its first screen is the part of it that shows in the top
viewport (zero when it sits below the fold), and the --max-* limits apply to each frame separately. A
cross-origin or sandboxed frame cannot be read: it gets a `frame-skipped` note and is NOT checked, so lint its
own URL. Console errors and exceptions of frames are reported once, without a frame name.

Kinds: page-hscroll, text-overflow (text runs out of its box), text-clipped (cut off by overflow/ellipsis/
line-clamp), small-text (< 12px), low-contrast (< 4.5:1, or < 3:1 for >= 24px or >= 18.66px bold; text over
an image or gradient is only a `contrast-unknown` note), no-accessible-name, small-target (< 24x24),
console-error, exception, overlap (text boxes overlapping), density (a --max-* limit exceeded).

DENSITY is also printed for the first screen (scroll 0, --height tall): visible controls (navigation - nav,
role=navigation, a Streamlit sidebar - counted apart and not judged by --max-controls), words, distinct
bordered/filled boxes, notice/alert-like elements, distinct text sizes and text colours. These are a report,
not problems, unless you pass --max-controls / --max-words / --max-boxes / --max-notices (no defaults).

Exit codes: 0 clean, 1 at least one problem, 2 not run (no browser, or the page cannot be loaded).
Standard library only. --json prints {"ok", "problems", "notes", "density"} with one entry per width x theme.
"""
import argparse
import itertools
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser import Browser, BrowserUnavailable, CDPError, LoadError, to_url  # noqa: E402

JS = (Path(__file__).resolve().parent / "lint_ui.js").read_text()
FRAMES_JS = (Path(__file__).resolve().parent / "lint_frames.js").read_text()
MAX_PER_KIND = 15


def lint(page_arg, widths, themes, height=900, wait_for=None, settle=800, timeout=15, limits=None):
    """Run every width x theme. Returns (problems, notes, density, warnings); each problem is a dict with
    width, theme, kind, selector, detail."""
    limits = limits or {}
    problems, notes, density, warnings = [], [], [], []
    url = to_url(page_arg)
    with Browser() as b:
        page = b.new_page()
        for w, theme in itertools.product(widths, themes):
            page.set_view(w, height, 1.0, theme)
            page.goto(url)
            r = page.settle(settle, timeout, wait_for)
            if r.get("waitFor") is False:
                warnings.append("%d %s: --wait-for %r never became visible" % (w, theme, wait_for))
            elif r.get("timedOut"):
                warnings.append("%d %s: page still changing after %ds; checked anyway" % (w, theme, timeout))
            entries = page.evaluate("(%s)(%s, %s)" % (FRAMES_JS, JS, json.dumps({})))
            page.pump(0.15)
            tag = {"width": w, "theme": theme}
            for e in entries:
                frame = e["frame"]
                if "skipped" in e:
                    notes.append(dict(tag, kind="frame-skipped", selector=frame, detail=e["skipped"], frame=frame))
                    continue
                res = e["result"]
                for p in res["problems"]:
                    problems.append(dict(tag, frame=frame, **p))
                for n in res["notes"]:
                    notes.append(dict(tag, frame=frame, **n))
                if not res["density"]:
                    continue
                d = dict(tag, frame=frame, onFirstScreen=e["onFirstScreen"], **res["density"])
                density.append(d)
                for key, label in (("controls", "visible controls"), ("words", "visible words"),
                                   ("boxes", "bordered/filled boxes"), ("notices", "notices/alerts")):
                    lim = limits.get(key)
                    if lim is not None and d[key] > lim:
                        extra = ""
                        if key == "notices" and d["noticeSelectors"]:
                            extra = " (" + ", ".join(d["noticeSelectors"]) + ")"
                        problems.append(dict(tag, kind="density", frame=frame, selector="first screen",
                                             detail="%d %s on the first screen, limit %d%s" % (d[key], label, lim, extra)))
            for kind, loc, text in page.console_problems():
                problems.append(dict(tag, kind=kind, selector=loc, detail=text[:200], frame=None))
            warnings.extend("%d %s: %s" % (w, theme, t) for t in page.warnings())
    return problems, notes, density, warnings


def _prefix(combos, widths, themes):
    ws = sorted({c[0] for c in combos})
    ts = [t for t in themes if t in {c[1] for c in combos}]
    return "%s %s" % (",".join(map(str, ws)), ",".join(ts))


def shown_selector(it):
    return it["selector"] if not it.get("frame") or it["kind"] == "frame-skipped" else "%s > %s" % (it["frame"], it["selector"])


def merge(items, widths, themes):
    """Group identical (kind, selector, detail) over width x theme. Returns [(prefix, item)]."""
    groups = {}
    for it in items:
        groups.setdefault((it["kind"], shown_selector(it), it["detail"]), []).append((it["width"], it["theme"]))
    out = []
    for (kind, sel, detail), combos in groups.items():
        ws, ts = {c[0] for c in combos}, {c[1] for c in combos}
        if len(set(combos)) == len(ws) * len(ts):          # a full width x theme block: one line
            out.append((_prefix(combos, widths, themes), kind, sel, detail, min(combos)))
        else:
            for c in sorted(set(combos)):
                out.append(("%d %s" % c, kind, sel, detail, c))
    order = {w: i for i, w in enumerate(widths)}
    out.sort(key=lambda x: (x[1], order.get(x[4][0], 99), themes.index(x[4][1]) if x[4][1] in themes else 9))
    return out


def print_report(problems, notes, density, warnings, widths, themes, height):
    for w in warnings:
        print("warning: " + w, file=sys.stderr)
    lines = merge(problems, widths, themes)
    per_kind = {}
    for prefix, kind, sel, detail, _ in lines:
        per_kind[kind] = per_kind.get(kind, 0) + 1
        if per_kind[kind] <= MAX_PER_KIND:
            print("%s: %s: %s: %s" % (prefix, kind, sel, detail))
    for kind, n in per_kind.items():
        if n > MAX_PER_KIND:
            print("... and %d more %s (use --json for all)" % (n - MAX_PER_KIND, kind))
    for prefix, kind, sel, detail, _ in merge(notes, widths, themes):
        print("note: %s: %s: %s: %s" % (prefix, kind, sel, detail))
    print("")
    print("DENSITY (first screen, %dpx tall; a report, not a verdict):" % height)
    for d in density:
        name = "" if not d.get("frame") else "  %s%s:" % (d["frame"], "" if d.get("onFirstScreen", True) else " [below the first screen]")
        nav = " (+%d navigation)" % d["navControls"] if d.get("navControls") else ""
        print("  %4d %-5s%s controls %d%s, words %d, boxes %d, notices %d, text sizes %d %s, text colours %d %s" % (
            d["width"], d["theme"], name, d["controls"], nav, d["words"], d["boxes"], d["notices"],
            len(d["textSizes"]), d["textSizes"], len(d["textColors"]), " ".join(d["textColors"][:8])))
    print("")
    print("%d problem line(s)." % len(lines) if lines else "OK: no problems found.")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Lint a GUI page for overflow, contrast, tiny text/targets, console errors and density.")
    ap.add_argument("page", help="HTML file or URL")
    ap.add_argument("--widths", default="390,800,1280", help="viewport widths in CSS px, comma separated")
    ap.add_argument("--themes", default="light,dark", help="light, dark or both")
    ap.add_argument("--height", type=int, default=900, help="viewport height = the 'first screen' for density")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--wait-for", metavar="CSS", help="wait until this selector is visible (slow JS apps)")
    ap.add_argument("--settle", type=int, default=800, help="ms the DOM must stay unchanged before checking")
    ap.add_argument("--timeout", type=int, default=15, help="max seconds to wait for the page to settle")
    ap.add_argument("--max-controls", type=int, help="problem if more visible controls on the first screen (navigation not counted)")
    ap.add_argument("--max-words", type=int, help="problem if more visible words on the first screen")
    ap.add_argument("--max-boxes", type=int, help="problem if more bordered/filled boxes on the first screen")
    ap.add_argument("--max-notices", type=int, help="problem if more notice/alert elements on the first screen")
    a = ap.parse_args(argv)

    widths = [int(x) for x in a.widths.split(",") if x.strip()]
    themes = [x.strip() for x in a.themes.split(",") if x.strip()]
    if not widths or not themes or any(t not in ("light", "dark") for t in themes):
        ap.error("--widths needs numbers and --themes light and/or dark")
    limits = {"controls": a.max_controls, "words": a.max_words, "boxes": a.max_boxes, "notices": a.max_notices}
    try:
        problems, notes, density, warnings = lint(a.page, widths, themes, a.height, a.wait_for, a.settle,
                                                  a.timeout, limits)
    except (BrowserUnavailable, LoadError) as e:
        print("lint_ui.py: NOT RUN - %s" % e, file=sys.stderr)
        return 2
    except (CDPError, ConnectionError, TimeoutError) as e:
        print("lint_ui.py: NOT RUN - browser error: %s" % e, file=sys.stderr)
        return 2
    if a.json:
        print(json.dumps({"page": a.page, "ok": not problems, "problems": problems, "notes": notes,
                          "density": density, "warnings": warnings}, indent=1))
    else:
        print_report(problems, notes, density, warnings, widths, themes, a.height)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
