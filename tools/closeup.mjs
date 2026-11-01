// Close-up review of the animated characters and cars during an autopilot run: node tools/closeup.mjs [port]
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const port = +(process.argv[2] || 9491);
const tab = await chrome('closeup', port, TMP + 'go26-closeup', { args: ['--window-size=1280,720'] });
const cam = (x, y, z, tx, ty, tz) => tab.ev(`(() => { const a = __fs.api; a.G.camOverride = [${x}, ${y}, ${z}, ${tx}, ${ty}, ${tz}]; })()`);
try {
  await tab.size(1280, 720, false); await tab.go((process.env.URL || 'http://localhost:8811/public/') + '?bot&speed=1');
  for (let i = 0; i < 200 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api; a.startDay(); for (const id of ['pump1','pump2','pump3','cereal','oil','coffee','jerry','tyre']) a.G.unlocked.add(id); a.applyUnlocks(); a.G.shift = 2; a.G.shiftT = 20; for (let i = 0; i < 4; i++) a.spawnCar(); for (let i = 0; i < 6; i++) a.spawnCustomer({ x: 6 + i * 0.3, z: -2.4 }); a.hire('stocker'); })()`);
  for (let i = 0; i < 60 && (await tab.ev('__fs.api.player().userData && __fs.api.ENT && !__fs.api.player().children.find(c => c.type === "Group" && c.children.length)')); i++) await sleep(250);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 80 && !(await tab.ev('(() => { const h = __fs.api.player().children.filter(c => c.type === "Group").pop(); return h && h.children.length > 0; })()')); i++) await sleep(200);
    await sleep(500 + k * 1200);
    const p = await tab.ev('(() => { const p = __fs.api.player().position; return [p.x, p.z]; })()');
    await cam(p[0] + 2.2, 2.0, p[1] + 2.6, p[0], 0.9, p[1]); await sleep(200); await tab.shot(ROOT + `shots/closeup-player-${k}.png`);
  }
  await cam(7, 3.2, 8.5, 7, 0.8, 3); await sleep(300); await tab.shot(ROOT + 'shots/closeup-cars.png');
  await cam(3.5, 3.0, -2.0, 3.5, 0.8, -7.5); await sleep(300); await tab.shot(ROOT + 'shots/closeup-shop.png');
} catch (e) { console.log('FAIL', e.message); }
console.log('ERRORS', JSON.stringify(tab.errs.slice(0, 6)));
await tab.close(); process.exit(0);
