// View check with the real gameplay camera: node tools/viewcheck.mjs <tag> [mobile 0|1] [port]
// 1) shots of the player carrying cartons / jerry cans / tyres in the shop and on the forecourt (+ a staff stocker carrying)
// 2) framing: the player stands on every work ring; the ring centre and the player's head must be on screen, outside the HUD
//    boxes (measured from the DOM), and the ring must not be hidden behind scenery (ray from the camera). Prints FAIL lines.
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [tag = 'x', mob = '0', port = '9495'] = process.argv.slice(2); const mobile = mob === '1';
const W = mobile ? 390 : 1280, H = mobile ? 844 : 720;
const tab = await chrome('view-' + tag + mob, +port, TMP + 'go26-view-' + mob, { args: ['--window-size=' + W + ',' + H] });
const out = (n) => ROOT + `shots/view-${tag}-${mobile ? 'phone' : 'desk'}-${n}.png`;
let fails = 0;
try {
  await tab.size(W, H, mobile); await tab.go((process.env.URL || 'http://localhost:8811/public/') + (mobile ? '?touch' : ''));
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api, G = a.G; a.startDay(); G.spawnT = 1e9; G.ambT = 1e9;
    for (const id of ['pump1','pump2','pump3','cereal','oil','coffee','jerry','tyre']) G.unlocked.add(id); a.applyUnlocks();
    for (const id of ['soda','cereal','oil','coffee']) { const st = a.stations()[id]; st.stock = Math.round(st.cap * 0.6); st.inst.count = st.stock; } })()`);
  const put = (x, z, carry, n, face = 0) => tab.ev(`(() => { const a = __fs.api; a.player().position.set(${x}, 0, ${z}); a.player().rotation.y = ${face}; a.setCarry(${carry ? `'${carry}'` : 'null'}, ${n}); })()`);
  // carry shots (player stands still, facing the camera-ish / up the screen)
  const shelf = await tab.ev('__fs.api.shelfSpot ? __fs.api.shelfSpot("soda") : null');
  await put(shelf ? shelf.x + 1.2 : 4.4, shelf ? shelf.z + 2.0 : -9.0, 'carton', 3, Math.PI); await sleep(900); await tab.shot(out('1-carry-cartons-shop')); // facing away: the hardest case await sleep(900); await tab.shot(out('1-carry-cartons-shop'));
  await put(6, 6.0, 'jerry', 3, 0.6); await sleep(900); await tab.shot(out('2-carry-jerry'));
  await put(9, 6.0, 'tyre', 3, -0.6); await sleep(900); await tab.shot(out('3-carry-tyres'));
  await tab.ev(`(() => { const a = __fs.api; a.hire('stocker'); for (const s of a.ENT.staff) { s.pos = { x: 6.2, z: -9.7 }; s.state = 'review'; s.carry = 3; s.path = []; s.face = Math.PI * 0.75; a.setStaffCarry(s, 3); } a.player().position.set(3.0, 0, -6.6); a.setCarry(null, 0); window.__staffPos = a.ENT.staff[0].pos; })()`);
  await sleep(700); await tab.shot(out('4-staff-carry')); await tab.ev(`(() => { const a = __fs.api; for (const s of a.ENT.staff) a.scene.remove(s.mesh); a.ENT.staff.length = 0; })()`);
  // framing: every active ring and pad
  const spots = await tab.ev(`__fs.api.zones().filter(z => z.g.visible).map(z => ({ id: z.id, x: z.x, z: z.z }))`);
  for (const s of spots) {
    await put(s.x, s.z, null, 0, Math.PI); await sleep(450);
    const r = await tab.ev(`(async () => { const THREE = await import('three'); const a = __fs.api, cam = a.camera; const p = a.player().position;
      const proj = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; };
      const ring = proj(${s.x}, 0.03, ${s.z}), head = proj(p.x, 1.75, p.z);
      const huds = ['cash', 'shiftbox', 'rep', 'topbtns', 'upgBtn', 'gearbox', 'gearkeys', 'carry'].map(id => document.getElementById(id)).filter(e => e && e.offsetParent !== null && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
      if (${mobile}) { const st = document.getElementById('stick').getBoundingClientRect(); huds.push(st); }
      const under = (q) => huds.some(b => q.x > b.left - 4 && q.x < b.right + 4 && q.y > b.top - 4 && q.y < b.bottom + 4);
      const off = (q) => q.x < 8 || q.x > innerWidth - 8 || q.y < 8 || q.y > innerHeight - 8;
      // occlusion: ray from the camera to the ring centre; anything opaque hit before it (other than the player) hides it
      const tgt = new THREE.Vector3(${s.x}, 0.05, ${s.z}); const dir = tgt.clone().sub(cam.position); const dist = dir.length(); dir.normalize();
      const rc = new THREE.Raycaster(cam.position.clone(), dir, 0.1, dist - 0.15); const objs = []; a.scene.traverse(o => { if (o.isMesh && o.visible && !(o.material.transparent && o.material.opacity < 0.5)) { let pl = false, vis = true; o.traverseAncestors(q => { if (q === a.player()) pl = true; if (!q.visible) vis = false; }); if (!pl && vis) objs.push(o); } });
      const hit = rc.intersectObjects(objs, false).filter(h => h.object.geometry.type !== 'RingGeometry' && h.object.geometry.type !== 'CircleGeometry')[0];
      return { ring, head, ringUnder: under(ring), headUnder: under(head), ringOff: off(ring), headOff: off(head), hidden: hit ? (hit.object.name || hit.object.parent?.name || hit.object.geometry.type) : null }; })()`);
    const bad = r.ringUnder || r.headUnder || r.ringOff || r.headOff || r.hidden;
    if (bad) { fails++; console.log(`[${tag} ${mobile ? 'phone' : 'desk'}] FAIL ${s.id}`, JSON.stringify({ ringUnder: r.ringUnder, headUnder: r.headUnder, ringOff: r.ringOff, headOff: r.headOff, hidden: r.hidden, ring: [Math.round(r.ring.x), Math.round(r.ring.y)] })); await tab.shot(out('fail-' + s.id)); }
  }
  console.log(`[${tag} ${mobile ? 'phone' : 'desk'}] framing: ${spots.length - fails}/${spots.length} rings OK`);
  // shop overview from the gameplay camera with the player in the middle of the shop
  await put(5, -7.0, null, 0, Math.PI); await sleep(900); await tab.shot(out('5-shop'));
} catch (e) { console.log('FAIL exception', e.message); }
console.log(`[${tag} ${mobile ? 'phone' : 'desk'}] console errors`, tab.errs.length, JSON.stringify(tab.errs.slice(0, 5)));
await tab.close(); process.exit(0);
