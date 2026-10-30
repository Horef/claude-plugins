"""The look step of draw -> render -> LOOK -> fix.

render(svgs, out_png): renders inline SVG strings exactly as a browser does
(Chromium via Playwright), at 2x, stacked on one sheet with names, plus
optional grayscale and deuteranopia versions (Wilke ch. 19-20: test in a
CVD simulator; a figure should survive grayscale).

Then: open the PNG with the Read tool and actually look at it.

Backends: Playwright + Chromium (via node) when found; otherwise a headless
Chrome/Chromium/Edge binary (macOS or Linux, see find_chrome). cvd_png /
cvd_sheet simulate colour-vision deficiency on any PNG with Pillow + numpy.
"""
import json
import os
import shutil
import subprocess
import tempfile
from urllib.parse import quote

import numpy as np

PLAYWRIGHT_DIRS = [
    "/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright",
    "/usr/lib/node_modules/playwright",
    "/usr/local/lib/node_modules/playwright",
]
CHROMIUM = "/opt/pw-browsers/chromium"

# fallback when Playwright is not installed (e.g. the Mac): a headless browser
CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]
CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium",
                "chromium-browser", "microsoft-edge", "chrome"]

_NODE = r"""
const pw = require(process.argv[2]);
const [html, out, exe] = process.argv.slice(3);
(async () => {
  const opts = {};
  if (exe) opts.executablePath = exe;
  const b = await pw.chromium.launch(opts);
  const p = await b.newPage({viewport: {width: 2400, height: 800}, deviceScaleFactor: 2});
  await p.goto('file://' + html);
  await p.waitForTimeout(150);
  const el = await p.$('#sheet');
  await el.screenshot({path: out});
  await b.close();
})();
"""

# Machado et al. 2009 deuteranopia, severity 1.0 (linear RGB)
_DEUTAN = "0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"
_GRAY = "0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"


_RESOLVED = []


def _node_playwright():
    """Folder node itself resolves `playwright` to (NODE_PATH, global installs), or None. Cached."""
    if not _RESOLVED:
        found = None
        if shutil.which("node"):
            try:
                r = subprocess.run(["node", "-e", "process.stdout.write(require.resolve('playwright/package.json'))"],
                                   cwd=tempfile.gettempdir(), capture_output=True, text=True, timeout=20)
                if r.returncode == 0 and r.stdout.strip():
                    found = os.path.dirname(r.stdout.strip())
            except (OSError, subprocess.TimeoutExpired):
                pass
        _RESOLVED.append(found)
    return _RESOLVED[0]


def _find_playwright():
    """Folder of a Playwright node module: $SF_PLAYWRIGHT, then PLAYWRIGHT_DIRS, then node's own resolution."""
    env = os.environ.get("SF_PLAYWRIGHT")
    for d in ([env] if env else []) + PLAYWRIGHT_DIRS:
        if os.path.isdir(d):
            return d
    found = _node_playwright()
    if found:
        return found
    raise RuntimeError("playwright module not found; set SF_PLAYWRIGHT or see PLAYWRIGHT_DIRS in check.py")


def playwright_ok():
    """True if node and a Playwright module are available (first choice)."""
    if not shutil.which("node"):
        return False
    try:
        _find_playwright()
        return True
    except RuntimeError:
        return False


def find_chrome():
    """Path of a headless-capable Chrome/Chromium/Edge: $SF_CHROME, then the
    macOS app bundles in CHROME_PATHS, then CHROME_NAMES on PATH. None if absent."""
    env = os.environ.get("SF_CHROME")
    if env and os.access(env, os.X_OK):
        return env
    for p in CHROME_PATHS:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    for n in CHROME_NAMES:
        w = shutil.which(n)
        if w:
            return w
    return None


def _trim_png(path, bg=(255, 255, 255), size=None):
    """Crop a PNG to its non-background content (top-left anchored), or to
    `size` (w, h) in pixels if given. Returns True if content touched the
    bottom edge (screenshot window may have been too short)."""
    from PIL import Image, ImageChops
    im = Image.open(path).convert("RGB")
    full_h = im.size[1]
    if size:
        box = (0, 0, min(size[0], im.size[0]), min(size[1], im.size[1]))
    else:
        box = ImageChops.difference(im, Image.new("RGB", im.size, bg)).getbbox()
        if box is None:
            box = (0, 0, im.size[0], im.size[1])
        box = (0, 0, box[2], box[3])
    im.crop(box).save(path)
    return box[3] >= full_h


