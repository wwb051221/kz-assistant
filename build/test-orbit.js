// 自由视角测试：切到 3D 模型 → 拖动 → 相机位置应变化 → 双击复位
const { spawn } = require('child_process');
const http = require('http');
const PORT = 9336;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + process.env.TEMP + '\\kz-cdp4', 'about:blank'], { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 40; i++) { try { ver = await getJSON('/json/version'); break; } catch { await sleep(250); } }
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
  await ps('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await ps('Page.navigate', { url: 'http://127.0.0.1:8123/?mock=1&theme=wide' });
  await ps('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errs=[];addEventListener("error",function(e){__errs.push(String(e.message))});'});
  await sleep(4200);

  const ev = async (expr) => {
    const r = await ps('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  };

  // 等 app 完成 boot
  for (let k = 0; k < 25; k++) {
    const ok = await ev('!!(window.KZ && window.Attitude3D && document.getElementById("view3d").className)');
    if (ok) break;
    await sleep(400);
  }

  const out = {};
  out.scopeDefault = await ev('document.getElementById("view3d").className');
  // 切到 3D 模型
  await ev('document.getElementById("btnSet").click()');
  await sleep(200);
  await ev('document.querySelector("#setModel3D button[data-v=\'model\']").click()');
  await sleep(400);
  await ev('document.getElementById("setOk").click()');
  await sleep(1200);
  out.modelClass = await ev('document.getElementById("view3d").className');
  out.cam0 = await ev('Attitude3D.cam()');

  // 拖动
  const box = await ev('(function(){var r=document.getElementById("c3d").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()');
  if (!box || !box.w) { console.log('canvas 尺寸异常', JSON.stringify(box)); pws.close(); ws.close(); chrome.kill(); process.exit(1); }
  const cx = Math.round(box.x + box.w / 2), cy = Math.round(box.y + box.h / 2);
  await ps('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await ps('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 160, y: cy + 40, button: 'left' });
  await sleep(120);
  await ps('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 260, y: cy + 90, button: 'left' });
  await sleep(120);
  await ps('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 260, y: cy + 90, button: 'left', clickCount: 1 });
  await sleep(900);
  out.camAfterDrag = await ev('Attitude3D.cam()');

  // 滚轮缩放
  await ps('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: -240 });
  await sleep(700);
  out.camAfterWheel = await ev('Attitude3D.cam()');

  // 复位
  await ev('Attitude3D.resetView()');
  await sleep(900);
  out.camAfterReset = await ev('Attitude3D.cam()');

  out.errs = await ev('window.__errs || []');
  out.state = await ev('JSON.stringify({cls:document.getElementById("view3d").className, kz:typeof window.KZ, att:typeof window.Attitude3D, g:typeof (window.Gauges||{}).makeAttScope})');
  console.log(JSON.stringify(out, null, 2));
  pws.close(); ws.close(); chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
