// 功能自检：语言 / 单位 / 布局 / 浅色 / 报错
const { spawn } = require('child_process');
const http = require('http');
const PORT = 9334;

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8123/?mock=1&theme=wide';

function getJSON(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, r => {
      let d = ''; r.on('data', c => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + process.env.TEMP + '\\kz-cdp2', 'about:blank'], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 40; i++) { try { ver = await getJSON('/json/version'); break; } catch { await sleep(250); } }
  if (!ver) { console.log('chrome 启动失败'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let idc = 0; const pending = new Map();
  const send = (m, p) => new Promise((res, rej) => { const id = ++idc; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  await new Promise(r => (ws.onopen = r));

  const t = await send('Target.createTarget', { url: 'about:blank' });
  const list = await getJSON('/json/list');
  const page = list.find(x => x.id === t.targetId);
  const pws = new WebSocket(page.webSocketDebuggerUrl);
  let pid = 0; const pp = new Map();
  const ps = (m, p) => new Promise((res, rej) => { const id = ++pid; pp.set(id, { res, rej }); pws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  pws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pp.has(m.id)) { const p = pp.get(m.id); pp.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  await new Promise(r => (pws.onopen = r));

  await ps('Page.enable'); await ps('Runtime.enable');
  await ps('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errs=[];addEventListener("error",function(e){__errs.push(String(e.message))});' });
  await ps('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await ps('Page.navigate', { url: URL });
  await sleep(3500);

  async function ev(expr) {
    const r = await ps('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.text };
    return r.result.value;
  }

  const out = {};
  out.errors = await ev('window.__errs || []');
  out.langDefault = await ev('KZ.getLang()');
  out.themeDefault = await ev('localStorage.getItem("wt-panel-settings")');

  // 打开设置
  await ev('document.getElementById("btnSet").click()');
  await sleep(300);

  // 切俄文
  await ev('document.querySelector("#setLang button[data-v=\'ru\']").click()');
  await sleep(700);
  out.langAfter = await ev('KZ.getLang()');
  out.settingsTitleRu = await ev('document.querySelector(".set-head b").textContent');
  out.mfdHasRu = await ev('Array.from(document.querySelectorAll("#gauges svg text")).some(t=>t.textContent==="ТАНГАЖ")');
  out.mfdTitles = await ev('Array.from(document.querySelectorAll("#gauges svg text")).slice(0,6).map(t=>t.textContent)');

  // 切英制
  await ev('document.querySelector("#setUnits button[data-v=\'imperial\']").click()');
  await sleep(700);
  out.unitsAfter = await ev('KZ.getUnits()');
  out.speedUnitText = await ev('Array.from(document.querySelectorAll("#gauges svg text")).map(t=>t.textContent).filter(x=>x==="KT"||x==="FT")');
  out.settingsUnits = await ev('document.querySelector("#setUnits button.on").dataset.v');

  // 切布局：上下
  await ev('document.querySelector("#setLayout button[data-v=\'tb\']").click()');
  await sleep(400);
  out.layoutClass = await ev('document.getElementById("stage").className');
  out.stacked = await ev('(function(){var g=document.getElementById("gauges").getBoundingClientRect(),v=document.getElementById("view3d").getBoundingClientRect();return {gx:Math.round(g.x),gy:Math.round(g.y),vw:Math.round(v.width),vy:Math.round(v.y)};})()');

  // 仅仪表
  await ev('document.querySelector("#setLayout button[data-v=\'mfd\']").click()');
  await sleep(300);
  out.mfdOnly = await ev('getComputedStyle(document.getElementById("view3d")).display');

  // 浅色
  await ev('document.querySelector("#setLayout button[data-v=\'auto\']").click()');
  await ev('document.querySelector("#setUi button[data-v=\'light\']").click()');
  await sleep(400);
  out.lightClass = await ev('document.body.className');
  out.scopeOn = await ev('document.getElementById("view3d").className');
  out.scopeSvg = await ev('!!document.querySelector("#attScope svg")');
  out.scopeNums = await ev('Array.from(document.querySelectorAll("#attScope svg text")).slice(0,6).map(t=>t.textContent)');
  out.engineVals = await ev('Array.from(document.querySelectorAll("#gauges svg text")).filter(t=>/%$/.test(t.textContent)).map(t=>t.textContent)');
  out.abText = await ev('Array.from(document.querySelectorAll("#gauges svg text")).some(t=>t.textContent==="AB")');
  out.topbarBg = await ev('getComputedStyle(document.getElementById("topbar")).backgroundColor');

  // 回到中文/公制/深色，避免污染默认
  await ev('document.querySelector("#setLang button[data-v=\'zh\']").click()');
  await sleep(500);
  await ev('document.querySelector("#setUnits button[data-v=\'metric\']").click()');
  await sleep(500);
  await ev('document.querySelector("#setUi button[data-v=\'dark\']").click()');
  await sleep(300);
  out.errorsFinal = await ev('window.__errs || []');

  console.log(JSON.stringify(out, null, 2));
  pws.close(); ws.close(); chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
