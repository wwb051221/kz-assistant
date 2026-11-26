/* ============================================================
   themes.js — 仪表风格（经典 / 战斗机 / 玻璃座舱）
   每种风格自己构建 DOM 并实现 update(C, V)
   ============================================================ */
(function (global) {
  'use strict';

  var G = global.Gauges;

  /* ---------------- 共用：灯板 + 数字条 ---------------- */
  function lampLabel(k, dflt) {
    return (window.KZ && window.KZ.t) ? window.KZ.t('lamp_' + k) : dflt;
  }
  function lampDefs() { return [
    { key: 'gear', label: lampLabel('gear', 'GEAR') },
    { key: 'flaps', label: lampLabel('flaps', 'FLAPS') },
    { key: 'brake', label: lampLabel('brake', 'AIRBRK') },
    { key: 'wep', label: lampLabel('wep', 'WEP'), kind: 'warn' },
    { key: 'fuel', label: lampLabel('fuel', 'FUEL'), kind: 'bad' },
    { key: 'ovspd', label: lampLabel('ovspd', 'OVERSPD'), kind: 'bad' },
    { key: 'stall', label: lampLabel('stall', 'STALL'), kind: 'bad' },
    { key: 'link', label: lampLabel('link', 'LINK') }
  ]; }

  var STRIP_HTML =
    '<div class="strip" id="strip">' +
    '<div class="sItem"><label>MACH</label><b id="sMach">—</b></div>' +
    '<div class="sItem"><label>G</label><b id="sG">—</b></div>' +
    '<div class="sItem"><label>AOA</label><b id="sAoa">—</b></div>' +
    '<div class="sItem"><label>AOS</label><b id="sAos">—</b></div>' +
    '<div class="sItem"><label>THR</label><b id="sThr">—</b></div>' +
    '<div class="sItem"><label>OIL</label><b id="sOil">—</b></div>' +
    '<div class="sItem"><label>ENDUR</label><b id="sEnd">—</b></div>' +
    '</div>';

  function chomp(v, d) { return v.toFixed(d); }

  function KZ() { return window.KZ || {}; }
  function IMP() { return !!(window.KZ && window.KZ.isImperial && window.KZ.isImperial()); }
  function SU() { return (window.KZ && window.KZ.speedUnit) ? window.KZ.speedUnit() : 'KM/H'; }
  function AU() { return (window.KZ && window.KZ.altUnit) ? window.KZ.altUnit() : 'M'; }
  function VU() { return (window.KZ && window.KZ.vsiUnit) ? window.KZ.vsiUnit() : 'M/S'; }
  function FU() { return (window.KZ && window.KZ.fuelUnit) ? window.KZ.fuelUnit() : 'KG'; }
  function CS(v) { return (window.KZ && window.KZ.speed) ? window.KZ.speed(v) : v; }
  function CA(v) { return (window.KZ && window.KZ.alt) ? window.KZ.alt(v) : v; }
  function CV(v) { return (window.KZ && window.KZ.vsi) ? window.KZ.vsi(v) : v; }
  function CF(v) { return (window.KZ && window.KZ.fuel) ? window.KZ.fuel(v) : v; }

  function buildChrome(host, inner) {
    host.innerHTML = inner +
      '<div class="lamps" id="lampRow"></div>' +
      STRIP_HTML;
  }

  function updateStrip(C) {
    var $ = function (id) { return document.getElementById(id); };
    if (!$('sMach')) return;
    $('sMach').textContent = C.mach.toFixed(2);
    $('sG').textContent = C.g.toFixed(1);
    $('sAoa').textContent = C.aoa.toFixed(1) + '°';
    $('sAos').textContent = C.aos.toFixed(1) + '°';
    $('sThr').textContent = Math.round(C.throttle) + '%';
    $('sOil').textContent = Math.round(C.oil) + '°C';

    var pct = C.fuel0 > 0 ? C.fuel / C.fuel0 : 0;
    var endS = 0;
    if (C.fuel0 > 0 && C.fuel > 0) {
      if (!updateStrip._f0) { updateStrip._f0 = C.fuel; updateStrip._t0 = performance.now(); }
      var el = (performance.now() - updateStrip._t0) / 1000;
      if (el > 5) {
        var burn = (updateStrip._f0 - C.fuel) / el;
        endS = burn > 0.01 ? C.fuel / burn : 0;
      }
    }
    if (endS > 0) {
      var m = Math.floor(endS / 60), s = Math.floor(endS % 60);
      $('sEnd').textContent = m + ':' + ('0' + s).slice(-2);
    } else {
      $('sEnd').textContent = '—';
    }
  }

  function updateLamps(lamps, C, V, connected) {
    var pct = C.fuel0 > 0 ? C.fuel / C.fuel0 : 0;
    lamps.set('gear', C.gear > 0.98);
    lamps.set('flaps', C.flaps > 0.02);
    lamps.set('brake', C.brake > 0.02);
    lamps.set('wep', C.throttle >= 99.5 && C.ias > 30);
    lamps.set('fuel', pct < 0.15 && C.fuel0 > 0);
    lamps.set('ovspd', C.ias > 1400);
    lamps.set('stall', C.aoa > 24);
    lamps.set('link', connected || V.mock === true);
  }

  function niceStep(x) {
    var p = Math.pow(10, Math.floor(Math.log10(x)));
    var nn = x / p;
    var s = nn <= 1 ? 1 : nn <= 2 ? 2 : nn <= 5 ? 5 : 10;
    return s * p;
  }

  /* ============================================================
     风格 1：经典六表
     ============================================================ */
  function buildClassic(host) {
    buildChrome(host,
      '<div class="cell" id="cSpd"></div>' +
      '<div class="cell" id="cAlt"></div>' +
      '<div class="cell" id="cVsi"></div>' +
      '<div class="cell" id="cHdg"></div>' +
      '<div class="cell" id="cRpm"></div>' +
      '<div class="cell" id="cFuel"></div>');

    host.classList.add('t-classic');

    var spd = G.makeDial(document.getElementById('cSpd'), {
      min: 0, max: IMP() ? 900 : 1600, major: IMP() ? 100 : 200, minor: IMP() ? 25 : 50,
      title: 'AIRSPEED', unit: SU() + ' · IAS', needleLen: 136,
      arcs: [{ from: 0, to: 1600, color: '#1d2a31', width: 3, opacity: .9 }]
    });
    var alt = G.makeDial(document.getElementById('cAlt'), {
      min: 0, max: IMP() ? 10000 : 1000, major: IMP() ? 2000 : 200, minor: IMP() ? 500 : 50,
      title: 'ALTITUDE', unit: AU() + ' · BARO', needleLen: 136,
      labelFormat: IMP() ? function (v) { return String(v / 1000); } : null
    });
    var vsi = G.makeDial(document.getElementById('cVsi'), {
      min: IMP() ? -6000 : -30, max: IMP() ? 6000 : 30, major: IMP() ? 2000 : 10, minor: IMP() ? 500 : 2.5,
      title: 'VERT SPEED', unit: VU(), needleLen: 128,
      labelFormat: function (v) { return v > 0 ? '+' + v : String(v); }
    });
    var hdg = G.makeCompass(document.getElementById('cHdg'));
    var rpm = G.makeDial(document.getElementById('cRpm'), {
      min: 0, max: 4000, major: 500, minor: 100,
      title: 'RPM', unit: 'REV / MIN', needles: 3,
      needleColors: ['#ffb648', '#7fd1ff', '#a6e86a'], needleLen: 120
    });

    var fuelMax = 0, fuel = null, fuelCell = document.getElementById('cFuel');
    function makeFuel(maxKg) {
      var m = Math.max(100, Math.ceil(maxKg / 100) * 100);
      fuelMax = m;
      var major = niceStep(m / 5);
      fuel = G.makeDial(fuelCell, {
        min: 0, max: CF(m), major: Math.max(1, Math.round(CF(m / 5))), minor: Math.max(1, Math.round(CF(m / 20))),
        title: 'FUEL', unit: FU(), needleLen: 130,
        arcs: [
          { from: 0, to: m * 0.15, color: '#b8342c', width: 8, opacity: .9 },
          { from: m * 0.15, to: m, color: '#2c6b3c', width: 3, opacity: .7 }
        ]
      });
    }
    makeFuel(2000);

    var lamps = G.makeLamps(document.getElementById('lampRow'), lampDefs());

    var rpmMax = 4000;
    function makeRpm(max) {
      rpmMax = max;
      var major = niceStep(max / 8);
      rpm = G.makeDial(document.getElementById('cRpm'), {
        min: 0, max: max, major: major, minor: major / 5,
        title: 'RPM', unit: 'REV / MIN', needles: 3,
        needleColors: ['#ffb648', '#7fd1ff', '#a6e86a'], needleLen: 120
      });
    }

    return {
      update: function (C, V, connected) {
        spd.set(CS(C.ias)); spd.setText(Math.round(CS(C.ias)));
        var altv = CA(C.alt);
        alt.set(IMP() ? altv % 10000 : altv % 1000); alt.setText(Math.round(altv));
        vsi.set(CV(C.vy)); vsi.setText((CV(C.vy) >= 0 ? '+' : '') + CV(C.vy).toFixed(IMP() ? 0 : 1));
        hdg.set(C.hdg);
        rpm.setMulti(C.rpm); rpm.setCount(Math.min(3, Math.max(1, V.engCount || 1)));
        rpm.setText(Math.round(C.rpm[0]));

        if (V.fuel0 > 0 && Math.abs(V.fuel0 - fuelMax) > 60) makeFuel(V.fuel0);
        fuel.set(CF(C.fuel)); fuel.setText(Math.round(CF(C.fuel)));

        var maxR = Math.max(C.rpm[0], C.rpm[1], C.rpm[2]);
        if (maxR > rpmMax * 0.97 && rpmMax < 32000) makeRpm(rpmMax * 2);

        updateLamps(lamps, C, V, connected);
        updateStrip(C);
      }
    };
  }

  /* ============================================================
     风格 2：战斗机 PFD（F-16 主飞行显示）
     ============================================================ */
  function osb(cls, n) {
    var s = '<div class="mfd-osb ' + cls + '">';
    for (var i = 0; i < n; i++) s += '<i></i>';
    return s + '</div>';
  }

  function buildWide(host, en) {
    host.innerHTML =
      '<div class="mfd">' +
        osb('osb-t row', 5) +
        osb('osb-l col', 5) +
        '<div class="mfd-screen">' +
          '<div class="mfd-head"><span>MFD 1</span><b>' + (en ? 'F-15E · MFD' : 'J-16 / SU-30SM2') + '</b></div>' +
          '<div class="pfd-svg" id="wideSvg"></div>' +
        '</div>' +
        osb('osb-r col', 5) +
        osb('osb-b row', 5) +
      '</div>' +
      '<div class="lamps" id="lampRow"></div>';
    host.classList.add('t-wide');

    var wide = G.makeWideMFD(document.getElementById('wideSvg'), en);
    var lamps = G.makeLamps(document.getElementById('lampRow'), lampDefs());

    return {
      update: function (C, V, connected) {
        wide.set(C, V);
        updateLamps(lamps, C, V, connected);
      }
    };
  }

  function buildPFD(host) {
    host.innerHTML =
      '<div class="mfd">' +
        osb('osb-t row', 5) +
        osb('osb-l col', 5) +
        '<div class="mfd-screen">' +
          '<div class="mfd-head"><span>MFD 1</span><b>PFD</b></div>' +
          '<div class="pfd-svg" id="pfdSvg"></div>' +
          STRIP_HTML.replace('class="strip"', 'class="strip mfd-strip"') +
        '</div>' +
        osb('osb-r col', 5) +
        osb('osb-b row', 5) +
      '</div>' +
      '<div class="lamps" id="lampRow"></div>';
    host.classList.add('t-pfd');

    var pfd = G.makePFD(document.getElementById('pfdSvg'));
    var lamps = G.makeLamps(document.getElementById('lampRow'), lampDefs());

    return {
      update: function (C, V, connected) {
        pfd.set(C, V);
        updateLamps(lamps, C, V, connected);
        updateStrip(C);
      }
    };
  }
  /* ============================================================
     风格 3：玻璃座舱（大数字 + 条）
     ============================================================ */
  function buildGlass(host) {
    buildChrome(host,
      '<div class="glass">' +
        '<div class="gcell big"><label>IAS</label><b id="gIas">—</b><i>' + SU() + '</i></div>' +
        '<div class="gcell big"><label>ALT</label><b id="gAlt">—</b><i>' + AU() + '</i></div>' +
        '<div class="gcell"><label>V/S</label><b id="gVsi">—</b><i>' + VU() + '</i></div>' +
        '<div class="gcell"><label>HDG</label><b id="gHdg">—</b><i>°</i></div>' +
        '<div class="gcell"><label>MACH</label><b id="gMach">—</b><i></i></div>' +
        '<div class="gcell"><label>G</label><b id="gG">—</b><i></i></div>' +
        '<div class="gcell"><label>AOA</label><b id="gAoa">—</b><i>°</i></div>' +
        '<div class="gcell"><label>TRK</label><b id="gTrk">—</b><i>°</i></div>' +
        '<div class="gcell bar"><label>THR</label><div class="pbar"><i id="gThrBar"></i></div><b id="gThr">—</b></div>' +
        '<div class="gcell bar"><label>FUEL</label><div class="pbar"><i id="gFuelBar"></i></div><b id="gFuel">—</b></div>' +
      '</div>');
    host.classList.add('t-glass');

    var $ = function (id) { return document.getElementById(id); };
    var lamps = G.makeLamps($('lampRow'), lampDefs());

    return {
      update: function (C, V, connected) {
        $('gIas').textContent = Math.round(CS(C.ias));
        $('gAlt').textContent = Math.round(CA(C.alt));
        $('gVsi').textContent = (CV(C.vy) >= 0 ? '+' : '') + CV(C.vy).toFixed(IMP() ? 0 : 1);
        $('gHdg').textContent = ('00' + Math.round(C.hdg) % 360).slice(-3);
        $('gMach').textContent = C.mach.toFixed(2);
        $('gG').textContent = C.g.toFixed(1);
        $('gAoa').textContent = C.aoa.toFixed(1);
        $('gTrk').textContent = (V.trk >= 0 && performance.now() - V.trkAt < 6000)
          ? ('00' + Math.round(V.trk) % 360).slice(-3) : '—';
        $('gThr').textContent = Math.round(C.throttle) + '%';
        $('gThrBar').style.width = Math.max(0, Math.min(100, C.throttle)) + '%';
        var pct = C.fuel0 > 0 ? Math.max(0, Math.min(100, C.fuel / C.fuel0 * 100)) : 0;
        $('gFuel').textContent = Math.round(CF(C.fuel)) + ' ' + FU();
        $('gFuelBar').style.width = pct + '%';
        $('gFuelBar').className = pct < 15 ? 'low' : '';
        updateLamps(lamps, C, V, connected);
        updateStrip(C);
      }
    };
  }

  global.Themes = {
    list: [
      { id: 'wide', name: '俄系/中式 大屏（J-16 / Su-30SM2）' },
      { id: 'f15', name: '美系 MFD（F-15）' },
      { id: 'pfd', name: '战斗机 PFD（F-16）' },
      { id: 'classic', name: '经典六表（二战）' },
      { id: 'glass', name: '玻璃座舱（大数字）' }
    ],
    build: function (id, host) {
      host.className = '';
      host.innerHTML = '';
      if (id === 'wide') return buildWide(host, false);
      if (id === 'f15') return buildWide(host, true);
      if (id === 'classic') return buildClassic(host);
      if (id === 'glass') return buildGlass(host);
      return buildPFD(host);
    }
  };
})(window);







