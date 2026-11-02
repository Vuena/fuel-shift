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
    return { x: 8.6, z: 6.2, why: 'idle' }; // between bays, clear of parked cars and lanes
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

// ---------------------------------------------------------------- NPC navigation recorder (every sim step of a whole day)
// FAIL when an NPC centre crosses a wall / glass line outside a door opening, stands inside a shelf / counter / pallet / island,
// or two NPCs overlap (centres < 0.45 m) for more than one step. Also tracks the busiest moment (most NPCs).
export function startNavCheck(api) {
  const R = (window.__nav = { steps: 0, cross: [], inside: [], overlap: [], stuck: [], silent: [], maxNpc: 0, maxAt: null, pairs: 0, minDist: 9 }); const prev = new Map(), olap = new Map(), st = new Map();
  const flag = (list, o) => { if (list.length < 50) list.push(o); };
  let clock = 0; // simulated play time only (the game clock also runs while the shift-change card is open)
  api.qaTick = (sdt = 0) => { clock += sdt;
    const G = api.G, L = [...api.ENT.people, ...api.ENT.staff]; R.steps++; const cols = api.activeColliders();
    if (L.length > R.maxNpc) { R.maxNpc = L.length; R.maxAt = { shift: G.shift, t: Math.round(G.shiftT) }; }
    for (const e of L) {
      const p = { x: e.pos.x, z: e.pos.z }, q = prev.get(e);
      if (q && api.crossesWall(q, p) && R.cross.length < 50) R.cross.push({ who: e.kind || 'customer', from: [q.x, q.z].map((v) => +v.toFixed(2)), to: [p.x, p.z].map((v) => +v.toFixed(2)), shift: G.shift, t: +G.shiftT.toFixed(1) });
      for (const c of cols) if (p.x > c.x0 + 0.02 && p.x < c.x1 - 0.02 && p.z > c.z0 + 0.02 && p.z < c.z1 - 0.02) { if (R.inside.length < 50) R.inside.push({ who: e.kind || 'customer', at: [p.x, p.z].map((v) => +v.toFixed(2)), box: [c.x0, c.z0, c.x1, c.z1].map((v) => +v.toFixed(2)) }); break; }
      prev.set(e, p);
    }
    // every waiting state must resolve, and be explained by a bubble on screen while it lasts
    const T = clock, lab = api.labels;
    const track = (e, state, moving) => { let s = st.get(e); if (!s || s.state !== state) { s = { state, since: T, moveT: T, at: { ...e.pos }, told: false }; st.set(e, s); }
      if (Math.hypot(e.pos.x - s.at.x, e.pos.z - s.at.z) > 0.05) { s.at = { ...e.pos }; s.moveT = T; } return s; };
    for (const c of api.ENT.people) {
      const s = track(c, c.state); const wait = c.state === 'atStation' || c.state === 'queue';
      if (wait && T - s.since > c.patMax / 0.8 + 6 && !s.told) { s.told = true; flag(R.stuck, { who: 'customer', state: c.state, secs: Math.round(T - s.since), shift: G.shift }); }
      if (!wait && T - s.moveT > 10 && !s.told) { s.told = true; flag(R.stuck, { who: 'customer', state: c.state, stalled: Math.round(T - s.moveT), at: [c.pos.x, c.pos.z].map((v) => +v.toFixed(1)), shift: G.shift }); }
      if (c.state === 'atStation' && T - s.since > 2 && !lab.has(c) && !s.told2) { s.told2 = true; flag(R.silent, { who: 'customer at shelf', secs: Math.round(T - s.since) }); }
    }
    for (const car of api.ENT.cars) { if (car.ambient) continue; const s = track(car, car.state);
      const pending = car.needs && (car.needs.fuel || car.needs.jerry || car.needs.tyre);
      if (car.state === 'wait' && !pending && T - s.since > 2 && !s.told) { s.told = true; flag(R.stuck, { who: 'car', state: 'wait (nothing pending)', secs: Math.round(T - s.since) }); }
      if ((car.state === 'wait' || car.state === 'park') && T - s.since > 2 && !lab.has(car) && !s.told2) { s.told2 = true; flag(R.silent, { who: 'car', state: car.state, secs: Math.round(T - s.since) }); }
      if (car.state === 'park' && T - s.since > 160 && !s.told) { s.told = true; flag(R.stuck, { who: 'car', state: 'park', secs: Math.round(T - s.since) }); }
      if ((car.state === 'in' || car.state === 'out') && T - s.moveT > 12 && !s.told) { s.told = true; flag(R.stuck, { who: 'car', state: car.state, stalled: Math.round(T - s.moveT), at: [car.pos.x, car.pos.z].map((v) => +v.toFixed(1)) }); }
    }
    R.rescued = G.qaRescue || 0;
    const now = new Set();
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { R.pairs++; const dd = Math.hypot(L[i].pos.x - L[j].pos.x, L[i].pos.z - L[j].pos.z); if (dd < R.minDist) R.minDist = +dd.toFixed(3); if (dd < 0.45) { const k = L[i].id + ':' + L[j].id; now.add(k); const n = (olap.get(k) || 0) + 1; olap.set(k, n); if (n === 2 && R.overlap.length < 50) R.overlap.push({ at: [L[i].pos.x, L[i].pos.z].map((v) => +v.toFixed(2)), shift: G.shift, t: +G.shiftT.toFixed(1) }); } }
    for (const k of olap.keys()) if (!now.has(k)) olap.delete(k);
  };
}

