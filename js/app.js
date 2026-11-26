/* ============================================================
   app.js — 数据接入 / 风格切换 / 设置 / 3D 模型导入
   数据源：War Thunder 官方本地接口 http://localhost:8111
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);

  var CFG = {
    api: qs.get('api') || localStorage.getItem('wt-panel-api') || 'http://localhost:8111',
    pollMs: 120,
    mock: qs.has('mock'),
    fixed: (function () {
      var f = qs.get('fixed');
      if (!f) return null;
      var a = f.split(',').map(parseFloat);
      return (a.length >= 2 && isFinite(a[0]) && isFinite(a[1])) ? a : null;
    })()
  };
  if (qs.get('api')) localStorage.setItem('wt-panel-api', CFG.api);

  /* ============================================================
     设置
     ============================================================ */
  var DEFAULTS = {
    theme: 'wide',
    modelYaw: 0,
    modelScale: 1,
    fpm: true,
    scale: true,
    modelFile: '',
    sensor: 'tgp',
    showModel: false,
    view: 'axes',
    maxThrust: 110,
    thrustAuto: true,
    layout: 'auto',
    units: 'metric',
    lang: 'zh',
    ui: 'dark',
    pitchSign: 1,
    rollSign: 1
  };
  function loadSettings() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('wt-panel-settings') || '{}'));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  var settings = loadSettings();
  function saveSettings() {
    try { localStorage.setItem('wt-panel-settings', JSON.stringify(settings)); } catch (e) { }
  }
  if (qs.get('modelYaw')) settings.modelYaw = parseFloat(qs.get('modelYaw')) || 0;
  if (qs.get('modelScale')) settings.modelScale = parseFloat(qs.get('modelScale')) || 1;

  /* ============================================================
     目标值 / 显示值
     ============================================================ */
  var V = {
    ias: 0, tas: 0, alt: 0, vy: 0, mach: 0, aoa: 0, aos: 0, g: 1,
    fuel: 0, fuel0: 0, throttle: 0, oil: 0,
    rpm: [0, 0, 0, 0, 0, 0, 0, 0], engCount: 1,
    pitch: 0, roll: 0, hdg: 0,
    gear: 0, gears: null, flaps: 0, brake: 0,
    valid: false, type: '', attSrc: '', trk: -1, trkAt: 0, mock: false, contacts: []
  };
  var C = JSON.parse(JSON.stringify(V));

  /* ---------- 派生计算（全部基于 8111 公开数据） ---------- */
  var calc = { es: 0, ps: 0, omega: 0, radius: 0, accel: 0, burn: 0, endur: 0, range: 0, thrust: 0 };
  var calcPrev = null;
  var G0 = 9.80665;

  function updateCalc(C) {
    var v = C.tas / 3.6;                      // m/s
    var es = C.alt + (v * v) / (2 * G0);      // 比能量 (m)
    var n = Math.max(0.05, C.g);

    // 转弯率 / 半径
    var q = Math.sqrt(Math.max(0, n * n - 1));
    calc.omega = (G0 * q / Math.max(5, v)) * 57.29578;   // °/s
    calc.radius = q > 0.01 ? (v * v) / (G0 * q) : 0;      // m

    var now = performance.now();
    if (!calcPrev) {
      calcPrev = { t: now, v: v, es: es, fuel: C.fuel };
    } else {
      var dt = (now - calcPrev.t) / 1000;
      if (dt >= 0.25 && dt < 6) {
        var accel = (v - calcPrev.v) / dt;
        calc.accel = calc.accel * 0.55 + accel * 0.45;
        var psNew = (es - calcPrev.es) / dt;
        calc.ps = calc.ps * 0.55 + psNew * 0.45;
        var dm = calcPrev.fuel - C.fuel;
        if (dm < -50) {
          calc.burn = 0;                               // 加油/换机：重置
        } else if (C.fuel > 5 && dm >= 0) {
          var b = dm / dt * 60;                        // kg/min
          // 物理限幅：单台 0~120 kg/min，最多 8 台
          var cap = 120 * Math.max(1, Math.min(8, C.engCount || 1));
          if (b <= cap) calc.burn = calc.burn > 0 ? calc.burn * 0.8 + b * 0.2 : b;
        }
        calcPrev = { t: now, v: v, es: es, fuel: C.fuel };
      }
    }

    calc.es = es;
    var MT = settings.maxThrust || 110;
    var thr = C.throttle || 0;
    var engN = Math.max(1, Math.min(8, C.engCount || 1));
    calc.thrust = Math.round(thr / 100 * MT * (thr > 100.5 ? 1.15 : 1));

    // 油耗：优先用 Mfuel 实测；测不到时按「油门 × 台数」估
    var burnUse = calc.burn;
    calc.est = false;
    if (!(burnUse > 0.05)) {
      burnUse = (thr / 100) * 2.1 * engN;          // kg/min 粗估：100% 油门单发约 2.1 kg/min
      calc.est = true;
    }
    calc.endur = burnUse > 0.05 && C.fuel > 1 ? (C.fuel / burnUse) : 0;   // min
    calc.range = calc.endur / 60 * C.tas;                                  // km
    calc.fuel = C.fuel; calc.engN = engN;
    if (window.KZ) KZ.calc = calc;
  }

  var themeApi = null;
  var attScope = null;
  var bankScale = null;
  var connected = false;
  var failStreak = 0;
  var firstOkAt = 0;
  var lastIndAt = 0;
  var serverOk = false;
  var started = 0;

  /* ============================================================
     工具
     ============================================================ */
  function n(v, d) { var x = parseFloat(v); return isFinite(x) ? x : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function wrap180(d) { return ((d + 180) % 360 + 360) % 360 - 180; }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1800);
  }

  /* ============================================================
     8111 解析
     ============================================================ */
  function applyState(s) {
    var valid = s && s.valid !== false && typeof s['IAS, km/h'] !== 'undefined';
    if (!valid) { V.valid = false; return false; }
    V.valid = true;
    V.ias = n(s['IAS, km/h'], 0);
    V.tas = n(s['TAS, km/h'], V.ias);
    V.alt = n(s['H, m'], 0);
    V.vy = n(s['Vy, m/s'], 0);
    V.mach = n(s['M'], 0);
    V.aoa = n(s['AoA, deg'], 0);
    V.aos = n(s['AoS, deg'], 0);
    V.g = n(s['Ny'], 1);
    V.fuel = n(s['Mfuel, kg'], 0);
    V.fuel0 = n(s['Mfuel0, kg'], 0) || V.fuel0;

    V.rpm = [0, 0, 0, 0, 0, 0, 0, 0];
    var cnt = 0;
    for (var i = 1; i <= 8; i++) {
        if (typeof s['RPM ' + i] !== 'undefined' && n(s['RPM ' + i], 0) > 0) {
          V.rpm[i - 1] = n(s['RPM ' + i], 0);
        cnt++;
      }
    }
    V.engCount = Math.max(1, cnt);
    V.throttle = n(s['throttle 1, %'], 0);
    V.oil = n(s['oil temp 1, C'], n(s['water temp 1, C'], 0));

    if (!lastIndAt || performance.now() - lastIndAt > 1500) {
      var vMs0 = Math.max(1, V.tas / 3.6);
      var gam = Math.asin(clamp(V.vy / vMs0, -1, 1)) * 180 / Math.PI;
      V.pitch = gam + V.aoa;
      V.attSrc = 'EST';
    }
    return true;
  }

  function applyIndicators(ind) {
    if (!ind || ind.valid === false) return false;
    lastIndAt = performance.now();

    if (typeof ind.compass !== 'undefined') V.hdg = ((n(ind.compass, V.hdg) % 360) + 360) % 360;
    if (typeof ind.gears !== 'undefined') V.gear = n(ind.gears, 0);
    var gs = [];
    for (var gi = 1; gi <= 3; gi++) {
      if (typeof ind['gears' + gi] !== 'undefined') gs.push(n(ind['gears' + gi], 0));
    }
    V.gears = gs.length >= 2 ? gs : null;
    if (typeof ind.flaps !== 'undefined') V.flaps = n(ind.flaps, 0);
    if (typeof ind.airbrake_indicator !== 'undefined') V.brake = n(ind.airbrake_indicator, 0);
    if (typeof ind.g_meter !== 'undefined' && !V.g) V.g = n(ind.g_meter, 1);
    if (typeof ind.type === 'string' && ind.type) {
      if (ind.type !== V.type) {
        V.type = ind.type;
        if (settings.thrustAuto !== false) {
          var tv0 = lookupThrust(V.type);
          if (tv0 && Math.abs(tv0 - settings.maxThrust) > 0.5) {
            settings.maxThrust = tv0;
            saveSettings();
            var sl = document.getElementById('maxThrust'), lb = document.getElementById('maxThrustV');
            if (sl) sl.value = tv0;
            if (lb) lb.textContent = tv0 + ' kN';
          }
        }
      }
    }

    var hp = ind.aviahorizon_pitch, hr = ind.aviahorizon_roll, bk = ind.bank;
    if (typeof hp !== 'undefined' && typeof hr !== 'undefined' && hp !== null && hr !== null) {
      V.pitch = settings.pitchSign * n(hp, 0);
      V.roll = settings.rollSign * (typeof bk !== 'undefined' ? n(bk, 0) : -n(hr, 0));
      V.attSrc = 'GAME';
    } else {
      var vMs = Math.max(1, V.tas / 3.6);
      var gamma = Math.asin(clamp(V.vy / vMs, -1, 1)) * 180 / Math.PI;
      V.pitch = gamma + V.aoa * Math.cos(V.roll * Math.PI / 180);
      var omega = n(ind.turn, 0);
      V.roll = clamp(Math.atan(omega * Math.PI / 180 * vMs / 9.81) * 180 / Math.PI, -75, 75);
      V.attSrc = 'EST';
    }
    return true;
  }

  /* 地面航迹（地图坐标推算） */
  var lastSelf = null;
  /* ---------- 地图对象：自机航迹 + 已点亮目标 ---------- */
  var GRID = null;

  function fetchGrid() {
    fetchJson('/map_info.json').then(function (g) {
      if (g && g.grid_size && g.grid_size.length >= 2) GRID = g.grid_size;
    }).catch(function () { });
  }

  function isEnemyColor(c) {
    if (!c || c.charAt(0) !== '#' || c.length < 7) return false;
    var r = parseInt(c.substr(1, 2), 16), g = parseInt(c.substr(3, 2), 16), b = parseInt(c.substr(5, 2), 16);
    return r > 180 && g < 120 && b < 120;
  }

  function applyMap(list) {
    if (!Array.isArray(list)) return;

    var self = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].icon === 'Player') { self = list[i]; break; }
    }
    if (!self || typeof self.x !== 'number') return;

    var now = performance.now();
    if (lastSelf && now - lastSelf.t > 300) {
      var ddx = self.x - lastSelf.x, ddy = self.y - lastSelf.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) > 2e-5) {
        V.trk = ((Math.atan2(ddx, -ddy) * 180 / Math.PI) + 360) % 360;
        V.trkAt = now;
      }
    }
    lastSelf = { x: self.x, y: self.y, t: now };

    // 已点亮目标（游戏地图本身给的就是点亮过的）
    var W = GRID ? GRID[0] : 131072, H = GRID ? GRID[1] : 131072;
    var out = [];
    for (var k = 0; k < list.length; k++) {
      var o = list[k];
      if (!o || o === self || typeof o.x !== 'number' || typeof o.y !== 'number') continue;
      if (!isEnemyColor(o.color)) continue;
      var dxm = (o.x - self.x) * W;
      var dym = (o.y - self.y) * H;
      var dist = Math.sqrt(dxm * dxm + dym * dym);
      var brg = ((Math.atan2(dxm, dym) * 180 / Math.PI) + 360) % 360;
      var kind = 'AIR';
      var ic = String(o.icon || '');
      // 导弹要排除 MissileDestroyer（那是军舰）
      if (/^missile/i.test(ic) && !/destroyer|frigate|boat|ship/i.test(ic)) kind = 'MSL';
      else if (/missile/i.test(String(o.type || ''))) kind = 'MSL';
      else if (o.type === 'ground_model') kind = 'GND';
      else if (o.type !== 'aircraft') kind = 'SUR';
      out.push({ brg: brg, dist: dist, kind: kind, icon: o.icon || '', type: o.type });
    }
    var PRI = { MSL: 0, AIR: 1, GND: 2, SUR: 3 };
    out.sort(function (a, b) {
      var pa = PRI[a.kind], pb = PRI[b.kind];
      if (pa !== pb) return pa - pb;
      return a.dist - b.dist;
    });
    V.contacts = out.slice(0, 6);
  }

  /* ============================================================
     轮询
     ============================================================ */
  function fetchJson(path, timeout) {
    var ctl = new AbortController();
    var tid = setTimeout(function () { ctl.abort(); }, timeout || 900);
    return fetch(CFG.api + path, { cache: 'no-store', signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(tid); });
  }

  function setLink(ok, text) {
    connected = ok;
    $('linkDot').className = 'dot ' + (ok ? 'ok' : 'bad');
    $('linkText').textContent = text;
  }

  function poll() {
    if (CFG.mock) return;
    var reached = false;
    Promise.all([
      fetchJson('/state').then(function (s) { reached = true; serverOk = true; return applyState(s); }).catch(function () { return false; }),
      fetchJson('/indicators').then(function (s) { reached = true; serverOk = true; return applyIndicators(s); }).catch(function () { return false; })
    ]).then(function () {
      if (reached) {
        failStreak = 0;
        if (!firstOkAt) firstOkAt = performance.now();
        setLink(true, V.valid ? 'LINK 8111' : 'HANGAR · 未上机');
      } else {
        failStreak++;
        if (failStreak > 2) setLink(false, 'NO LINK · 启动游戏');
      }
    });
  }

  function pollMap() {
    if (CFG.mock) return;
    fetchJson('/map_obj.json').then(applyMap).catch(function () { });
  }

  /* ============================================================
     演示数据
     ============================================================ */
  var mockT = 0;
  function mockTick(dt) {
    mockT += dt;
    var t = mockT;
    V.mock = true;
    V.valid = true;
    V.type = 'demo_f16';
    V.hdg = (t * 6) % 360;
    V.roll = 34 * Math.sin(t * 0.32) + 8 * Math.sin(t * 1.7);
    V.pitch = 5 + 7 * Math.sin(t * 0.21);
    V.ias = 640 + 120 * Math.sin(t * 0.18);
    V.tas = V.ias * 1.12;
    V.alt = 3600 + 900 * Math.sin(t * 0.11);
    V.vy = clamp(900 * 0.11 * Math.cos(t * 0.11) / 2.2, -25, 25);
    V.mach = V.tas / 1225;
    V.aoa = 2.5 + 2 * Math.sin(t * 0.5);
    V.aos = 1.2 * Math.sin(t * 0.9);
    V.g = 1 + 0.9 * Math.sin(t * 0.44) + Math.abs(V.roll) / 60;
    if (V.fuel0 === 0) { V.fuel0 = 4800; V.fuel = 4800; }
    V.fuel = Math.max(0, V.fuel - dt * 1.1);
    V.rpm = [2760 + 40 * Math.sin(t), 2740 + 40 * Math.cos(t), 0];
    V.engCount = 2;
    V.throttle = 92 + 8 * Math.sin(t * 0.9);
    V.oil = 68 + 4 * Math.sin(t * 0.13);
    V.gear = 0; V.flaps = 0; V.brake = 0;
    V.trk = (V.hdg + 2.5) % 360; V.trkAt = performance.now();
    V.attSrc = 'DEMO';
  }

  /* ============================================================
     3D 模型
     ============================================================ */
  var modelBlobUrl = null;
  var modelLabel = '内置机模';

  function setModelLabel(txt) {
    modelLabel = txt;
    $('modelName').textContent = txt;
    $('modelTag').textContent = 'MODEL · ' + (txt === '内置机模' ? 'BUILT-IN' : txt.toUpperCase());
  }

  function loadModelUrl(url, label) {
    Attitude3D.loadModel(url, function (name) {
      setModelLabel(label || name);
      toast('已加载 3D 模型：' + (label || name), 2500);
    });
  }

  function initModel() {
    if (qs.get('model')) { loadModelUrl(qs.get('model')); return; }

    fetch('models/manifest.json', { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : [];
    }).then(function (list) {
      var sel = $('modelSelect');
      if (sel && Array.isArray(list)) {
        list.forEach(function (m) {
          var o = document.createElement('option');
          o.value = m.file; o.textContent = m.name;
          sel.appendChild(o);
        });
      }
      var pick = settings.modelFile;
      if (!pick && list && list.length) pick = list[0].file;
      if (pick) {
        loadModelUrl(pick);
        if (sel) sel.value = pick;
      } else {
        fetch('models/aircraft.glb', { method: 'HEAD' }).then(function (r2) {
          if (r2.ok) loadModelUrl('models/aircraft.glb');
        }).catch(function () { });
      }
    }).catch(function () { });
  }

  function applySensor(mode) {
    settings.sensor = mode;
    saveSettings();
    var v = $('view3d');
    v.className = v.className.replace(/\bsensor-\w+/g, '').trim();
    v.classList.add('sensor-' + mode);
    markSeg('setSensor', mode, 'data-v');
  }

  function applyModelTransform() {
    Attitude3D.setTransform(settings.modelYaw, settings.modelScale);
    applySensor(settings.sensor || 'tgp');
  }

  /* ============================================================
     设置面板
     ============================================================ */
  function openSettings(open) {
    $('settings').classList.toggle('hidden', !open);
    if (open) syncSettingsUi();
  }

  function markSeg(containerId, value, attr) {
    var box = $(containerId);
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute(attr || 'data-v') === String(value));
    });
  }

  function syncSettingsUi() {
    markSeg('setTheme', settings.theme, 'data-v');
    $('modelYaw').value = settings.modelYaw;
    $('modelYawV').textContent = Math.round(settings.modelYaw) + '°';
    $('modelScale').value = settings.modelScale;
    $('modelScaleV').textContent = settings.modelScale.toFixed(2) + '×';
    markSeg('setSensor', settings.sensor || 'tgp', 'data-v');
    markSeg('setLayout', settings.layout || 'auto', 'data-v');
    markSeg('setModel3D', settings.view || 'axes', 'data-v');
    if ($('maxThrust')) $('maxThrust').value = settings.maxThrust || 110;
    if ($('maxThrustV')) $('maxThrustV').textContent = Math.round(settings.maxThrust || 110) + ' kN';
    markSeg('setThrustAuto', settings.thrustAuto === false ? 'manual' : 'auto', 'data-v');
    markSeg('setUnits', settings.units || 'metric', 'data-v');
    markSeg('setLang', settings.lang || 'zh', 'data-v');
    markSeg('setUi', settings.ui || 'dark', 'data-v');
    $('btnScale').classList.toggle('on', !!settings.scale);
    $('modelName').textContent = modelLabel;
  }

  function bindSettings() {
    $('btnSet').addEventListener('click', function () { openSettings(true); });
    $('setClose').addEventListener('click', function () { openSettings(false); });
    $('setOk').addEventListener('click', function () { openSettings(false); });

    $('setTheme').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !b.dataset.v) return;
      applyTheme(b.dataset.v);
      markSeg('setTheme', b.dataset.v, 'data-v');
    });

    $('modelSelect').addEventListener('change', function (e) {
      if (!e.target.value) return;
      settings.modelFile = e.target.value;
      saveSettings();
      loadModelUrl(e.target.value);
    });
    $('setLayout').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) { applyLayoutMode(b.dataset.v); markSeg('setLayout', b.dataset.v, 'data-v'); }
    });
    $('btnResetView').addEventListener('click', function () {
      if (Attitude3D.resetView) Attitude3D.resetView();
    });
    $('btnResetModel').addEventListener('click', function () {
      settings.modelYaw = 0; settings.modelScale = 1;
      if (Attitude3D.applyUserTransform) Attitude3D.applyUserTransform();
      saveSettings(); syncSettingsUi();
    });
    $('maxThrust').addEventListener('input', function () {
      settings.maxThrust = parseFloat(this.value) || 110;
      settings.thrustAuto = false;
      $('maxThrustV').textContent = Math.round(settings.maxThrust) + ' kN';
      markSeg('setThrustAuto', 'manual', 'data-v');
      saveSettings();
    });
    $('setThrustAuto').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !b.dataset.v) return;
      settings.thrustAuto = (b.dataset.v === 'auto');
      if (settings.thrustAuto) {
        var tv = lookupThrust(V.type);
        if (tv) {
          settings.maxThrust = tv;
          $('maxThrust').value = tv;
          $('maxThrustV').textContent = tv + ' kN';
        }
      }
      markSeg('setThrustAuto', b.dataset.v, 'data-v');
      saveSettings();
    });
    $('setModel3D').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) applyModelView(b.dataset.v);
    });
    $('setUnits').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) { applyUnits(b.dataset.v); markSeg('setUnits', b.dataset.v, 'data-v'); }
    });
    $('setLang').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) { applyLang(b.dataset.v); markSeg('setLang', b.dataset.v, 'data-v'); }
    });
    $('setUi').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) { applyUiMode(b.dataset.v); markSeg('setUi', b.dataset.v, 'data-v'); }
    });
    $('setSensor').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b && b.dataset.v) applySensor(b.dataset.v);
    });
    $('btnModel').addEventListener('click', function () { $('fileModel').click(); });
    $('fileModel').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (modelBlobUrl) URL.revokeObjectURL(modelBlobUrl);
      modelBlobUrl = URL.createObjectURL(f);
      loadModelUrl(modelBlobUrl, f.name);
    });

    $('modelYaw').addEventListener('input', function (e) {
      settings.modelYaw = parseFloat(e.target.value) || 0;
      $('modelYawV').textContent = Math.round(settings.modelYaw) + '°';
      applyModelTransform();
      saveSettings();
    });
    $('modelScale').addEventListener('input', function (e) {
      settings.modelScale = parseFloat(e.target.value) || 1;
      $('modelScaleV').textContent = settings.modelScale.toFixed(2) + '×';
      applyModelTransform();
      saveSettings();
    });

    $('btnFlipPitch').addEventListener('click', function () {
      settings.pitchSign *= -1; saveSettings();
      toast('俯仰方向：' + (settings.pitchSign > 0 ? '默认' : '反向'));
    });
    $('btnFlipRoll').addEventListener('click', function () {
      settings.rollSign *= -1; saveSettings();
      toast('坡度方向：' + (settings.rollSign > 0 ? '默认' : '反向'));
    });

    $('btnScale').addEventListener('click', function () {
      settings.scale = !settings.scale; saveSettings();
      $('bankScaleBox').style.display = settings.scale ? '' : 'none';
      $('btnScale').classList.toggle('on', settings.scale);
    });
  }

  /* ============================================================
     风格
     ============================================================ */
  /* 各机型单发最大推力（kN，加力状态近似值）；按 type 前缀匹配 */
  var THRUST_DB = {
    b_52: 76, b_29: 22, b_17: 18, tu_4: 22, tu_95: 18, tu_16: 85, tu_22: 127, tu_160: 137,
    f_14: 93, f_15: 106, f_16: 76, f_18: 98, f_22: 156, f_35: 125, f_4: 79, f_5: 50, f_8: 76,
    su_27: 122, su_30: 122, su_33: 122, su_34: 122, su_35: 142, su_25: 44, su_24: 110,
    j_11: 125, j_16: 125, j_10: 132, j_8: 125, jh_7: 100, j_7: 60,
    mig_21: 68, mig_23: 100, mig_29: 81, mig_31: 122, mig_25: 90, mig_19: 75,
    a_10: 40, a_4: 41, av_8: 96, harrier: 96,
    il_28: 26, he_111: 12, ju_88: 12, do_217: 12, bf_109: 14, fw_190: 15,
    p_51: 15, p_47: 17, p_38: 13, a6m: 10, spitfire: 14, hurricane: 12, typhoon: 16
  };
  function lookupThrust(type) {
    if (!type) return 0;
    var t = String(type).toLowerCase();
    for (var k in THRUST_DB) { if (t.indexOf(k) === 0) return THRUST_DB[k]; }
    return 0;
  }

  /* 单发最大推力（kN），供发动机推力读数换算 */
  if (window.KZ) KZ.maxThrust = function () { return settings.maxThrust || 110; };

  var lastReadout = 0;
  function updateReadout(C, V) {
    var now = performance.now();
    if (now - lastReadout < 220) return;
    lastReadout = now;
    var spd = Math.round(C.ias);
    var hdg = Math.round(C.hdg) % 360;
    var trk = (V.trk >= 0 && now - V.trkAt < 6000) ? Math.round(V.trk) % 360 : hdg;
    var el1 = $('rNose'), el2 = $('rSpd'), el3 = $('rVel');
    if (el1) el1.textContent = ('00' + hdg).slice(-3) + '\u00b0 / ' + (C.pitch >= 0 ? '+' : '') + C.pitch.toFixed(1) + '\u00b0';
    if (el2) el2.textContent = spd + ' ' + (window.KZ ? KZ.speedUnit() : 'KM/H') + ' · M ' + C.mach.toFixed(2);
    if (el3) el3.textContent = ('00' + trk).slice(-3) + '\u00b0 / \u03b1 ' + C.aoa.toFixed(1) + '\u00b0';
  }

  function applyTheme(id) {
    settings.theme = id;
    saveSettings();
    if (window.KZ) {
      KZ.setLang(settings.lang || 'zh');
      KZ.setUnits(settings.units || 'metric');
    }
    themeApi = Themes.build(id, $('gauges'));
  }

  /* 布局：自动 / 左右 / 上下 / 仅仪表 / 仅 3D */
  function applyLayoutMode(m) {
    settings.layout = m;
    var st = $('stage');
    st.classList.remove('layout-lr', 'layout-tb', 'layout-mfd', 'layout-3d');
    if (m === 'lr') st.classList.add('layout-lr');
    else if (m === 'tb') st.classList.add('layout-tb');
    else if (m === 'mfd') st.classList.add('layout-mfd');
    else if (m === '3d') st.classList.add('layout-3d');
    saveSettings();
  }

  /* 右侧视图：坐标系（斜二测） / 姿态球 / 3D 模型 */
  var obliqueApi = null;

  function applyModelView(mode) {
    var m = (mode === 'model' || mode === 'scope' || mode === 'axes') ? mode : 'axes';
    settings.view = m;
    settings.showModel = (m === 'model');
    var v = $('view3d');
    v.classList.remove('scope-on', 'axes-on', 'model-on');
    v.classList.add(m === 'model' ? 'model-on' : (m === 'scope' ? 'scope-on' : 'axes-on'));
    markSeg('setModel3D', m, 'data-v');
    saveSettings();
  }

  function applyUiMode(m) {
    settings.ui = m;
    document.body.classList.toggle('ui-light', m === 'light');
    saveSettings();
  }

  function applyLang(m) {
    settings.lang = m;
    if (window.KZ) { KZ.setLang(m); KZ.applyDom(); }
    setModelLabel(modelLabel);
    applyTheme(settings.theme);
    saveSettings();
  }

  function applyUnits(m) {
    settings.units = m;
    if (window.KZ) KZ.setUnits(m);
    applyTheme(settings.theme);
    saveSettings();
  }

  /* ============================================================
     渲染循环
     ============================================================ */
  var last = performance.now();
  var uiAcc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (CFG.mock) mockTick(dt);
    if (CFG.fixed) { V.pitch = CFG.fixed[0]; V.roll = CFG.fixed[1]; V.attSrc = 'FIXED'; }
    if (qs.get('gear') !== null) { V.gear = parseFloat(qs.get('gear')) || 0; V.gears = null; }

    var k = 1 - Math.exp(-dt / 0.10);
    C.ias = lerp(C.ias, V.ias, k);
    C.tas = lerp(C.tas, V.tas, k);
    C.alt = lerp(C.alt, V.alt, k);
    C.vy = lerp(C.vy, V.vy, k);
    C.mach = lerp(C.mach, V.mach, k);
    C.aoa = lerp(C.aoa, V.aoa, k);
    C.aos = lerp(C.aos, V.aos, k);
    C.g = lerp(C.g, V.g, k);
    C.fuel = lerp(C.fuel, V.fuel, k);
    C.fuel0 = V.fuel0 || C.fuel0;
    C.throttle = lerp(C.throttle, V.throttle, k);
    C.oil = lerp(C.oil, V.oil, k);
    C.gear = lerp(C.gear, V.gear, 1 - Math.exp(-dt / 0.05));
    C.flaps = lerp(C.flaps, V.flaps, k);
    C.brake = lerp(C.brake, V.brake, k);
    C.engCount = V.engCount;
    for (var i = 0; i < 8; i++) C.rpm[i] = lerp(C.rpm[i] || 0, V.rpm[i] || 0, k);

    C.pitch = lerp(C.pitch, V.pitch, 1 - Math.exp(-dt / 0.14));
    C.roll = lerp(C.roll, V.roll, 1 - Math.exp(-dt / 0.14));
    var dh = wrap180(V.hdg - C.hdg);
    C.hdg = (C.hdg + dh * (1 - Math.exp(-dt / 0.16)) + 360) % 360;

    updateCalc(C);
    var view = settings.view || 'axes';
    if (view === 'model') Attitude3D.set(C.pitch, C.roll, C.hdg, C.aoa, C.aos);
    if (view === 'scope' && attScope) attScope.set(C, V);
    if (view === 'axes' && obliqueApi) obliqueApi.set(C, V);
    updateReadout(C, V);
    if (settings.scale) bankScale.set(C.roll);
    if (themeApi) themeApi.update(C, V, connected);

    uiAcc += dt;
    if (uiAcc > 0.1) { uiAcc = 0; updateUi(); }
  }

  function updateUi() {
    $('pitchVal').textContent = (C.pitch >= 0 ? '+' : '') + C.pitch.toFixed(1) + '°';
    $('bankVal').textContent = (C.roll >= 0 ? 'R' : 'L') + Math.abs(C.roll).toFixed(0) + '°';
    $('hdgVal').textContent = ('00' + Math.round(C.hdg) % 360).slice(-3);

    var trkOk = V.trk >= 0 && performance.now() - V.trkAt < 6000;
    $('trkVal').textContent = trkOk ? ('00' + Math.round(V.trk) % 360).slice(-3) : '---';
    $('stallWarn').classList.toggle('on', C.aoa > 24);
    $('badgeAtt').textContent = 'AHRS ' + (V.attSrc || '—');
    $('badgeAtt').className = 'badge ' + (V.attSrc === 'GAME' ? 'live' : V.attSrc ? 'est' : '');

    var mode;
    if (V.valid) mode = C.ias > 30 ? 'AIRBORNE' : 'GROUND';
    else if (CFG.mock) mode = 'DEMO';
    else mode = serverOk ? 'HANGAR' : 'STANDBY';
    $('badgeMode').textContent = mode;
    $('acType').textContent = V.type ? String(V.type).replace(/_/g, ' ').toUpperCase() : '—';
    var vm = settings.view || 'axes';
    $('v3note').textContent = vm === 'model'
      ? (KZ.t ? KZ.t('dragHint') : '拖动旋转 · 滚轮缩放 · 双击复位')
      : (vm === 'axes' ? '斜二测 · OBLIQUE' : 'ATTITUDE');
  }

  /* ============================================================
     时钟 / 交互
     ============================================================ */
  function clockTick() {
    var d = new Date();
    $('clock').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (x) { return ('0' + x).slice(-2); }).join(':');
    if (started) {
      var s = Math.floor((performance.now() - started) / 1000);
      $('session').textContent = 'T+' + ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () { });
    else document.exitFullscreen();
  }

  function bindKeys() {
    $('btnFull').addEventListener('click', toggleFullscreen);
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (k === 'f') toggleFullscreen();
      else if (k === 's') { openSettings($('settings').classList.contains('hidden')); }
      else if (k === 'escape') openSettings(false);
      else if (k === 'i') {
        settings.pitchSign *= -1; saveSettings();
        toast('俯仰方向已翻转（' + (settings.pitchSign > 0 ? '默认' : '反向') + '）');
      } else if (k === 'o') {
        settings.rollSign *= -1; saveSettings();
        toast('坡度方向已翻转（' + (settings.rollSign > 0 ? '默认' : '反向') + '）');
      }
    });
  }

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    applyTheme(qs.get('theme') || settings.theme);
    bankScale = Gauges.makeBankScale($('bankScale'));
    Attitude3D.init($('c3d'));
    attScope = Gauges.makeAttScope($('attScope'));
    obliqueApi = Gauges.makeOblique($('oblique'));
    applyModelView(settings.view || 'axes');
    Attitude3D.setTransform(settings.modelYaw, settings.modelScale);
    applySensor(settings.sensor || 'tgp');
    initModel();

    bindKeys();
    bindSettings();
    syncSettingsUi();
    $('bankScaleBox').style.display = settings.scale ? '' : 'none';

    if (window.KZ) { KZ.setLang(settings.lang || 'zh'); KZ.setUnits(settings.units || 'metric'); KZ.applyDom(); }
    applyUiMode(settings.ui || 'dark');
    applyLayoutMode(settings.layout || 'auto');

    if (qs.has('settings')) openSettings(true);

    clockTick();
    setInterval(clockTick, 1000);

    if (CFG.mock) {
      setLink(true, 'DEMO MODE');
      $('linkDot').className = 'dot warn';
      toast('演示模式：模拟数据，按 S 打开设置', 3200);
      started = performance.now();
    } else {
      setLink(false, 'CONNECTING…');
      setInterval(poll, CFG.pollMs);
      setInterval(pollMap, 700);
      fetchGrid();
    poll(); pollMap();
      setTimeout(function () {
        if (!connected) toast('未连接到 ' + CFG.api + ' —— 请先启动游戏', 4000);
      }, 2500);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();



