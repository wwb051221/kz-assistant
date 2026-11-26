// 多分辨率布局自检（CDP over WebSocket，无第三方依赖）
const { spawn } = require('child_process');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const THEME = process.env.KZ_THEME || 'wide';
const URL = 'http://127.0.0.1:8123/?mock=1&theme=' + THEME;
const ONLY = process.env.KZ_SIZES ? process.env.KZ_SIZES.split(';').map(x => x.split(',')) : null;

const SIZES = [
  [1280, 720, '720p'],
  [1440, 960, '你的副屏'],
  [1600, 900, '16:9 小'],
  [1920, 1080, '1080p'],
  [1920, 1200, '16:10'],
  [2560, 1440, '2K'],
  [3440, 1440, '21:9'],
  [5120, 1440, '32:9'],
  [3840, 2160, '4K'],
  [1024, 768, '4:3'],
  [1080, 1920, '竖屏'],
  [1200, 1600, '竖屏 3:4'],
];

function getJSON(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, r => {
      let d = '';
      r.on('data', c => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + process.env.TEMP + '\\kz-cdp',
    'about:blank'
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 40; i++) {
    try { ver = await getJSON('/json/version'); break; } catch { await sleep(250); }
  }
  if (!ver) { console.log('chrome 未启动'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let idc = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++idc;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  await new Promise(r => (ws.onopen = r));

  const t = await send('Target.createTarget', { url: 'about:blank' });
  const list = await getJSON('/json/list');
  const page = list.find(x => x.id === t.targetId);
  const pws = new WebSocket(page.webSocketDebuggerUrl);
  let pid = 0;
  const ppending = new Map();
  const psend = (method, params) => new Promise((res, rej) => {
    const id = ++pid;
    ppending.set(id, { res, rej });
    pws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  pws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && ppending.has(m.id)) {
      const p = ppending.get(m.id); ppending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  await new Promise(r => (pws.onopen = r));
  await psend('Page.enable');
  await psend('Runtime.enable');

  const expr = `(() => {
    const r = el => { if (!el) return null; const b = el.getBoundingClientRect();
      return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)}; };
    const g = id => document.getElementById(id);
    const fs = sel => { const e = document.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; };
    return {
      vw: innerWidth, vh: innerHeight,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      topbar: r(g('topbar')), stage: r(g('stage')),
      gauges: r(g('gauges')), view: r(g('view3d')),
      mfd: r(document.querySelector('.mfd')), pfd: r(document.querySelector('.pfd-svg svg')),
      fpm: r(g('fpmBox')), strip: r(document.querySelector('.strip')), lamps: r(g('lampRow')),
      fsBrand: fs('.brandText'), fsStrip: fs('.sItem b'), fsV3: fs('.v3-att b'),
      themed: document.querySelectorAll('.mfd,.cell').length
    };
  })()`;

  const rows = [];
  const sizes = ONLY ? SIZES.filter(s => ONLY.some(o => o[0] === String(s[0]) && o[1] === String(s[1]))) : SIZES;
  for (const [w, h, name] of sizes) {
    await psend('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await psend('Page.navigate', { url: URL });
    let v = null;
    for (let k = 0; k < 20; k++) {
      await sleep(400);
      const out = await psend('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (out && out.result && out.result.value && out.result.value.vw) { v = out.result.value; break; }
      if (out && out.exceptionDetails) console.log('  expr error:', out.exceptionDetails.text);
    }
    if (!v) { console.log(name.padEnd(10), (w+'x'+h).padEnd(11), 'EVAL-FAIL'); continue; }
    const overflow = v.sw > v.vw + 1 || v.sh > v.vh + 1;
    const bad = [];
    if (!v.mfd || v.mfd.w < 80 || v.mfd.h < 80) bad.push('MFD太小');
    if (!v.pfd || v.pfd.w < 60) bad.push('PFD未渲染');
    if (v.gauges && v.view && (v.gauges.w < 40 || v.view.w < 40)) bad.push('列宽异常');
    if (v.fpm && v.view && (v.fpm.x + v.fpm.w > v.view.x + v.view.w + 2)) bad.push('FPM溢出');
    rows.push({ name, size: w + 'x' + h, overflow, bad: bad.join('/') || '-',
      mfd: v.mfd ? v.mfd.w + 'x' + v.mfd.h : '-',
      gauges: v.gauges ? v.gauges.w + 'x' + v.gauges.h : '-',
      view: v.view ? v.view.w + 'x' + v.view.h : '-',
      fs: Math.round(v.fsBrand) + '/' + Math.round(v.fsStrip) + '/' + Math.round(v.fsV3) });
  }

  console.log('名称'.padEnd(10), '分辨率'.padEnd(11), '溢出', 'MFD'.padEnd(11), '仪表列'.padEnd(11), '3D'.padEnd(11), '字号(品牌/条/3D)'.padEnd(14), '问题');
  for (const r of rows) {
    console.log(
      r.name.padEnd(10), r.size.padEnd(11),
      (r.overflow ? 'YES' : 'no ').padEnd(4),
      r.mfd.padEnd(11), r.gauges.padEnd(11), r.view.padEnd(11), r.fs.padEnd(14),
      r.bad
    );
  }

  pws.close(); ws.close(); chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

