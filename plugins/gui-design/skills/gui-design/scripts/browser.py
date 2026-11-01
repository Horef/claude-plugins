"""Headless Chrome driver shared by shot.py and lint_ui.py (Python 3 standard library only).

Starts Chrome/Chromium/Edge headless with a throw-away profile and talks to it over the DevTools
protocol through a minimal built-in websocket client, so no Playwright, Selenium or pip package is needed.
Works on a local HTML file and on a URL (e.g. a Streamlit app on http://localhost:8501): `Page.settle`
waits until the DOM has been quiet for a while, because such pages render by JavaScript after load.

Browser lookup: $GUI_CHROME, $SF_CHROME, the macOS app bundles in CHROME_PATHS, then CHROME_NAMES on PATH.
`BrowserUnavailable` is raised when none is found (scripts exit 2 = "not run").

Not a command-line tool; import it:  from browser import Browser, to_url
"""
import base64
import json
import os
import shutil
import signal
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]
CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
                "microsoft-edge", "chrome"]


class BrowserUnavailable(RuntimeError):
    """No usable Chrome/Chromium/Edge (or it failed to start)."""


class LoadError(RuntimeError):
    """The page could not be loaded (connection refused, bad file, ...)."""


class CDPError(RuntimeError):
    """The browser answered a DevTools command with an error, or a script threw."""


def find_chrome():
    """Path of a headless-capable Chrome/Chromium/Edge, or None."""
    for var in ("GUI_CHROME", "SF_CHROME"):
        env = os.environ.get(var)
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


def to_url(page):
    """A URL (http, https, file) is returned as is; anything else is a file path -> file:// URL."""
    if "://" in page.split("?")[0][:12]:
        return page
    p = Path(page).expanduser().resolve()
    if not p.exists():
        raise LoadError("no such file: %s" % page)
    return p.as_uri()


def page_stem(page):
    """Short file-name stem for a page argument (file name without extension, or host-port-path for URLs)."""
    if "://" in page.split("?")[0][:12]:
        u = urlparse(page)
        raw = (u.netloc + u.path).strip("/")
    else:
        raw = Path(page).stem
    stem = "".join(c if c.isalnum() or c in "-_" else "-" for c in raw).strip("-")
    return stem[:40] or "page"


