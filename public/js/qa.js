// Fuel Shift - QA tools (loaded only with ?bot or ?qa).
// startBot: an autopilot that plays a whole day through the same movement input a player uses (input.bot = stick vector),
//           follows the in-game suggest() jobs, buys pads/upgrades, shifts gears by its own rule and picks perks by clicking.
// layoutGate: three.js version of asset-sales/_tools/layout_gate.py - FLOAT / OVERLAP / WALL checks on every placed sampler prop.
import * as THREE from 'three';

export function startBot(api) {
  const { G } = api; const log = []; window.__bot = { log, shifts: [], buys: [] };
  let path = null, tgt = null, repath = 0, gearT = 0, buyT = 0, stuckT = 0, lastPos = null;
  const inp = () => api.input();
  const goal = () => {
    const pads = api.pads().filter((p) => api.padVisible(p) && G.cash >= p.cost - p.paid);
    if (pads.length) return { x: pads[0].x, z: pads[0].z, why: 'pad-' + pads[0].id };
    const tt = api.tutTarget(); if (tt) return { ...tt, why: 'tut' };
    const s = api.suggest(); if (s) return s;
    return { x: 6, z: 3.6, why: 'idle' };
  };
  api.botTick = (dt) => {
    const snap = () => window.__bot.shifts.push({ shift: G.shift, earned: G.earned, cash: G.cash, served: G.served, lost: G.lost, rep: +G.rep.toFixed(2), gear: G.gear, unlocked: G.unlocked.size, lvl: { ...G.lvl } });
    if (G.state === 'end') { if (!window.__bot.ended) { window.__bot.ended = true; snap(); } return; }
    if (G.state === 'card') { const b = document.querySelector('.perk'); if (b) { snap(); window.__bot.buys.push('perk:' + b.dataset.perk); b.click(); } return; }
    if (G.state !== 'play') return;
    const p = api.player().position;
    // upgrades from the panel API (same function the panel buttons call)
    buyT -= dt; if (buyT <= 0 && G.tut >= 6) { buyT = 2; const order = ['carry', 'speed', 'stocker', 'pump', 'scan', 'cashier', 'carry', 'attendant', 'speed', 'pump', 'scan', 'carry', 'speed', 'pump', 'scan'];
      const padLeft = api.pads().some((x) => api.padVisible(x)); for (const id of order) { const u = api.UPG.find((x) => x.id === id), l = G.lvl[id]; if (l < u.cost.length && G.cash >= u.cost[l] * (padLeft && !u.staff ? 1.6 : 1.05)) { api.buyUpgrade(id); window.__bot.buys.push(`${G.shift}:${Math.round(G.shiftT)}s ${id}${l + 1}`); break; } } }
    // gearbox rule: up when calm, down when customers walk out
    gearT -= dt; const pend = api.ENT.cars.filter((c) => c.state === 'wait').length + api.ENT.people.filter((c) => c.state === 'queue').length;
    if (G.tut === 5 && gearT <= 0) { api.shiftGear(1); gearT = 3; }
    else if (G.tut >= 6 && gearT <= 0) {
      if ((G.rep < 2.8 || G.t - G.lastBad < 6) && G.gear > 1) { api.shiftGear(-1); gearT = 12; }
      else if (G.rep >= 3.9 && G.t - G.lastBad > 35 && pend <= 1 && G.gear < (window.__botMaxGear || 5)) { api.shiftGear(1); gearT = 25; }
    }
    repath -= dt; const g = goal();
    if (!tgt || repath <= 0 || Math.hypot(g.x - tgt.x, g.z - tgt.z) > 0.3) { tgt = g; path = api.findPath({ x: p.x, z: p.z }, g); repath = 1.0; }
    while (path && path.length && Math.hypot(path[0].x - p.x, path[0].z - p.z) < (path.length > 1 ? 0.35 : 0.12)) path.shift();
    const w = path && path[0];
    if (!w) { inp().bot = { x: 0, y: 0 }; return; }
    const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz), k = path.length === 1 ? Math.min(1, d / 0.6) : 1;
    inp().bot = { x: (dx / d) * k, y: (dz / d) * k };
    if (lastPos && Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.002 && d > 0.3) { stuckT += dt; if (stuckT > 1.2) { stuckT = 0; repath = 0; inp().bot = { x: Math.random() - 0.5, y: Math.random() - 0.5 }; log.push('stuck at ' + p.x.toFixed(1) + ',' + p.z.toFixed(1) + ' -> ' + g.why); } } else stuckT = 0;
    lastPos = { x: p.x, z: p.z };
  };
}

