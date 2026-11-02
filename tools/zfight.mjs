// Scene z-fight scan (see sceneZFight in public/js/qa.js): node tools/zfight.mjs [selftest]
import { chrome, sleep } from './lib/cdp.mjs';
import { tmpdir } from 'node:os';
const self = process.argv[2] === 'selftest';
const tab = await chrome('zf', 9507, tmpdir() + '/go26-zf', { args: ['--window-size=1280,720'] });
try {
  await tab.size(1280, 720, false); await tab.go((process.env.URL || 'http://localhost:8811/public/') + '?qa');
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready && __fs.qa)')); i++) await sleep(100);
  const r = await tab.ev(`(async () => { const THREE = await import('three'); const a = __fs.api; localStorage.setItem('fuelshift.tutDone', 'true'); a.startDay();
    for (const id of ['pump1','pump2','pump3','cereal','oil','coffee','jerry','tyre']) a.G.unlocked.add(id); a.applyUnlocks();
    for (const id of ['soda','cereal','oil','coffee']) { const st = a.stations()[id]; st.stock = st.cap; st.inst.count = st.stock; }
    for (let i = 0; i < 4; i++) a.spawnCar(); for (let i = 0; i < 40; i++) a.frame(0.05);
    ${self ? `const z = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0xff3366 })); z.rotation.x = -Math.PI / 2; z.position.set(4, 0.026, -6.5); a.scene.add(z);` : ''}
    const t0 = performance.now(); const r = __fs.qa.sceneZFight(a); r.ms = Math.round(performance.now() - t0); return r; })()`);
  console.log(`[zfight${self ? ' SELFTEST' : ''}] triangles ${r.tris} in ${r.ms} ms, coincident object pairs: ${r.pairs.length}`);
  for (const p of r.pairs.slice(0, 30)) console.log('  ', JSON.stringify(p));
} catch (e) { console.log('FAIL', e.message); }
console.log('console errors', tab.errs.length, JSON.stringify(tab.errs.slice(0, 4)));
await tab.close(); process.exit(0);
