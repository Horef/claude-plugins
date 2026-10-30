"""Render one inline SVG string to a PNG of exactly the figure (2x by default).
Use when a figure must be an image file (Anki cards, DEVONthink image records,
slides, papers).

Playwright + Chromium is used when found; otherwise headless Chrome/Chromium/
Edge (check.find_chrome) renders the PNG and the PDF."""
import os, re, shutil, subprocess, tempfile

from .check import _find_playwright, CHROMIUM, playwright_ok, find_chrome, chrome_shot

_JS = r"""
const pw = require(process.argv[2]);
const [html, out, exe, scale] = process.argv.slice(3);
(async () => {
  const opts = {}; if (exe) opts.executablePath = exe;
  const b = await pw.chromium.launch(opts);
  const p = await b.newPage({viewport: {width: 2000, height: 2000}, deviceScaleFactor: parseFloat(scale)});
  await p.goto('file://' + html);
  const el = await p.$('svg');
  await el.screenshot({path: out});
  await b.close();
})();
"""


def _design_size(svg):
    """(w, h) of the figure in CSS px from its root tag, or None."""
    root = re.search(r"<svg[^>]*>", svg)
    if not root:
        return None
    root = root.group(0)
    wm = re.search(r'\swidth="([\d.]+)(?:px)?"', root)
    vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', root)
    hm = re.search(r'\sheight="([\d.]+)(?:px)?"', root)
    if wm and hm:
        return float(wm.group(1)), float(hm.group(1))
    if vb:
        vw, vh = float(vb.group(1)), float(vb.group(2))
        w = float(wm.group(1)) if wm else vw
        return w, w * vh / vw
    return None


def svg_to_png(svg, out_png, scale=2.0):
    """One inline SVG string -> PNG of exactly the figure at `scale`x."""
    os.makedirs(os.path.dirname(os.path.abspath(out_png)), exist_ok=True)
    tmp = tempfile.mkdtemp()
    hp = os.path.join(tmp, "f.html"); js = os.path.join(tmp, "r.js")
    # remove max-width so the figure renders at its design size
    open(hp, "w").write("<!doctype html><html><body style='margin:0;background:#fff'>"
                        + svg.replace("max-width:100%;", "") + "</body></html>")
    if not playwright_ok():
        try:
            sz = _design_size(svg)
            if sz:  # exact crop; the window is a little larger than the figure
                chrome_shot(hp, out_png, max(sz[0], 800), sz[1] + 200, scale=scale, size=sz)
            else:   # unknown size: generous window, trim trailing white
                chrome_shot(hp, out_png, 2000, 2000, scale=scale)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return out_png
    open(js, "w").write(_JS)
    exe = CHROMIUM if os.path.exists(CHROMIUM) else ""
    r = subprocess.run(["node", js, _find_playwright(), hp, os.path.abspath(out_png), exe, str(scale)],
                       capture_output=True, text=True, timeout=120)
    shutil.rmtree(tmp, ignore_errors=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return out_png


_JS_PDF = r"""
const pw = require(process.argv[2]);
const [html, out, exe, w, h] = process.argv.slice(3);
(async () => {
  const opts = {}; if (exe) opts.executablePath = exe;
  const b = await pw.chromium.launch(opts);
  const p = await b.newPage();
  await p.goto('file://' + html);
  await p.pdf({path: out, width: w + 'px', height: h + 'px', printBackground: true,
               margin: {top: 0, right: 0, bottom: 0, left: 0}, pageRanges: '1'});
  await b.close();
})();
"""


def svg_to_pdf(svg, out_pdf):
    """Vector PDF of the figure at its design size (for papers and slides).
    Text stays text; fonts are embedded by Chromium."""
    os.makedirs(os.path.dirname(os.path.abspath(out_pdf)), exist_ok=True)
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    w, h = (float(m.group(1)), float(m.group(2))) if m else (640, 400)
    tmp = tempfile.mkdtemp()
    hp = os.path.join(tmp, "f.html"); js = os.path.join(tmp, "r.js")
    open(hp, "w").write("<!doctype html><html><head><style>@page{margin:0}html,body{margin:0}</style>"
                        "</head><body>" + svg.replace("max-width:100%;", "") + "</body></html>")
    if not playwright_ok():
        exe = find_chrome()
        if not exe:
            raise RuntimeError("no Playwright and no Chrome/Chromium/Edge found")
        html = open(hp).read().replace("@page{margin:0}", f"@page{{size:{int(round(w))}px {int(round(h)) + 1}px;margin:0}}svg{{display:block}}")
        open(hp, "w").write(html)
        try:
            r = subprocess.run([exe, "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run",
                                "--user-data-dir=" + os.path.join(tmp, "prof"), "--no-pdf-header-footer",
                                "--print-to-pdf=" + os.path.abspath(out_pdf), "file://" + hp],
                               capture_output=True, text=True, timeout=120)
            if not os.path.exists(out_pdf):
                raise RuntimeError("headless Chrome wrote no PDF: " + r.stderr[-1500:])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return out_pdf
    open(js, "w").write(_JS_PDF)
    exe = CHROMIUM if os.path.exists(CHROMIUM) else ""
    r = subprocess.run(["node", js, _find_playwright(), hp, os.path.abspath(out_pdf), exe,
                        str(int(round(w))), str(int(round(h)) + 1)], capture_output=True, text=True,
                       timeout=120)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return out_pdf


def export_files(svg, base, png_scale=3.0):
    """Write base.svg (standalone file), base.png (raster at png_scale x) and
    base.pdf (vector) - the formats a paper or a slide deck needs."""
    std = svg
    if 'xmlns="http://www.w3.org/2000/svg"' not in std:
        std = std.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
    open(base + ".svg", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n' + std)
    svg_to_png(svg, base + ".png", scale=png_scale)
    svg_to_pdf(svg, base + ".pdf")
    return [base + ".svg", base + ".png", base + ".pdf"]