// ---------------------------------------------------------------- layout gate
const TOL = 0.003, FLOAT_EPS = 0.012;
const ALLOW = [['sk_price_tag_shelf', 'sk_shelf_wall_120'], ['ap_pillow_square', 'ap_armchair']];
const allowed = (a, b) => ALLOW.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
function meshesOf(o) { const out = []; o.updateMatrixWorld(true); o.traverse((m) => { if (m.isMesh) out.push(m); }); return out; }
function worldVerts(o, max = 400) { const pts = []; for (const m of meshesOf(o)) { const pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / max)); for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)); } return pts; }
function inside(pt, meshes) { // ray parity along two axes
  let votes = 0; for (const dir of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0.001).normalize()]) {
    const rc = new THREE.Raycaster(pt, dir); let n = 0; for (const m of meshes) { const s = m.material.side; m.material.side = THREE.DoubleSide; n += rc.intersectObject(m, false).length; m.material.side = s; } if (n % 2 === 1) votes++;
  } return votes === 2;
}
export function layoutGate(api, { unlockAll = true } = {}) {
  const W = api.W(), G = api.G; if (unlockAll) { for (const id of ['pump1', 'pump2', 'pump3', 'cereal', 'oil', 'coffee', 'jerry', 'tyre']) G.unlocked.add(id); api.applyUnlocks(); }
  api.scene.updateMatrixWorld(true);
  const props = W.props.filter((p) => { let v = true; p.o.traverseAncestors((a) => { if (a.visible === false) v = false; }); return v && p.o.visible; });
  const items = props.map((p) => ({ ...p, box: new THREE.Box3().setFromObject(p.o, true), meshes: meshesOf(p.o) }));
  // shell = code-built static boxes (walls, counter, kerbs, islands, sidewalks) + ground
  const shell = []; api.scene.traverse((m) => { if (m.isMesh && m.geometry.type === 'BoxGeometry' && !items.some((it) => it.meshes.includes(m))) { let dyn = false; m.traverseAncestors((a) => { if (a.userData && (a.userData.wheels || a.userData.legs)) dyn = true; }); if (!dyn) shell.push(m); } });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()); ground.updateMatrixWorld(true);
  const V = [];
  const all = items.flatMap((it) => it.meshes);
  for (const it of items) {
    if (it.tag === 'hang') { // WALL: a ray from the item's centre backwards must hit a wall/unit within 10 mm of the back face
      const c = it.box.getCenter(new THREE.Vector3()); const back = new THREE.Vector3(0, 0, -1).applyQuaternion(it.o.getWorldQuaternion(new THREE.Quaternion()));
      const rc = new THREE.Raycaster(c.clone().addScaledVector(back, -0.01), back, 0, 0.06); const hits = rc.intersectObjects([...shell, ...all.filter((m) => !it.meshes.includes(m))], false);
      const depth = Math.abs(back.x) > 0.5 ? (it.box.max.x - it.box.min.x) / 2 : (it.box.max.z - it.box.min.z) / 2;
      if (!hits.length || hits[0].distance > depth + 0.02 + 0.01) V.push({ kind: 'WALL', name: it.name, at: c.toArray().map((v) => +v.toFixed(2)), d: hits[0] ? +hits[0].distance.toFixed(3) : null });
      continue;
    }
    // FLOAT: 5 footprint rays from just above the bottom must find support within 12 mm
    const b = it.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, ex = (b.max.x - b.min.x) * 0.3, ez = (b.max.z - b.min.z) * 0.3;
    const others = [...shell, ground, ...all.filter((m) => !it.meshes.includes(m))]; let ok = false, best = null;
    for (const [dx, dz] of [[0, 0], [ex, ez], [-ex, ez], [ex, -ez], [-ex, -ez]]) {
      const rc = new THREE.Raycaster(new THREE.Vector3(cx + dx, b.min.y + 0.05, cz + dz), new THREE.Vector3(0, -1, 0), 0, 0.05 + FLOAT_EPS + 0.002);
      const h = rc.intersectObjects(others, false)[0]; if (h) { ok = true; break; }
      const far = new THREE.Raycaster(new THREE.Vector3(cx + dx, b.min.y + 0.05, cz + dz), new THREE.Vector3(0, -1, 0), 0, 5).intersectObjects(others, false)[0]; if (far) best = Math.min(best ?? 9, far.distance - 0.05);
    }
    if (!ok) V.push({ kind: 'FLOAT', name: it.name, at: [cx, b.min.y, cz].map((v) => +v.toFixed(3)), gap: best === null ? null : +best.toFixed(3) });
  }
  // OVERLAP: broad phase on AABBs (smaller shrunk by 3 mm/side), narrow phase = vertices of the smaller inside the other mesh
  const shellItems = shell.map((m) => ({ name: 'shell', meshes: [m], box: new THREE.Box3().setFromObject(m), o: m }));
  const list = [...items, ...shellItems];
  for (let i = 0; i < items.length; i++) for (let j = 0; j < list.length; j++) {
    const a = items[i], b = list[j]; if (j < items.length && j <= i) continue; if (allowed(a.name, b.name)) continue;
    const sa = a.box.getSize(new THREE.Vector3()), sb = b.box.getSize(new THREE.Vector3()); const small = sa.x * sa.y * sa.z <= sb.x * sb.y * sb.z ? a : b, big = small === a ? b : a;
    const sbx = small.box.clone().expandByScalar(-TOL); if (!sbx.intersectsBox(big.box)) continue;
    const ctr = small.box.getCenter(new THREE.Vector3());
    const pts = worldVerts(small.o, 300).map((p) => p.clone().lerp(ctr, 0).addScaledVector(ctr.clone().sub(p).normalize(), TOL)).filter((p) => big.box.containsPoint(p));
    let n = 0; for (const p of pts) { if (inside(p, big.meshes)) { n++; if (n >= 3) break; } }
    if (n >= 3) V.push({ kind: 'OVERLAP', a: a.name, b: b.name, at: ctr.toArray().map((v) => +v.toFixed(2)) });
  }
  return { props: items.length, shell: shell.length, violations: V };
}
