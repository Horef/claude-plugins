// In-page checks for lint_ui.py: overflow, contrast, small text and targets, unnamed controls, first-screen density.
/* In-page checks for lint_ui.py. A function expression: lint_ui.py calls it as (<this file>)(options) through
   Runtime.evaluate and reads the returned {problems, notes, density}. It only reads the page, never changes it.
   Problem kinds: page-hscroll, text-overflow, text-clipped, small-text, low-contrast, no-accessible-name,
   small-target, overlap. Density counts are for the first screen (scroll position 0, viewport height; inside an
   iframe, the part of it that shows in the top viewport). */
(function (opts) {
  var TOL = 2;                                  // px of slack for sub-pixel layout
  var SKIP = {SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, META: 1, LINK: 1, TITLE: 1, BR: 1, WBR: 1,
              TEXTAREA: 1, SELECT: 1, OPTION: 1, OPTGROUP: 1, IFRAME: 1, CANVAS: 1, OBJECT: 1};
  var NATIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary';
  var INTERACTIVE = NATIVE + ',[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],' +
    '[role=menuitem],[role=option],[role=combobox],[role=slider],[role=textbox],[contenteditable=""],' +
    '[contenteditable=true],[tabindex]:not([tabindex="-1"])';
  var VIS = {checkOpacity: true, checkVisibilityCSS: true};
  var problems = [], notes = [], seen = {};
  window.scrollTo(0, 0);
  var VW = window.innerWidth, VH = window.innerHeight;
  // First screen = this window's viewport; inside an iframe, lint_frames.js passes opts.clip: the part of the frame
  // that is visible in the top viewport (frame coordinates).
  var CLIP = (opts && opts.clip) || {left: 0, top: 0, right: VW, bottom: VH};
  var body = document.body;
  if (!body) return {problems: [], notes: [], density: null};

  // ---------- helpers ----------
  function sel(el) {
    var parts = [], cur = el;
    for (var i = 0; cur && cur.nodeType === 1 && cur !== document.documentElement && i < 4; i++) {
      var s = cur.tagName.toLowerCase(), anchored = false, tid = cur.getAttribute('data-testid');
      if (cur.id) { s += '#' + CSS.escape(cur.id); anchored = true; }
      else if (tid) { s += '[data-testid="' + tid + '"]'; anchored = true; }
      else if (cur.classList && cur.classList.length) {
        s += '.' + Array.prototype.slice.call(cur.classList, 0, 2).map(function (c) { return CSS.escape(c); }).join('.');
        anchored = true;
      }
      parts.unshift(s);
      if (anchored) break;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function add(kind, el, detail) {
    var selector = typeof el === 'string' ? el : sel(el), key = kind + '|' + selector + '|' + detail;
    if (seen[key]) return;
    seen[key] = 1;
    problems.push({kind: kind, selector: selector, detail: detail});
  }
  function snippet(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
    t = t.replace(/\s+/g, ' ').trim();
    return t.length > 28 ? t.slice(0, 27) + '…' : t;
  }
  var cv = document.createElement('canvas'); cv.width = cv.height = 1;
  var cx = cv.getContext('2d', {willReadFrequently: true}), ccache = {};
  function parseColor(s) {                       // any CSS colour (rgb, oklch, color-mix, ...) -> [r,g,b,a]
    if (ccache[s]) return ccache[s];
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    var d = cx.getImageData(0, 0, 1, 1).data;
    return (ccache[s] = [d[0], d[1], d[2], d[3] / 255]);
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function over(top, bot) {
    var a = top[3];
    return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1];
  }
  function hex(c) {
    return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(c[i]).toString(16)).slice(-2); }).join('');
  }
  var scheme = getComputedStyle(document.documentElement).colorScheme || '';
  var darkCanvas = /dark/.test(scheme) && (!/light/.test(scheme) || matchMedia('(prefers-color-scheme: dark)').matches);
  var CANVAS = darkCanvas ? [18, 18, 18, 1] : [255, 255, 255, 1];
  function bgOf(el) {                            // effective opaque background colour, or null over image/gradient
    var layers = [];
    for (var a = el; a && a.nodeType === 1; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.backgroundImage !== 'none' || cs.webkitBackgroundClip === 'text') return null;
      var c = parseColor(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    var base = CANVAS;
    for (var i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  function borderSides(cs) {
    var n = 0;
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (s) {
      if (parseFloat(cs['border' + s + 'Width']) >= 1 && cs['border' + s + 'Style'] !== 'none' &&
          parseColor(cs['border' + s + 'Color'])[3] > 0.1) n++;
    });
    return n;
  }
  function isBox(cs) {                           // has a visible edge: fill, border or clipping
    return cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.backgroundImage !== 'none' ||
      parseColor(cs.backgroundColor)[3] > 0.05 || borderSides(cs) > 0;
  }
  function inFirstScreen(r) { return r.top < CLIP.bottom && r.bottom > CLIP.top && r.left < CLIP.right && r.right > CLIP.left; }

  // ---------- visible text elements ----------
  var all = body.querySelectorAll('*'), textEls = [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (SKIP[el.tagName] || el instanceof SVGElement) continue;
    var nodes = [];
    for (var k = 0; k < el.childNodes.length; k++) {
      var n = el.childNodes[k];
      if (n.nodeType === 3 && n.nodeValue.trim()) nodes.push(n);
    }
    if (!nodes.length || !el.checkVisibility(VIS)) continue;
    var rects = [], nodeInfo = [];
    nodes.forEach(function (node) {
      var rg = document.createRange(); rg.selectNodeContents(node);
      var rs = Array.prototype.filter.call(rg.getClientRects(), function (r) { return r.width >= 2 && r.height >= 4; });
      if (rs.length) { nodeInfo.push({node: node, rects: rs}); rects = rects.concat(rs); }
    });
    if (!rects.length || rects.every(function (r) { return r.right <= 0 || r.bottom <= 0; })) continue;
    textEls.push({el: el, rects: rects, nodes: nodeInfo, cs: getComputedStyle(el)});
  }

  // ---------- page-hscroll ----------
  var de = document.documentElement, cw = de.clientWidth;
  if (de.scrollWidth > cw + 1) {
    var offs = [], offSet = new Set();
    for (i = 0; i < all.length; i++) {
      var e = all[i];
      if (SKIP[e.tagName] || (e instanceof SVGElement && e.tagName !== 'svg')) continue;
      var ecs = getComputedStyle(e);
      if (ecs.position === 'fixed' || ecs.display === 'none') continue;
      var er = e.getBoundingClientRect();
      if (!er.width || er.right <= cw + 1) continue;
      var clipped = false;
      for (var a = e.parentElement; a && a !== body && a !== de; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
      }
      if (!clipped) { offs.push({el: e, r: er}); offSet.add(e); }
    }
    var tops = offs.filter(function (o) { return !offSet.has(o.el.parentElement); })
      .sort(function (x, y) { return y.r.right - x.r.right; });
    var who = tops.slice(0, 3).map(function (o) { return sel(o.el) + ' (right edge ' + Math.round(o.r.right) + 'px)'; });
    add('page-hscroll', tops.length ? tops[0].el : 'html',
        'page is ' + (de.scrollWidth - cw) + 'px wider than the ' + cw + 'px viewport' +
        (who.length ? '; widest: ' + who.join(', ') : ''));
  }

  // ---------- text-overflow / text-clipped / small-text ----------
  function nearestBox(el) {
    for (var a = el; a && a !== body && a !== de; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.display === 'inline' || cs.display === 'contents') continue;
      if (isBox(cs)) return a;
    }
    return null;
  }
  textEls.forEach(function (t) {
    var size = parseFloat(t.cs.fontSize);
    if (size < 12) add('small-text', t.el, size.toFixed(size % 1 ? 1 : 0) + 'px (min 12px): "' + snippet(t.el) + '"');
    var B = nearestBox(t.el);
    if (!B) return;
    var bcs = getComputedStyle(B), br = B.getBoundingClientRect();
    var pl = br.left + (parseFloat(bcs.borderLeftWidth) || 0), pr = br.right - (parseFloat(bcs.borderRightWidth) || 0);
    var pt = br.top + (parseFloat(bcs.borderTopWidth) || 0), pb = br.bottom - (parseFloat(bcs.borderBottomWidth) || 0);
    var clipX = bcs.overflowX !== 'visible', clipY = bcs.overflowY !== 'visible';
    var scrollX = bcs.overflowX === 'auto' || bcs.overflowX === 'scroll';
    var scrollY = bcs.overflowY === 'auto' || bcs.overflowY === 'scroll';
    var worst = null;
    t.rects.forEach(function (r) {
      var sides = [];
      if (!scrollX) { sides.push(['right', r.right - pr], ['left', pl - r.left]); }
      if (!scrollY) { sides.push(['bottom', r.bottom - pb], ['top', pt - r.top]); }
      var outsideAll = r.bottom <= pt || r.top >= pb || r.right <= pl || r.left >= pr;
      sides.forEach(function (sd) {
        var isX = sd[0] === 'left' || sd[0] === 'right';
        if (sd[1] > TOL && ((isX ? clipX : clipY) ? !outsideAll : true) && (!worst || sd[1] > worst[1])) worst = sd;
      });
    });
    if (!worst) return;
    var isX = worst[0] === 'left' || worst[0] === 'right';
    var clips = isX ? clipX : clipY;
    var how = '';
    if (t.cs.textOverflow === 'ellipsis' || bcs.textOverflow === 'ellipsis') how = ' (ellipsis)';
    else if (parseInt(bcs.webkitLineClamp) > 0 || parseInt(t.cs.webkitLineClamp) > 0) how = ' (line-clamp)';
    add(clips ? 'text-clipped' : 'text-overflow', t.el,
        '"' + snippet(t.el) + '" ' + (clips ? 'is cut off ' : 'runs ') + Math.round(worst[1]) + 'px past the ' +
        worst[0] + ' of ' + sel(B) + ' (' + Math.round(br.width) + 'x' + Math.round(br.height) + ')' + how);
  });

  // ---------- low-contrast ----------
  var unknownEls = [];
  textEls.forEach(function (t) {
    var el = t.el;
    if (el.closest(':disabled,[aria-disabled="true"]')) return;
    var fg0 = parseColor(t.cs.webkitTextFillColor || t.cs.color), op = 1;
    for (var a = el; a && a.nodeType === 1; a = a.parentElement) {
      var o = parseFloat(getComputedStyle(a).opacity); op *= isNaN(o) ? 1 : o;
    }
    var alpha = fg0[3] * op;
    if (alpha < 0.05) return;
    var bg = bgOf(el);
    if (!bg) { unknownEls.push(el); return; }
    var fg = over([fg0[0], fg0[1], fg0[2], alpha], bg);
    var size = parseFloat(t.cs.fontSize), large = size >= 24 || (size >= 18.66 && parseInt(t.cs.fontWeight) >= 700);
    var need = large ? 3 : 4.5, cr = ratio(fg, bg);
    if (cr < need - 0.005) {
      add('low-contrast', el, cr.toFixed(2) + ':1 (needs ' + need + ':1) ' + hex(fg) + ' on ' + hex(bg) + ': "' + snippet(el) + '"');
    }
  });
  if (unknownEls.length) {
    notes.push({kind: 'contrast-unknown', selector: sel(unknownEls[0]),
                detail: unknownEls.length + ' text element(s) sit over an image or gradient, contrast not computed; check by eye'});
  }

  // ---------- interactive: names, targets ----------
  function accName(el) {
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var s = lb.split(/\s+/).map(function (id) { var x = document.getElementById(id); return x ? (x.textContent || '').trim() : ''; }).join(' ').trim();
      if (s) return s;
    }
    var al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    if (el.labels && el.labels.length) {
      var ls = Array.prototype.map.call(el.labels, function (l) { return (l.textContent || '').trim(); }).join(' ').trim();
      if (ls) return ls;
    }
    if (el.tagName === 'INPUT') {
      var ty = (el.type || '').toLowerCase();
      if ((ty === 'button' || ty === 'submit' || ty === 'reset') && (el.value || '').trim()) return el.value.trim();
      if (ty === 'image' && (el.alt || '').trim()) return el.alt.trim();
    }
    var tx = (el.innerText || el.textContent || '').trim();
    if (tx) return tx;
    var kids = el.querySelectorAll('img[alt],svg title,[aria-label]');
    for (var j = 0; j < kids.length; j++) {
      var kt = (kids[j].getAttribute('alt') || kids[j].getAttribute('aria-label') || kids[j].textContent || '').trim();
      if (kt) return kt;
    }
    var ti = (el.getAttribute('title') || '').trim();
    if (ti) return ti;
    return (el.placeholder || '').trim();
  }
  var inter = [];
  var cand = body.querySelectorAll(INTERACTIVE);
  for (i = 0; i < cand.length; i++) {
    var c = cand[i];
    if (!c.checkVisibility(VIS)) continue;
    if (!c.matches(NATIVE) && (c.querySelector(NATIVE) || (c.parentElement && c.parentElement.closest(NATIVE)))) continue;
    var cr2 = c.getBoundingClientRect();
    if (!cr2.width || !cr2.height) continue;
    inter.push({el: c, r: cr2});
  }
  inter.forEach(function (it) {
    var c = it.el;
    if (!accName(c)) add('no-accessible-name', c, 'a <' + c.tagName.toLowerCase() + '> control has no text, aria-label, label or title');
    if (getComputedStyle(c).display === 'inline' && c.tagName === 'A') return;     // inline link in running text
    var w = it.r.width, h = it.r.height;
    if (c.labels && c.labels.length) {
      Array.prototype.forEach.call(c.labels, function (l) {
        var lr = l.getBoundingClientRect();
        if (lr.width * lr.height > w * h) { w = lr.width; h = lr.height; }
      });
    }
    if (w < 23.5 || h < 23.5) add('small-target', c, Math.round(w) + 'x' + Math.round(h) + 'px (min 24x24)');
  });

  // ---------- overlap ----------
  var lines = [];
  textEls.forEach(function (t, idx) { t.rects.forEach(function (r) { lines.push({i: idx, r: r}); }); });
  lines.sort(function (x, y) { return x.r.top - y.r.top; });
  var lim = Math.min(lines.length, 4000);
  for (var p = 0; p < lim; p++) {
    var A = lines[p];
    for (var q = p + 1; q < lim; q++) {
      var Bq = lines[q];
      if (Bq.r.top >= A.r.bottom) break;
      if (A.i === Bq.i) continue;
      var ea = textEls[A.i].el, eb = textEls[Bq.i].el;
      if (ea.contains(eb) || eb.contains(ea)) continue;
      var w2 = Math.min(A.r.right, Bq.r.right) - Math.max(A.r.left, Bq.r.left);
      var h2 = Math.min(A.r.bottom, Bq.r.bottom) - Math.max(A.r.top, Bq.r.top);
      if (w2 < 4 || h2 < 4 || h2 < 0.3 * Math.min(A.r.height, Bq.r.height)) continue;
      var mx = Math.max(A.r.left, Bq.r.left) + w2 / 2, my = Math.max(A.r.top, Bq.r.top) + h2 / 2;
      if (mx >= 0 && my >= 0 && mx < VW && my < VH) {
        var topEl = document.elementFromPoint(mx, my);
        if (!topEl || !(ea.contains(topEl) || eb.contains(topEl))) continue;      // one is covered by something else
      }
      add('overlap', ea, '"' + snippet(ea) + '" overlaps ' + sel(eb) + ' "' + snippet(eb) + '" by ' + Math.round(w2) + 'x' + Math.round(h2) + 'px');
    }
  }

  // ---------- density (first screen) ----------
  var controls = inter.filter(function (it) { return inFirstScreen(it.r); }).length;
  var words = 0, sizes = {}, colors = {};
  textEls.forEach(function (t) {
    var shown = false;
    t.nodes.forEach(function (ni) {
      if (ni.rects.some(inFirstScreen)) {
        shown = true;
        words += ni.node.nodeValue.trim().split(/\s+/).length;
      }
    });
    if (shown) {
      sizes[Math.round(parseFloat(t.cs.fontSize))] = 1;
      var fc = parseColor(t.cs.webkitTextFillColor || t.cs.color);
      colors[hex(fc) + (fc[3] < 0.99 ? '/' + fc[3].toFixed(2) : '')] = 1;
    }
  });
  var NOT_BOX = {INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, A: 1, SUMMARY: 1, TR: 1, TD: 1, TH: 1, THEAD: 1, TBODY: 1,
                 TFOOT: 1, OPTION: 1, IMG: 1, HR: 1, LABEL: 1, VIDEO: 1, PICTURE: 1};
  var boxes = [], boxRects = [];
  for (i = 0; i < all.length; i++) {
    var b = all[i];
    if (SKIP[b.tagName] || NOT_BOX[b.tagName] || b instanceof SVGElement || !b.checkVisibility(VIS)) continue;
    var br2 = b.getBoundingClientRect();
    if (!inFirstScreen(br2) || br2.width * br2.height < 1500 || br2.width < 40 || br2.height < 20) continue;
    if (br2.width >= 0.98 * VW && br2.height >= 0.9 * VH) continue;
    var bs = getComputedStyle(b);
    if (bs.display === 'inline') continue;
    var visible = false;
    if (borderSides(bs) >= 2 || bs.boxShadow !== 'none') visible = true;
    else {
      var fill = parseColor(bs.backgroundColor);
      if (fill[3] > 0.05) {
        var pbg = b.parentElement ? bgOf(b.parentElement) : CANVAS;
        var mine = pbg ? over(fill, pbg) : fill;
        visible = !pbg || Math.abs(mine[0] - pbg[0]) + Math.abs(mine[1] - pbg[1]) + Math.abs(mine[2] - pbg[2]) > 10;
      }
    }
    if (!visible) continue;
    var dup = boxRects.some(function (x) {
      return Math.abs(x.left - br2.left) < 1 && Math.abs(x.top - br2.top) < 1 &&
             Math.abs(x.width - br2.width) < 1 && Math.abs(x.height - br2.height) < 1;
    });
    if (dup) continue;
    boxRects.push(br2); boxes.push(b);
  }
  var NOTICE_RE = /(^|[-_\s])(alert|notice|banner|callout|toast|admonition|flash|snackbar|warning)([-_\s]|$)/i;
  var notices = [];
  for (i = 0; i < all.length; i++) {
    var nEl = all[i];
    if (SKIP[nEl.tagName] || nEl instanceof SVGElement) continue;
    var role = nEl.getAttribute('role') || '', tid = nEl.getAttribute('data-testid') || '';
    var hay = (typeof nEl.className === 'string' ? nEl.className : '') + ' ' + nEl.id + ' ' + tid;
    var isN = role === 'alert' || role === 'status' || role === 'alertdialog' || NOTICE_RE.test(hay) ||
              /^(stAlert|stNotification|stToast)/.test(tid);
    if (!isN || !nEl.checkVisibility(VIS) || !(nEl.innerText || '').trim()) continue;
    var nr = nEl.getBoundingClientRect();
    if (!inFirstScreen(nr) || nr.width * nr.height < 400) continue;
    if (notices.some(function (x) { return x.contains(nEl); })) continue;
    notices.push(nEl);
  }
  return {
    problems: problems,
    notes: notes,
    density: {
      controls: controls,
      words: words,
      boxes: boxes.length,
      notices: notices.length,
      textSizes: Object.keys(sizes).map(Number).sort(function (x, y) { return x - y; }),
      textColors: Object.keys(colors).sort(),
      noticeSelectors: notices.slice(0, 5).map(sel),
      boxSelectors: boxes.slice(0, 8).map(sel)
    }
  };
})