class _WebSocket:
    """Just enough of RFC 6455 for DevTools: text frames, fragmentation, ping/pong, close."""

    def __init__(self, url):
        u = urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=10)
        self.buf = bytearray()
        self._partial = bytearray()
        key = base64.b64encode(os.urandom(16)).decode()
        path = u.path + ("?" + u.query if u.query else "")
        req = ("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, u.hostname, u.port, key))
        self.sock.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("websocket handshake failed")
            head += chunk
        head, _, rest = head.partition(b"\r\n\r\n")
        if b" 101 " not in head.split(b"\r\n")[0]:
            raise ConnectionError("websocket handshake refused: " + head.split(b"\r\n")[0].decode(errors="replace"))
        self.buf += rest

    def _need(self, n, deadline):
        while len(self.buf) < n:
            left = deadline - time.monotonic()
            if left <= 0:
                raise TimeoutError("timed out waiting for the browser")
            self.sock.settimeout(left)
            try:
                chunk = self.sock.recv(1 << 16)
            except socket.timeout:
                raise TimeoutError("timed out waiting for the browser")
            if not chunk:
                raise ConnectionError("browser closed the connection")
            self.buf += chunk

    def _frame(self, deadline):
        """Next frame as (opcode, fin, payload); consumes nothing if it times out half way."""
        self._need(2, deadline)
        b0, b1 = self.buf[0], self.buf[1]
        ln, off = b1 & 0x7F, 2
        if ln == 126:
            self._need(4, deadline)
            ln, off = struct.unpack(">H", bytes(self.buf[2:4]))[0], 4
        elif ln == 127:
            self._need(10, deadline)
            ln, off = struct.unpack(">Q", bytes(self.buf[2:10]))[0], 10
        mask = b""
        if b1 & 0x80:
            self._need(off + 4, deadline)
            mask, off = bytes(self.buf[off:off + 4]), off + 4
        self._need(off + ln, deadline)
        payload = bytes(self.buf[off:off + ln])
        del self.buf[:off + ln]
        if mask:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return b0 & 0x0F, bool(b0 & 0x80), payload

    def _send_frame(self, opcode, payload):
        n = len(payload)
        head = bytes([0x80 | opcode])
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            head += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload)) if n < 4096 else _xor(payload, mask)
        self.sock.settimeout(30)
        self.sock.sendall(head + mask + masked)

    def send(self, text):
        self._send_frame(1, text.encode())

    def recv(self, timeout):
        """Next complete text message (str). Raises TimeoutError after `timeout` seconds."""
        deadline = time.monotonic() + timeout
        while True:
            op, fin, payload = self._frame(deadline)
            if op == 9:
                self._send_frame(10, payload)
                continue
            if op == 10:
                continue
            if op == 8:
                raise ConnectionError("browser closed the connection")
            if op in (1, 2):
                self._partial = bytearray(payload)
            elif op == 0:
                self._partial += payload
            if fin:
                msg, self._partial = bytes(self._partial), bytearray()
                return msg.decode("utf-8", "replace")

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def _xor(payload, mask):
    """XOR a large payload with a 4-byte mask quickly (big-integer trick)."""
    n = len(payload)
    full = (mask * (n // 4 + 1))[:n]
    return (int.from_bytes(payload, "big") ^ int.from_bytes(full, "big")).to_bytes(n, "big")


_INSTALL_OBSERVER = """
window.__guiLast = performance.timeOrigin + performance.now();    // absolute, so frames compare
new MutationObserver(function () { window.__guiLast = performance.timeOrigin + performance.now(); })
  .observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
"""

# resolves once the DOM has been quiet for `quiet` ms (and waitFor, if given, is visible); gives up after maxMs
_SETTLE = """
(function (quiet, maxMs, waitFor) {
  var t0 = performance.now(), abs0 = performance.timeOrigin + t0;
  function wins() {                       // this window and every reachable (same-origin) frame below it
    var out = [window];
    (function walk(w, depth) {
      var fr = w.document.querySelectorAll('iframe');
      for (var i = 0; i < fr.length && depth < 3; i++) {
        try { var cw = fr[i].contentWindow; if (cw && cw.document) { out.push(cw); walk(cw, depth + 1); } } catch (e) {}
      }
    })(window, 0);
    return out;
  }
  function busy(ws) {
    return ws.some(function (w) { return !!w.document.querySelector('[data-teststate="running"],[aria-busy="true"]'); }) ||
      ws.some(function (w) { return w.document.readyState === 'loading'; });
  }
  function textual() { return document.body && document.body.innerText.trim().length > 0; }
  function found() {
    if (!waitFor) return true;
    var e = document.querySelector(waitFor);
    return !!e && e.checkVisibility();
  }
  return new Promise(function (resolve) {
    (function tick() {
      var now = performance.now(), ws = wins();
      var last = Math.max.apply(null, ws.map(function (w) { return w.__guiLast || abs0; }));
      var quietFor = performance.timeOrigin + now - last;
      var done = quietFor >= quiet && found() && !busy(ws) && (textual() || now - t0 > maxMs / 2);
      if (done || now - t0 > maxMs) {
        resolve({timedOut: !done, waitFor: waitFor ? found() : null, ms: Math.round(now - t0)});
      } else setTimeout(tick, 50);
    })();
  });
})
"""

_CLICK_TARGET = """
(function (sel) {
  var el = null;
  if (sel.indexOf('text=') === 0) {
    var t = sel.slice(5).trim().toLowerCase(), best = null;
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e instanceof SVGElement || !e.checkVisibility()) continue;
      var tx = (e.innerText || '').trim().toLowerCase();
      if (tx && tx.indexOf(t) >= 0 && (!best || tx.length < best.len)) best = {e: e, len: tx.length};
    }
    el = best && best.e;
  } else {
    var list = document.querySelectorAll(sel);
    for (var j = 0; j < list.length; j++) { if (list[j].checkVisibility()) { el = list[j]; break; } }
  }
  if (!el) return null;
  var r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
    el.scrollIntoView({block: 'center', inline: 'center'});
    r = el.getBoundingClientRect();
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
})
"""

_FULL_HEIGHT = """
(function () {
  var de = document.documentElement, need = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);
  var all = document.body ? document.body.querySelectorAll('*') : [];
  for (var i = 0; i < all.length; i++) {            // apps that scroll inside a big inner container (Streamlit)
    var e = all[i], cs = getComputedStyle(e);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 50 &&
        e.clientHeight * e.clientWidth > 0.5 * innerHeight * innerWidth) {
      need = Math.max(need, Math.round(e.getBoundingClientRect().top + e.scrollHeight));
    }
  }
  return need;
})()
"""


class Page:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0
        self.events = []
        self.view = (1280, 900, 1.0, "light")

    # -- protocol ----------------------------------------------------------------------------------
    def call(self, method, params=None, timeout=30):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        while True:
            msg = json.loads(self.ws.recv(max(0.05, deadline - time.monotonic())))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise CDPError("%s: %s" % (method, msg["error"].get("message", msg["error"])))
                return msg.get("result", {})
            if "method" in msg:
                self.events.append(msg)

    def evaluate(self, expression, await_promise=False, timeout=30):
        r = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True,
                                           "awaitPromise": await_promise}, timeout)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise CDPError("script error: " + ((d.get("exception") or {}).get("description") or d.get("text", "")))
        return r.get("result", {}).get("value")

    def wait_event(self, name, since=0, timeout=30):
        """True when an event called `name` arrived (after index `since` of self.events)."""
        deadline = time.monotonic() + timeout
        i = since
        while True:
            while i < len(self.events):
                if self.events[i].get("method") == name:
                    return True
                i += 1
            left = deadline - time.monotonic()
            if left <= 0:
                return False
            try:
                msg = json.loads(self.ws.recv(left))
            except TimeoutError:
                return False
            if "method" in msg:
                self.events.append(msg)

    def pump(self, seconds):
        """Keep reading events for `seconds` (so late console messages are not missed)."""
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            try:
                msg = json.loads(self.ws.recv(max(0.01, end - time.monotonic())))
            except TimeoutError:
                return
            if "method" in msg:
                self.events.append(msg)

    # -- viewport and navigation -------------------------------------------------------------------
    def set_view(self, width, height, scale=1.0, theme="light"):
        """Viewport size, device scale and emulated prefers-color-scheme (light|dark)."""
        self.view = (width, height, scale, theme)
        self.call("Emulation.setDeviceMetricsOverride", {"width": int(width), "height": int(height),
                                                         "deviceScaleFactor": scale, "mobile": False})
        self.call("Emulation.setEmulatedMedia", {"features": [
            {"name": "prefers-color-scheme", "value": theme},
            {"name": "prefers-reduced-motion", "value": "reduce"}]})

    def goto(self, url, timeout=45):
        """Navigate and wait for the load event. Raises LoadError if the page cannot be loaded."""
        self.events = []
        r = self.call("Page.navigate", {"url": url}, timeout)
        if r.get("errorText"):
            raise LoadError("cannot load %s: %s" % (url, r["errorText"]))
        if not self.wait_event("Page.loadEventFired", 0, timeout):
            self.events.append({"method": "gui.warning", "params": {"text": "load event not seen within %ds" % timeout}})

    def settle(self, quiet_ms=800, timeout_s=15, wait_for=None):
        """Wait until the DOM has been quiet for quiet_ms (and `wait_for` CSS is visible). Returns a dict;
        timedOut=True means it stopped waiting at timeout_s, waitFor=False means the selector never appeared."""
        expr = "%s(%d, %d, %s)" % (_SETTLE, quiet_ms, timeout_s * 1000, json.dumps(wait_for))
        return self.evaluate(expr, await_promise=True, timeout=timeout_s + 10)

    # -- interaction -------------------------------------------------------------------------------
    def click(self, selector):
        """Real mouse click on the first visible match of a CSS selector, or of `text=Some label`
        (the smallest visible element containing that text). Raises CDPError if nothing matches."""
        pos = self.evaluate("%s(%s)" % (_CLICK_TARGET, json.dumps(selector)))
        if not pos:
            raise CDPError("--click: nothing visible matches %r" % selector)
        for typ in ("mouseMoved", "mousePressed", "mouseReleased"):
            self.call("Input.dispatchMouseEvent", {"type": typ, "x": pos["x"], "y": pos["y"],
                                                   "button": "left", "clickCount": 1})
        self.settle(quiet_ms=400, timeout_s=8)

    def screenshot(self, path, full=False, max_height=12000):
        """PNG of the viewport (first screen), or of the whole page with full=True (the viewport is made as
        tall as the content, up to max_height; apps scrolling in an inner container are handled too)."""
        w, h, scale, theme = self.view
        restore = False
        if full:
            need = min(int(self.evaluate(_FULL_HEIGHT)), max_height)
            if need > h:
                self.set_view(w, need, scale, theme)
                restore = True
                time.sleep(0.4)
        try:
            r = self.call("Page.captureScreenshot", {"format": "png"}, timeout=60)
        finally:
            if restore:
                self.set_view(w, h, scale, theme)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(base64.b64decode(r["data"]))
        return path

    # -- diagnostics collected since the last goto() -----------------------------------------------
    def console_problems(self):
        """[(kind, location, text)] for console.error calls, uncaught exceptions and failed resource loads."""
        out = []
        for ev in self.events:
            m, p = ev.get("method"), ev.get("params", {})
            if m == "Runtime.consoleAPICalled" and p.get("type") in ("error", "assert"):
                text = " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))
                frames = (p.get("stackTrace") or {}).get("callFrames") or [{}]
                out.append(("console-error", _loc(frames[0].get("url"), frames[0].get("lineNumber")), text))
            elif m == "Runtime.exceptionThrown":
                d = p.get("exceptionDetails", {})
                text = ((d.get("exception") or {}).get("description") or d.get("text") or "").splitlines()[0]
                out.append(("exception", _loc(d.get("url"), d.get("lineNumber")), text))
            elif m == "Log.entryAdded":
                e = p.get("entry", {})
                if e.get("level") == "error" and e.get("source") not in ("javascript", "console-api"):
                    if (e.get("url") or "").split("?")[0].endswith("favicon.ico"):
                        continue
                    out.append(("console-error", _loc(e.get("url"), e.get("lineNumber")), e.get("text", "")))
        seen, uniq = set(), []
        for item in out:
            if item not in seen:
                seen.add(item)
                uniq.append(item)
        return uniq

    def warnings(self):
        return [ev["params"]["text"] for ev in self.events if ev.get("method") == "gui.warning"]


