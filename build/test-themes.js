// 各主题 × 英制 × 英文 冒烟测试
const { spawn } = require('child_process');
const http = require('http');
const PORT = 9335;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const THEMES = ['wide', 'f15', 'pfd', 'classic', 'glass'];

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
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + process.env.TEMP + '\\kz-cdp3', 'about:blank'], { stdio: 'ignore' });
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
  await ps('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  const rows = [];
  for (const th of THEMES) {
    await ps('Page.addScriptToEvaluateOnNewDocument', {
      source: 'localStorage.setItem("wt-panel-settings", JSON.stringify({theme:"' + th + '",units:"imperial",lang:"en",ui:"dark",layout:"auto",sensor:"tgp",fpm:true,scale:true,modelYaw:0,modelScale:1,modelFile:"",pitchSign:1,rollSign:1}));window.__errs=[];addEventListener("error",function(e){__errs.push(String(e.message))});'
    });
    await ps('Page.navigate', { url: 'http://127.0.0.1:8123/?mock=1' });
    await sleep(2600);
    const r = await ps('Runtime.evaluate', {
      expression: `(function(){
        var errs = window.__errs||[];
        var g = document.getElementById('gauges');
        var kids = g ? g.children.length : 0;
        var sw = document.documentElement.scrollWidth, vw = innerWidth;
        var labels = Array.from(document.querySelectorAll('#gauges svg text')).map(t=>t.textContent);
        return { errs: errs.slice(0,3), kids: kids, overflow: sw > vw + 1,
                 kt: labels.filter(x=>x==='KT'||x==='FT'||x==='FT/MIN').length,
                 title: document.title };
      })()`, returnByValue: true
    });
    rows.push({ theme: th, ...r.result.value });
  }
  for (const r of rows) console.log(r.theme.padEnd(8), 'kids=' + r.kids, 'overflow=' + r.overflow, 'units=' + r.kt, 'errs=' + JSON.stringify(r.errs));
  pws.close(); ws.close(); chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
