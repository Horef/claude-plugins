"""Scripted evals for gui-design's look-loop tools (exit 0 pass, 1 fail, 2 not run).

Runs scripts/lint_ui.py and scripts/shot.py against the fixtures in evals/fixtures/ in a real headless Chrome:
  - good.html lints clean at 390/800/1280 in light and dark; the dark run really uses other colours;
  - bad.html reports every planted fault (overflow, clipping, 10px text, low contrast, unnamed icon button,
    small target, horizontal scroll at 390 only, console error, uncaught exception, overlap, 3 notices);
  - the --max-* limits turn density into problems;
  - shot.py writes the expected PNGs (right size, light differs from dark, --click and --full change the image,
    a missed --click selector exits 1), plus sheet.png when Pillow is installed;
  - the same works over http:// (fixtures served on a free local port), including delayed.html, which only
    renders its controls half a second after load, and a closed port exits 2.
No Chrome/Chromium/Edge (see scripts/browser.py find_chrome; $GUI_CHROME) means "not run" (2), never a pass.
Nothing is written into the skill folder; output goes to a temporary folder.
"""
import functools
import http.server
import json
import socket
import struct
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
FIX = HERE / "fixtures"
sys.path.insert(0, str(SCRIPTS))
sys.dont_write_bytecode = True

FAILS = []


def check(ok, what, detail=""):
    print("  %s %s%s" % ("ok  " if ok else "FAIL", what, ("  -> " + detail) if detail and not ok else ""))
    if not ok:
        FAILS.append(what)