def _loc(url, line):
    name = (url or "").rsplit("/", 1)[-1].split("?")[0] or "page"
    return "%s:%s" % (name, (line or 0) + 1) if line is not None else name


class Browser:
    """Context manager: `with Browser() as b: page = b.new_page()`."""

    def __init__(self):
        self.proc = None
        self.profile = None
        self.port = None
        self.page = None

    def __enter__(self):
        exe = find_chrome()
        if not exe:
            raise BrowserUnavailable("no Chrome/Chromium/Edge found; install one or set GUI_CHROME to the binary")
        self.profile = tempfile.mkdtemp(prefix="gui-chrome-")
        args = [exe, "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + self.profile,
                "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
                "--force-color-profile=srgb", "--disable-extensions", "--disable-background-networking",
                "--disable-component-update", "--disable-sync", "--mute-audio"]
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            args.append("--no-sandbox")
        args.append("about:blank")
        try:
            self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                         start_new_session=True)
        except OSError as e:
            self._cleanup()
            raise BrowserUnavailable("cannot start %s: %s" % (exe, e))
        port_file = Path(self.profile) / "DevToolsActivePort"
        end = time.monotonic() + 20
        while time.monotonic() < end:
            if self.proc.poll() is not None:
                self._cleanup()
                raise BrowserUnavailable("%s exited immediately (code %s)" % (exe, self.proc.returncode))
            if port_file.exists() and port_file.read_text().strip():
                self.port = int(port_file.read_text().split()[0])
                break
            time.sleep(0.05)
        if not self.port:
            self._cleanup()
            raise BrowserUnavailable("%s did not open its DevTools port within 20 s" % exe)
        return self

    def __exit__(self, *exc):
        self._cleanup()

    def _http(self, path, method="GET"):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (self.port, path), method=method)
        with opener.open(req, timeout=10) as r:
            return json.loads(r.read().decode())

    def new_page(self):
        """The browser's tab, ready: Page/Runtime/Log events on, DOM-quiet observer installed on every load."""
        targets = [t for t in self._http("/json/list") if t.get("type") == "page"]
        if not targets:
            targets = [self._http("/json/new?about:blank", "PUT")]
        page = Page(_WebSocket(targets[0]["webSocketDebuggerUrl"]))
        for domain in ("Page", "Runtime", "Log"):
            page.call(domain + ".enable")
        page.call("Page.addScriptToEvaluateOnNewDocument", {"source": _INSTALL_OBSERVER})
        self.page = page
        return page

    def _cleanup(self):
        if self.page:
            self.page.ws.close()
            self.page = None
        if self.proc and self.proc.poll() is None:
            try:
                os.killpg(self.proc.pid, signal.SIGTERM)
            except (OSError, ProcessLookupError):
                self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(self.proc.pid, signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    self.proc.kill()
        self.proc = None
        if self.profile:
            shutil.rmtree(self.profile, ignore_errors=True)
            self.profile = None