def chrome_shot(html_path, out_png, width, height, scale=2.0, size=None):
    """Screenshot an HTML file with headless Chrome at `scale`x. The window
    needs a height, so give a generous one: the result is trimmed to its
    non-white content (or cropped to `size` = (w, h) CSS px if known); if the
    content fills the window the height is doubled and the shot repeated."""
    exe = find_chrome()
    if not exe:
        raise RuntimeError("no Playwright and no Chrome/Chromium/Edge found; "
                           "install one or set SF_CHROME to the binary")
    out_png = os.path.abspath(out_png)
    prof = tempfile.mkdtemp()
    try:
        for _ in range(4):
            cmd = [exe, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
                   "--no-first-run", "--disable-extensions", "--user-data-dir=" + prof,
                   f"--force-device-scale-factor={scale:g}",
                   f"--window-size={int(width)},{int(height)}",
                   "--virtual-time-budget=2000", "--screenshot=" + out_png,
                   "file://" + quote(html_path)]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if not os.path.exists(out_png):
                raise RuntimeError("headless Chrome wrote no screenshot: " + r.stderr[-1500:])
            px = None if size is None else (int(round(size[0] * scale)), int(round(size[1] * scale)))
            if not _trim_png(out_png, size=px) or size is not None:
                return out_png
            height *= 2
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    return out_png


def _sheet_shot(html, out_png, width, height=1500):
    """HTML with a #sheet element -> PNG of that element (Playwright if found,
    else headless Chrome with trailing white trimmed)."""
    tmp = tempfile.mkdtemp()
    try:
        hp = os.path.join(tmp, "sheet.html")
        open(hp, "w").write(html)
        if playwright_ok():
            js = os.path.join(tmp, "r.js")
            open(js, "w").write(_NODE)
            exe = CHROMIUM if os.path.exists(CHROMIUM) else ""
            r = subprocess.run(["node", js, _find_playwright(), hp, os.path.abspath(out_png), exe],
                               capture_output=True, text=True, timeout=120)
            if r.returncode:
                raise RuntimeError(r.stderr[-2000:])
        else:
            chrome_shot(hp, out_png, width, height)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out_png


def render_row(svgs, out_png, names=None, cell_width=320):
    """Render several SVGs side by side (one row) - for comparing variants."""
    names = names or [""] * len(svgs)
    cells = "".join(f'<div class="cell" style="width:{cell_width}px"><div class="nm">{n}</div>{s}</div>'
                    for n, s in zip(names, svgs))
    return _shoot(f'<div class="row">{cells}</div>', out_png,
                  width=len(svgs) * (cell_width + 12) + 40)


