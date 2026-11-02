"""Screenshot a GUI so you can LOOK at it: one PNG per width x theme, plus a labelled contact sheet.

    python shot.py PAGE [--widths 390,800,1280] [--themes light,dark] [--height 900] [--full]
                        [--out DIR] [--wait-for CSS] [--click SEL ...] [--scale 1] [--settle MS]

PAGE is an HTML file or a URL (http://localhost:8501 for a Streamlit app). By default only the FIRST SCREEN
(viewport height, --height) is captured, because that is what a user sees first; --full captures the whole
page (the viewport is stretched to the content, so 100vh sections grow too). Dark theme = emulated
prefers-color-scheme: dark. --click SEL clicks before the shot (CSS selector, or `text=Label` for the smallest
element containing that text) to capture layer-2 states such as an opened expander or popover; repeat it for
several clicks. Images are device scale 1 unless --scale 2, to keep them cheap to view.

Prints one PNG path per line, then the contact sheet `sheet.png` (made with Pillow when it is installed,
otherwise by screenshotting an HTML layout of the tiles in the same browser). Open the sheet first with the Read tool, then single PNGs for detail.
Exit codes: 0 done, 1 a page step failed (e.g. --click matched nothing; shots already taken are still printed),
2 not run (no browser, page not found or not loadable).
Standard library only; Pillow optional (faster contact sheet).
"""
import argparse
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser import Browser, BrowserUnavailable, CDPError, LoadError, page_stem, to_url  # noqa: E402


