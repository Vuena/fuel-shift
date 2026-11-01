// Pose review in the open forecourt: walk carrying, walk empty, idle carrying, plus every customer character. node tools/posecheck.mjs
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const tab = await chrome('pose', 9492, TMP + 'go26-pose', { args: ['--window-size=1280,720'] });
try {
  await tab.size(1280, 720, false); await tab.go((process.env.URL || 'http://localhost:8811/public/'));
  for (let i = 0; i < 200 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api; a.startDay(); a.G.spawnT = 999; a.G.ambT = 999; a.player().position.set(5, 0, 6.5); a.setCarry('carton', 4); a.input().bot = { x: 1, y: 0 }; })()`);
  const shoot = async (n, x, z) => { await tab.ev(`__fs.api.G.camOverride = [${x} + 0.6, 1.6, ${z} + 3.4, ${x}, 0.95, ${z}]`); await sleep(120); await tab.shot(ROOT + `shots/pose-${n}.png`); };
  await sleep(700); let p = await tab.ev('[__fs.api.player().position.x, __fs.api.player().position.z]'); await shoot('walk-carry', p[0], p[1]);
  await tab.ev(`(() => { const a = __fs.api; a.input().bot = { x: 0, y: 0 }; })()`); await sleep(800); p = await tab.ev('[__fs.api.player().position.x, __fs.api.player().position.z]'); await shoot('idle-carry', p[0], p[1]);
  await tab.ev(`(() => { const a = __fs.api; a.setCarry(null, 0); a.input().bot = { x: -1, y: 0 }; })()`); await sleep(700); p = await tab.ev('[__fs.api.player().position.x, __fs.api.player().position.z]'); await shoot('walk-empty', p[0], p[1]);
  // a line-up of customers walking past (one of each, night shift so the zombie can appear)
  await tab.ev(`(() => { const a = __fs.api; a.input().bot = { x: 0, y: 0 }; a.player().position.set(-2, 0, 6.5); a.G.shift = 2; for (let i = 0; i < 9; i++) { const c = a.spawnCustomer({ x: 1 + i * 1.3, z: 6.6 }); if (c) { c.path = [{ x: 1 + i * 1.3, z: 4.6 }]; c.state = 'exit'; } } })()`);
  await sleep(600); await tab.ev('__fs.api.G.camOverride = [7, 2.2, 10.5, 7, 0.9, 5.4]'); await sleep(120); await tab.shot(ROOT + 'shots/pose-lineup.png');
} catch (e) { console.log('FAIL', e.message); }
console.log('ERRORS', JSON.stringify(tab.errs.slice(0, 6)));
await tab.close(); process.exit(0);
