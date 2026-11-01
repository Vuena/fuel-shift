// FPS under CPU throttle: node tools/perf.mjs <cdpPort> <mobile 0|1> [throttle=4] [seconds=12]
// Worst case: every station unlocked, all three staff hired, night lights on, gear 5 traffic, autopilot working.
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [port = '9471', mob = '0', thr = '4', secs = '12'] = process.argv.slice(2); const mobile = mob === '1';
const W = mobile ? 390 : 1280, H = mobile ? 844 : 720, tag = `perf-${mob}`;
const URL = (process.env.URL || 'http://localhost:8811/public/') + '?bot' + (mobile ? '&touch' : '');
const tab = await chrome(tag, +port, TMP + 'go26-' + tag, { args: ['--window-size=' + W + ',' + H] });
try {
  await tab.size(W, H, mobile); await tab.go(URL);
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await tab.ev(`(() => { const a = __fs.api, G = a.G; localStorage.setItem('fuelshift.tutDone', 'true'); a.startDay(); G.tut = 6; G.shift = 2; G.shiftT = 30;
    for (const id of ['pump1', 'pump2', 'pump3', 'cereal', 'oil', 'coffee', 'jerry', 'tyre']) G.unlocked.add(id); a.applyUnlocks();
    for (const k of ['stocker', 'cashier', 'attendant']) { G.lvl[k] = 1; a.hire(k); } window.__botMaxGear = 5; G.gear = 5; G.rep = 5;
    for (let i = 0; i < 4; i++) a.spawnCar(); for (let i = 0; i < 6; i++) a.spawnCustomer({ x: -10, z: 9.2 }); })()`);
  await sleep(6000);
  await tab.cmd('Emulation.setCPUThrottlingRate', { rate: +thr });
  await sleep(1500);
  const r = await tab.ev(`new Promise((res) => { const times = []; let last = performance.now(); const t0 = last;
    function f(now) { times.push(now - last); last = now; if (now - t0 < ${+secs * 1000}) requestAnimationFrame(f); else { times.shift(); const s = times.slice().sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length; const a = __fs.api; res({ frames: times.length, avgFps: +(1000 / avg).toFixed(1), p95ms: +s[Math.floor(s.length * 0.95)].toFixed(1), worstMs: +s[s.length - 1].toFixed(1),
        cars: a.ENT.cars.length, people: a.ENT.people.length, staff: a.ENT.staff.length, calls: a.renderer.info.render.calls, tris: a.renderer.info.render.triangles, pixelRatio: a.renderer.getPixelRatio(), night: +(a.G.night || 0).toFixed(2) }); } }
    requestAnimationFrame(f); })`);
  console.log(`[${tag}] ${W}x${H} cpu x${thr}:`, JSON.stringify(r));
  await tab.cmd('Emulation.setCPUThrottlingRate', { rate: 1 });
  await tab.shot(`${ROOT}shots/${tag}.png`);
} catch (e) { console.log(`[${tag}] FAIL`, e.message); }
console.log(`[${tag}] errors`, JSON.stringify(tab.errs.slice(0, 6)));
await tab.close(); process.exit(0);
