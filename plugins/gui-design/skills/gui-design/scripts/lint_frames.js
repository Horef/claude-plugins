// Frame walker for lint_ui.py: runs the lint_ui.js checks in the top document and in every readable iframe.
/* Frame walker for lint_ui.py. A function expression called as (<this file>)(lint, opts) through Runtime.evaluate,
   where `lint` is the function from lint_ui.js. It runs `lint` in the top document, then in every iframe it can
   reach (same-origin and srcdoc, nested up to 3 deep), and returns a list of
     {frame: null | "iframe#N (title or src)", result: <lint result>}            checked
     {frame: "iframe#N (...)", skipped: "<why>"}                                  not checked (a note)
   The top document is run directly (works under a strict CSP); frames run the same source through the frame's own
   eval so that its globals, SVG classes and viewport are the frame's. Frames that are not displayed are ignored.
   Each frame gets opts.clip: the part of it visible in the top viewport, in the frame's coordinates, so its density
   is the density of what the person sees first. */
(function (lint, opts) {
  var out = [], counter = 0, src = '(' + lint.toString() + ')';
  var NONE = {left: -1e9, top: -1e9, right: -1e9, bottom: -1e9};          // nothing of this frame is on the first screen

  function labelOf(el, n) {
    var t = (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
    if (!t) {
      var s = el.getAttribute('src');
      t = s ? s.replace(/^https?:\/\/[^/]+/, '') : 'srcdoc';
    }
    if (t.length > 40) t = t.slice(0, 39) + '…';
    return 'iframe#' + n + ' (' + t + ')';
  }

  function walk(win, clip, depth) {
    var frames = win.document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var el = frames[i];
      if (!el.checkVisibility()) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      var label = labelOf(el, ++counter), cw = null, doc = null;
      try { cw = el.contentWindow; doc = cw && cw.document; } catch (e) { doc = null; }
      if (!doc) {
        out.push({frame: label, skipped: 'cross-origin or sandboxed frame, not checked'});
        continue;
      }
      if (!doc.body) {
        out.push({frame: label, skipped: 'frame has no body yet (still loading or empty), not checked'});
        continue;
      }
      var l = r.left + el.clientLeft, t = r.top + el.clientTop;
      var x0 = Math.max(l, clip.left), x1 = Math.min(l + el.clientWidth, clip.right);
      var y0 = Math.max(t, clip.top), y1 = Math.min(t + el.clientHeight, clip.bottom);
      var sub = (x1 > x0 && y1 > y0) ? {left: x0 - l, top: y0 - t, right: x1 - l, bottom: y1 - t} : NONE;
      var res;
      try {
        res = cw.eval(src)(Object.assign({}, opts, {clip: sub}));
      } catch (e) {
        out.push({frame: label, skipped: 'checks could not run in the frame (' + (e && e.name || 'error') + ': ' +
                  String(e && e.message || e).slice(0, 80) + ')'});
        continue;
      }
      out.push({frame: label, result: res, onFirstScreen: sub !== NONE});
      if (depth < 3) walk(cw, sub, depth + 1);
    }
  }

  var top = lint(opts);
  out.push({frame: null, result: top, onFirstScreen: true});
  if (document.body) walk(window, {left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight}, 1);
  return out;
})
