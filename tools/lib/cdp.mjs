// Small Chrome DevTools Protocol helper (own code, from our popyca-games repo): starts headless Chrome with its own profile
// (muted), and gives tab commands (evaluate, click, tap, screenshot, device emulation). Comments below are in Turkish.
// Küçük CDP yardımcısı: başsız Chrome'u ayrı profille açar, sekme komutları (evaluate, tıklama, ekran görüntüsü, cihaz öykünmesi).
import { spawn, execSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';

export const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
// Geçici profil klasörlerini sil (keep=false): yoksa Temp her testte büyür ve diski doldurur.
function dropProfile(p) { if (p.profileDir) { for (let i = 0; i < 5; i++) { try { rmSync(p.profileDir, { recursive: true, force: true }); break; } catch { execSync('ping -n 2 127.0.0.1', { stdio: 'ignore' }); } } } }
export function killChromes() { for (const p of procs) { try { execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} dropProfile(p); } procs.length = 0; }

export async function chrome(name, port, profileDir, { lang = 'en-US', keep = false, args = [] } = {}) {
  if (!keep) rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });
  const p = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profileDir, '--no-first-run', '--no-default-browser-check',
    '--mute-audio', ...args, '--lang=' + lang, '--accept-lang=' + lang + ',en', ...(process.env.HEADLESS_NO_GPU ? [] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']), '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  if (!keep) p.profileDir = profileDir;
  procs.push(p);
  let t; for (let i = 0; i < 80 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!t) await sleep(250); }
  if (!t) throw new Error('chrome did not start ' + name);
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  const tab = { name, errs: [], logs: [], ws, proc: p };
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') tab.errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled') { const s = m.params.args.map((a) => a.value ?? a.description).join(' '); if (m.params.type === 'error') tab.errs.push('ERR ' + s.slice(0, 300)); else tab.logs.push(s.slice(0, 300)); }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) tab.errs.push('LOG ' + m.params.entry.text.slice(0, 200) + ' ' + (m.params.entry.url || ''));
  });
  tab.cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await tab.cmd('Runtime.enable'); await tab.cmd('Log.enable'); await tab.cmd('Page.enable');
  tab.ev = async (expr) => {
    const r = await tab.cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(name + ': ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result?.result?.value;
  };
  // Oyun iframe'inin içinde çalıştırma (portal sayfasında) ya da doğrudan oyun sayfasında
  tab.g = (expr) => tab.ev(`(function(){ const f = document.querySelector('iframe'); const w = f ? f.contentWindow : window; return w.eval(${JSON.stringify(expr)}); })()`);
  tab.gAsync = (expr) => tab.ev(`(async function(){ const f = document.querySelector('iframe'); const w = f ? f.contentWindow : window; return await w.eval(${JSON.stringify('(async()=>{' + expr + '})()')}); })()`);
  tab.go = async (url) => { await tab.cmd('Page.navigate', { url }); await sleep(300); for (let i = 0; i < 60; i++) { if (await tab.ev('document.readyState') === 'complete') break; await sleep(150); } };
  tab.size = async (w, h, mobile) => {
    await tab.cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile: !!mobile, screenOrientation: { type: w > h ? 'landscapePrimary' : 'portraitPrimary', angle: w > h ? 90 : 0 } });
    await tab.cmd('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 0 });
  };
  tab.shot = async (file) => { const r = await tab.cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file; };
  tab.click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await tab.cmd('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  };
  let tid = 1;
  tab.tap = async (x, y) => {
    const id = tid++;
    await tab.cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id, radiusX: 4, radiusY: 4, force: 1 }] });
    await sleep(40);
    await tab.cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  // Bir öğenin ortası (oyun iframe'i içindeki seçici, sayfa koordinatına çevrilir)
  tab.center = (sel) => tab.ev(`(function(){ const f = document.querySelector('iframe'); const d = f ? f.contentDocument : document; const e = d.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); const o = f ? f.getBoundingClientRect() : { left: 0, top: 0 }; return { x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2, w: r.width, h: r.height }; })()`);
  tab.clickSel = async (sel) => { const c = await tab.center(sel); if (!c) throw new Error(name + ': no element ' + sel); await tab.click(c.x, c.y); return c; };
  tab.close = async () => { try { ws.close(); } catch {} try { execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} dropProfile(p); };
  return tab;
}
