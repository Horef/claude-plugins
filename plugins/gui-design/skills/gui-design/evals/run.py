"""Scripted evals for gui-design's look-loop tools (exit 0 pass, 1 fail, 2 not run).

Runs scripts/lint_ui.py and scripts/shot.py against the fixtures in evals/fixtures/ in a real headless Chrome:
  - good.html lints clean at 390/800/1280 in light and dark; the dark run really uses other colours;
  - bad.html reports every planted fault (overflow, clipping, 10px text, low contrast, unnamed icon button,
    small target, horizontal scroll at 390 only, console error, uncaught exception, overlap, 3 notices);
  - the --max-* limits turn density into problems;
  - host.html (a clean page embedding three frames): faults inside its srcdoc frame are reported with the frame
    prefix and in the frame's own density line, nothing is blamed on the host, a frame below the fold has zero
    first-screen density, --max-* limits apply per frame; a file:// host cannot read the file:// frame (a note,
    not a pass), but over http:// the good.html frame is checked, clean, and follows the dark theme;
  - shot.py writes the expected PNGs (right size, light differs from dark, --click and --full change the image,
    a missed --click selector exits 1), plus sheet.png (Pillow, or the browser when Pillow is missing);
  - nav.html: navigation controls are counted apart from the page's; the browser has WebGL;
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

    print("lint host.html (iframes)")
    host = str(FIX / "host.html")
    code, data, err = lint_json(host, "--widths", "390,1280", "--themes", "light,dark")
    f1 = [p for p in data["problems"] if p.get("frame", "") and p["frame"].startswith("iframe#1 ")]
    got = {(p["kind"], p["selector"].split(".")[0] + "." + p["selector"].split(".")[-1]) for p in f1}
    for kind, sel in (("text-overflow", "div.fixed"), ("low-contrast", "p.grey"), ("no-accessible-name", "button.icon"),
                      ("small-target", "button.icon")):
        check((kind, sel) in got, "host.html: %s on %s reported inside the srcdoc frame" % (kind, sel), str(sorted(got)))
    check(all(p.get("frame") for p in data["problems"]), "host.html: no problem is blamed on the host page itself",
          str([p for p in data["problems"] if not p.get("frame")][:2]))
    check({(p["width"], p["theme"]) for p in f1} >= {(w, t) for w in (390, 1280) for t in ("light", "dark")},
          "host.html: frame faults found at every width x theme")
    code, out, _ = run("lint_ui.py", host, "--widths", "390", "--themes", "light")
    check("390 light: low-contrast: iframe#1 (Faulty embed) > p.grey:" in out, "host.html: text output puts the frame before the selector", out[:300])
    fd = {d["frame"]: d for d in data["density"] if d["width"] == 1280 and d["theme"] == "light"}
    check(set(fd) == {None, "iframe#1 (Faulty embed)", "iframe#3 (Far embed)"}, "host.html: one density line per readable frame", str(sorted(map(str, fd))))
    f1d, far = fd.get("iframe#1 (Faulty embed)", {}), fd.get("iframe#3 (Far embed)", {})
    check(f1d.get("controls") == 1 and f1d.get("words", 0) >= 4, "host.html: frame density counts the frame's own controls and words", str(f1d.get("controls")))
    check(far.get("onFirstScreen") is False and far.get("controls") == 0 and far.get("words") == 0,
          "host.html: a frame below the fold has zero first-screen density", str(far))
    skipped = [n for n in data["notes"] if n["kind"] == "frame-skipped"]
    check(any("Good embed" in n["selector"] for n in skipped), "host.html (file://): the unreadable file:// frame is a frame-skipped note", str(skipped[:1]))
    code, data, _ = lint_json(host, "--widths", "1280", "--themes", "light", "--max-controls", "0", "--max-words", "1")
    dens = [(p["frame"], p["detail"]) for p in data["problems"] if p["kind"] == "density"]
    check({f for f, _ in dens} == {None, "iframe#1 (Faulty embed)"} and any("controls" in d for f, d in dens if f),
          "host.html: --max-* limits apply to each frame separately", str(dens))
    check(not any(p["frame"] == "iframe#3 (Far embed)" for p in data["problems"] if p["kind"] == "density"),
          "host.html: a frame below the fold never breaks a first-screen limit")

    code, data, err = lint_json(FIX / "nav.html", "--widths", "1280", "--themes", "light", "--max-controls", "3")
    d = data["density"][0] if data["density"] else {}
    check(d.get("controls") == 2 and d.get("navControls") == 5, "nav.html: navigation controls are counted apart",
          "%s / %s" % (d.get("controls"), d.get("navControls")))
    check(not [p for p in data["problems"] if p["kind"] == "density"], "nav.html: --max-controls judges the page without its navigation",
          str(data["problems"][:2]))
    from browser import Browser, to_url
    with Browser() as b:
        pg = b.new_page()
        pg.set_view(400, 300, 1.0, "light")
        pg.goto(to_url(str(FIX / "nav.html")))
        pg.settle(300, 10, None)
        check(pg.evaluate("document.body.dataset.webgl") == "yes", "the headless browser has WebGL (Plotly 3D, maps)")

    print("shot.py")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        code, out, err = run("shot.py", good, "--out", tmp / "a")
        files = {p.name: p for p in (tmp / "a").glob("*.png")}
        check(code == 0 and len(files) == 7, "good.html: six PNGs + sheet.png (with or without Pillow)", "exit %s %s" % (code, err[-200:]))
        sizes_ok = all(png_size(files.get("good-%d-%s.png" % (w, t), tmp)) == (w, 900) for w in (390, 800, 1280) for t in ("light", "dark"))
        check(sizes_ok, "PNG sizes are width x 900 (first screen only)")
        a, b = files.get("good-390-light.png"), files.get("good-390-dark.png")
        check(bool(a and b and a.read_bytes() != b.read_bytes()), "light and dark shots differ")
        if have_pil and a and b:
            from PIL import Image, ImageStat
            ml, md = (ImageStat.Stat(Image.open(p).convert("L")).mean[0] for p in (a, b))
            check(ml > 200 and md < 80, "light shot is bright, dark shot is dark", "means %.0f / %.0f" % (ml, md))
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
            code, data, err = lint_json(base_url + "/host.html", "--widths", "390,1280")
            frames_seen = {d["frame"] for d in data["density"]}
            check("iframe#2 (Good embed)" in frames_seen, "URL: host.html reads the same-origin frame pointing to good.html", str(sorted(map(str, frames_seen))))
            check(not [n for n in data["notes"] if n["kind"] == "frame-skipped"], "URL: no frame is skipped over http://", str(data["notes"][:1]))
            check(not [p for p in data["problems"] if (p.get("frame") or "").startswith("iframe#2")],
                  "URL: the good.html frame adds no problems", str([p for p in data["problems"] if (p.get("frame") or "").startswith("iframe#2")][:2]))
            check({p["frame"] for p in data["problems"]} == {"iframe#1 (Faulty embed)"}, "URL: only the faulty frame has problems",
                  str({p["frame"] for p in data["problems"]}))
            gd = {d["theme"]: d for d in data["density"] if d["frame"] == "iframe#2 (Good embed)" and d["width"] == 1280}
            check(len(gd) == 2 and gd["light"]["controls"] >= 3 and gd["light"]["textColors"] != gd["dark"]["textColors"],
                  "URL: the good.html frame has its own density and follows the dark theme", str(gd.get("light", {}).get("textColors")))
            code, data, err = lint_json(base_url + "/delayed.html", "--widths", "800", "--themes", "light")
            d = data["density"][0] if data["density"] else {}
            check(code == 0 and d.get("controls") == 3, "URL: waits for JS-rendered controls (delayed.html)", str(d.get("controls")) + " " + err[-200:])
            code, out, err = run("shot.py", base_url + "/delayed.html", "--widths", "800", "--themes", "light", "--wait-for", "#go", "--out", tmp / "f")
            check(code == 0 and (tmp / "f" / "sheet.png").exists() and any((tmp / "f").glob("*800-light.png")),
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