def _shoot(inner, out_png, width=2400):
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#fff}} #sheet{{display:inline-block;padding:12px;background:#d9d9d9}}
.row{{display:flex;gap:12px;align-items:flex-start}} .cell{{background:#fff;padding:8px;box-sizing:border-box}}
.nm{{font:11px Helvetica,Arial,sans-serif;color:#888;margin-bottom:4px}}
</style></head><body><div id="sheet">{inner}</div></body></html>"""
    return _sheet_shot(html, out_png, width)


def render(svgs, out_png, names=None, cvd=False, page_width=700, body_css=""):
    """Render one or more inline-SVG strings to a single PNG sheet.

    svgs: str or list of str. names: optional captions above each.
    cvd=True adds grayscale + deuteranopia copies beside each figure.
    page_width ~ the DEVONthink reading column; figures scale like they do
    there (max-width:100%)."""
    if isinstance(svgs, str):
        svgs = [svgs]
    names = names or [f"figure {i+1}" for i in range(len(svgs))]
    rows = []
    for nm, s in zip(names, svgs):
        cells = [f'<div class="cell"><div class="nm">{nm}</div>{s}</div>']
        if cvd:
            cells.append(f'<div class="cell"><div class="nm">{nm} - grayscale</div>'
                         f'<div style="filter:url(#gray)">{s}</div></div>')
            cells.append(f'<div class="cell"><div class="nm">{nm} - deuteranopia</div>'
                         f'<div style="filter:url(#deutan)">{s}</div></div>')
        rows.append('<div class="row">' + "".join(cells) + "</div>")
    filters = (
        '<svg width="0" height="0" style="position:absolute"><defs>'
        f'<filter id="gray" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="{_GRAY}"/></filter>'
        f'<filter id="deutan" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="{_DEUTAN}"/></filter>'
        "</defs></svg>")
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#fff;font-family:Helvetica,Arial,sans-serif;{body_css}}}
#sheet{{display:inline-block;padding:12px;background:#d9d9d9}}
.row{{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start}}
.cell{{background:#fff;width:{page_width}px;padding:8px;box-sizing:border-box}}
.nm{{font:11px Helvetica,Arial,sans-serif;color:#888;margin-bottom:4px}}
</style></head><body>{filters}<div id="sheet">{''.join(rows)}</div></body></html>"""
    ncol = 3 if cvd else 1
    return _sheet_shot(html, out_png, ncol * (page_width + 12) + 40,
                       height=max(1500, 700 * len(svgs)))


import re as _re

# colours only: never touch id references like url(#fig-1) or href="#fig-1"
_HEX = _re.compile(r"(?<!\()(?<!href=\")(?<!xlink:href=\")#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])")


def hex_to_rgb(svg):
    """DEVONthink turns '#0072b2' in a Markdown note into a TAG (hashtag
    detection). Write every colour as rgb(r,g,b) instead."""
    def rep(m):
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return "rgb({},{},{})".format(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return _HEX.sub(rep, svg)


def check_inline(svg):
    """Static checks for DEVONthink inline SVG. Returns list of problems."""
    p = []
    if "\n" in svg:
        p.append("SVG spans several lines - must be ONE line")
    if "&" in svg.replace("&amp;", "").replace("&lt;", "").replace("&gt;", "").replace("&quot;", "").replace("&#", ""):
        p.append("raw '&' in SVG")
    if not _re.search(r'<rect width="100%" height="100%" fill="(#fff|#ffffff|rgb\(255,255,255\))"', svg[:1500]) \
            and not _re.search(r'fill="(#ffffff|rgb\(255,255,255\))"/>', svg[:1500]):
        p.append("no white background rect near the start")
    if _HEX.search(svg):
        p.append("hex colour '#rrggbb' present - DEVONthink makes it a tag; use hex_to_rgb()")
    if "<script" in svg or "<foreignObject" in svg:
        p.append("script/foreignObject not allowed")
    if "currentColor" in svg:
        p.append("currentColor used - use explicit colours (DEVONthink themes)")
    if len(svg) > 150_000:
        p.append(f"SVG is large ({len(svg)//1000} kB) - simplify or rasterize dense layers")
    return p


# ---------------------------------------------------------------- colour-vision check (no browser)
# Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
CVD_MATRICES = {
    "deuteranopia": [[0.367322, 0.860646, -0.227968],
                     [0.280085, 0.672501, 0.047413],
                     [-0.011820, 0.042940, 0.968881]],
    "protanopia": [[0.152286, 1.052583, -0.204868],
                   [0.114503, 0.786281, 0.099216],
                   [-0.003882, -0.048116, 1.051998]],
    "tritanopia": [[1.255528, -0.076749, -0.178779],
                   [-0.078411, 0.930809, 0.147602],
                   [0.004733, 0.691367, 0.303900]],
}
_LUM = (0.2126, 0.7152, 0.0722)


def _srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def cvd_simulate(im, kind):
    """PIL image -> PIL image as seen with `kind` ("grayscale", "deuteranopia",
    "protanopia", "tritanopia"). Transparency is composited on white."""
    from PIL import Image
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    lin = _srgb_to_lin(np.asarray(im.convert("RGB"), dtype=np.float64) / 255.0)
    if kind == "grayscale":
        y = lin @ np.array(_LUM)
        out = np.repeat(y[..., None], 3, axis=2)
    elif kind in CVD_MATRICES:
        out = lin @ np.array(CVD_MATRICES[kind]).T
    else:
        raise ValueError(f"unknown kind {kind!r}; use grayscale or one of {sorted(CVD_MATRICES)}")
    return Image.fromarray((_lin_to_srgb(out) * 255.0 + 0.5).astype(np.uint8), "RGB")


def cvd_png(png_path, out_dir=None, kinds=("grayscale", "deuteranopia", "protanopia")):
    """Write simulated colour-vision versions of a PNG (Pillow + numpy, no
    browser). Default out_dir: a `_cvd/` folder next to the input. Returns
    the list of written paths (name_<kind>.png)."""
    from PIL import Image
    png_path = os.path.abspath(png_path)
    out_dir = out_dir or os.path.join(os.path.dirname(png_path), "_cvd")
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(png_path))[0]
    im = Image.open(png_path)
    paths = []
    for k in kinds:
        p = os.path.join(out_dir, f"{base}_{k}.png")
        cvd_simulate(im, k).save(p)
        paths.append(p)
    return paths


def _label_font(size):
    from PIL import ImageFont
    for f in ("/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def cvd_sheet(png_path, out_png, kinds=("grayscale", "deuteranopia", "protanopia")):
    """One labelled image: the original and its simulated versions, for a
    single look. Wide figures go in a 2-column grid, tall ones in one row."""
    from PIL import Image, ImageDraw
    im = Image.open(png_path)
    if im.mode in ("RGBA", "LA", "P"):
        im = Image.alpha_composite(Image.new("RGBA", im.size, (255, 255, 255, 255)),
                                   im.convert("RGBA"))
    im = im.convert("RGB")
    panels = [("original", im)] + [(k, cvd_simulate(im, k)) for k in kinds]
    w, h = im.size
    pad, gap = 16, 16
    fs = max(14, int(round(min(w, 2400) / 45)))
    font = _label_font(fs)
    head = fs + 12
    cols = 2 if w > 1.3 * h else len(panels)
    rows = -(-len(panels) // cols)
    W = pad * 2 + cols * w + (cols - 1) * gap
    H = pad * 2 + rows * (h + head) + (rows - 1) * gap
    sheet = Image.new("RGB", (W, H), (217, 217, 217))
    d = ImageDraw.Draw(sheet)
    for i, (name, p) in enumerate(panels):
        r, c = divmod(i, cols)
        x, y = pad + c * (w + gap), pad + r * (h + head + gap)
        d.text((x, y + 2), name, fill=(60, 60, 60), font=font)
        sheet.paste(p, (x, y + head))
    sheet.save(out_png)
    return out_png
