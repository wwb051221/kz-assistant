/* ============================================================
   gauges.js — 拟真仪表（SVG 绘制）
   提供：makeDial / makeCompass / makeBankScale / makeLamps
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n, d) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toFixed(d === undefined ? 0 : d);
  }
  // 0° = 12 点方向，顺时针为正
  function pol(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  }
  function arcPath(cx, cy, r, a0, a1) {
    var p0 = pol(cx, cy, r, a0), p1 = pol(cx, cy, r, a1);
    var large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
      ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' +
      p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }

  /* ---------- 共用 defs ---------- */
  function buildDefs(svg, id) {
    var defs = el('defs', null, svg);
    var bez = el('radialGradient', { id: 'bez' + id, cx: '35%', cy: '25%', r: '80%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#4a545c' }, bez);
    el('stop', { offset: '45%', 'stop-color': '#252d34' }, bez);
    el('stop', { offset: '100%', 'stop-color': '#0b0f12' }, bez);

    var face = el('radialGradient', { id: 'face' + id, cx: '32%', cy: '20%', r: '85%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#2b333a' }, face);
    el('stop', { offset: '55%', 'stop-color': '#171d22' }, face);
    el('stop', { offset: '100%', 'stop-color': '#0d1216' }, face);

    var glass = el('linearGradient', { id: 'glass' + id, x1: '0', y1: '0', x2: '0.7', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '.10' }, glass);
    el('stop', { offset: '38%', 'stop-color': '#ffffff', 'stop-opacity': '.02' }, glass);
    el('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' }, glass);

    var glow = el('filter', { id: 'glow' + id, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
    el('feGaussianBlur', { stdDeviation: '1.6', result: 'b' }, glow);
    var mg = el('feMerge', null, glow);
    el('feMergeNode', { in: 'b' }, mg);
    el('feMergeNode', { in: 'SourceGraphic' }, mg);

    return defs;
  }

  /* ============================================================
     圆形仪表
     ============================================================ */
  function makeDial(host, cfg) {
    var id = 'd' + Math.random().toString(36).slice(2, 8);
    var min = cfg.min, max = cfg.max;
    var start = cfg.start === undefined ? -125 : cfg.start;
    var end = cfg.end === undefined ? 125 : cfg.end;
    var cx = 200, cy = 200;

    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 400 400', preserveAspectRatio: 'xMidYMid meet' }, host);
    buildDefs(svg, id);

    /* bezel */
    el('circle', { cx: 200, cy: 200, r: 196, fill: 'url(#bez' + id + ')', stroke: '#05080a', 'stroke-width': 4 }, svg);
    el('circle', { cx: 200, cy: 200, r: 188, fill: 'none', stroke: '#000', 'stroke-opacity': '.55', 'stroke-width': 2 }, svg);
    /* face */
    el('circle', { cx: 200, cy: 200, r: 180, fill: 'url(#face' + id + ')', stroke: '#0a0e11', 'stroke-width': 2 }, svg);
    el('circle', { cx: 200, cy: 200, r: 172, fill: 'none', stroke: '#39434b', 'stroke-opacity': '.45', 'stroke-width': 1 }, svg);

    /* colored arcs (可选) */
    (cfg.arcs || []).forEach(function (a) {
      var a0 = start + (a.from - min) / (max - min) * (end - start);
      var a1 = start + (a.to - min) / (max - min) * (end - start);
      el('path', {
        d: arcPath(cx, cy, a.r || 140, a0, a1),
        fill: 'none', stroke: a.color, 'stroke-width': a.width || 9,
        'stroke-linecap': 'butt', opacity: a.opacity || .85
      }, svg);
    });

    /* ticks */
    var tickG = el('g', null, svg);
    var minor = cfg.minor || (max - min) / 20;
    var major = cfg.major || (max - min) / 5;
    var n = Math.round((max - min) / minor);
    for (var i = 0; i <= n; i++) {
      var v = min + i * minor;
      var ang = start + (v - min) / (max - min) * (end - start);
      var isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
      var r1 = isMajor ? 150 : 159;
      var r2 = 170;
      var p1 = pol(cx, cy, r1, ang), p2 = pol(cx, cy, r2, ang);
      el('line', {
        x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2),
        stroke: isMajor ? '#e4eef4' : '#8fa0ab',
        'stroke-width': isMajor ? 3.2 : 1.4,
        'stroke-linecap': 'round',
        opacity: isMajor ? .95 : .5
      }, tickG);

      if (isMajor && cfg.labels !== false) {
        var lp = pol(cx, cy, 127, ang);
        el('text', {
          x: lp[0].toFixed(2), y: (lp[1] + 7).toFixed(2),
          'text-anchor': 'middle', 'font-size': 19, 'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif",
          'font-weight': 600, fill: '#e8f1f6', opacity: .92
        }, tickG).textContent = (cfg.labelFormat ? cfg.labelFormat(v) : String(Math.round(v)));
      }
    }

    /* 标题（放在表盘下半部，避开刻度数字） */
    if (cfg.title) {
      el('text', { x: 200, y: 250, 'text-anchor': 'middle', 'font-size': 14.5, 'letter-spacing': '2.2',
        'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", fill: '#9db0bb', opacity: .85 }, svg).textContent = cfg.title;
    }
    if (cfg.unit) {
      el('text', { x: 200, y: 267, 'text-anchor': 'middle', 'font-size': 9.5, 'letter-spacing': '1.5',
        'font-family': "'WT Mono', Consolas, monospace", fill: '#71828d' }, svg).textContent = cfg.unit;
    }

    /* 数字窗 */
    var digital = null;
    if (cfg.digital !== false) {
      el('rect', { x: 143, y: 288, width: 114, height: 32, rx: 3.5, fill: '#07090b', stroke: '#2a343b', 'stroke-width': 1.5 }, svg);
      digital = el('text', {
        x: 200, y: 312, 'text-anchor': 'middle', 'font-size': 22,
        'font-family': "'WT Mono', Consolas, monospace", 'font-weight': 700, fill: '#ffcf87',
        'letter-spacing': '0.5'
      }, svg);
    }

    /* 指针 */
    var needleG = el('g', { filter: 'url(#glow' + id + ')' }, svg);
    var needles = [];
    var needleCount = cfg.needles || 1;
    for (var k = 0; k < needleCount; k++) {
      var ng = el('g', null, needleG);
      var color = (cfg.needleColors && cfg.needleColors[k]) || cfg.needleColor || '#ffb648';
      var len = cfg.needleLen || 132;
      el('path', {
        d: 'M200 ' + (200 - len) + ' L195.5 200 L200 214 L204.5 200 Z',
        fill: color, stroke: '#1a1206', 'stroke-width': .8
      }, ng);
      el('circle', { cx: 200, cy: 200, r: 13, fill: '#20272d', stroke: '#0a0d10', 'stroke-width': 2 }, ng);
      el('circle', { cx: 200, cy: 200, r: 5, fill: color, opacity: .9 }, ng);
      needles.push(ng);
    }

    /* 玻璃反光 */
    el('ellipse', { cx: 148, cy: 138, rx: 108, ry: 84, fill: 'url(#glass' + id + ')', transform: 'rotate(-28 148 138)' }, svg);
    el('path', { d: 'M 78 250 C 120 300 210 320 275 292', fill: 'none', stroke: '#fff', 'stroke-opacity': '.05', 'stroke-width': 14, 'stroke-linecap': 'round' }, svg);

    /* 螺丝 */
    [[52, 52], [348, 52], [52, 348], [348, 348]].forEach(function (p) {
      el('circle', { cx: p[0], cy: p[1], r: 5.5, fill: '#232b31', stroke: '#0a0d10', 'stroke-width': 1.2 }, svg);
      el('line', { x1: p[0] - 3.4, y1: p[1], x2: p[0] + 3.4, y2: p[1], stroke: '#3d474f', 'stroke-width': 1.2 }, svg);
    });

    var api = {
      el: host,
      set: function (v, idx) {
        idx = idx || 0;
        var ang = start + (Math.max(min, Math.min(max, v)) - min) / (max - min) * (end - start);
        if (needles[idx]) needles[idx].setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 200 200)');
      },
      setMulti: function (arr) {
        for (var i = 0; i < needles.length; i++) api.set(arr[i] || min, i);
      },
      setText: function (t) { if (digital) digital.textContent = t; },
      setColor: function (c) { if (digital) digital.setAttribute('fill', c); },
      setCount: function (count) {
        for (var i = 0; i < needles.length; i++) needles[i].style.opacity = i < count ? '1' : '0';
      }
    };
    return api;
  }

  /* ============================================================
     航向罗盘
     ============================================================ */
  function makeCompass(host) {
    var id = 'c' + Math.random().toString(36).slice(2, 8);
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 400 400', preserveAspectRatio: 'xMidYMid meet' }, host);
    buildDefs(svg, id);

    el('circle', { cx: 200, cy: 200, r: 196, fill: 'url(#bez' + id + ')', stroke: '#05080a', 'stroke-width': 4 }, svg);
    el('circle', { cx: 200, cy: 200, r: 188, fill: 'none', stroke: '#000', 'stroke-opacity': '.55', 'stroke-width': 2 }, svg);
    el('circle', { cx: 200, cy: 200, r: 180, fill: 'url(#face' + id + ')', stroke: '#0a0e11', 'stroke-width': 2 }, svg);

    var card = el('g', null, svg);

    // 刻度
    for (var d = 0; d < 360; d += 5) {
      var isMajor = d % 30 === 0;
      var r1 = isMajor ? 132 : (d % 10 === 0 ? 142 : 150);
      var p1 = pol(200, 200, r1, d), p2 = pol(200, 200, 164, d);
      el('line', {
        x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2),
        stroke: isMajor ? '#e8f1f6' : '#8fa0ab', 'stroke-width': isMajor ? 3.2 : 1.3,
        opacity: isMajor ? .95 : .5
      }, card);
    }
    // 数字
    for (var dd = 0; dd < 360; dd += 30) {
      var lp = pol(200, 200, 106, dd);
      var txt;
      if (dd === 0) txt = 'N';
      else if (dd === 90) txt = 'E';
      else if (dd === 180) txt = 'S';
      else if (dd === 270) txt = 'W';
      else txt = ('0' + (dd / 10)).slice(-2);
      var t = el('text', {
        x: lp[0].toFixed(2), y: (lp[1] + 7).toFixed(2),
        'text-anchor': 'middle', 'font-size': (dd % 90 === 0 ? 26 : 20),
        'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", 'font-weight': 600,
        fill: dd % 90 === 0 ? '#f2f8fc' : '#c8d6df'
      }, card);
      t.textContent = txt;
      t.setAttribute('transform', 'rotate(' + dd + ' ' + lp[0].toFixed(2) + ' ' + lp[1].toFixed(2) + ')');
    }

    // 中心飞机符号
    el('path', { d: 'M200 150 L206 186 L246 186 L246 194 L206 198 L206 232 L214 240 L214 246 L200 242 L186 246 L186 240 L194 232 L194 198 L154 194 L154 186 L194 186 Z',
      fill: '#ffb648', opacity: .95, filter: 'url(#glow' + id + ')' }, svg);
    el('circle', { cx: 200, cy: 200, r: 4, fill: '#fff' }, svg);

    // 顶部基准三角
    el('path', { d: 'M200 26 L210 48 L190 48 Z', fill: '#ffb648', filter: 'url(#glow' + id + ')' }, svg);

    el('text', { x: 200, y: 66, 'text-anchor': 'middle', 'font-size': 14.5, 'letter-spacing': '2.2',
      'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", fill: '#9db0bb', opacity: .85 }, svg).textContent = 'HEADING';
    el('text', { x: 200, y: 83, 'text-anchor': 'middle', 'font-size': 9.5, 'letter-spacing': '1.5',
      'font-family': "'WT Mono', Consolas, monospace", fill: '#71828d' }, svg).textContent = 'DEG';

    el('rect', { x: 140, y: 286, width: 120, height: 38, rx: 4, fill: '#07090b', stroke: '#2a343b', 'stroke-width': 1.5 }, svg);
    var digit = el('text', { x: 200, y: 313, 'text-anchor': 'middle', 'font-size': 26,
      'font-family': "'WT Mono', Consolas, monospace", 'font-weight': 700, fill: '#ffcf87' }, svg);

    el('ellipse', { cx: 148, cy: 138, rx: 108, ry: 84, fill: 'url(#glass' + id + ')', transform: 'rotate(-28 148 138)' }, svg);

    return {
      el: host,
      set: function (hdg) {
        var h = ((hdg % 360) + 360) % 360;
        card.setAttribute('transform', 'rotate(' + (-h).toFixed(2) + ' 200 200)');
        digit.textContent = ('00' + Math.round(h) % 360).slice(-3);
      }
    };
  }

  /* ============================================================
     3D 视图底部坡度尺
     ============================================================ */
  function makeBankScale(host) {
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 620 44', preserveAspectRatio: 'xMidYMid meet' }, host);
    var cx = 310, half = 250, base = 40;
    el('line', { x1: cx - half, y1: base, x2: cx + half, y2: base, stroke: '#4a5a63', 'stroke-width': 1.2, opacity: .65 }, svg);
    for (var a = -60; a <= 60; a += 5) {
      var x = cx + a / 60 * half;
      var major = a % 30 === 0;
      el('line', {
        x1: x.toFixed(1), y1: base, x2: x.toFixed(1), y2: base - (major ? 15 : 8),
        stroke: a === 0 ? '#a9bcc6' : '#6d7f88', 'stroke-width': major ? 2 : 1.2, opacity: .95
      }, svg);
    }
    [-45, -30, -15, 15, 30, 45].forEach(function (a) {
      el('text', {
        x: (cx + a / 60 * half).toFixed(1), y: base - 20, 'text-anchor': 'middle',
        'font-size': 10, 'font-family': "'WT Mono', Consolas, monospace", fill: '#4e5f68'
      }, svg).textContent = Math.abs(a);
    });
    var mark = el('path', { d: 'M0 0 L5.5 9 L-5.5 9 Z', fill: '#ffb648' }, svg);
    return {
      set: function (roll) {
        var a = Math.max(-62, Math.min(62, roll));
        var x = cx + a / 60 * half;
        mark.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (base - 34) + ')');
      }
    };
  }

  /* ============================================================
     指示灯
     ============================================================ */
  function makeLamps(host, list) {
    host.innerHTML = '';
    var map = {};
    list.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'lamp' + (it.kind ? ' ' + it.kind : '');
      var b = document.createElement('div');
      b.className = 'bulb';
      var s = document.createElement('span');
      s.textContent = it.label;
      d.appendChild(b); d.appendChild(s);
      host.appendChild(d);
      map[it.key] = { root: d, on: false };
    });
    return {
      set: function (key, on) {
        var m = map[key];
        if (!m || m.on === !!on) return;
        m.on = !!on;
        m.root.classList.toggle('on', m.on);
      },
      pulse: function (key, on) { this.set(key, on); }
    };
  }

  /* ============================================================
     航迹矢量指示器（机头 vs 实际气流方向）
     ============================================================ */
  function makeFpm(host) {
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 170 150', preserveAspectRatio: 'xMidYMid meet' }, host);
    var cx = 85, cy = 72, k = 1.9;
    function cl(v) { return Math.max(-44, Math.min(44, v)); }

    el('circle', { cx: cx, cy: cy, r: 46, fill: 'none', stroke: '#2c3a42', 'stroke-width': 1, 'stroke-dasharray': '2 5' }, svg);
    el('line', { x1: cx - 13, y1: cy, x2: cx + 13, y2: cy, stroke: '#6f818a', 'stroke-width': 1.2 }, svg);
    el('line', { x1: cx, y1: cy - 13, x2: cx, y2: cy + 13, stroke: '#6f818a', 'stroke-width': 1.2 }, svg);
    el('path', { d: 'M85 64 L90 74 L85 71.5 L80 74 Z', fill: '#93a7b1' }, svg);
    el('text', { x: cx, y: cy - 50, 'text-anchor': 'middle', 'font-size': 8,
      'font-family': "'WT Mono', Consolas, monospace", fill: '#55656e', 'letter-spacing': '1.5' }, svg).textContent = 'NOSE';

    var link = el('line', {
      x1: cx, y1: cy, x2: cx, y2: cy,
      stroke: '#ffb648', 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: .6
    }, svg);

    var dot = el('g', null, svg);
    el('circle', { cx: 0, cy: 0, r: 7.5, fill: 'rgba(255,182,72,.12)', stroke: '#ffb648', 'stroke-width': 1.3 }, dot);
    el('circle', { cx: 0, cy: 0, r: 1.8, fill: '#ffb648' }, dot);
    el('line', { x1: -12, y1: 0, x2: -6, y2: 0, stroke: '#ffb648', 'stroke-width': 1.3 }, dot);
    el('line', { x1: 6, y1: 0, x2: 12, y2: 0, stroke: '#ffb648', 'stroke-width': 1.3 }, dot);
    el('line', { x1: 0, y1: -11, x2: 0, y2: -5.5, stroke: '#ffb648', 'stroke-width': 1.3 }, dot);

    return {
      set: function (aoa, aos) {
        var x = cx + cl((aos || 0) * k);
        var y = cy + cl((aoa || 0) * k);
        dot.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
        link.setAttribute('x2', x.toFixed(1));
        link.setAttribute('y2', y.toFixed(1));
      }
    };
  }

  /* ============================================================
     垂直磁带（空速 / 高度）
     ============================================================ */
  function makeTape(host, cfg) {
    var id = 'tp' + Math.random().toString(36).slice(2, 8);
    var min = cfg.min, max = cfg.max;
    var s = cfg.scale === undefined ? 1.12 : cfg.scale;
    var cy = 180;

    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 150 360', preserveAspectRatio: 'xMidYMid meet' }, host);

    var defs = el('defs', null, svg);
    var cp = el('clipPath', { id: 'clip' + id }, defs);
    el('rect', { x: 0, y: 40, width: 104, height: 282 }, cp);

    var grp = el('g', { 'clip-path': 'url(#clip' + id + ')' }, svg);
    var ticks = el('g', null, grp);

    for (var v = min; v <= max + 1e-6; v += cfg.minor) {
      var y = cy - v * s;
      var major = Math.abs(v / cfg.major - Math.round(v / cfg.major)) < 1e-6;
      el('line', {
        x1: 100, y1: y.toFixed(2), x2: major ? 66 : 88, y2: y.toFixed(2),
        stroke: major ? '#e8f1f6' : '#8fa0ab',
        'stroke-width': major ? 2.2 : 1.1,
        opacity: major ? .95 : .5
      }, ticks);
      if (major) {
        el('text', {
          x: 62, y: (y + 5).toFixed(2), 'text-anchor': 'end', 'font-size': 15,
          'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", 'font-weight': 600, fill: '#e8f1f6'
        }, ticks).textContent = Math.round(v);
      }
    }

    el('line', { x1: 102, y1: 40, x2: 102, y2: 322, stroke: '#39454d', 'stroke-width': 1 }, svg);
    el('path', { d: 'M104 180 L114 173 L114 187 Z', fill: '#ffb648' }, svg);
    el('rect', { x: 8, y: 162, width: 92, height: 34, rx: 3, fill: 'rgba(4,7,9,.92)', stroke: '#3c4a52', 'stroke-width': 1 }, svg);
    var txt = el('text', {
      x: 54, y: 186, 'text-anchor': 'middle', 'font-size': 22,
      'font-family': "'WT Mono', Consolas, monospace", 'font-weight': 700, fill: '#ffcf87'
    }, svg);
    el('text', {
      x: 54, y: 20, 'text-anchor': 'middle', 'font-size': 11, 'letter-spacing': '2',
      'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", fill: '#93a7b1'
    }, svg).textContent = cfg.title;
    el('text', {
      x: 54, y: 34, 'text-anchor': 'middle', 'font-size': 9, 'letter-spacing': '1.2',
      'font-family': "'WT Mono', Consolas, monospace", fill: '#5d6d76'
    }, svg).textContent = cfg.unit;

    return {
      set: function (val) {
        var vv = Math.max(min, Math.min(max, val || 0));
        ticks.setAttribute('transform', 'translate(0 ' + (vv * s).toFixed(2) + ')');
        txt.textContent = Math.round(vv);
      }
    };
  }

  /* ============================================================
     姿态仪 ADI
     ============================================================ */
  function makeADI(host) {
    var id = 'ad' + Math.random().toString(36).slice(2, 8);
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 200 200', preserveAspectRatio: 'xMidYMid meet' }, host);

    el('circle', { cx: 100, cy: 100, r: 97, fill: '#070b0e', stroke: '#1e272d', 'stroke-width': 3 }, svg);

    var defs = el('defs', null, svg);
    var cp = el('clipPath', { id: 'adi' + id }, defs);
    el('circle', { cx: 100, cy: 100, r: 88 }, cp);

    var ball = el('g', { 'clip-path': 'url(#adi' + id + ')' }, svg);
    var inner = el('g', null, ball);

    el('rect', { x: -260, y: -320, width: 720, height: 420, fill: '#1b587f' }, inner);
    el('rect', { x: -260, y: 100, width: 720, height: 420, fill: '#6d4a2c' }, inner);
    el('line', { x1: -260, y1: 100, x2: 460, y2: 100, stroke: '#ffffff', 'stroke-width': 1.8 }, inner);

    for (var p = -30; p <= 30; p += 10) {
      if (p === 0) continue;
      var yy = 100 - p * 2.4;
      var w = p % 20 === 0 ? 34 : 22;
      el('line', { x1: 100 - w, y1: yy, x2: 100 - 12, y2: yy, stroke: '#dbe8f0', 'stroke-width': 1.3, opacity: .85 }, inner);
      el('line', { x1: 100 + 12, y1: yy, x2: 100 + w, y2: yy, stroke: '#dbe8f0', 'stroke-width': 1.3, opacity: .85 }, inner);
      el('text', { x: 100 - w - 6, y: yy + 4, 'text-anchor': 'end', 'font-size': 9, 'font-family': "'WT Mono', Consolas, monospace", fill: '#cfe0ea' }, inner).textContent = Math.abs(p);
      el('text', { x: 100 + w + 6, y: yy + 4, 'font-size': 9, 'font-family': "'WT Mono', Consolas, monospace", fill: '#cfe0ea' }, inner).textContent = Math.abs(p);
    }

    /* 坡度刻度（固定） */
    [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach(function (a) {
      var major = a % 30 === 0;
      var p1 = pol(100, 100, 88, a), p2 = pol(100, 100, 88 - (major ? 11 : 6), a);
      el('line', {
        x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1),
        stroke: a === 0 ? '#ffb648' : '#93a7b1', 'stroke-width': major ? 2 : 1, opacity: .9
      }, svg);
    });
    var rollMark = el('path', { d: 'M100 12 L106 24 L94 24 Z', fill: '#ffb648' }, svg);

    /* 固定机翼符号 */
    el('path', { d: 'M100 86 L104 96 L132 100 L132 105 L104 103 L104 112 L110 118 L110 121 L100 118 L90 121 L90 118 L96 112 L96 103 L68 105 L68 100 L96 96 Z',
      fill: '#ffb648', opacity: .95 }, svg);

    return {
      set: function (pitch, roll) {
        var r = Math.max(-90, Math.min(90, roll || 0));
        var p = Math.max(-60, Math.min(60, pitch || 0));
        inner.setAttribute('transform',
          'rotate(' + (-r).toFixed(2) + ' 100 100) translate(0 ' + (p * 2.4).toFixed(2) + ')');
        rollMark.setAttribute('transform', 'rotate(' + (-r).toFixed(2) + ' 100 12)');
      }
    };
  }

  /* ============================================================
     航向带
     ============================================================ */
  function makeHeadingTape(host) {
    var id = 'hd' + Math.random().toString(36).slice(2, 8);
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 620 96', preserveAspectRatio: 'xMidYMid meet' }, host);
    var px = 2.6;

    var defs = el('defs', null, svg);
    var cp = el('clipPath', { id: 'hdg' + id }, defs);
    el('rect', { x: 0, y: 6, width: 620, height: 56 }, cp);

    var grp = el('g', { 'clip-path': 'url(#hdg' + id + ')' }, svg);
    var ticks = el('g', null, grp);

    for (var d = -180; d <= 540; d += 5) {
      var x = 310 + d * px;
      if (x < -20 || x > 640) continue;
      var norm = ((d % 360) + 360) % 360;
      var isMajor = norm % 30 === 0;
      el('line', {
        x1: x.toFixed(1), y1: 8, x2: x.toFixed(1), y2: isMajor ? 34 : 26,
        stroke: isMajor ? '#e8f1f6' : '#8fa0ab', 'stroke-width': isMajor ? 2 : 1.1, opacity: isMajor ? .95 : .5
      }, ticks);
      if (isMajor) {
        var lab = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : ('0' + (norm / 10)).slice(-2);
        el('text', {
          x: x.toFixed(1), y: 48, 'text-anchor': 'middle', 'font-size': 13,
          'font-family': "'WT UI', Bahnschrift, Segoe UI, sans-serif", 'font-weight': 600,
          fill: norm % 90 === 0 ? '#f2f8fc' : '#c8d6df'
        }, ticks).textContent = lab;
      }
    }

    el('path', { d: 'M310 62 L318 76 L302 76 Z', fill: '#ffb648' }, svg);
    el('rect', { x: 265, y: 66, width: 90, height: 26, rx: 3, fill: 'rgba(4,7,9,.92)', stroke: '#3c4a52' }, svg);
    var txt = el('text', {
      x: 310, y: 86, 'text-anchor': 'middle', 'font-size': 19,
      'font-family': "'WT Mono', Consolas, monospace", 'font-weight': 700, fill: '#ffcf87'
    }, svg);

    return {
      set: function (hdg) {
        var h = ((hdg % 360) + 360) % 360;
        ticks.setAttribute('transform', 'translate(' + (-h * px).toFixed(2) + ' 0)');
        txt.textContent = ('00' + Math.round(h) % 360).slice(-3);
      }
    };
  }

  /* ============================================================
     发动机 / 燃油 面板
     ============================================================ */
  function makeEnginePanel(host) {
    host.innerHTML = '';
    var root = document.createElement('div');
    root.className = 'eng';
    host.appendChild(root);

    var left = document.createElement('div');
    left.className = 'eng-col';
    var right = document.createElement('div');
    right.className = 'eng-col right';
    root.appendChild(left);
    root.appendChild(right);

    function mk(tag, cls, parent) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (parent) parent.appendChild(e);
      return e;
    }

    mk('div', 'eng-head', left).textContent = 'ENGINE';
    var rows = [];
    for (var i = 0; i < 3; i++) {
      var row = mk('div', 'eng-row', left);
      mk('span', 'eng-lab', row).textContent = 'ENG ' + (i + 1);
      var bar = mk('div', 'bar', row);
      var fill = mk('i', '', bar);
      var val = mk('span', 'eng-val', row);
      rows.push({ row: row, fill: fill, val: val });
    }
    var foot = mk('div', 'eng-head2', left);
    foot.textContent = 'THR —  OIL —';

    mk('div', 'eng-head', right).textContent = 'FUEL';
    var big = mk('div', 'fuel-big', right);
    var fuelKg = mk('b', '', big);
    fuelKg.textContent = '—';
    mk('span', '', big).textContent = 'KG';
    var fbar = mk('div', 'bar fuelline', right);
    var ffill = mk('i', '', fbar);
    var fpct = mk('div', 'fuel-pct', right);
    fpct.textContent = '—';

    var rpmTop = 4000;
    return {
      set: function (rpms, engCount, thr, oil, fuel, fuel0) {
        var n = Math.min(3, Math.max(1, engCount | 0));
        var mx = 0;
        for (var i = 0; i < n; i++) mx = Math.max(mx, rpms[i] || 0);
        if (mx > rpmTop * 0.97) rpmTop = mx * 1.25;

        for (var k = 0; k < rows.length; k++) {
          var r = rows[k];
          if (k >= n) { r.row.style.display = 'none'; continue; }
          r.row.style.display = '';
          var v = rpms[k] || 0;
          r.fill.style.width = Math.max(0, Math.min(100, v / rpmTop * 100)) + '%';
          r.val.textContent = Math.round(v);
        }
        foot.textContent = 'THR ' + Math.round(thr) + '%   OIL ' + Math.round(oil) + '°C';

        var pct = fuel0 > 0 ? Math.max(0, Math.min(100, fuel / fuel0 * 100)) : 0;
        fuelKg.textContent = Math.round(fuel);
        fpct.textContent = Math.round(pct) + '%';
        ffill.style.width = pct + '%';
        ffill.className = pct < 15 ? 'low' : '';
      }
    };
  }
  /* ============================================================
     F-16 风格 PFD（主飞行显示）
     ============================================================ */
  function makePFD(host) {
    var id = Math.random().toString(36).slice(2, 7);
    function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 700 820', preserveAspectRatio: 'xMidYMid meet' }, host);
    var defs = el('defs', null, svg);

    function clip(name, attrs) {
      var cp = el('clipPath', { id: name + id }, defs);
      el('rect', attrs, cp);
      return 'url(#' + name + id + ')';
    }
    var cSpd = clip('cs', { x: 40, y: 88, width: 112, height: 604 });
    var cAlt = clip('ca', { x: 548, y: 88, width: 92, height: 604 });
    var cAdi = clip('cd', { x: 172, y: 118, width: 356, height: 474, rx: 10 });
    var cHdg = clip('ch', { x: 160, y: 596, width: 380, height: 128 });

    var MONO = "'WT Mono', Consolas, monospace";
    var NUM = "'WT Mono', Consolas, monospace";
    var SANS = "'WT UI', Bahnschrift, Segoe UI, sans-serif";
    var K = window.KZ || {};
    var IMP = (K.isImperial && K.isImperial());
    var SPD_MAX = IMP ? 900 : 1600, SPD_STEP = IMP ? 10 : 20, SPD_MAJOR = IMP ? 50 : 100, SPD_PX = IMP ? 1.42 : 0.72;
    var ALT_MAX = IMP ? 50000 : 15000, ALT_STEP = IMP ? 500 : 100, ALT_MAJOR = IMP ? 5000 : 1000, ALT_PX = IMP ? 0.02 : 0.075;
    function SP(v) { return K.speed ? K.speed(v) : v; }
    function AL(v) { return K.alt ? K.alt(v) : v; }
    var WHITE = '#e8f1f6', GREEN = '#57ff6e', MAG = '#ff4dd2';

    /* ---------- 顶部状态行 ---------- */
    el('text', { x: 42, y: 40, 'font-size': 21, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1.5 }, svg)
      .textContent = 'FMC SPD';
    el('text', { x: 232, y: 40, 'font-size': 21, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1.5 }, svg)
      .textContent = 'LNAV';
    el('text', { x: 372, y: 40, 'font-size': 21, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1.5 }, svg)
      .textContent = 'VNAV PTH';
    el('text', { x: 350, y: 112, 'text-anchor': 'middle', 'font-size': 22, 'font-family': MONO, fill: GREEN, 'letter-spacing': 2 }, svg)
      .textContent = 'CMD';

    /* ---------- 速度带 ---------- */
    el('rect', { x: 40, y: 88, width: 112, height: 604, fill: '#39434b' }, svg);
    el('rect', { x: 40, y: 88, width: 112, height: 604, fill: 'none', stroke: '#556169', 'stroke-width': 1 }, svg);
    var spdG = el('g', { 'clip-path': cSpd }, svg);
    var spdTicks = el('g', null, spdG);
    for (var sv0 = 0; sv0 <= SPD_MAX; sv0 += SPD_STEP) {
      var sy = 390 - sv0 * SPD_PX;
      var major = sv0 % SPD_MAJOR === 0, mid = sv0 % (SPD_MAJOR / 2) === 0;
      el('line', {
        x1: 152, y1: sy, x2: major ? 118 : (mid ? 132 : 142), y2: sy,
        stroke: major ? '#dfe9ef' : '#9aa8b1', 'stroke-width': major ? 2.4 : 1.2, opacity: major ? .95 : .6
      }, spdTicks);
      if (major) {
        el('text', { x: 112, y: sy + 6, 'text-anchor': 'end', 'font-size': 17, 'font-family': SANS, 'font-weight': 600, fill: WHITE }, spdTicks)
          .textContent = sv0;
      }
    }
    el('rect', { x: 50, y: 360, width: 76, height: 48, fill: '#05070a', stroke: '#e8f1f6', 'stroke-width': 2 }, svg);
    var spdTxt = el('text', { x: 88, y: 398, 'text-anchor': 'middle', 'font-size': 28, 'font-family': NUM, fill: '#fff' }, svg);
    el('path', { d: 'M150 385 L166 373 L166 397 Z', fill: '#e8f1f6' }, svg);

    var machTop = el('text', { x: 44, y: 131, 'font-size': 27, 'font-family': NUM, fill: MAG }, svg);
    var machBot = el('text', { x: 44, y: 733, 'font-size': 29, 'font-family': NUM, fill: '#fff' }, svg);

    /* ---------- ADI ---------- */
    el('rect', { x: 172, y: 118, width: 356, height: 474, rx: 10, fill: '#000' }, svg);
    var adiG = el('g', { 'clip-path': cAdi }, svg);
    var ball = el('g', null, adiG);

    el('rect', { x: -700, y: -900, width: 2100, height: 1260, fill: '#2f72c4' }, ball);
    el('rect', { x: -700, y: 360, width: 2100, height: 1200, fill: '#a8781f' }, ball);
    el('line', { x1: -700, y1: 360, x2: 1400, y2: 360, stroke: '#fff', 'stroke-width': 2 }, ball);

    var ladder = el('g', null, ball);
    for (var p = -30; p <= 30; p += 5) {
      if (p === 0) continue;
      var ly = 360 - p * 3.2;
      var w = (p % 10 === 0) ? 70 : 42;
      el('line', { x1: 350 - w, y1: ly, x2: 350 - 22, y2: ly, stroke: '#fff', 'stroke-width': 2, opacity: .92 }, ladder);
      el('line', { x1: 350 + 22, y1: ly, x2: 350 + w, y2: ly, stroke: '#fff', 'stroke-width': 2, opacity: .92 }, ladder);
      if (p % 10 === 0) {
        el('text', { x: 350 - w - 8, y: ly + 5, 'text-anchor': 'end', 'font-size': 13, 'font-family': MONO, fill: '#fff' }, ladder).textContent = Math.abs(p);
        el('text', { x: 350 + w + 8, y: ly + 5, 'font-size': 13, 'font-family': MONO, fill: '#fff' }, ladder).textContent = Math.abs(p);
      }
    }

    /* 坡度刻度（固定） */
    [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach(function (a) {
      var major = a % 30 === 0;
      var p1 = pol(350, 360, 178, a), p2 = pol(350, 360, 178 - (major ? 16 : 9), a);
      el('line', { x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1),
        stroke: '#e8f1f6', 'stroke-width': major ? 2.4 : 1.3, opacity: .9 }, svg);
    });
    var bankPtr = el('path', { d: 'M350 160 L361 178 L339 178 Z', fill: '#fff' }, svg);

    /* 水线符号 */
    el('path', { d: 'M350 342 L380 376 L350 366 L320 376 Z', fill: '#111', stroke: '#fff', 'stroke-width': 2 }, svg);
    el('path', { d: 'M350 350 L370 370 L350 363 L330 370 Z', fill: '#fff' }, svg);

    /* 航迹矢量 FPV */
    var fpv = el('g', null, svg);
    el('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, fpv);
    el('line', { x1: -26, y1: 0, x2: -10, y2: 0, stroke: '#fff', 'stroke-width': 2 }, fpv);
    el('line', { x1: 10, y1: 0, x2: 26, y2: 0, stroke: '#fff', 'stroke-width': 2 }, fpv);
    el('line', { x1: 0, y1: -12, x2: 0, y2: -4, stroke: '#fff', 'stroke-width': 2 }, fpv);
    el('circle', { cx: 0, cy: 0, r: 1.6, fill: '#fff' }, fpv);

    /* 航迹线 */
    el('line', { x1: 200, y1: 566, x2: 500, y2: 566, stroke: MAG, 'stroke-width': 1.5, opacity: .55 }, svg);

    /* 磁性偏差条（装饰） */
    el('rect', { x: 536, y: 300, width: 8, height: 120, fill: 'none', stroke: MAG, 'stroke-width': 1, opacity: .5 }, svg);
    el('path', { d: 'M540 366 L548 358 L548 374 Z', fill: MAG, opacity: .8 }, svg);
    el('rect', { x: 240, y: 604, width: 220, height: 8, fill: 'none', stroke: MAG, 'stroke-width': 1, opacity: .5 }, svg);

    /* ---------- 高度带 ---------- */
    el('rect', { x: 548, y: 88, width: 92, height: 604, fill: '#39434b' }, svg);
    el('rect', { x: 548, y: 88, width: 92, height: 604, fill: 'none', stroke: '#556169', 'stroke-width': 1 }, svg);
    var altG = el('g', { 'clip-path': cAlt }, svg);
    var altTicks = el('g', null, altG);
    for (var av = 0; av <= ALT_MAX; av += ALT_STEP) {
      var ay = 390 - av * ALT_PX;
      var amaj = av % ALT_MAJOR === 0, amid = av % (ALT_MAJOR / 2) === 0;
      el('line', {
        x1: 548, y1: ay, x2: amaj ? 584 : (amid ? 570 : 560), y2: ay,
        stroke: amaj ? '#dfe9ef' : '#9aa8b1', 'stroke-width': amaj ? 2.4 : 1.2, opacity: amaj ? .95 : .6
      }, altTicks);
      if (amaj) {
        el('text', { x: 590, y: ay + 6, 'font-size': 16, 'font-family': SANS, 'font-weight': 600, fill: WHITE }, altTicks).textContent = av;
      }
    }
    el('text', { x: 604, y: 82, 'font-size': 14, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1 }, svg).textContent = (K.altUnit ? K.altUnit() : 'M');
    el('text', { x: 44, y: 82, 'font-size': 14, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1 }, svg).textContent = (K.speedUnit ? K.speedUnit() : 'KM/H');
    el('rect', { x: 552, y: 358, width: 88, height: 48, fill: '#05070a', stroke: '#e8f1f6', 'stroke-width': 2 }, svg);
    var altTxt = el('text', { x: 596, y: 396, 'text-anchor': 'middle', 'font-size': 26, 'font-family': NUM, fill: '#fff' }, svg);
    el('path', { d: 'M548 386 L534 374 L534 398 Z', fill: '#e8f1f6' }, svg);

    /* ---------- 升降率 ---------- */
    el('text', { x: 664, y: 250, 'text-anchor': 'middle', 'font-size': 11, 'font-family': MONO, fill: '#9aa8b1' }, svg).textContent = 'V/S';
    el('line', { x1: 648, y1: 270, x2: 648, y2: 510, stroke: '#556169', 'stroke-width': 1 }, svg);
    [[6, 1], [2, 1], [1, 1]].forEach(function (t, i) {
      var y = 390 - t[0] * 33;
      el('line', { x1: 642, y1: y, x2: 656, y2: y, stroke: '#9aa8b1', 'stroke-width': 1.4 }, svg);
      el('text', { x: 662, y: y + 4, 'font-size': 11, 'font-family': MONO, fill: '#c8d6df' }, svg).textContent = t[0];
    });
    [1, 2, 6].forEach(function (t) {
      var y = 390 + t * 33;
      el('line', { x1: 642, y1: y, x2: 656, y2: y, stroke: '#9aa8b1', 'stroke-width': 1.4 }, svg);
      el('text', { x: 662, y: y + 4, 'font-size': 11, 'font-family': MONO, fill: '#c8d6df' }, svg).textContent = t;
    });
    var vsiPtr = el('path', { d: 'M636 390 L646 384 L646 396 Z', fill: '#e8f1f6' }, svg);

    /* ---------- 航向带（弧形） ---------- */
    var hdgG = el('g', { 'clip-path': cHdg }, svg);
    el('circle', { cx: 350, cy: 830, r: 200, fill: 'none', stroke: '#556169', 'stroke-width': 1 }, hdgG);
    var hdgTicks = el('g', null, hdgG);
    for (var hd = 0; hd < 360; hd += 5) {
      var a = (hd - 0) * Math.PI / 180;
      var major = hd % 10 === 0;
      var p1 = pol(350, 830, 200, hd), p2 = pol(350, 830, 200 - (major ? 16 : 9), hd);
      el('line', { x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1),
        stroke: major ? '#dfe9ef' : '#8fa0ab', 'stroke-width': major ? 2 : 1.1, opacity: major ? .95 : .6 }, hdgTicks);
      if (hd % 30 === 0) {
        var lp = pol(350, 830, 158, hd);
        el('text', { x: lp[0].toFixed(1), y: (lp[1] + 6).toFixed(1), 'text-anchor': 'middle', 'font-size': 18,
          'font-family': MONO, 'font-weight': 700, fill: WHITE }, hdgTicks).textContent = ('0' + (hd / 10)).slice(-2);
      }
    }
    el('path', { d: 'M350 596 L362 612 L338 612 Z', fill: '#fff' }, svg);

    /* 航向数字 */
    var hdgTxt = el('text', { x: 318, y: 783, 'text-anchor': 'middle', 'font-size': 37, 'font-family': NUM, fill: MAG }, svg);
    el('text', { x: 350, y: 780, 'font-size': 20, 'font-family': MONO, fill: MAG }, svg).textContent = 'H';
    el('text', { x: 470, y: 780, 'font-size': 17, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1 }, svg).textContent = 'MAG';

    /* 底部条 */
    el('text', { x: 42, y: 790, 'font-size': 17, 'font-family': MONO, fill: '#c8d6df' }, svg).textContent = 'BARO 200';
    var pfdGearLab = el('text', { x: 128, y: 790, 'font-size': 14, 'font-family': MONO, fill: '#9fb0ba' }, svg);
    pfdGearLab.textContent = 'GEAR';
    var pfdGear = [];
    ['N', 'L', 'R'].forEach(function (lab, i) {
      var gx = 168 + i * 21;
      el('rect', { x: gx, y: 776, width: 16, height: 16, rx: 2, fill: '#07110b', stroke: '#2c3a42', 'stroke-width': 1 }, svg);
      var f = el('rect', { x: gx + 2, y: 778, width: 12, height: 12, rx: 1.5, fill: '#0b1f16', opacity: .5 }, svg);
      el('text', { x: gx + 8, y: 806, 'text-anchor': 'middle', 'font-size': 8, 'font-family': MONO, fill: '#4e5c65' }, svg).textContent = lab;
      pfdGear.push(f);
    });
    el('text', { x: 560, y: 790, 'font-size': 17, 'font-family': MONO, fill: GREEN, 'letter-spacing': 1 }, svg).textContent = 'STD';
    var baroTxt = el('text', { x: 600, y: 790, 'font-size': 17, 'font-family': MONO, fill: GREEN }, svg);
    baroTxt.textContent = '1017 HPA';

    /* ---------- 更新 ---------- */
    return {
      set: function (C, V) {
        spdTicks.setAttribute('transform', 'translate(0 ' + (SP(C.ias) * SPD_PX).toFixed(2) + ')');
        spdTxt.textContent = Math.round(SP(C.ias));
        machTop.textContent = '.' + Math.round(C.mach * 100);
        machBot.textContent = '.' + (Math.round(C.mach * 1000) / 1000).toFixed(3).slice(2);

        ball.setAttribute('transform',
          'rotate(' + (-cl(C.roll, -80, 80)).toFixed(2) + ' 350 360) translate(0 ' + (cl(C.pitch, -40, 40) * 3.2).toFixed(2) + ')');
        bankPtr.setAttribute('transform', 'rotate(' + (-cl(C.roll, -80, 80)).toFixed(2) + ' 350 360)');

        fpv.setAttribute('transform', 'translate(' + (350 + cl(C.aos * 3, -60, 60)).toFixed(1) + ' ' + (360 + cl(C.aoa * 3, -50, 50)).toFixed(1) + ')');

        altTicks.setAttribute('transform', 'translate(0 ' + (AL(C.alt) * ALT_PX).toFixed(2) + ')');
        altTxt.textContent = Math.round(AL(C.alt));

        vsiPtr.setAttribute('transform', 'translate(0 ' + (cl(C.vy / 30, -1, 1) * 100).toFixed(1) + ')');

        hdgTicks.setAttribute('transform', 'rotate(' + (-C.hdg).toFixed(2) + ' 350 830)');
        hdgTxt.textContent = ('00' + Math.round(C.hdg) % 360).slice(-3);
      }
    };
  }
  /* ============================================================
     俄系 / 中式 大屏 MFD（J-16 / Su-30SM2 风格）
     左：发动机；中：姿态；右：导航；底部数据行
     ============================================================ */
  function makeWideMFD(host) {
    var id = Math.random().toString(36).slice(2, 7);
    function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
    var K = window.KZ || {};
    function T(k) { return K.t ? K.t(k) : k; }
    function U(v, f) { return (K[f] ? K[f](v) : v); }
    function UN(f, d) { return (K[f] ? K[f]() : d); }

    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 600 780', preserveAspectRatio: 'xMidYMid meet' }, host);
    var defs = el('defs', null, svg);
    var MONO = "'WT Mono', Consolas, monospace";
    var NUM = "'WT Mono', Consolas, monospace";
    var UI = "'WT UI', 'WT Mono', 'Microsoft YaHei UI', sans-serif";
    var GRN = '#93d99b', WHT = '#dfe7dc', DIM = '#3a5740', AMB = '#d8a95c';

    function clip(name, attrs) {
      var cp = el('clipPath', { id: name + id }, defs);
      el('rect', attrs, cp);
      return 'url(#' + name + id + ')';
    }
    var cAdi = clip('wa', { x: 60, y: 52, width: 480, height: 300, rx: 2 });
    var cSph = clip('ws', { x: 306, y: 438, width: 280, height: 176, rx: 2 });

    el('rect', { x: 0, y: 0, width: 600, height: 780, fill: '#0b0c0d' }, svg);

    function panel(x, y, w, h, title) {
      el('rect', { x: x, y: y, width: w, height: h, fill: 'none', stroke: '#2a2d31', 'stroke-width': 1 }, svg);
      el('text', { x: x + 10, y: y + 19, 'font-size': 13, 'font-family': UI, fill: WHT, 'letter-spacing': 2 }, svg).textContent = title;
      el('line', { x1: x, y1: y + 25, x2: x + w, y2: y + 25, stroke: '#2a2d31', 'stroke-width': 1 }, svg);
    }

    /* ================= 计算（基于 8111 公开数据推算） ================= */
    panel(8, 8, 584, 392, T('calc'));
    var MONO2 = MONO;
    function calcCell(x, y, key, big) {
      el('text', { x: x, y: y, 'font-size': 11, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T(key);
      return el('text', { x: x, y: y + (big ? 42 : 32), 'font-size': big ? 34 : 24, 'font-family': NUM, fill: big ? GRN : WHT }, svg);
    }
    var cEs = calcCell(28, 78, 'es', true);
    var cEsKg = el('text', { x: 28, y: 146, 'font-size': 12, 'font-family': MONO, fill: '#5f7f6a' }, svg);
    var cPs = calcCell(316, 78, 'ps', true);
    var cTurn = calcCell(28, 178, 'turnR', false);
    var cRad = calcCell(316, 178, 'radius', false);
    var cThr = calcCell(28, 258, 'thrust', false);
    var cAcc = calcCell(316, 258, 'accel', false);
    var cEnd = calcCell(28, 338, 'endur', false);
    var cRng = calcCell(316, 338, 'range', false);
    // 分隔线
    [160, 240, 320].forEach(function (yy) {
      el('line', { x1: 24, y1: yy, x2: 576, y2: yy, stroke: '#1e2a22', 'stroke-width': 1 }, svg);
    });
    el('line', { x1: 300, y1: 60, x2: 300, y2: 372, stroke: '#1e2a22', 'stroke-width': 1 }, svg);


    /* ================= 发动机（1~8 发自适应） ================= */
    panel(8, 408, 284, 212, T('eng'));
    var engG = el('g', null, svg);
    var engs = [];

    el('text', { x: 20, y: 462, 'font-size': 10, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T('thr');
    var thrTxt = el('text', { x: 20, y: 484, 'font-size': 16, 'font-family': NUM, fill: WHT }, svg);
    var abTxt = el('text', { x: 20, y: 502, 'font-size': 10, 'font-family': MONO, fill: AMB }, svg);
    el('text', { x: 20, y: 552, 'font-size': 10, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T('oil');
    var oilTxt = el('text', { x: 20, y: 574, 'font-size': 14, 'font-family': NUM, fill: WHT }, svg);
    var engNote = el('text', { x: 20, y: 600, 'font-size': 11, 'font-family': MONO, fill: '#5f6f5c' }, svg);

    function buildEngines(n) {
      while (engG.firstChild) engG.removeChild(engG.firstChild);
      engs = [];
      var cols = n <= 2 ? n : (n <= 4 ? 2 : (n <= 6 ? 3 : 4));
      var rows = Math.ceil(n / cols);
      var ax = 74, aw = 202, ay = 450, ah = 152;
      var cw = aw / cols, rh = ah / rows;
      for (var i = 0; i < n; i++) {
        var c = i % cols, r = Math.floor(i / cols);
        var cxp = ax + cw * c + cw / 2;
        var top = ay + rh * r + 14;
        var bot = ay + rh * (r + 1) - 18;
        var bw = Math.max(9, Math.min(22, cw * 0.46));
        var lab = el('text', { x: cxp, y: top - 5, 'text-anchor': 'middle', 'font-size': rows > 1 ? 9 : 11,
          'font-family': MONO, fill: GRN }, engG);
        lab.textContent = n === 1 ? T('single') : (n === 2 ? (i === 0 ? T('engLeft') : T('engRight')) : ('#' + (i + 1)));
        var pctLab = el('text', { x: cxp, y: bot + 24, 'text-anchor': 'middle', 'font-size': rows > 1 ? 8 : 9,
          'font-family': 'MONO', fill: '#5f6f5c' }, engG);
        pctLab.textContent = '';
        el('rect', { x: cxp - bw / 2 - 2, y: top, width: bw + 4, height: bot - top, fill: '#080b08', stroke: '#223026' }, engG);
        el('rect', { x: cxp - bw / 2 - 2, y: top, width: bw + 4, height: (bot - top) * 10 / 110, fill: AMB, opacity: .14 }, engG);
        var bar = el('rect', { x: cxp - bw / 2, y: bot, width: bw, height: 0, fill: GRN, opacity: .82 }, engG);
        var ab = el('rect', { x: cxp - bw / 2, y: top, width: bw, height: 0, fill: AMB, opacity: .95 }, engG);
        var val = el('text', { x: cxp, y: bot + 13, 'text-anchor': 'middle', 'font-size': rows > 1 ? 11 : 14,
          'font-family': NUM, fill: WHT }, engG);
        engs.push({ bar: bar, ab: ab, val: val, pct: pctLab, top: top, bot: bot, h: bot - top });
      }
    }
    buildEngines(2);

    /* ================= 态势（只显示游戏已点亮的目标） ================= */
    panel(300, 408, 292, 212, T('tactical'));
    var rows = [];
    for (var ri = 0; ri < 5; ri++) {
      var ry = 462 + ri * 30;
      rows.push({
        kind: el('text', { x: 316, y: ry, 'font-size': 11, 'font-family': MONO, fill: '#7f8f7a' }, svg),
        brg: el('text', { x: 372, y: ry, 'text-anchor': 'end', 'font-size': 16, 'font-family': NUM, fill: WHT }, svg),
        dist: el('text', { x: 452, y: ry, 'text-anchor': 'end', 'font-size': 13, 'font-family': NUM, fill: WHT }, svg),
        name: el('text', { x: 470, y: ry, 'font-size': 10, 'font-family': MONO, fill: '#5f6f5c' }, svg)
      });
    }
    var noC = el('text', { x: 446, y: 530, 'text-anchor': 'middle', 'font-size': 12, 'font-family': UI, fill: '#4f6a58' }, svg);
    noC.textContent = T('noContacts');

    /* ================= 数据行 ================= */
    panel(8, 628, 584, 144, T('data'));
    var fields = [['mach', 'mach'], ['vs', 'vs'], ['trk', 'trk'], ['fuel', 'fuel']];
    var texts = {};
    fields.forEach(function (f, i) {
      var x = 24 + i * 145;
      el('text', { x: x, y: 676, 'font-size': 10, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T(f[0]);
      texts[f[1]] = el('text', { x: x, y: 704, 'font-size': 19, 'font-family': NUM, fill: WHT }, svg);
    });
    el('text', { x: 24, y: 744, 'font-size': 10, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T('aos');
    var aosTxt = el('text', { x: 24, y: 766, 'font-size': 17, 'font-family': NUM, fill: WHT }, svg);

    el('text', { x: 320, y: 744, 'font-size': 10, 'font-family': UI, fill: '#7f8f7a' }, svg).textContent = T('gear');
    var gearSq = [];
    [0, 1, 2].forEach(function (i) {
      var gx = 386 + i * 24;
      el('rect', { x: gx, y: 728, width: 18, height: 18, rx: 2, fill: '#080b08', stroke: '#223026', 'stroke-width': 1 }, svg);
      gearSq.push(el('rect', { x: gx + 2, y: 730, width: 14, height: 14, rx: 2, fill: '#0d1a10', opacity: .6 }, svg));
    });
    var gearTxt = el('text', { x: 470, y: 743, 'font-size': 13, 'font-family': NUM, fill: '#5f6f5c' }, svg);

    function refreshUnits() { /* 单位已在数值里体现，无需单独刷新 */ }
    refreshUnits();

    return {
      set: function (C, V) {
        var n = Math.max(1, Math.min(8, V.engCount || 1));
        if (n !== engs.length) buildEngines(n);

        var thr = cl(C.throttle, 0, 110);
        var pct = thr / 110;
        var abOn = thr > 100.5;
        var MT = (window.KZ && KZ.maxThrust) ? KZ.maxThrust() : 110;
        var thrust = Math.round(thr / 100 * MT * (abOn ? 1.15 : 1));

        var thrMin = 999, thrMax = -1, thrSum = 0;
        for (var ei = 0; ei < engs.length; ei++) {
          var e = engs[ei];
          var ethr = (C.thr && typeof C.thr[ei] === 'number' && C.thr[ei] > 0.1) ? C.thr[ei] : thr;
          if (ei === 0 && !(C.thr && C.thr[0] > 0.1)) ethr = thr;
          if (thrMin > ethr) thrMin = ethr;
          if (thrMax < ethr) thrMax = ethr;
          thrSum += ethr;

          var epct = cl(ethr, 0, 110) / 110;
          var eab = ethr > 100.5;
          var fillH = e.h * Math.min(epct, 100 / 110);
          e.bar.setAttribute('height', fillH.toFixed(1));
          e.bar.setAttribute('y', (e.bot - fillH).toFixed(1));
          e.ab.setAttribute('height', (eab ? e.h * (Math.min(epct, 1) - 100 / 110) : 0).toFixed(1));
          e.ab.setAttribute('y', e.top);
          var ethrust = Math.round(ethr / 100 * MT * (eab ? 1.15 : 1));
          e.val.textContent = ethrust;
          e.pct.textContent = Math.round(ethr) + '%';
        }

        var thrAvg = n > 0 ? thrSum / n : thr;
        thrTxt.textContent = (thrMax - thrMin > 1)
          ? (Math.round(thrMin) + '-' + Math.round(thrMax) + '%')
          : (Math.round(thrAvg) + '%');
        abTxt.textContent = (thrMax > 100.5) ? 'AB' : '';
        oilTxt.textContent = Math.round(C.oil) + '\u00b0C';
        engNote.textContent = n + ' \u00d7 ' + Math.round(thrust) + ' kN';

        /* --- 计算结果 --- */
        var K2 = (window.KZ && KZ.calc) ? KZ.calc : { es: 0, ps: 0, omega: 0, radius: 0, accel: 0, endur: 0, range: 0 };
        cEs.textContent = Math.round(K2.es) + ' m';
        cEsKg.textContent = '\u2261 ' + (K2.es * 9.80665 / 1000).toFixed(1) + ' kJ/kg';
        cPs.textContent = (K2.ps >= 0 ? '+' : '') + K2.ps.toFixed(0) + ' m/s';
        cPs.setAttribute('fill', K2.ps >= 0 ? GRN : AMB);
        cTurn.textContent = K2.omega.toFixed(1) + ' \u00b0/s';
        cRad.textContent = (C.tas < 5) ? '---' : (K2.radius > 0 ? Math.round(K2.radius) + ' m' : '\u221e');
        cThr.textContent = thrust + ' kN';
        cAcc.textContent = (K2.accel >= 0 ? '+' : '') + K2.accel.toFixed(1) + ' m/s\u00b2';
        if (K2.endur > 0) {
          cEnd.textContent = K2.endur.toFixed(1) + ' min';
          cRng.textContent = Math.round(K2.range) + ' km';
        } else {
          var measuring = (C.fuel > 1) ? T('measuring') : '---';
          cEnd.textContent = measuring;
          cRng.textContent = measuring;
        }

        /* --- 态势 --- */
        var cs = (V && V.contacts) ? V.contacts : [];
        for (var i2 = 0; i2 < rows.length; i2++) {
          var row = rows[i2], c = cs[i2];
          if (!c) {
            row.kind.textContent = ''; row.brg.textContent = '';
            row.dist.textContent = ''; row.name.textContent = '';
            continue;
          }
          row.kind.textContent = c.kind;
          row.kind.setAttribute('fill', c.kind === 'MSL' ? '#ff5cd2' : (c.kind === 'AIR' ? '#ff6b5e' : '#d8a95c'));
          row.brg.textContent = ('00' + Math.round(c.brg) % 360).slice(-3) + '\u00b0';
          row.dist.textContent = c.dist > 1000 ? (c.dist / 1000).toFixed(1) + ' km' : Math.round(c.dist) + ' m';
          row.name.textContent = c.icon && c.icon !== 'none' ? c.icon : '';
        }
        noC.style.display = cs.length ? 'none' : 'block';

        /* --- 数据行 --- */
        texts.mach.textContent = C.mach.toFixed(2);
        var vsv = U(C.vy, 'vsi');
        texts.vs.textContent = (vsv >= 0 ? '+' : '') + vsv.toFixed(0);
        texts.trk.textContent = (V.trk >= 0 && performance.now() - V.trkAt < 6000)
          ? ('00' + Math.round(V.trk) % 360).slice(-3) : '---';
        texts.fuel.textContent = Math.round(U(C.fuel, 'fuel')) + ' ' + UN('fuelUnit', 'KG');
        aosTxt.textContent = C.aos.toFixed(1) + '\u00b0';

        var gs = (V.gears && V.gears.length) ? V.gears : [C.gear, C.gear, C.gear];
        var allDown = true, allUp = true;
        for (var gi = 0; gi < 3; gi++) {
          var gv = gs[gi] === undefined ? C.gear : gs[gi];
          var down = gv >= 0.98, up = gv <= 0.02;
          if (!down) allDown = false;
          if (!up) allUp = false;
          gearSq[gi].setAttribute('fill', down ? '#93d99b' : (up ? '#0d1a10' : '#d8a95c'));
          gearSq[gi].setAttribute('opacity', down ? 1 : (up ? .5 : .9));
        }
        gearTxt.textContent = allDown ? 'DOWN' : (allUp ? 'UP' : 'TRANSIT');
        gearTxt.setAttribute('fill', allDown ? '#93d99b' : (allUp ? '#5f6f5c' : '#d8a95c'));
      },
      refreshUnits: refreshUnits
    };
  }


  /* ============================================================
     姿态球 + 坐标轴（小飞机、航向、速度矢量）
     ============================================================ */
  function makeAttScope(host) {
    var id = Math.random().toString(36).slice(2, 7);
    host.innerHTML = '';
    var K = window.KZ || {};
    function T(k) { return K.t ? K.t(k) : k; }
    var GRN = '#93d99b', WHT = '#dfe7dc', DIM = '#2f4a37', MAG = '#ff5cd2';
    var W = 700, H = 760, cx = 350, cy = 392;

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, host);
    var defs = el('defs', null, svg);
    var cp = el('clipPath', { id: 'as' + id }, defs);
    el('circle', { cx: cx, cy: cy, r: 236 }, cp);

    /* 坐标轴 */
    el('line', { x1: 26, y1: cy, x2: W - 26, y2: cy, stroke: '#243126', 'stroke-width': 1, 'stroke-dasharray': '5 7' }, svg);
    el('line', { x1: cx, y1: 74, x2: cx, y2: H - 26, stroke: '#243126', 'stroke-width': 1, 'stroke-dasharray': '5 7' }, svg);

    /* 球 */
    var ballG = el('g', { 'clip-path': 'url(#as' + id + ')' }, svg);
    var ball = el('g', null, ballG);
    el('rect', { x: cx - 600, y: cy - 700, width: 1200, height: 700, fill: '#0b1f12' }, ball);
    el('line', { x1: cx - 600, y1: cy, x2: cx + 600, y2: cy, stroke: GRN, 'stroke-width': 2 }, ball);
    var ASC = 3.0;
    for (var p = -45; p <= 45; p += 5) {
      if (p === 0) continue;
      var ly = cy - p * ASC, w = p % 10 === 0 ? 70 : 38;
      el('line', { x1: cx - w, y1: ly, x2: cx - 20, y2: ly, stroke: GRN, 'stroke-width': 1.5, opacity: .8 }, ball);
      el('line', { x1: cx + 20, y1: ly, x2: cx + w, y2: ly, stroke: GRN, 'stroke-width': 1.5, opacity: .8 }, ball);
      if (p % 10 === 0) {
        el('text', { x: cx - w - 6, y: ly + 4, 'text-anchor': 'end', 'font-size': 10, 'font-family': 'Consolas, monospace', fill: GRN }, ball).textContent = Math.abs(p);
        el('text', { x: cx + w + 6, y: ly + 4, 'font-size': 10, 'font-family': 'Consolas, monospace', fill: GRN }, ball).textContent = Math.abs(p);
      }
    }
    el('circle', { cx: cx, cy: cy, r: 236, fill: 'none', stroke: '#22362a', 'stroke-width': 1.5 }, svg);

    /* 外圈刻度 */
    for (var a = 0; a < 360; a += 10) {
      var isM = a % 30 === 0;
      var q1 = pol(cx, cy, 250, a), q2 = pol(cx, cy, 250 + (isM ? 14 : 8), a);
      el('line', { x1: q1[0].toFixed(1), y1: q1[1].toFixed(1), x2: q2[0].toFixed(1), y2: q2[1].toFixed(1),
        stroke: isM ? GRN : '#3d5f47', 'stroke-width': isM ? 1.8 : 1, opacity: isM ? .95 : .55 }, svg);
    }
    /* 水平航向数字 */
    var nums = [];
    for (var i = 0; i < 12; i++) {
      nums.push(el('text', { x: cx, y: cy, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'Consolas, monospace', fill: GRN }, svg));
    }
    var hdgPtr = el('path', { d: 'M350 ' + (cy - 274) + ' L360 ' + (cy - 258) + ' L340 ' + (cy - 258) + ' Z', fill: GRN }, svg);

    /* 小飞机 */
    var plane = el('path', {
      d: 'M0 -26 L5 -8 L32 -2 L32 6 L5 3 L5 16 L13 24 L13 30 L0 24 L-13 30 L-13 24 L-5 16 L-5 3 L-32 6 L-32 -2 L-5 -8 Z',
      fill: 'none', stroke: WHT, 'stroke-width': 2, 'stroke-linejoin': 'round'
    }, svg);
    plane.setAttribute('transform', 'translate(' + cx + ',' + cy + ')');

    /* 速度矢量 */
    var fpv = el('g', null, svg);
    el('circle', { cx: 0, cy: 0, r: 9, fill: 'none', stroke: MAG, 'stroke-width': 2 }, fpv);
    el('line', { x1: -24, y1: 0, x2: -9, y2: 0, stroke: MAG, 'stroke-width': 2 }, fpv);
    el('line', { x1: 9, y1: 0, x2: 24, y2: 0, stroke: MAG, 'stroke-width': 2 }, fpv);
    el('line', { x1: 0, y1: -14, x2: 0, y2: -5, stroke: MAG, 'stroke-width': 2 }, fpv);

    /* 轴端读数 */
    var hdgAxis = el('text', { x: cx, y: 60, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'Consolas, monospace', fill: WHT }, svg);
    var hdgLab = el('text', { x: cx + 44, y: 60, 'font-size': 10, 'font-family': 'Consolas, monospace', fill: '#7f8f7a' }, svg);
    hdgLab.textContent = T('hdg');
    var trkAxis = el('text', { x: W - 26, y: cy - 14, 'text-anchor': 'end', 'font-size': 15, 'font-family': 'Consolas, monospace', fill: MAG }, svg);
    var trkLab = el('text', { x: W - 26, y: cy + 8, 'text-anchor': 'end', 'font-size': 10, 'font-family': 'Consolas, monospace', fill: '#7f8f7a' }, svg);
    trkLab.textContent = T('trk');
    var vsAxis = el('text', { x: 26, y: cy + 22, 'font-size': 12, 'font-family': 'Consolas, monospace', fill: '#7f8f7a' }, svg);

    return {
      set: function (C, V) {
        var hdg = ((C.hdg % 360) + 360) % 360;
        ball.setAttribute('transform',
          'rotate(' + (-Math.max(-80, Math.min(80, C.roll))).toFixed(1) + ' ' + cx + ' ' + cy + ') translate(0 ' + (Math.max(-45, Math.min(45, C.pitch)) * ASC).toFixed(1) + ')');
        for (var k = 0; k < 12; k++) {
          var ang = k * 30 - hdg;
          var pt = pol(cx, cy, 288, ang);
          nums[k].setAttribute('x', pt[0].toFixed(1));
          nums[k].setAttribute('y', (pt[1] + 5).toFixed(1));
          nums[k].textContent = ('00' + ((k * 30) % 360 / 10 | 0)).slice(-2);
        }
        fpv.setAttribute('transform', 'translate(' + (cx + Math.max(-190, Math.min(190, C.aos * 6))).toFixed(1) + ' ' + (cy + Math.max(-190, Math.min(190, C.aoa * 6))).toFixed(1) + ')');
        hdgAxis.textContent = ('00' + Math.round(hdg) % 360).slice(-3);
        var trk = (V.trk >= 0 && performance.now() - V.trkAt < 6000) ? V.trk : hdg;
        trkAxis.textContent = ('00' + Math.round(trk) % 360).slice(-3);
        vsAxis.textContent = (K.vsi ? Math.round(K.vsi(C.vy)) : Math.round(C.vy)) + (K.vsiUnit ? K.vsiUnit() : 'M/S');
      }
    };
  }

  /* ============================================================
     斜二测空间直角坐标系（机体为参考系，机头固定）
     X 轴水平、Z 轴垂直、Y 轴 45°（长度取半）
     ============================================================ */
  function makeOblique(host) {
    host.innerHTML = '';
    var K = window.KZ || {};
    function T(k) { return K.t ? K.t(k) : k; }
    var W = 600, H = 600, cx = 300, cy = 340, U = 96;
    var OK = 0.35355339;                        // 斜二测 Y 投影系数

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, host);

    // 机体系 -> 屏幕（斜二测）：body x=右, y=机头, z=上
    function pj(v) {
      return [cx + (v[0] - v[1] * OK) * U, cy - (v[2] + v[1] * OK) * U];
    }
    function seg(a, b, color, w, dash, parent) {
      var A = pj(a), B = pj(b);
      var l = el('line', { x1: A[0].toFixed(1), y1: A[1].toFixed(1),
        x2: B[0].toFixed(1), y2: B[1].toFixed(1), stroke: color, 'stroke-width': w || 1.5 }, parent || svg);
      if (dash) l.setAttribute('stroke-dasharray', dash);
      return l;
    }
    function headTo(b, color, parent) {
      var A = pj([0, 0, 0]), B = pj(b);
      var ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
      var sz = 9;
      var p1 = [B[0] - sz * Math.cos(ang - 0.42), B[1] - sz * Math.sin(ang - 0.42)];
      var p2 = [B[0] - sz * Math.cos(ang + 0.42), B[1] - sz * Math.sin(ang + 0.42)];
      el('polygon', { points: B[0].toFixed(1) + ',' + B[1].toFixed(1) + ' ' +
        p1[0].toFixed(1) + ',' + p1[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1),
        fill: color }, parent || svg);
      return B;
    }
    function txt(t, B, color, size, parent) {
      var e = el('text', { x: (B[0] + 9).toFixed(1), y: (B[1] + 4).toFixed(1),
        'font-size': size || 12, 'font-family': 'WT Mono, Consolas, monospace', fill: color }, parent || svg);
      e.textContent = t;
      return e;
    }

    /* ---------- 投影说明 ---------- */
    el('text', { x: 18, y: 26, 'font-size': 11, 'font-family': 'WT Mono, Consolas, monospace', fill: '#5f7f6a' }, svg)
      .textContent = '\u89c6\u89d2\uff1a\u7b2c IV \u5366\u9650';
    el('text', { x: 18, y: 44, 'font-size': 11, 'font-family': 'WT Mono, Consolas, monospace', fill: '#4f6a58' }, svg)
      .textContent = 'f(x,y,z) = (x \u2212 0.354y, z + 0.354y)';

    /* ---------- 地面网格 ---------- */
    for (var gi = -3; gi <= 3; gi++) {
      if (gi === 0) continue;
      seg([gi, -3, 0], [gi, 3, 0], '#182219', 1);
      seg([-3, gi, 0], [3, gi, 0], '#182219', 1);
    }

    /* ---------- 距离球（三个正交大圆）+ 地面刻度 ---------- */
    function ellipseOn(parent, c, r, z, color, w, dash) {
      var pts = [];
      for (var a = 0; a <= 360; a += 6) {
        var t = a * Math.PI / 180;
        var P = pj([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), (c[2] || 0) + (z || 0)]);
        pts.push(P[0].toFixed(1) + ',' + P[1].toFixed(1));
      }
      return el('polygon', { points: pts.join(' '), fill: 'none', stroke: color,
        'stroke-width': w || 1, 'stroke-dasharray': dash || '3 6', opacity: .45 }, parent);
    }
    function sphere(km, color) {
      var r = km / 5;                             // 5 km = 1 单位
      ellipseOn(svg, [0, 0, 0], r, 0, color);                     // 水平面
      var pts;
      // XZ 平面大圆
      pts = [];
      for (var a = 0; a <= 360; a += 6) {
        var t = a * Math.PI / 180;
        var P = pj([r * Math.sin(t), 0, r * Math.cos(t)]);
        pts.push(P[0].toFixed(1) + ',' + P[1].toFixed(1));
      }
      el('polygon', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 1,
        'stroke-dasharray': '2 7', opacity: .3 }, svg);
      // YZ 平面大圆
      pts = [];
      for (var b = 0; b <= 360; b += 6) {
        var t2 = b * Math.PI / 180;
        var P2 = pj([0, r * Math.sin(t2), r * Math.cos(t2)]);
        pts.push(P2[0].toFixed(1) + ',' + P2[1].toFixed(1));
      }
      el('polygon', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 1,
        'stroke-dasharray': '2 7', opacity: .3 }, svg);
    }
    sphere(5, '#2f4a37');
    sphere(10, '#23372a');

    /* ---------- 地面上的距离刻度 ---------- */
    [[5, '5 km'], [10, '10 km']].forEach(function (it) {
      var r = it[0] / 5;
      [[r, 0], [-r, 0], [0, r], [0, -r]].forEach(function (p, idx) {
        var P = pj([p[0], p[1], 0]);
        el('text', { x: P[0].toFixed(1), y: (P[1] + (idx < 2 ? 12 : 4)).toFixed(1),
          'text-anchor': 'middle', 'font-size': 9, 'font-family': 'WT Mono, Consolas, monospace',
          fill: '#3f5f4a' }, svg).textContent = it[1];
      });
    });

    /* ---------- 小飞机模型（原点） ---------- */
    var planeG = el('g', null, svg);
    function poly(pts, fill, stroke, w) {
      var s2 = pts.map(function (v) { var P = pj(v); return P[0].toFixed(1) + ',' + P[1].toFixed(1); }).join(' ');
      el('polygon', { points: s2, fill: fill, stroke: stroke, 'stroke-width': w || 1, 'stroke-linejoin': 'round' }, planeG);
    }
    poly([[0, 0.16, 0], [0.95, -0.05, 0], [0.95, -0.16, 0], [0, -0.06, 0],
          [-0.95, -0.16, 0], [-0.95, -0.05, 0]], '#c7d2d9', '#8b979e', 1.2);
    poly([[0, 0.86, 0], [0.10, 0.30, 0], [0.10, -0.62, 0], [-0.10, -0.62, 0],
          [-0.10, 0.30, 0]], '#dde5ea', '#8b979e', 1.2);
    poly([[0, -0.42, 0], [0.42, -0.62, 0], [0.42, -0.70, 0], [0, -0.60, 0],
          [-0.42, -0.70, 0], [-0.42, -0.62, 0]], '#bfcad1', '#8b979e', 1.1);
    poly([[0, -0.34, 0], [0, -0.62, 0.30], [0, -0.72, 0.30], [0, -0.60, 0]], '#9fb0ba', '#8b979e', 1.1);
    poly([[0, 0.30, 0.02], [0.06, 0.12, 0.02], [0.06, 0.02, 0.02], [-0.06, 0.02, 0.02],
          [-0.06, 0.12, 0.02]], '#5f7d8c', '#4a6472', 1);

    /* ---------- 固定机体轴 ---------- */
    var bodyG = el('g', null, svg);
    seg([0, 0, 0], [1.75, 0, 0], '#ff9f5e', 2.4, null, bodyG);
    txt('\u53f3', headTo([1.75, 0, 0], '#ff9f5e', bodyG), '#ff9f5e', 12, bodyG);
    seg([0, 0, 0], [0, 2.05, 0], '#58a6ff', 2.6, null, bodyG);
    txt('\u673a\u5934', headTo([0, 2.05, 0], '#58a6ff', bodyG), '#58a6ff', 12, bodyG);
    seg([0, 0, 0], [0, 0, 1.5], '#7ee787', 2.4, null, bodyG);
    txt('\u4e0a', headTo([0, 0, 1.5], '#7ee787', bodyG), '#7ee787', 12, bodyG);

    /* ---------- 图例 ---------- */
    var LEG = [['#ff5cd2', 'MSL'], ['#ff6b5e', 'AIR'], ['#d8a95c', 'GND'], ['#7fd1ff', 'SUR']];
    var legName = { MSL: T('kMsl'), AIR: T('kAir'), GND: T('kGnd'), SUR: T('kSur') };
    el('text', { x: 22, y: 470, 'font-size': 11, 'font-family': 'WT Mono, Consolas, monospace', fill: '#5f7f6a' }, svg)
      .textContent = T('legend') + '  \u00b7  ' + T('heading');
    LEG.forEach(function (it, i) {
      var y = 492 + i * 19;
      el('rect', { x: 24, y: y - 8, width: 8, height: 8, fill: it[0] }, svg);
      el('text', { x: 38, y: y, 'font-size': 11, 'font-family': 'WT Mono, Consolas, monospace', fill: '#8fa39a' }, svg)
        .textContent = it[1] + ' ' + (legName[it[1]] || '');
    });

    /* ---------- 动态图层 ---------- */
    var contactG = el('g', null, svg);
    var velG = el('g', null, svg);

    function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }

    function rot(pitch, roll, hdg) {
      var p = pitch * Math.PI / 180, r = roll * Math.PI / 180, y = hdg * Math.PI / 180;
      var f = [Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), Math.sin(p)];
      var rh = [Math.cos(y), -Math.sin(y), 0];
      var u = [f[1] * rh[2] - f[2] * rh[1], f[2] * rh[0] - f[0] * rh[2], f[0] * rh[1] - f[1] * rh[0]];
      var cr = Math.cos(r), sr = Math.sin(r);
      var r2 = [rh[0] * cr - u[0] * sr, rh[1] * cr - u[1] * sr, rh[2] * cr - u[2] * sr];
      var u2 = [u[0] * cr + rh[0] * sr, u[1] * cr + rh[1] * sr, u[2] * cr + rh[2] * sr];
      return { f: f, r: r2, u: u2 };
    }

    var lastT = 0, lp = 999, lr = 999, lh = 999, lastSig = '';
    return {
      set: function (C, V) {
        var now = performance.now();
        var cs0 = (V && V.contacts) ? V.contacts : [];
        var sig = cs0.length + ':' + cs0.map(function (c) {
          return Math.round(c.brg) + '/' + Math.round(c.dist / 100) + '/' + Math.round(c.dir || 0);
        }).join(',') + '/' + Math.round(C.tas);
        var changed = Math.abs(C.pitch - lp) > 0.3 || Math.abs(C.roll - lr) > 0.3 ||
                      Math.abs(C.hdg - lh) > 0.3 || sig !== lastSig;
        if (!changed && now - lastT < 90) return;
        lastT = now; lp = C.pitch; lr = C.roll; lh = C.hdg; lastSig = sig;

        /* ---- 敌情：圆柱（在 z 方向有高度）---- */
        clear(contactG);
        var CH = 0.26;                       // 圆柱高度（单位）
        for (var ci = 0; ci < cs0.length; ci++) {
          var cc = cs0[ci];
          var d = Math.min(3, cc.dist / 1000 / 5);
          var dlt = (cc.brg - C.hdg) * Math.PI / 180;
          var bx = d * Math.sin(dlt), by = d * Math.cos(dlt);
          var col = cc.kind === 'MSL' ? '#ff5cd2' : (cc.kind === 'AIR' ? '#ff6b5e' : (cc.kind === 'GND' ? '#d8a95c' : '#7fd1ff'));
          var rr = cc.kind === 'MSL' ? 0.075 : 0.06;

          // 底面 + 顶面
          ellipseOn(contactG, [bx, by, 0], rr, 0, col, 1.2, 'none');
          ellipseOn(contactG, [bx, by, CH], rr, 0, col, 1.2, 'none');
          // 侧壁（取左右两条母线）
          seg([bx - rr, by, 0], [bx - rr, by, CH], col, 1.2, null, contactG);
          seg([bx + rr, by, 0], [bx + rr, by, CH], col, 1.2, null, contactG);
          seg([bx, by - rr * OK * 2, 0], [bx, by - rr * OK * 2, CH], col, 1, null, contactG);
          // 顶面朝向箭头
          var dRel = ((cc.dir || 0) - C.hdg) * Math.PI / 180;
          var hs = rr * 2.6;
          seg([bx, by, CH], [bx + Math.sin(dRel) * hs, by + Math.cos(dRel) * hs, CH], col, 2, null, contactG);
          // 距离标签
          var top = pj([bx, by, CH]);
          el('text', { x: (top[0] + 8).toFixed(1), y: (top[1] - 4).toFixed(1), 'font-size': 9,
            'font-family': 'WT Mono, Consolas, monospace', fill: col }, contactG)
            .textContent = cc.dist > 1000 ? (cc.dist / 1000).toFixed(0) + 'km' : Math.round(cc.dist) + 'm';
        }

        /* ---- 本机速度矢量：长度随速度，方向随航迹 ---- */
        clear(velG);
        var aa = C.aoa * Math.PI / 180, ss = C.aos * Math.PI / 180;
        var vdir = [Math.sin(ss) * Math.cos(aa), Math.cos(ss) * Math.cos(aa), -Math.sin(aa)];
        var spd = Math.max(0, C.tas);
        var L = Math.max(0.55, Math.min(2.9, spd / 380));       // 380 km/h ≈ 1 单位
        var tip = [vdir[0] * L, vdir[1] * L, vdir[2] * L];
        seg([0, 0, 0], tip, '#ff5cd2', 2.6, null, velG);
        var B = headTo(tip, '#ff5cd2', velG);
        var K2 = window.KZ || {};
        var unit = (K2.speedUnit ? K2.speedUnit() : 'KM/H');
        var shown = K2.speed ? Math.round(K2.speed(spd)) : Math.round(spd);
        var lab = el('text', { x: (B[0] + 8).toFixed(1), y: (B[1] + 4).toFixed(1), 'font-size': 11,
          'font-family': 'WT Mono, Consolas, monospace', fill: '#ff5cd2' }, velG);
        lab.textContent = 'VEL ' + shown + ' ' + unit;
      }
    };
  }

  global.Gauges = {
    makeDial: makeDial,
    makeCompass: makeCompass,
    makeBankScale: makeBankScale,
    makeLamps: makeLamps,
    makeFpm: makeFpm,
    makeTape: makeTape,
    makeADI: makeADI,
    makeHeadingTape: makeHeadingTape,
    makeEnginePanel: makeEnginePanel,
    makePFD: makePFD,
    makeWideMFD: makeWideMFD,
    makeAttScope: makeAttScope,
    makeOblique: makeOblique,
    fmt: f
  };
})(window);