// ---------------------------------------------------------------- scene z-fight scan
// Every visible, depth-writing mesh in the scene (static props, code-built boxes and planes, decals, instanced stock): faces of
// DIFFERENT objects that lie within 3 mm of the same plane, face the same way (or are double-sided) and overlap in area z-fight.
export function sceneZFight(api, { tol = 0.0005 } = {}) { // 0.6 mm: ~30x the depth resolution at 30 m with near = 2.5 m
  const tris = [], buckets = new Map(), hits = new Map(); let n = 0;
  const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  const add = (geo, mw, objId, name, ds) => {
    const pos = geo.attributes.position, ix = geo.index ? geo.index.array : null, nT = (ix ? ix.length : pos.count) / 3; if (nT > 20000) return;
    for (let t = 0; t < nT; t++) {
      const p = [0, 1, 2].map((k) => v.fromBufferAttribute(pos, ix ? ix[t * 3 + k] : t * 3 + k).applyMatrix4(mw).toArray());
      const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      let nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...nn); if (L < 1e-8) continue; nn = nn.map((q) => q / L);
      const d = nn[0] * p[0][0] + nn[1] * p[0][1] + nn[2] * p[0][2];
      const T = { p, n: nn, d, objId, name, ds }; n++;
      // bucket by quantised normal (direction kept) and offset; neighbours in offset are checked too
      const key = nn.map((q) => Math.round(q * 50)).join(',');
      const bk = Math.floor(d / tol); for (const k of [bk - 1, bk, bk + 1]) { const kk = key + '|' + k; if (k === bk) (buckets.get(kk) || buckets.set(kk, []).get(kk)).push(T); }
      T.key = key; T.bk = bk; tris.push(T);
    }
  };
  let id = 0;
  api.scene.updateMatrixWorld(true);
  api.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.isSkinnedMesh) return; let vis = o.visible; o.traverseAncestors((q) => { if (!q.visible) vis = false; }); if (!vis) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material]; if (mats.every((m) => (m.transparent && !m.depthWrite) || m.colorWrite === false)) return; // skip see-through and the invisible shadow proxy if (mats.some((m) => m.depthFunc !== THREE.LessEqualDepth)) return;
    const ds = mats.some((m) => m.side === THREE.DoubleSide); let name = o.name || o.geometry.type; o.traverseAncestors((q) => { if (q.userData && q.userData.model) name = q.userData.model; });
    if (o.userData && o.userData.model) name = o.userData.model;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, IM); M.multiplyMatrices(o.matrixWorld, IM); add(o.geometry, M, 'i' + (id++), name + '#inst', ds); } }
    else { const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); add(o.geometry, o.matrixWorld, 'o' + (id++), name + '@' + wp.toArray().map((x) => x.toFixed(1)).join(','), ds); }
  });
  const ov = (a, b) => { for (const tt of [a, b]) for (let i = 0; i < 3; i++) { const P = tt[i], Q = tt[(i + 1) % 3]; let ax = -(Q[1] - P[1]), ay = Q[0] - P[0]; const l = Math.hypot(ax, ay); if (l < 1e-9) continue; ax /= l; ay /= l;
    const A = a.map((q) => q[0] * ax + q[1] * ay), B = b.map((q) => q[0] * ax + q[1] * ay); if (Math.max(...A) <= Math.min(...B) + 2e-3 || Math.max(...B) <= Math.min(...A) + 2e-3) return false; } return true; };
  for (const A of tris) for (const k of [A.bk - 1, A.bk, A.bk + 1]) {
    const list = buckets.get(A.key + '|' + k); if (!list) continue;
    for (const B of list) {
      if (B === A || B.objId === A.objId || B.objId < A.objId) continue; if (Math.abs(A.d - B.d) > tol) continue;
      const nn = A.n, ax = Math.abs(nn[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]; let e1 = [nn[1] * ax[2] - nn[2] * ax[1], nn[2] * ax[0] - nn[0] * ax[2], nn[0] * ax[1] - nn[1] * ax[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((q) => q / l1);
      const e2 = [nn[1] * e1[2] - nn[2] * e1[1], nn[2] * e1[0] - nn[0] * e1[2], nn[0] * e1[1] - nn[1] * e1[0]], pr = (T) => T.p.map((q) => [q[0] * e1[0] + q[1] * e1[1] + q[2] * e1[2], q[0] * e2[0] + q[1] * e2[1] + q[2] * e2[2]]);
      if (!ov(pr(A), pr(B))) continue;
      const key = [A.name, B.name].sort().join(' / '); const h = hits.get(key) || { n: 0, at: A.p[0].map((q) => +q.toFixed(2)), gap: +Math.abs(A.d - B.d).toFixed(4) }; h.n++; hits.set(key, h);
    }
  }
  // opposite-facing coincident faces only fight when one side is double-sided
  return { tris: n, pairs: [...hits.entries()].map(([k, h]) => ({ objects: k, ...h })).sort((a, b) => b.n - a.n) };
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
