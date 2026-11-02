// Guidance check: node tools/guidecheck.mjs <mobile 0|1> [port]
// 1) a car wants a jerry can: the rack shows a demand bubble, the player picks one up, the HUD line names the car + pump,
//    the guide arrow / pulsing ring sit on that pump, the jerry can sits in the carried stack; deliver it -> paid, need cleared
// 2) nobody needs a jerry can: standing at the rack picks nothing up and explains why
// 3) first-time tutorial: the hint has a Skip button (at the joystick on phones); Skip ends the tutorial
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [mob = '0', port = '9520'] = process.argv.slice(2); const mobile = mob === '1', W = mobile ? 390 : 1280, H = mobile ? 844 : 720, tag = mobile ? 'phone' : 'desk';
const tab = await chrome('guide' + mob, +port, TMP + 'go26-guide-' + mob, { args: ['--window-size=' + W + ',' + H] });
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(`[${tag}] ${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const shot = (n) => tab.shot(ROOT + `shots/guide-${tag}-${n}.png`);
const step = (n) => tab.ev(`(() => { for (let i = 0; i < ${n}; i++) __fs.api.frame(1 / 30); })()`);
try {
  await tab.size(W, H, mobile); await tab.go((process.env.URL || 'http://localhost:8811/public/') + (mobile ? '?touch' : ''));
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  // ---- 1) demand + delivery
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api, G = a.G; a.startDay(); G.qaHold = true; G.spawnT = 1e9; G.ambT = 1e9; G.unlocked.add('pump1'); G.unlocked.add('jerry'); a.applyUnlocks();
    const c = a.spawnCar({ pump: 1, simple: true, near: true }); window.__car = c; })()`);
  for (let i = 0; i < 40 && (await tab.ev('__car.state')) !== 'wait'; i++) await step(15);
  await tab.ev(`(() => { __car.needs.jerry = true; __car.needs.fuel = false; __fs.api.player().position.set(-3.4, 0, 3.5); })()`); await step(20);
  check('pile shows a demand bubble', await tab.ev(`[...__fs.api.labels.keys()].includes('pile-jerry')`));
  check('car bubble shows the jerry can icon', await tab.ev(`(() => { const el = __fs.api.labels.get(__car); return !!el && el.innerHTML.includes('#d62828'); })()`));
  check('picked up exactly the needed number (1)', (await tab.ev('__fs.api.player().userData.carry.length')) === 1);
  const txt = await tab.ev(`document.getElementById('carry').textContent`); check('HUD line names the car and pump', /Bring the jerry can to the .+ at pump 2/.test(txt), JSON.stringify(txt));
  check('stack: one centred can', await tab.ev(`(() => { const h = __fs.api.player().userData.hold; return h.children.length === 1 && Math.abs(h.children[0].position.x) < 1e-6; })()`));
  const g = await tab.ev(`(() => { const ps = { x: 4.5, z: 3.95 }; return __fs.api.coach ? __fs.api.coach.at() : null; })()`);
  check('first-time coach points at pump 2', g && Math.abs(g.x - 4.5) < 0.01, JSON.stringify(g));
  check('coach hint visible', await tab.ev(`getComputedStyle(document.getElementById('hint')).display !== 'none' && document.getElementById('hint').textContent.includes('pump 2')`));
  if (mobile) { const hb = await tab.ev(`(() => { const r = document.getElementById('hint').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    check('phone hint sits at the joystick (bottom-left), not screen centre', hb.x < W * 0.55 && hb.y > H * 0.55, JSON.stringify(hb)); }
  await tab.ev(`__fs.api.player().position.set(-1.2, 0, 4.6)`); await step(10); await shot('1-carrying-jerry');
  const cash0 = await tab.ev('__fs.api.G.cash'); await tab.ev(`__fs.api.player().position.set(4.5, 0, 3.95)`); await step(30);
  check('delivered: need cleared and paid', !(await tab.ev('__car.needs.jerry')) && (await tab.ev('__fs.api.G.cash')) > cash0);
  check('coach finished and remembered', !(await tab.ev('__fs.api.coach')) && (await tab.ev(`localStorage.getItem('fuelshift.coach.jerry')`)) === 'true');
  // ---- 2) no demand
  await tab.ev(`(() => { const a = __fs.api; a.startDay(); a.G.qaHold = true; a.G.spawnT = 1e9; a.G.unlocked.add('jerry'); a.applyUnlocks(); a.player().position.set(-3.4, 0, 3.5); })()`); await step(25);
  check('no demand: nothing picked up', (await tab.ev('__fs.api.player().userData.carry.length')) === 0);
  const toast = await tab.ev(`document.getElementById('toast').textContent`); check('no demand: explained', /No one needs a jerry can/.test(toast), JSON.stringify(toast)); await shot('2-no-demand');
  // ---- 3) tutorial with Skip
  await tab.ev(`(() => { localStorage.removeItem('fuelshift.tutDone'); const a = __fs.api; a.startDay(); a.G.qaHold = false; })()`); await sleep(900);
  check('tutorial hint has a Skip button', await tab.ev(`!!document.querySelector('#hint .skip')`)); await shot('3-tutorial');
  const sk = await tab.center('#hint .skip'); if (mobile) await tab.tap(sk.x, sk.y); else await tab.click(sk.x, sk.y); await sleep(400);
  check('Skip ends the tutorial (and remembers it)', (await tab.ev('__fs.api.G.tut')) >= 6 && (await tab.ev(`localStorage.getItem('fuelshift.tutDone')`)) === 'true');
} catch (e) { console.log('FAIL exception', e.message); res.push(false); }
console.log(`[${tag}] ${res.filter(Boolean).length}/${res.length} passed; console errors`, tab.errs.length, JSON.stringify(tab.errs.slice(0, 4)));
await tab.close(); process.exit(0);
