// Real-input check (no autopilot): node tools/input.mjs <mobile 0|1> <cdpPort>
// Desktop: WASD, mouse drag, Right/Left Shift gearbox, U/Esc panel, P pause. Phone: joystick drag in the corner zone,
// a drag outside the zone must NOT move, gear buttons by touch, then walks to the pump with the joystick and finishes the
// first fill-up of the tutorial. Prints PASS/FAIL per check and the console errors.
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [mob = '0', port = '9461'] = process.argv.slice(2); const mobile = mob === '1';
const W = mobile ? 390 : 1280, H = mobile ? 844 : 720;
const URL = (process.env.URL || 'http://localhost:8811/public/') + '?tut';
const tab = await chrome('input-' + mob, +port, TMP + 'go26-input-' + mob, { args: ['--window-size=' + W + ',' + H] });
const res = []; const check = (name, ok, extra = '') => { res.push(ok); console.log(`[${mobile ? 'phone' : 'desk'}] ${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const pos = () => tab.ev('(() => { const p = __fs.api.player().position; return { x: p.x, z: p.z }; })()');
const KEYS = { KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68], ShiftRight: ['Shift', 16, 2], ShiftLeft: ['Shift', 16, 1], KeyU: ['u', 85], KeyP: ['p', 80], Escape: ['Escape', 27] };
const key = async (code, type) => { const k = KEYS[code]; await tab.cmd('Input.dispatchKeyEvent', { type, code, key: k[0], windowsVirtualKeyCode: k[1], location: k[2] || 0 }); };
const press = async (code) => { await key(code, 'keyDown'); await sleep(40); await key(code, 'keyUp'); await sleep(120); };
let TID = 30;
async function stick(dx, dy, ms, at) { // touch drag starting at `at` (default the stick home), held for ms
  const h = at || await tab.ev('__fs.api.input().home'); const id = TID++;
  const pt = (k) => ({ x: h.x + dx * 50 * k, y: h.y + dy * 50 * k, id, radiusX: 4, radiusY: 4, force: 1 });
  await tab.cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(0)] });
  for (let k = 1; k <= 4; k++) { await tab.cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(k / 4)] }); await sleep(16); }
  await sleep(ms); await tab.cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(80);
}
try {
  await tab.size(W, H, mobile); await tab.go(URL);
  for (let i = 0; i < 200 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  const sb = await tab.center('#startBtn'); if (mobile) await tab.tap(sb.x, sb.y); else await tab.click(sb.x, sb.y); await sleep(600);
  check('start button', (await tab.ev('__fs.state')) === 'play');
  if (!mobile) {
    let a = await pos(); await key('KeyD', 'keyDown'); await sleep(500); await key('KeyD', 'keyUp'); let b = await pos(); check('D moves right', b.x - a.x > 1, (b.x - a.x).toFixed(2));
    a = b; await key('KeyW', 'keyDown'); await sleep(400); await key('KeyW', 'keyUp'); b = await pos(); check('W moves up-screen (-z)', a.z - b.z > 0.8, (a.z - b.z).toFixed(2));
    a = b; await tab.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 400, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 6; i++) { await tab.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640 - i * 10, y: 400, button: 'left', buttons: 1 }); await sleep(16); }
    await sleep(450); await tab.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 580, y: 400, button: 'left', buttons: 0, clickCount: 1 }); b = await pos(); check('mouse drag moves left', a.x - b.x > 0.8, (a.x - b.x).toFixed(2));
    await press('ShiftRight'); check('Right Shift = gear up', (await tab.ev('__fs.api.G.gear')) === 2);
    await press('ShiftLeft'); check('Left Shift = gear down', (await tab.ev('__fs.api.G.gear')) === 1);
    await tab.clickSel('#gUp'); check('gear button up (click)', (await tab.ev('__fs.api.G.gear')) === 2); await tab.clickSel('#gDn');
    await press('KeyU'); check('U opens upgrades', !(await tab.ev('document.getElementById("upg").classList.contains("hidden")')));
    await press('Escape'); check('Esc closes upgrades', await tab.ev('document.getElementById("upg").classList.contains("hidden")') && (await tab.ev('__fs.state')) === 'play');
    await press('KeyP'); check('P pauses', (await tab.ev('__fs.state')) === 'paused'); await tab.clickSel('#resumeBtn'); check('resume button', (await tab.ev('__fs.state')) === 'play');
  } else {
    let a = await pos(); await stick(1, 0, 500); let b = await pos(); check('joystick right moves +x', b.x - a.x > 1, (b.x - a.x).toFixed(2));
    a = b; await stick(0, 0, 400, { x: W * 0.8, y: H * 0.35 }); await stick(0, -1, 0, { x: W * 0.8, y: H * 0.35 }); b = await pos(); check('drag outside the corner zone does not move', Math.hypot(b.x - a.x, b.z - a.z) < 0.05);
    const up = await tab.center('#gUp'); await tab.tap(up.x, up.y); await sleep(150); check('gear up button (touch)', (await tab.ev('__fs.api.G.gear')) === 2);
    const dn = await tab.center('#gDn'); await tab.tap(dn.x, dn.y); await sleep(150); check('gear down button (touch)', (await tab.ev('__fs.api.G.gear')) === 1);
    const ub = await tab.center('#upgBtn'); await tab.tap(ub.x, ub.y); await sleep(250); check('upgrades opens (touch)', !(await tab.ev('document.getElementById("upg").classList.contains("hidden")')));
    const ux = await tab.center('#upgX'); await tab.tap(ux.x, ux.y); await sleep(250); check('upgrades closes (touch)', (await tab.ev('__fs.state')) === 'play');
    // tutorial: walk to the pump ring with the joystick, stand there until the first car is filled
    for (let i = 0; i < 24; i++) { // steer along the game's own A* waypoints (the parked tutorial car is in the way), real touches only
      const p = await pos(); const goal = { x: 0, z: 3.95 }; if (Math.hypot(goal.x - p.x, goal.z - p.z) < 0.5) break;
      const w = (await tab.ev(`__fs.api.findPath({ x: ${p.x}, z: ${p.z} }, { x: 0, z: 3.95 })`))[0];
      const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
      await stick(dx / d, dz / d, Math.min(700, Math.max(100, (d - 0.15) / 4.4 * 1000)));
    }
    check('reached the pump ring by joystick', (await tab.ev('__fs.api.playerZone()?.id')) === 'pump0');
    for (let i = 0; i < 40 && !(await tab.ev('__fs.api.G.cash > 0')); i++) await sleep(250);
    check('first fill-up paid', (await tab.ev('__fs.api.G.cash')) > 0, '$' + (await tab.ev('__fs.api.G.cash')));
    await tab.shot(ROOT + 'shots/input-phone.png');
  }
} catch (e) { console.log('FAIL exception', e.message); res.push(false); }
console.log(`[${mobile ? 'phone' : 'desk'}] ${res.filter(Boolean).length}/${res.length} passed; console errors:`, tab.errs.length, JSON.stringify(tab.errs.slice(0, 5)));
await tab.close(); process.exit(0);
