// Close-up crops for the render review: node tools/crops.mjs <tag> [baseUrl]  -> shots/crops-<tag>-*.png
// Same cameras on any build (uses only G.camOverride + startDay), evening light.
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [tag = 'x', base = 'http://localhost:8811/public/'] = process.argv.slice(2);
const tab = await chrome('crops-' + tag, 9530 + (tag.length % 7), TMP + 'go26-crops-' + tag, { args: ['--window-size=1280,720'] });
try {
  await tab.size(1280, 720, false); await tab.go(base);
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api, G = a.G; a.startDay(); G.spawnT = 1e9; G.ambT = 1e9; G.timeScale = 1; G.shift = 1; G.shiftT = 120;
    for (const id of ['pump1','pump2','pump3','cereal','oil','coffee','jerry','tyre']) G.unlocked.add(id); a.applyUnlocks();
    for (let i = 0; i < 4; i++) a.spawnCar(); for (let i = 0; i < 40 && !a.ENT.people.some(p => p.mesh.userData.name === 'blocky_05_wizard'); i++) a.spawnCustomer({ x: 6 + (i % 4) * 0.4, z: -4.6 });
    document.getElementById('hud').style.display = 'none'; document.getElementById('labels').style.display = 'none'; })()`);
  await sleep(9000); // cars park, customers walk in
  const views = { hat: null, trim: [9.5, 3.4, -9.4, 9.5, 2.7, -12.1], counter: [2.6, 2.4, -3.6, 1.0, 0.95, -5.6], shadows: [3.5, 5.0, 9.5, 3.5, 0.0, 3.2], walls: [12.0, 4.5, -2.0, 10.0, 1.4, -9.0] };
  for (const [k, v] of Object.entries(views)) {
    await tab.ev(`(() => { const a = __fs.api, G = a.G; G.timeScale = 0.0001; let o = ${JSON.stringify(v)};
      if (!o) { const w = a.ENT.people.find(p => p.mesh.userData.name === 'blocky_05_wizard'); const p = w ? w.mesh.position : { x: 6, y: 0, z: -5 }; o = [p.x + 1.0, 2.7, p.z + 1.5, p.x, 1.75, p.z]; }
      G.camOverride = o; })()`);
    await sleep(700); await tab.shot(ROOT + `shots/crops-${tag}-${k}.png`);
  }
} catch (e) { console.log('FAIL', e.message); }
console.log('[crops ' + tag + '] errors', tab.errs.length, JSON.stringify(tab.errs.slice(0, 3)));
await tab.close(); process.exit(0);
