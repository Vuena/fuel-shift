// Layout gate (three.js port of asset-sales/_tools/layout_gate.py): node tools/gate.mjs [port]
// Unlocks every station, checks FLOAT / OVERLAP / WALL on all placed sampler props, writes shots/gate-report.json and
// close-up review shots of each area (shots/gate-*.png) for the art-director pass.
import { chrome, sleep } from './lib/cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const port = +(process.argv[2] || 9431); const out = ROOT + 'shots/'; mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8811/public/';
const tab = await chrome('gate', port, TMP + 'go26-gate', { args: ['--window-size=1280,720'] });
try {
  await tab.size(1280, 720, false); await tab.go(URL + '?qa');
  for (let i = 0; i < 200 && !(await tab.ev('!!(window.__fs && __fs.ready && __fs.qa)')); i++) await sleep(100);
  const r = await tab.ev('(() => { const r = __fs.qa.layoutGate(__fs.api); return r; })()');
  writeFileSync(out + 'gate-report.json', JSON.stringify(r, null, 1));
  console.log('props', r.props, 'shell', r.shell, 'violations', r.violations.length); for (const v of r.violations) console.log(' ', JSON.stringify(v));
  // review shots: close-ups of each area with everything unlocked (title camera replaced by fixed views)
  await tab.ev(`(() => { const a = __fs.api; document.getElementById('title').classList.add('hidden'); document.getElementById('jamTag').classList.add('hidden'); a.G.state = 'review'; for (const c of a.ENT.cars) a.scene.remove(c.mesh); a.ENT.cars.length = 0; })()`);
  const views = { pumps: [7, 9, 13, 7, 0, 2.6], shop: [5, 9.5, 2.5, 5, 0, -8], stock: [16, 6, -3, 16, 0, -9], lounge: [-0.5, 3.6, -5.2, -1.2, 0.4, -9.4], shelves: [5.4, 2.4, -7.8, 5.4, 0.9, -11.6], tyres: [17.6, 3.2, 6.2, 17.5, 0.4, 2.3], jerry: [-3.4, 2.6, 5.4, -3.4, 0.3, 2.4], till: [1.2, 2.8, -2.6, 1.0, 0.9, -5.2] };
  for (const [k, v] of Object.entries(views)) {
    await tab.ev(`(() => { const c = __fs.api.camera; c.position.set(${v[0]}, ${v[1]}, ${v[2]}); c.lookAt(${v[3]}, ${v[4]}, ${v[5]}); c.fov = 50; c.updateProjectionMatrix(); __fs.api.renderer.render(__fs.api.scene, c); })()`);
    await sleep(150); await tab.ev(`__fs.api.renderer.render(__fs.api.scene, __fs.api.camera)`); await tab.shot(out + 'gate-' + k + '.png');
  }
} catch (e) { console.log('FAIL', e.message); }
console.log('ERRORS', JSON.stringify(tab.errs.slice(0, 8)));
await tab.close(); process.exit(0);