def make_sheet(tiles, widths, themes, out_path, view_h, tile_h=380, max_w=1800):
    """tiles: {(width, theme): png path}; view_h = viewport height in image pixels. One row per theme, one column
    per width, labelled; --full images show their top part only. False if there is no Pillow."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    try:
        font = ImageFont.load_default(size=14)
    except TypeError:
        font = ImageFont.load_default()
    pad, band = 10, 24
    rows = []
    for theme in themes:
        row = []
        for w in widths:
            p = tiles.get((w, theme))
            if not p:
                continue
            im = Image.open(p).convert("RGB")
            f = tile_h / min(im.height, view_h)             # the first screen fits the tile height
            small = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
            small = small.crop((0, 0, small.width, min(small.height, tile_h * 2)))
            row.append((small, "%dpx %s" % (w, theme)))
        if row:
            rows.append(row)
    if not rows:
        return False
    sheet_w = max(sum(t.width for t, _ in r) + pad * (len(r) + 1) for r in rows)
    shrink = min(1.0, max_w / sheet_w)
    if shrink < 1.0:
        rows = [[(t.resize((max(1, round(t.width * shrink)), max(1, round(t.height * shrink))), Image.LANCZOS), lab)
                 for t, lab in r] for r in rows]
        sheet_w = max(sum(t.width for t, _ in r) + pad * (len(r) + 1) for r in rows)
    sheet_h = sum(max(t.height for t, _ in r) + band + pad for r in rows) + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (200, 200, 200))
    d = ImageDraw.Draw(sheet)
    y = pad
    for r in rows:
        x = pad
        for t, lab in r:
            d.text((x, y + 3), lab, fill=(20, 20, 20), font=font)
            sheet.paste(t, (x, y + band))
            d.rectangle([x - 1, y + band - 1, x + t.width, y + band + t.height], outline=(120, 120, 120))
            x += t.width + pad
        y += max(t.height for t, _ in r) + band + pad
    sheet.save(out_path)
    return True


def make_sheet_browser(tiles, widths, themes, out_path, view_h, tile_h=380, max_w=1800):
    """The contact sheet without Pillow: lay the tiles out in an HTML page and screenshot it with the same headless
    browser. Same layout as make_sheet (a row per theme, a column per width, labelled, first screen only)."""
    import html
    import struct

    def tile(w, theme):
        p = Path(tiles[(w, theme)]).resolve()
        px_w = struct.unpack(">I", p.read_bytes()[16:20])[0]          # PNG IHDR width
        return ('<figure><figcaption>%dpx %s</figcaption><div style="max-height:%dpx;overflow:hidden">'
                '<img src="%s" style="width:%dpx;display:block"></div></figure>' % (
                    w, theme, tile_h * 2, html.escape(p.as_uri()), round(px_w * tile_h / view_h)))
    cells = []
    for theme in themes:
        row = "".join(tile(w, theme) for w in widths if (w, theme) in tiles)
        if row:
            cells.append('<div class="r">%s</div>' % row)
    if not cells:
        return False
    page = out_path.with_suffix(".html")
    page.write_text('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:10px;background:#c8c8c8;'
                    'font:14px sans-serif;width:max-content}.r{display:flex;gap:10px;margin-bottom:10px}'
                    'figure{margin:0}figcaption{height:22px;color:#141414}img{outline:1px solid #787878}'
                    '</style>' + "".join(cells))
    try:
        with Browser() as b:
            pg = b.new_page()
            pg.set_view(max_w, 400, 1.0, "light")
            pg.goto(page.as_uri())
            pg.settle(300, 10, None)
            pg.screenshot(out_path, full=True)
    except (BrowserUnavailable, LoadError, CDPError, ConnectionError, TimeoutError):
        return False
    finally:
        page.unlink(missing_ok=True)
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(description="Screenshot a GUI at several widths and themes (first screen by default).")
    ap.add_argument("page", help="HTML file or URL")
    ap.add_argument("--widths", default="390,800,1280", help="viewport widths in CSS px, comma separated")
    ap.add_argument("--themes", default="light,dark", help="light, dark or both")
    ap.add_argument("--height", type=int, default=900, help="viewport height = the 'first screen'")
    ap.add_argument("--full", action="store_true", help="capture the whole page, not just the first screen")
    ap.add_argument("--out", help="output folder (default: <tmp>/gui-shots/<page name>)")
    ap.add_argument("--wait-for", metavar="CSS", help="wait until this selector is visible (slow JS apps)")
    ap.add_argument("--click", action="append", default=[], metavar="SEL",
                    help="click this before the shot (CSS or text=Label); repeatable, in order")
    ap.add_argument("--scale", type=float, default=1.0, help="device scale factor (2 = sharper, bigger files)")
    ap.add_argument("--settle", type=int, default=800, help="ms the DOM must stay unchanged before the shot")
    ap.add_argument("--timeout", type=int, default=15, help="max seconds to wait for the page to settle")
    a = ap.parse_args(argv)

    widths = [int(x) for x in a.widths.split(",") if x.strip()]
    themes = [x.strip() for x in a.themes.split(",") if x.strip()]
    bad = [t for t in themes if t not in ("light", "dark")]
    if bad or not widths or not themes:
        ap.error("--widths needs numbers and --themes light and/or dark")
    out = Path(a.out).expanduser() if a.out else Path(tempfile.gettempdir()) / "gui-shots" / page_stem(a.page)
    out.mkdir(parents=True, exist_ok=True)

    tiles, failed = {}, False
    try:
        url = to_url(a.page)
        with Browser() as b:
            page = b.new_page()
            for w in widths:
                for theme in themes:
                    page.set_view(w, a.height, a.scale, theme)
                    page.goto(url)
                    r = page.settle(a.settle, a.timeout, a.wait_for)
                    if r.get("waitFor") is False:
                        print("warning: %dpx %s: --wait-for %r never became visible" % (w, theme, a.wait_for), file=sys.stderr)
                    elif r.get("timedOut"):
                        print("warning: %dpx %s: page was still changing after %ds; shot taken anyway" % (w, theme, a.timeout), file=sys.stderr)
                    try:
                        for sel in a.click:
                            page.click(sel)
                    except CDPError as e:
                        print("error: %dpx %s: %s" % (w, theme, e), file=sys.stderr)
                        failed = True
                        continue
                    path = out / ("%s-%d-%s.png" % (page_stem(a.page), w, theme))
                    page.screenshot(path, full=a.full)
                    tiles[(w, theme)] = path
                    print(path)
    except (BrowserUnavailable, LoadError) as e:
        print("shot.py: NOT RUN - %s" % e, file=sys.stderr)
        return 2
    except (CDPError, ConnectionError, TimeoutError) as e:
        print("shot.py: browser error - %s" % e, file=sys.stderr)
        return 1

    if tiles:
        sheet = out / "sheet.png"
        if (make_sheet(tiles, widths, themes, sheet, int(a.height * a.scale))
                or make_sheet_browser(tiles, widths, themes, sheet, int(a.height * a.scale))):
            print(sheet)
        else:
            print("(no contact sheet could be made)", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