def run(script, *args, timeout=240):
    p = subprocess.run([sys.executable, "-B", str(SCRIPTS / script)] + [str(a) for a in args],
                       capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


def lint_json(page, *args):
    code, out, err = run("lint_ui.py", page, "--json", *args)
    try:
        return code, json.loads(out), err
    except ValueError:
        return code, {"problems": [], "notes": [], "density": []}, out + err


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def serve(directory):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(directory))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    from browser import find_chrome
    if not find_chrome():
        print("gui-design evals: NOT RUN - no Chrome/Chromium/Edge found (set GUI_CHROME)")
        return 2
    try:
        import PIL  # noqa: F401
        have_pil = True
    except ImportError:
        have_pil = False

    good, bad = str(FIX / "good.html"), str(FIX / "bad.html")

    print("lint good.html")
    code, data, err = lint_json(good)
    check(code == 0 and not data["problems"], "good.html: no problems, exit 0", "exit %s, %s %s" % (code, data["problems"][:3], err[-200:]))
    check({(d["width"], d["theme"]) for d in data["density"]} == {(w, t) for w in (390, 800, 1280) for t in ("light", "dark")},
          "good.html: all six width x theme combinations ran")
    colors = {d["theme"]: set(d["textColors"]) for d in data["density"]}
    check(colors.get("light") and colors.get("light") != colors.get("dark"), "good.html: dark theme uses other text colours")

    print("lint bad.html")
    code, data, err = lint_json(bad, "--max-notices", "2")
    kinds = {p["kind"] for p in data["problems"]}
    check(code == 1, "bad.html: exit 1", "exit %s %s" % (code, err[-200:]))
    expect = {"text-overflow": "div.fixed", "text-clipped": "div.cut", "small-text": "p.tiny", "low-contrast": "div.grey",
              "no-accessible-name": "button.icon", "small-target": "button.icon", "page-hscroll": "div.wide",
              "overlap": "div.stack", "console-error": "bad.html", "exception": "bad.html", "density": "first screen"}
    for kind, sel in expect.items():
        hit = [p for p in data["problems"] if p["kind"] == kind and sel in p["selector"]]
        check(bool(hit), "bad.html reports %s on %s" % (kind, sel), "kinds seen: %s" % sorted(kinds))
    hs = {p["width"] for p in data["problems"] if p["kind"] == "page-hscroll"}
    check(hs == {390}, "page-hscroll only at 390px", str(sorted(hs)))
    check(all(d["notices"] == 3 for d in data["density"]), "density counts 3 notices on the first screen",
          str([d["notices"] for d in data["density"]]))
    code, data, _ = lint_json(bad, "--widths", "800", "--themes", "light", "--max-controls", "0", "--max-words", "5", "--max-boxes", "1")
    dens = [p["detail"] for p in data["problems"] if p["kind"] == "density"]
    check(len(dens) == 3, "--max-controls/--max-words/--max-boxes each add a density problem", str(dens))
    code, out, _ = run("lint_ui.py", bad, "--widths", "390", "--themes", "light")
    check("390 light: page-hscroll: div.wide:" in out, "text output uses `width theme: kind: selector: detail`", out[:300])

    print("shot.py")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        code, out, err = run("shot.py", good, "--out", tmp / "a")
        files = {p.name: p for p in (tmp / "a").glob("*.png")}
        check(code == 0 and len(files) == (7 if have_pil else 6), "good.html: six PNGs%s" % (" + sheet.png" if have_pil else ""), "exit %s %s" % (code, err[-200:]))
        sizes_ok = all(png_size(files.get("good-%d-%s.png" % (w, t), tmp)) == (w, 900) for w in (390, 800, 1280) for t in ("light", "dark"))
        check(sizes_ok, "PNG sizes are width x 900 (first screen only)")
        a, b = files.get("good-390-light.png"), files.get("good-390-dark.png")
        check(bool(a and b and a.read_bytes() != b.read_bytes()), "light and dark shots differ")
        if have_pil and a and b:
            from PIL import Image, ImageStat
            ml, md = (ImageStat.Stat(Image.open(p).convert("L")).mean[0] for p in (a, b))
            check(ml > 200 and md < 80, "light shot is bright, dark shot is dark", "means %.0f / %.0f" % (ml, md))
        if have_pil:
            check("sheet.png" in files and png_size(files["sheet.png"])[0] > 500, "contact sheet written")
        base = tmp / "b"
        run("shot.py", good, "--widths", "390", "--themes", "light", "--out", base)
        run("shot.py", good, "--widths", "390", "--themes", "light", "--click", "summary", "--out", tmp / "c")
        check((base / "good-390-light.png").read_bytes() != (tmp / "c" / "good-390-light.png").read_bytes(),
              "--click summary opens the details (image changes)")
        run("shot.py", good, "--widths", "390", "--themes", "light", "--click", "text=Recent activity", "--out", tmp / "c2")
        check((tmp / "c2" / "good-390-light.png").read_bytes() == (tmp / "c" / "good-390-light.png").read_bytes(),
              "--click text=Label does the same as the CSS selector")
        run("shot.py", good, "--widths", "390", "--themes", "light", "--height", "400", "--full", "--click", "summary", "--out", tmp / "d")
        full = png_size(tmp / "d" / "good-390-light.png")
        check(bool(full) and full[1] > 400, "--full is taller than --height", str(full))
        code, _, err = run("shot.py", good, "--widths", "390", "--themes", "light", "--click", "#nothing-here", "--out", tmp / "e")
        check(code == 1 and "nothing visible matches" in err, "--click that matches nothing exits 1", "exit %s %s" % (code, err[-200:]))

        print("over http://")
        srv = serve(FIX)
        base_url = "http://127.0.0.1:%d" % srv.server_address[1]
        try:
            code, data, err = lint_json(base_url + "/good.html", "--widths", "390,1280")
            check(code == 0 and not data["problems"], "URL: good.html lints clean", "exit %s %s" % (code, data["problems"][:3]))
            code, data, err = lint_json(base_url + "/bad.html", "--widths", "390", "--themes", "light")
            check(code == 1 and {"text-overflow", "console-error"} <= {p["kind"] for p in data["problems"]}, "URL: bad.html faults reported")
            code, data, err = lint_json(base_url + "/delayed.html", "--widths", "800", "--themes", "light")
            d = data["density"][0] if data["density"] else {}
            check(code == 0 and d.get("controls") == 3, "URL: waits for JS-rendered controls (delayed.html)", str(d.get("controls")) + " " + err[-200:])
            code, out, err = run("shot.py", base_url + "/delayed.html", "--widths", "800", "--themes", "light", "--wait-for", "#go", "--out", tmp / "f")
            check(code == 0 and (tmp / "f" / "sheet.png").exists() == have_pil and any((tmp / "f").glob("*800-light.png")),
                  "URL: shot.py with --wait-for", "exit %s %s" % (code, err[-200:]))
            code, out, err = run("shot.py", base_url + "/good.html", "--widths", "390", "--themes", "dark", "--out", tmp / "g")
            check(code == 0 and any((tmp / "g").glob("*390-dark.png")), "URL: shot.py writes the PNG", "exit %s %s" % (code, err[-200:]))
        finally:
            srv.shutdown()
        code, _, err = run("lint_ui.py", "http://127.0.0.1:%d/" % free_port())
        check(code == 2 and "NOT RUN" in err, "closed port exits 2 with a message", "exit %s %s" % (code, err[-200:]))

    print("gui-design evals: %s" % ("pass" if not FAILS else "FAIL (%d): %s" % (len(FAILS), "; ".join(FAILS))))
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(main())
