// Store media from the real game: node tools/media.mjs [port]
// -> media/screenshot_1..5.png (1280x720) and media/cover_630x500.png (rendered at 1260x1000, downscaled with PIL by build step below)
import { chrome, sleep } from './lib/cdp.mjs';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const port = +(process.argv[2] || 9481); const out = ROOT + 'media/'; mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8811/public/';
const tab = await chrome('media', port, TMP + 'go26-media', { args: ['--window-size=1280,720'] });
const ev = (s) => tab.ev(s);
// stage a moment: day progress (shift, seconds), gear, unlocks, staff, stock, player spot, entities; then fast-forward `ff` seconds
const stage = (o) => ev(`(() => { const a = __fs.api, G = a.G; localStorage.setItem('fuelshift.tutDone', 'true');
  if (G.state !== 'play') a.startDay(); for (const c of a.ENT.cars) a.scene.remove(c.mesh); for (const p of a.ENT.people) a.scene.remove(p.mesh); a.ENT.cars.length = 0; a.ENT.people.length = 0;
  G.tut = 6; G.shift = ${o.shift}; G.shiftT = ${o.t}; G.rep = ${o.rep ?? 4.6}; G.cash = ${o.cash}; G.earned = ${o.earned};
  for (const id of ${JSON.stringify(o.unlock || [])}) G.unlocked.add(id); a.applyUnlocks();
  for (const k of ${JSON.stringify(o.staff || [])}) if (!G.lvl[k]) { G.lvl[k] = 1; a.hire(k); }
  for (const id of ['soda', 'cereal', 'oil', 'coffee']) { const st = a.stations()[id]; st.stock = Math.round(st.cap * ${o.stock ?? 0.8}); st.inst.count = st.stock; }
  a.player().position.set(${o.px}, 0, ${o.pz}); window.__botMaxGear = ${o.gear}; while (G.gear < ${o.gear}) a.shiftGear(1); while (G.gear > ${o.gear}) a.shiftGear(-1);
  for (let i = 0; i < ${o.cars ?? 0}; i++) a.spawnCar(); for (let i = 0; i < ${o.walk ?? 0}; i++) a.spawnCustomer({ x: 6 + (i % 3) * 0.4, z: -2.6 });
  G.timeScale = 4; })()`);
const shot = async (name, ff) => { await sleep(ff * 250); await ev('__fs.api.G.timeScale = 1'); await sleep(900); await tab.shot(out + name); console.log('shot', name); };
try {
  await tab.size(1280, 720, false); await tab.go(URL + '?bot');
  for (let i = 0; i < 300 && !(await ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  // 1 morning forecourt rush
  await stage({ shift: 0, t: 95, gear: 3, cash: 214, earned: 640, unlock: ['pump1', 'pump2', 'cereal', 'jerry'], px: 4.4, pz: 4.4, cars: 3, walk: 0, stock: 0.6 });
  await shot('screenshot_1.png', 9);
  // 2 evening shop: queue at the till, coffee corner, shelves
  await stage({ shift: 1, t: 70, gear: 3, cash: 486, earned: 1720, unlock: ['pump1', 'pump2', 'cereal', 'oil', 'coffee', 'jerry'], staff: ['stocker'], px: -0.15, pz: -5.6, cars: 1, walk: 6, stock: 0.7 });
  await shot('screenshot_2.png', 10);
  // 3 night shift: lit shop, trucks and tyres
  await stage({ shift: 2, t: 60, gear: 4, cash: 905, earned: 3480, unlock: ['pump1', 'pump2', 'pump3', 'cereal', 'oil', 'coffee', 'jerry', 'tyre'], staff: ['stocker', 'cashier', 'attendant'], px: 9.2, pz: 3.6, cars: 4, walk: 3, stock: 0.75 });
  await shot('screenshot_3.png', 10);
  // 4 gear 5 rush at dusk
  await stage({ shift: 1, t: 200, gear: 5, cash: 1290, earned: 2950, unlock: ['pump1', 'pump2', 'pump3', 'cereal', 'oil', 'coffee', 'jerry', 'tyre'], staff: ['stocker', 'cashier'], px: 0.2, pz: 4.1, cars: 4, walk: 4, stock: 0.5 });
  await shot('screenshot_4.png', 7);
  // 5 end screen (score, rank, kit link) over the dawn station
  await ev(`(() => { const a = __fs.api, G = a.G; G.earned = 4310; G.served = 241; G.lost = 9; G.rep = 4.4; G.topGear = 5; G.shift = 2; G.shiftT = 239.5; })()`);
  await sleep(1500); await tab.shot(out + 'screenshot_5.png'); console.log('shot screenshot_5.png');
  // cover: golden-hour station, HUD hidden, logo overlay, rendered at 1260x1000
  await tab.size(1260, 1000, false); await sleep(300);
  await stage({ shift: 1, t: 150, gear: 3, cash: 0, earned: 0, unlock: ['pump1', 'pump2', 'pump3', 'cereal', 'oil', 'coffee', 'jerry', 'tyre'], staff: [], px: 6.5, pz: 4.6, cars: 4, walk: 3, stock: 0.85 });
  await sleep(10 * 250); await ev('__fs.api.G.timeScale = 1');
  await ev(`(() => { const a = __fs.api; document.getElementById('end').classList.add('hidden'); a.G.state = 'review';
    for (const id of ['hud', 'labels', 'stick']) document.getElementById(id).style.display = 'none';
    const c = a.camera; c.fov = 34; c.aspect = 1260 / 1000; c.updateProjectionMatrix(); c.position.set(-6.5, 13.5, 17.5); c.lookAt(6.5, 0.5, 1.2);
    const d = document.createElement('div'); d.id = 'coverArt'; d.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;background:linear-gradient(180deg,rgba(14,22,42,.0) 52%,rgba(14,22,42,.78) 100%)';
    d.innerHTML = '<div class="logo" style="position:absolute;left:0;right:0;bottom:120px;text-align:center;font-size:150px">FUEL <span>SHIFT</span></div>'
      + '<div style="position:absolute;left:0;right:0;bottom:62px;text-align:center;font:900 34px Segoe UI,Arial;color:#fff4e0;letter-spacing:2px;text-shadow:0 3px 6px #000">3 SHIFTS \u00b7 5 GEARS \u00b7 1 GAS STATION</div>'
      + '<div style="position:absolute;right:46px;top:44px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#4a5a80,#1a2440 70%);border:7px solid #0c1428;box-shadow:0 10px 0 #0008;display:grid;place-items:center"><b style="font:900 92px Segoe UI,Arial;color:#ffb347;text-shadow:0 4px 0 #0008">5</b></div>';
    document.body.appendChild(d); })()`);
  await sleep(1200); await tab.shot(out + '_cover_1260x1000.png');
  execSync(`python -c "from PIL import Image; Image.open(r'${out}_cover_1260x1000.png').convert('RGB').resize((630,500), Image.LANCZOS).save(r'${out}cover_630x500.png')"`);
  console.log('cover done');
} catch (e) { console.log('FAIL', e.message); }
console.log('ERRORS', JSON.stringify(tab.errs.slice(0, 6)));
await tab.close(); process.exit(0);
