// Fuel Shift - GitHub Game Off 2026 (theme: SHIFT). One day at a 24/7 gas station: three work shifts and a 5-speed gearbox
// that sets the pace (more customers and higher prices in higher gears, less patience). Code: MIT. 3D props: Vuena Simulator
// Kits Sampler (CC0). Written with AI assistance (Claude).
import * as THREE from 'three';
import { Models } from './models.js';
import { buildWorld, PUMP_X, SHELF_X, SPOTS, QUEUE, shelfSpot, pumpSpot, baySpot, lyingTyre } from './world.js';
import { makePerson, makeCar } from './actors.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || Q.has('touch');
const store = { get(k, d) { try { const v = localStorage.getItem('fuelshift.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fuelshift.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const groundY = (z) => ((z > 8.5 && z < 9.9) || (z > 14.2 && z < 15.4) ? 0.12 : 0); // sidewalk kerbs

// ---------------------------------------------------------------- tuning
const SHIFT_LEN = +Q.get('shiftlen') || 240;          // seconds of play per work shift
const SHIFTS = [
  { name: 'MORNING SHIFT', pay: 1, car: 0.68, rate: 1.0, shop: 0.35, wants: { coffee: 3, cereal: 2, soda: 1, oil: 0.4 }, jerry: 0.22, tyre: 0.1, truck: 0.08 },
  { name: 'EVENING SHIFT', pay: 1.3, car: 0.5, rate: 0.88, shop: 0.5, wants: { soda: 3, cereal: 2, coffee: 1, oil: 1 }, jerry: 0.25, tyre: 0.15, truck: 0.12 },
  { name: 'NIGHT SHIFT', pay: 1.6, car: 0.66, rate: 1.05, shop: 0.32, wants: { coffee: 2.5, oil: 2, soda: 1.5, cereal: 0.4 }, jerry: 0.38, tyre: 0.4, truck: 0.45 },
];
const GEAR = { spawn: [7.2, 5.4, 4.1, 3.2, 2.55], price: [1, 1.35, 1.75, 2.2, 2.75], patience: [1.3, 1.08, 0.92, 0.8, 0.7], drive: [1, 1.1, 1.22, 1.35, 1.5] };
const PRICE = { fuel: 12, soda: 4, cereal: 6, coffee: 5, oil: 15, jerry: 18, tyre: 40 };
const PAD_DEFS = [
  { id: 'pump1', label: 'Pump 2', cost: 60, req: 0, at: () => pumpSpot(1) },
  { id: 'cereal', label: 'Cereal shelf', cost: 90, req: 0, at: () => shelfSpot('cereal') },
  { id: 'coffee', label: 'Coffee corner', cost: 160, req: 1, at: () => SPOTS.coffee },
  { id: 'jerry', label: 'Jerry can rack', cost: 220, req: 2, at: () => SPOTS.jerry },
  { id: 'pump2', label: 'Pump 3', cost: 320, req: 3, at: () => pumpSpot(2) },
  { id: 'oil', label: 'Motor oil shelf', cost: 380, req: 3, at: () => shelfSpot('oil') },
  { id: 'tyre', label: 'Tyre service', cost: 520, req: 4, at: () => SPOTS.tyre },
  { id: 'pump3', label: 'Pump 4', cost: 900, req: 5, at: () => pumpSpot(3) },
];
const UPG = [
  { id: 'speed', name: 'Sneakers', ic: '&#128095;', desc: (l) => `Walk speed ${[4.4, 5.1, 5.8, 6.5][l]} m/s`, cost: [70, 220, 520], vals: [4.4, 5.1, 5.8, 6.5] },
  { id: 'carry', name: 'Strong arms', ic: '&#128170;', desc: (l) => `Carry ${[3, 5, 7, 10][l]} items`, cost: [60, 200, 480], vals: [3, 5, 7, 10] },
  { id: 'pump', name: 'Turbo nozzles', ic: '&#9981;', desc: (l) => `Fill-up ${[3.2, 2.4, 1.7, 1.2][l]} s`, cost: [80, 260, 600], vals: [3.2, 2.4, 1.7, 1.2] },
  { id: 'scan', name: 'Barcode scanner', ic: '&#128722;', desc: (l) => `Checkout ${[0.55, 0.4, 0.28, 0.2][l]} s per item`, cost: [70, 240, 560], vals: [0.55, 0.4, 0.28, 0.2] },
  { id: 'stocker', name: 'Hire a stocker', ic: '&#128230;', desc: () => 'Keeps the shelves filled', cost: [300], vals: [0, 1], staff: true },
  { id: 'cashier', name: 'Hire a cashier', ic: '&#128181;', desc: () => 'Works the till (slower than you)', cost: [380], vals: [0, 1], staff: true },
  { id: 'attendant', name: 'Hire a pump attendant', ic: '&#128663;', desc: () => 'Fills up waiting cars', cost: [480], vals: [0, 1], staff: true },
];
const PERKS = [
  { id: 'tips', ic: '&#128176;', name: 'Big tippers', desc: 'Tips are doubled for the rest of the day.' },
  { id: 'zen', ic: '&#129496;', name: 'Zen customers', desc: 'Everyone waits 25% longer.' },
  { id: 'fuelp', ic: '&#9981;', name: 'Premium fuel', desc: 'Fuel sells for 25% more.' },
  { id: 'shopp', ic: '&#127991;', name: 'Snack markup', desc: 'Shop items sell for 25% more.' },
  { id: 'arms', ic: '&#128170;', name: 'Protein bar', desc: 'Carry 3 more items.' },
  { id: 'legs', ic: '&#9749;', name: 'Double espresso', desc: 'Walk 15% faster.' },
  { id: 'rep', ic: '&#11088;', name: 'Five-star review', desc: 'Reputation +1.5 stars now.' },
  { id: 'cash', ic: '&#128181;', name: 'Owner bonus', desc: 'Cash bonus right now.' },
];
const RANKS = [[0, 'Trainee'], [1200, 'Pump Jockey'], [2600, 'Shift Lead'], [4500, 'Night Manager'], [7000, 'Station Legend']];
const ICON = {
  fuel: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="10" height="18" rx="2" fill="#ff7a1a"/><rect x="6" y="5" width="6" height="5" fill="#14213d"/><path d="M14 8h2a2 2 0 0 1 2 2v7a1.5 1.5 0 0 0 3 0V9l-2-3" stroke="#14213d" stroke-width="1.8" fill="none"/></svg>',
  jerry: '<svg viewBox="0 0 24 24"><path d="M6 6h9l4 4v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="#d62828"/><rect x="8" y="3" width="5" height="3" rx="1" fill="#d62828"/><path d="M8 11l7 7M15 11l-7 7" stroke="#8b0000" stroke-width="1.5"/></svg>',
  tyre: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#222"/><circle cx="12" cy="12" r="4" fill="#9aa"/><circle cx="12" cy="12" r="1.6" fill="#444"/></svg>',
  soda: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="3" fill="#ff7a1a"/><rect x="7" y="9" width="10" height="5" fill="#fff4e0"/><rect x="9" y="2" width="6" height="2" rx="1" fill="#999"/></svg>',
  cereal: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1" fill="#2a9d55"/><rect x="5" y="3" width="14" height="5" fill="#ffd23f"/><circle cx="12" cy="14" r="3.5" fill="#ffd23f"/></svg>',
  coffee: '<svg viewBox="0 0 24 24"><path d="M5 8h11v7a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#e07a3f"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" stroke="#e07a3f" stroke-width="2" fill="none"/><path d="M8 2c0 2 2 2 2 4M12 2c0 2 2 2 2 4" stroke="#bbb" stroke-width="1.5" fill="none"/></svg>',
  oil: '<svg viewBox="0 0 24 24"><rect x="5" y="6" width="14" height="15" rx="2" fill="#111"/><rect x="8" y="3" width="5" height="4" fill="#111"/><rect x="5" y="11" width="14" height="5" fill="#ffd23f"/></svg>',
  pay: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd23f"/><text x="12" y="17" font-size="13" font-weight="900" text-anchor="middle" fill="#8a5a00" font-family="Arial">$</text></svg>',
  mad: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff4d5e"/><path d="M7 9l3 1.5M17 9l-3 1.5" stroke="#400" stroke-width="2"/><path d="M8 17c2-2.5 6-2.5 8 0" stroke="#400" stroke-width="2" fill="none"/></svg>',
};

// ---------------------------------------------------------------- boot
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let pixelRatio = Math.min(devicePixelRatio || 1, TOUCH ? 1.75 : 2); renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8ecae6); scene.fog = new THREE.Fog(0x8ecae6, 45, 110);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 200);
const audio = new Audio(); audio.muted = store.get('muted', false);
const models = new Models();
let W; // world
const G = { state: 'loading', cash: 0, earned: 0, served: 0, lost: 0, rep: 4, gear: 1, shift: 0, shiftT: 0, perks: new Set(), lvl: { speed: 0, carry: 0, pump: 0, scan: 0, stocker: 0, cashier: 0, attendant: 0 },
  unlocked: new Set(['pump0', 'soda']), bought: 0, timeScale: +Q.get('speed') || 1, tut: 0, tutT: 0, shiftStats: { earned: 0, served: 0, lost: 0 }, idleT: 0, spawnT: 2, ambT: 3, best: store.get('best', 0), lastBad: -99, t: 0, fps: 60 };
const ENT = { cars: [], people: [], staff: [], pops: [] };
let player, stations, zones = [], pads = [];

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  camera.aspect = w / h; camera.fov = w < h ? 38 : 30; camera.updateProjectionMatrix(); if (input) input.layout();
}
addEventListener('resize', resize);

let input;
async function boot() {
  await models.load((p) => { $('loadBar').style.width = Math.round(p * 92) + '%'; });
  W = buildWorld(scene, models);
  stations = W.stations;
  for (const id of ['soda', 'cereal', 'oil', 'coffee']) {
    const st = stations[id]; st.inst = models.instancer(st.model, st.slots.length); scene.add(st.inst.group);
    const order = st.slots.map((s, i) => i);
    if (id !== 'coffee' && !st.ordered) { const cx = SHELF_X[id]; order.sort((a, b) => (st.slots[a].z < st.slots[b].z) - (st.slots[b].z < st.slots[a].z) || Math.abs(st.slots[a].x - cx) - Math.abs(st.slots[b].x - cx) || st.slots[b].y - st.slots[a].y); }
    st.order = order.slice(0, st.cap); const m = new THREE.Matrix4(), qq = new THREE.Quaternion();
    st.order.forEach((si, k) => { const s = st.slots[si]; qq.setFromEuler(new THREE.Euler(0, (Math.random() - 0.5) * 0.12, 0)); m.compose(new THREE.Vector3(s.x, s.y, s.z), qq, new THREE.Vector3(1, 1, 1)); st.inst.set(k, m); });
    st.stock = id === 'soda' ? 5 : 0; st.inst.count = st.stock; st.perCarton = Math.ceil(st.cap / 4);
  }
  buildNav(); buildZones();
  // static world: freeze local matrices below the top-level groups (top-level groups stay live for the pop-in animation)
  scene.updateMatrixWorld(true); for (const top of scene.children) top.traverse((o) => { if (o !== top) { o.matrixAutoUpdate = false; } });
  renderer.shadowMap.autoUpdate = false; // refreshed every second frame in loop()
  for (const z of [...zones, ...pads]) z.fill.matrixAutoUpdate = true; // progress discs animate by scale
  player = makePerson(models, 'player'); player.position.set(6, 0, 5.6); player.rotation.y = Math.PI; scene.add(player);
  player.userData.carry = []; player.userData.carryType = null; player.userData.carryObjs = [];
  input = new Input(canvas, { onGear: (d) => shiftGear(d), onAny: () => audio.unlock(), isTouch: TOUCH });
  input.setEnabled(false);
  resize(); applyUnlocks(); setDayLight(0); updateHud(true);
  $('loadBar').style.width = '100%';
  setupUi();
  G.state = 'title'; showTitle();
  requestAnimationFrame(loop);
  $('loader').classList.add('hidden');
  window.__fs.ready = true;
  if (Q.has('bot')) import('./qa.js').then((m) => m.startBot(api));
  if (Q.has('qa')) import('./qa.js').then((m) => { window.__fs.qa = m; });
}

// ---------------------------------------------------------------- navigation grid (A*) for customers, staff and the QA bot
const NAV = { x0: -12, z0: -14.5, cs: 0.5, nx: 78, nz: 62 };
let navBlocked, navDyn;
function activeColliders() { return W.colliders.filter((c) => !c.unlock || G.unlocked.has(c.unlock)); }
function buildNav() {
  navBlocked = new Uint8Array(NAV.nx * NAV.nz); navDyn = navDyn || new Uint8Array(NAV.nx * NAV.nz); const inf = 0.34;
  for (const c of activeColliders()) {
    for (let ix = 0; ix < NAV.nx; ix++) for (let iz = 0; iz < NAV.nz; iz++) {
      const x = NAV.x0 + (ix + 0.5) * NAV.cs, z = NAV.z0 + (iz + 0.5) * NAV.cs;
      if (x > c.x0 - inf && x < c.x1 + inf && z > c.z0 - inf && z < c.z1 + inf) navBlocked[iz * NAV.nx + ix] = 1;
    }
  }
}
// parked cars block paths too (re-marked whenever a car parks or leaves its bay)
function markCars() {
  navDyn.fill(0); const inf = 0.3;
  for (const c of ENT.cars) { if (c.ambient || !(c.state === 'wait' || c.state === 'park')) continue; const b = baySpot(c.pump), hl = c.mesh.userData.len / 2;
    const hw = c.mesh.userData.width / 2; const [ix0, iz0] = cellOf(b.x - hw - inf, b.z - hl - inf), [ix1, iz1] = cellOf(b.x + hw + inf, b.z + hl + inf);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) navDyn[iz * NAV.nx + ix] = 1; }
}
const blockedAt = (i) => navBlocked[i] || navDyn[i];
const cellOf = (x, z) => [clamp(Math.floor((x - NAV.x0) / NAV.cs), 0, NAV.nx - 1), clamp(Math.floor((z - NAV.z0) / NAV.cs), 0, NAV.nz - 1)];
function freeLine(a, b) { const d = dist(a, b), n = Math.ceil(d / 0.2); for (let i = 1; i < n; i++) { const t = i / n; const [ix, iz] = cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (blockedAt(iz * NAV.nx + ix)) return false; } return true; }
function findPath(from, to) {
  if (freeLine(from, to)) return [{ x: to.x, z: to.z }];
  const [sx, sz] = cellOf(from.x, from.z), [tx, tz] = cellOf(to.x, to.z), N = NAV.nx, idx = (x, z) => z * N + x;
  const gS = new Float32Array(NAV.nx * NAV.nz).fill(1e9), came = new Int32Array(NAV.nx * NAV.nz).fill(-1), closed = new Uint8Array(NAV.nx * NAV.nz);
  const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return dx + dz - 0.586 * Math.min(dx, dz); };
  const s = idx(sx, sz), t = idx(tx, tz); gS[s] = 0; push(s, h(sx, sz)); let found = false, it = 0;
  while (heap.length && it++ < 6000) {
    const [, i] = pop(); if (closed[i]) continue; closed[i] = 1; if (i === t) { found = true; break; }
    const x = i % N, z = (i / N) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= NAV.nz) continue;
      const j = idx(nx, nz); if (closed[j] || (blockedAt(j) && j !== t)) continue;
      if (dx && dz && (blockedAt(idx(x + dx, z)) || blockedAt(idx(x, z + dz)))) continue;
      const g2 = gS[i] + (dx && dz ? 1.414 : 1); if (g2 < gS[j]) { gS[j] = g2; came[j] = i; push(j, g2 + h(nx, nz)); }
    }
  }
  if (!found) return [{ x: to.x, z: to.z }];
  const cells = []; for (let i = t; i !== -1 && i !== s; i = came[i]) cells.push(i); cells.reverse();
  const pts = cells.map((i) => ({ x: NAV.x0 + ((i % N) + 0.5) * NAV.cs, z: NAV.z0 + (((i / N) | 0) + 0.5) * NAV.cs })); pts[pts.length - 1] = { x: to.x, z: to.z };
  const out = []; let cur = from; // string pulling
  for (let k = 0; k < pts.length; k++) { if (k === pts.length - 1 || !freeLine(cur, pts[k + 1])) { out.push(pts[k]); cur = pts[k]; } }
  return out;
}

// ---------------------------------------------------------------- zones (rings on the ground) + pads
const ringGeo = new THREE.RingGeometry(0.62, 0.76, 40), fillGeo = new THREE.CircleGeometry(0.6, 36), padGeo = new THREE.RingGeometry(0.66, 0.8, 4, 1);
const ZCOL = { pump: 0x18c6b3, till: 0x3ddc84, pallet: 0xffb347, shelf: 0xffb347, coffee: 0xffb347, jerry: 0xff4d5e, tyre: 0xb0b8c8, pad: 0xffd23f };
function zoneMesh(kind, x, z, isPad) {
  const g = new THREE.Group(); g.position.set(x, 0.03, z);
  const ring = new THREE.Mesh(isPad ? padGeo : ringGeo, new THREE.MeshBasicMaterial({ color: ZCOL[kind], transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; if (isPad) ring.rotation.z = Math.PI / 4; g.add(ring);
  const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: ZCOL[kind], transparent: true, opacity: 0.45, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(0.001); g.add(fill);
  if (isPad) { const base = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0x14213d, transparent: true, opacity: 0.45, depthWrite: false })); base.rotation.x = -Math.PI / 2; base.position.y = -0.005; g.add(base); }
  g.renderOrder = 1; scene.add(g); return { g, ring, fill };
}
function buildZones() {
  const add = (o) => { const m = zoneMesh(o.kind, o.x, o.z, false); zones.push(Object.assign(o, m, { r: 0.85, prog: 0, t: 0 })); };
  PUMP_X.forEach((px, i) => add({ kind: 'pump', id: 'pump' + i, i, ...pumpSpot(i), need: 'pump' + i }));
  add({ kind: 'till', id: 'till', ...SPOTS.till });
  add({ kind: 'pallet', id: 'pallet', ...SPOTS.pallet });
  for (const id of ['soda', 'cereal', 'oil']) add({ kind: 'shelf', id, st: id, ...shelfSpot(id), need: id });
  add({ kind: 'coffee', id: 'coffee', st: 'coffee', ...SPOTS.coffee, need: 'coffee' });
  add({ kind: 'jerry', id: 'jerrysrc', ...SPOTS.jerry, need: 'jerry' });
  add({ kind: 'tyre', id: 'tyresrc', ...SPOTS.tyre, need: 'tyre' });
  for (const d of PAD_DEFS) { const at = d.at(); const m = zoneMesh('pad', at.x, at.z, true); pads.push(Object.assign({ ...d, kind: 'pad', x: at.x, z: at.z, paid: 0, r: 0.85 }, m)); }
}
const zoneActive = (z) => !z.need || G.unlocked.has(z.need);
function applyUnlocks() {
  W.pumps.forEach((p) => { p.group.visible = G.unlocked.has('pump' + p.i); });
  for (const id of ['cereal', 'oil', 'coffee']) { stations[id].group.visible = true; stations[id].inst.group.visible = G.unlocked.has(id); } // the furniture is always there; the pad sells the stock
  W.unlockables.jerry.visible = G.unlocked.has('jerry'); W.unlockables.tyre.visible = G.unlocked.has('tyre');
  for (const z of zones) z.g.visible = zoneActive(z);
  for (const p of pads) p.g.visible = padVisible(p);
  buildNav();
}
const padVisible = (p) => !G.unlocked.has(p.id) && G.bought >= p.req && G.tut >= 6;

// ---------------------------------------------------------------- economy helpers
const gi = () => G.gear - 1;
const stat = (id) => { const u = UPG.find((x) => x.id === id); return u.vals[G.lvl[id]]; };
const speedOf = () => stat('speed') * (G.perks.has('legs') ? 1.15 : 1);
const carryCap = () => stat('carry') + (G.perks.has('arms') ? 3 : 0);
const patienceMul = () => GEAR.patience[gi()] * (G.perks.has('zen') ? 1.25 : 1);
function priceOf(item) { let p = PRICE[item] * GEAR.price[gi()] * SHIFTS[G.shift].pay; if (item === 'fuel' && G.perks.has('fuelp')) p *= 1.25; if (item !== 'fuel' && item !== 'jerry' && item !== 'tyre' && G.perks.has('shopp')) p *= 1.25; return Math.round(p); }
function earn(amount, where, tipFrac = 0) {
  if (amount <= 0) return; let tip = 0;
  if (tipFrac > 0) tip = Math.round(amount * 0.2 * tipFrac * (G.rep / 5) * (G.perks.has('tips') ? 2 : 1));
  G.cash += amount + tip; G.earned += amount + tip; G.shiftStats.earned += amount + tip;
  pop('+$' + amount, where, ''); if (tip > 0) setTimeout(() => pop('tip +$' + tip, where, 'tip', 0.6), 200);
  audio.cash(amount); $('cash').classList.remove('bump'); void $('cash').offsetWidth; $('cash').classList.add('bump');
}
function served(where) { G.served++; G.shiftStats.served++; G.rep = Math.min(5, G.rep + 0.07); }
function angry(where, what) {
  G.lost++; G.shiftStats.lost++; G.rep = Math.max(0, G.rep - 0.38); G.lastBad = G.t; pop('walked out!', where, 'bad'); audio.bad();
  if (G.rep < 1.6) toast('Reputation is crashing: shift DOWN a gear!', 'bad');
  if (G.rep <= 0.001 && G.state === 'play') endDay(true);
}

// ---------------------------------------------------------------- carrying
// carried stack: shown 2x (cartons) / 1.4x (jerry cans, two per layer) / 1.25x (tyres) in front of the character, so it reads from the
// top-down camera even behind the big blocky heads. Shared by the player and the staff.
const CARRY = { carton: { m: 'sk_carton_s', s: 2.0, h: 0.17, per: 1 }, jerry: { m: 'gs_jerry_can', s: 1.4, h: 0.472, per: 2 }, tyre: { m: 'gs_tire', s: 1.25, h: 0.206, per: 1 } };
function buildCarry(hold, objs, type, n) {
  if (objs.type !== type) { while (objs.length) hold.remove(objs.pop()); objs.type = type; } // a different item: rebuild the stack
  while (objs.length > n) hold.remove(objs.pop());
  while (objs.length < n) {
    const k = objs.length, c = CARRY[type], layer = Math.floor(k / c.per), y = layer * c.h * c.s; let o;
    if (type === 'tyre') { o = lyingTyre(models.clone('gs_tire'), 0, y, 0, k); o.scale.setScalar(c.s); }
    else { o = models.clone(c.m); o.scale.setScalar(c.s); o.position.set(c.per > 1 ? (k % 2 ? 0.24 : -0.24) : 0, y, 0); o.rotation.y = (Math.random() - 0.5) * 0.2; }
    hold.add(o); objs.push(o);
  }
}
function setCarry(type, n) {
  const u = player.userData; u.carryType = n ? type : null; buildCarry(u.hold, u.carryObjs, type, n);
  u.carry.length = n; for (let i = 0; i < n; i++) u.carry[i] = type;
  const el = $('carry'); el.style.display = n ? 'block' : 'none'; el.textContent = n ? `Carrying ${n} ${type === 'carton' ? 'carton' : type === 'jerry' ? 'jerry can' : 'tyre'}${n > 1 ? 's' : ''} (max ${type === 'tyre' ? Math.max(1, Math.floor(carryCap() / 2)) : carryCap()})` : '';
}
const carryCount = () => player.userData.carry.length;
const capFor = (type) => (type === 'tyre' ? Math.max(1, Math.floor(carryCap() / 2)) : carryCap());

// ---------------------------------------------------------------- spawning
function freePump() { const free = PUMP_X.map((x, i) => i).filter((i) => G.unlocked.has('pump' + i) && !ENT.cars.some((c) => c.pump === i)); return free.length ? free[(Math.random() * free.length) | 0] : -1; }
function spawnCar(opts = {}) {
  const i = opts.pump ?? freePump(); if (i < 0) return null; const S = SHIFTS[G.shift];
  const truck = opts.truck ?? Math.random() < S.truck; const mesh = makeCar(models, truck); scene.add(mesh);
  const b = baySpot(i); const startX = opts.near ? -14 : -38 - Math.random() * 6;
  const car = { mesh, pump: i, state: 'in', path: [{ x: b.x - 5, z: 11.3 }, { x: b.x, z: 8.4 }, { x: b.x, z: b.z }], pos: { x: startX, z: 11.3 }, yaw: Math.PI / 2, speed: 9,
    needs: { fuel: true, jerry: !opts.simple && G.unlocked.has('jerry') && Math.random() < S.jerry, tyre: !opts.simple && G.unlocked.has('tyre') && Math.random() < S.tyre * (truck ? 1.6 : 0.6) }, fuelP: 0, pat: 0, patMax: 34, shop: !opts.simple && Math.random() < S.shop, driver: null, mad: false };
  car.patMax = (truck ? 40 : 34) * patienceMul(); car.pat = car.patMax;
  mesh.position.set(car.pos.x, 0, car.pos.z); mesh.rotation.y = car.yaw; ENT.cars.push(car); return car;
}
function spawnAmbient() { const mesh = makeCar(models, Math.random() < 0.25); scene.add(mesh); const car = { mesh, ambient: true, state: 'out', path: [{ x: 70, z: 12.7 }], pos: { x: -70, z: 12.7 }, yaw: Math.PI / 2, speed: 10 + Math.random() * 4 }; mesh.position.set(-70, 0, 12.7); mesh.rotation.y = Math.PI / 2; ENT.cars.push(car); }
function pickWants(n) {
  const S = SHIFTS[G.shift], opts = Object.entries(S.wants).filter(([k]) => G.unlocked.has(k)); const out = [];
  for (let k = 0; k < n && opts.length; k++) { const tot = opts.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot; let pick = opts[0][0]; for (const [id, w] of opts) { r -= w; if (r <= 0) { pick = id; break; } } if (!out.includes(pick)) out.push(pick); }
  return out;
}
function spawnCustomer(from, car, wants) {
  const mesh = makePerson(models, 'customer', { night: G.shift === 2 }); scene.add(mesh); mesh.position.set(from.x, 0, from.z);
  const c = { mesh, pos: { ...from }, state: 'toDoor', wants: wants || pickWants(1 + (Math.random() < 0.45) + (Math.random() < 0.15)), basket: [], car, home: from, pat: 0, patMax: 30 * patienceMul(), path: null, speed: rnd(2.0, 2.5), wait: 0, item: null };
  if (!c.wants.length) { scene.remove(mesh); return null; }
  goTo(c, SPOTS.doorOut); ENT.people.push(c); return c;
}
function goTo(e, p) { e.target = { x: p.x, z: p.z }; e.path = findPath(e.pos, p); }

// ---------------------------------------------------------------- shift + gear
function shiftGear(d) {
  if (G.state !== 'play') return; const g = clamp(G.gear + d, 1, 5); if (g === G.gear) { audio.ui(); return; }
  G.gear = g; audio.setGear(g); const k = $('knob'); k.classList.remove('flash'); void k.offsetWidth; k.classList.add('flash');
  k.className = 'knob flash g' + g; $('gearN').textContent = g; W.drawPylon(priceOf('fuel'), g);
  toast(d > 0 ? `GEAR ${g}: busier, pricier, less patient` : `GEAR ${g}: calmer`, d > 0 ? '' : 'good');
  if (G.tut === 5 && g >= 2) tutNext();
  updateHud(true);
}
function startDay() {
  Object.assign(G, { checkouts: 0, cash: 0, earned: 0, served: 0, lost: 0, rep: 4, gear: 1, shift: 0, shiftT: 0, bought: 0, perks: new Set(), spawnT: 2, t: 0, lastBad: -99, shiftStats: { earned: 0, served: 0, lost: 0 } });
  for (const k in G.lvl) G.lvl[k] = 0; G.unlocked = new Set(['pump0', 'soda']);
  for (const c of ENT.cars) scene.remove(c.mesh); for (const p of ENT.people) scene.remove(p.mesh); for (const s of ENT.staff) scene.remove(s.mesh);
  ENT.cars.length = ENT.people.length = ENT.staff.length = 0; for (const p of pads) p.paid = 0; markCars();
  for (const id of ['soda', 'cereal', 'oil', 'coffee']) { stations[id].stock = id === 'soda' ? 5 : 0; stations[id].inst.count = stations[id].stock; }
  player.position.set(6, 0, 5.6); setCarry(null, 0);
  G.tut = store.get('tutDone', false) && !Q.has('tut') ? 6 : 0; G.tutT = 0;
  if (G.tut === 0) { const c = spawnCar({ pump: 0, simple: true, near: true }); c.shop = true; c.wants = ['soda']; }
  G.state = 'play'; audio.unlock(); audio.start(); audio.setGear(1, true); $('knob').className = 'knob'; $('gearN').textContent = '1';
  applyUnlocks(); W.drawPylon(priceOf('fuel'), 1); setDayLight(0);
  ['title'].forEach((id) => $(id).classList.add('hidden')); $('hud').classList.remove('hidden'); $('jamTag').classList.add('hidden');
  input.setEnabled(true); updateHud(true); tutShow();
}
function endShift() {
  G.state = 'card'; input.setEnabled(false); audio.shiftEnd();
  const S = SHIFTS[G.shift]; $('scTitle').textContent = S.name.charAt(0) + S.name.slice(1).toLowerCase().replace(' shift', '') + ' shift done';
  $('scEarn').textContent = '$' + G.shiftStats.earned; $('scServed').textContent = G.shiftStats.served; $('scLost').textContent = G.shiftStats.lost;
  $('scKicker').textContent = `SHIFT CHANGE · ${G.shift === 0 ? '14:00' : '22:00'}`;
  $('scText').textContent = G.shift === 0 ? 'Evening rates: everything sells for 30% more. The evening crowd wants snacks and soda.' : 'Night rates: everything sells for 60% more. Fewer people, but truckers want tyres, oil and jerry cans, and they hate waiting.';
  const pool = PERKS.filter((p) => !G.perks.has(p.id) || p.id === 'cash' || p.id === 'rep').sort(() => Math.random() - 0.5).slice(0, 3);
  const box = $('perks'); box.innerHTML = '';
  for (const p of pool) {
    const b = document.createElement('button'); b.className = 'perk'; b.dataset.perk = p.id;
    const desc = p.id === 'cash' ? `+$${150 * (G.shift + 1)} right now.` : p.desc;
    b.innerHTML = `<span class="ic">${p.ic}</span><span><b>${p.name}</b><small>${desc}</small></span>`;
    b.onclick = () => { audio.ui(); takePerk(p.id); };
    box.appendChild(b);
  }
  $('shiftcard').classList.remove('hidden');
}
function takePerk(id) {
  if (id === 'cash') { const v = 150 * (G.shift + 1); G.cash += v; G.earned += v; }
  else if (id === 'rep') G.rep = Math.min(5, G.rep + 1.5); else G.perks.add(id);
  $('shiftcard').classList.add('hidden'); G.shift++; G.shiftT = 0; G.shiftStats = { earned: 0, served: 0, lost: 0 }; G.state = 'play'; input.setEnabled(true);
  toast(SHIFTS[G.shift].name + ' starts!', 'good'); audio.bell(); updateHud(true); W.drawPylon(priceOf('fuel'), G.gear);
}
function endDay(fired) {
  G.state = 'end'; input.setEnabled(false); audio.shiftEnd();
  const bonus = fired ? 0 : Math.round(G.rep * 120); const score = G.earned + bonus; const best = Math.max(G.best, score); const isBest = score > G.best && score > 0; G.best = best; store.set('best', best);
  const rank = RANKS.filter((r) => score >= r[0]).pop()[1];
  $('endKicker').textContent = fired ? 'SENT HOME EARLY' : '06:00 · DAY COMPLETE';
  $('endTitle').textContent = fired ? 'The stars hit zero. The owner took your keys.' : 'You survived all three shifts!';
  $('endScore').textContent = '$' + score.toLocaleString('en-US'); $('endRank').textContent = rank;
  $('endLine').textContent = `Earned $${G.earned.toLocaleString('en-US')} + star bonus $${bonus}. ${G.served} customers served, ${G.lost} walked out, ${G.rep.toFixed(1)} stars, top gear used: ${G.topGear || G.gear}.`;
  $('endBest').textContent = isBest ? 'New personal best!' : `Personal best: $${best.toLocaleString('en-US')}`;
  $('end').classList.remove('hidden'); $('hud').classList.add('hidden');
}

// ---------------------------------------------------------------- tutorial
const TUT = [
  { t: 'A car pulled in! Walk to the teal ring at the pump.', touch: 'Drag here to walk to the teal ring at the pump.', at: () => pumpSpot(0) },
  { t: 'Stand in the ring to fill her up.', at: () => pumpSpot(0) },
  { t: 'A customer is shopping. Get behind the counter: green ring.', at: () => SPOTS.till },
  { t: 'Shelves run dry. Grab cartons at the stock pallet (side door).', at: () => SPOTS.pallet },
  { t: 'Carry the cartons to the soda shelf.', at: () => shelfSpot('soda') },
  { t: 'SHIFT UP! A higher gear brings more customers and higher prices.', gear: true },
];
function tutShow() {
  const h = $('hint'), f = $('fingerHint'), gp = $('gearPoint');
  if (G.tut >= TUT.length || G.state !== 'play') { h.style.display = 'none'; f.style.display = 'none'; gp.style.display = 'none'; return; }
  const s = TUT[G.tut]; h.style.display = 'block'; h.textContent = (TOUCH && s.touch) || s.t;
  h.className = 'chip' + (s.gear ? ' gear' : TOUCH && G.tut === 0 ? ' touch' : '');
  if (TOUCH && G.tut === 0) { const hm = input.home; f.style.display = 'block'; f.style.left = hm.x + 'px'; f.style.top = hm.y + 'px'; } else f.style.display = 'none';
  if (s.gear) { const r = $('gUp').getBoundingClientRect(); gp.style.display = 'block'; gp.style.left = r.left + r.width / 2 - 12 + 'px'; gp.style.top = r.top - 46 + 'px'; } else gp.style.display = 'none';
}
function tutNext() {
  G.tut++; G.tutT = 0; audio.play('select', { vol: 0.5 });
  if (G.tut === 6) { store.set('tutDone', true); applyUnlocks(); toast('Buy stations on the gold pads. Keep the stars up!', 'good'); }
  tutShow();
}
function tutTick(dt) {
  if (G.tut >= TUT.length) return; G.tutT += dt;
  const pz = playerZone();
  if (G.tut === 0 && pz && pz.id === 'pump0') tutNext();
  else if (G.tut === 1 && ENT.cars[0] && !ENT.cars[0].needs.fuel) tutNext();
  else if (G.tut === 2 && G.checkouts >= 1) tutNext();
  else if (G.tut === 3 && player.userData.carryType === 'carton' && (carryCount() >= capFor('carton') || pz?.id !== 'pallet')) { G.tutStock = stations.soda.stock; tutNext(); }
  else if (G.tut === 4 && (stations.soda.stock > G.tutStock && !carryCount() || stations.soda.stock >= stations.soda.cap)) tutNext();
  if (G.tut === 1 && !ENT.cars.some((c) => c.needs && c.needs.fuel) && G.tutT > 1) tutNext();
  if (G.tutT > 45 && G.tut < 5) { G.tut = 5; G.tutT = 0; tutShow(); } // never block a player who ignores the tutorial
}

// ---------------------------------------------------------------- per-frame simulation
const tmpV = new THREE.Vector3();
function playerZone() {
  let best = null, bd = 1e9; const p = { x: player.position.x, z: player.position.z };
  for (const z of zones) { if (!zoneActive(z)) continue; const d = dist(p, z); if (d < z.r && d < bd) { bd = d; best = z; } }
  for (const z of pads) { if (!padVisible(z)) continue; const d = dist(p, z); if (d < z.r && d < bd) { bd = d; best = z; } }
  return best;
}
function movePlayer(dt) {
  const v = input.vec(); const sp = speedOf(); const u = player.userData;
  const mv = Math.hypot(v.x, v.y);
  let x = player.position.x + v.x * sp * dt, z = player.position.z + v.y * sp * dt;
  const R = 0.32;
  const cols = activeColliders(); for (const c of ENT.cars) if (!c.ambient && (c.state === 'wait' || c.state === 'park')) { const b = baySpot(c.pump); const hw = c.mesh.userData.width / 2 + 0.03, hl = c.mesh.userData.len / 2 + 0.05; cols.push({ x0: b.x - hw, x1: b.x + hw, z0: b.z - hl, z1: b.z + hl }); }
  for (let pass = 0; pass < 2; pass++) for (const c of cols) {
    const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1); const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    if (d < R) { if (d > 1e-5) { x = cx + (dx / d) * R; z = cz + (dz / d) * R; } else { const l = x - c.x0, r = c.x1 - x, t = z - c.z0, b = c.z1 - z, m = Math.min(l, r, t, b); if (m === l) x = c.x0 - R; else if (m === r) x = c.x1 + R; else if (m === t) z = c.z0 - R; else z = c.z1 + R; } }
  }
  x = clamp(x, -11, 25); z = clamp(z, -13.6, 15.5);
  const moved = Math.hypot(x - player.position.x, z - player.position.z);
  player.position.x = x; player.position.z = z; player.position.y = groundY(z);
  if (mv > 0.05) { const want = Math.atan2(v.x, v.y); let d = want - player.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); player.rotation.y += d * Math.min(1, dt * 14); }
  u.anim(dt, moved / Math.max(dt, 1e-4), carryCount() > 0);
  if (moved > 0.001) { u.stepD = (u.stepD || 0) + moved; if (u.stepD > 0.75) { u.stepD = 0; audio.step(u.stepN = (u.stepN || 0) + 1); } G.idleT = 0; } else G.idleT += dt;
}
function work(dt) {
  const z = playerZone(); const u = player.userData;
  for (const zz of zones) if (zz !== z) zz.prog = Math.max(0, zz.prog - dt * 2);
  if (!z) return;
  z.t = (z.t || 0) + dt;
  if (z.kind === 'pad') return payPad(z, dt);
  if (z.kind === 'pump') {
    const car = ENT.cars.find((c) => c.pump === z.i && c.state === 'wait');
    if (!car) return;
    if (car.needs.fuel) { car.fuelP += dt / stat('pump') * (G.perks.has('turbo') ? 1.33 : 1); z.prog = car.fuelP; audio.fuel(); if (car.fuelP >= 1) { car.needs.fuel = false; car.fuelP = 0; z.prog = 0; earn(priceOf('fuel'), car.mesh.position, car.pat / car.patMax); audio.play('bong', { vol: 0.3, rate: 1.4 }); } }
    for (const need of ['jerry', 'tyre']) if (car.needs[need] && u.carryType === need && z.t > 0.25) { z.t = 0; car.needs[need] = false; setCarry(need, carryCount() - 1); earn(priceOf(need), car.mesh.position, car.pat / car.patMax); audio.drop(); }
    return;
  }
  if (z.kind === 'till') { checkout(dt, 1 / 1, z); return; }
  if (z.kind === 'pallet') {
    if (u.carryType && u.carryType !== 'carton') { if (z.t > 0.5) { setCarry(null, 0); toast('Put the other items back.', ''); z.t = 0; } return; }
    if (carryCount() < capFor('carton') && z.t > 0.2) { z.t = 0; setCarry('carton', carryCount() + 1); audio.pick(); }
    else if (carryCount() >= capFor('carton') && !u.fullToast) { u.fullToast = true; toast('Arms full! Take them to a shelf.', ''); }
    return;
  }
  u.fullToast = false;
  if (z.kind === 'shelf' || z.kind === 'coffee') {
    const st = stations[z.st];
    if (u.carryType === 'carton' && st.stock < st.cap && z.t > 0.22) { z.t = 0; setCarry('carton', carryCount() - 1); st.stock = Math.min(st.cap, st.stock + st.perCarton); st.inst.count = st.stock; audio.drop(); pop('+' + st.perCarton, { x: z.x, y: 1.6, z: z.z }, 'tip'); }
    else if (!u.carryType && st.stock < st.cap * 0.5 && z.t > 0.8 && !z.told) { z.told = true; toast('Bring cartons from the stock pallet (side door).'); }
    if (z.t < 0.1) z.told = false;
    return;
  }
  if (z.kind === 'jerry' || z.kind === 'tyre') {
    const type = z.kind; if (u.carryType && u.carryType !== type) { if (z.t > 0.5) { setCarry(null, 0); toast('Put the other items back.', ''); z.t = 0; } return; }
    const want = ENT.cars.filter((c) => c.state === 'wait' && c.needs[type]).length;
    if (carryCount() < capFor(type) && z.t > 0.3) { if (!want && carryCount() >= 1) return; z.t = 0; setCarry(type, carryCount() + 1); audio.pick(); }
  }
}
function payPad(p, dt) {
  if (G.cash <= 0) { if (!p.told) { p.told = true; toast(`Need $${p.cost - p.paid} more for ${p.label}.`, 'bad'); } return; }
  p.told = false; const rate = Math.max(40, p.cost * 1.1) * dt; const amt = Math.min(G.cash, p.cost - p.paid, Math.ceil(rate));
  G.cash -= amt; p.paid += amt; p.fill.scale.setScalar(Math.max(0.001, p.paid / p.cost)); if (Math.random() < 0.3) audio.coin(p.paid);
  if (p.paid >= p.cost) {
    G.unlocked.add(p.id); G.bought++; audio.buy(); toast(p.label + ' is open!', 'good'); applyUnlocks();
    const grp = p.id.startsWith('pump') ? W.pumps[+p.id[4]].group : p.id === 'jerry' || p.id === 'tyre' ? W.unlockables[p.id] : stations[p.id].group;
    grp.scale.setScalar(0.01); grp.userData.popT = 0; popIns.push(grp); if (stations[p.id]) { stations[p.id].stock = stations[p.id].cap >> 1; stations[p.id].inst.count = stations[p.id].stock; }
  }
}
const popIns = [];
function checkout(dt, mul, z) {
  const c = ENT.people.find((p) => p.state === 'queue' && p.qi === 0 && dist(p.pos, p.target) < 0.3); if (!c) { if (z) z.prog = 0; return false; }
  const need = 0.35 + c.basket.length * (mul === 1 ? stat('scan') : 0.6);
  c.co = (c.co || 0) + dt / need * mul; if (z) z.prog = Math.min(1, c.co);
  if (c.co >= 1) {
    const total = c.basket.reduce((a, it) => a + priceOf(it), 0); earn(total, { x: c.pos.x, y: 2, z: c.pos.z }, c.pat / c.patMax); G.checkouts = (G.checkouts || 0) + 1; if (!c.car) served(c.pos); audio.play('select', { vol: 0.3, rate: 1.3 });
    c.state = 'leave'; if (c.car) goTo(c, { x: baySpot(c.car.pump).x - 1.25, z: baySpot(c.car.pump).z }); else goTo(c, SPOTS.doorOut); c.co = 0; if (z) z.prog = 0;
    reQueue(); return true;
  }
  return true;
}
function queueSpot(i) { return QUEUE[Math.min(i, QUEUE.length - 1)]; }
function reQueue() { const q = ENT.people.filter((p) => p.state === 'queue').sort((a, b) => a.qi - b.qi); q.forEach((p, i) => { if (p.qi !== i || !p.target) { p.qi = i; goTo(p, queueSpot(i)); } }); }

function moveAlong(e, dt, speed) {
  if (!e.path || !e.path.length) return true;
  const t = e.path[0], dx = t.x - e.pos.x, dz = t.z - e.pos.z, d = Math.hypot(dx, dz), step = speed * dt;
  if (d <= step) { e.pos.x = t.x; e.pos.z = t.z; e.path.shift(); } else { e.pos.x += (dx / d) * step; e.pos.z += (dz / d) * step; e.face = Math.atan2(dx, dz); }
  return !e.path.length;
}
function updatePeople(dt) {
  for (const c of ENT.people.slice()) {
    const prev = { ...c.pos }; const arrived = moveAlong(c, dt, c.speed);
    if (c.state === 'toDoor' && arrived) { c.state = 'shop'; nextWant(c); }
    else if (c.state === 'toStation' && arrived) { c.state = 'atStation'; c.wait = 0; }
    else if (c.state === 'atStation') {
      const st = stations[c.wants[0]]; c.wait += dt;
      if (st.stock > 0 && c.wait > 0.5) { st.stock--; st.inst.count = st.stock; c.basket.push(c.wants.shift()); c.pat = Math.min(c.patMax, c.pat + 6); audio.play('plank', { vol: 0.15, rate: 1.6 }); holdItem(c); nextWant(c); }
      else if (st.stock <= 0) { c.pat -= dt; if (c.pat <= 0) { angry({ x: c.pos.x, y: 2, z: c.pos.z }); c.mad = true; c.state = 'leave'; goTo(c, c.car ? { x: baySpot(c.car.pump).x - 1.25, z: baySpot(c.car.pump).z } : SPOTS.doorOut); } }
    } else if (c.state === 'queue') {
      if (!(c.qi === 0 && dist(c.pos, c.target) < 0.3 && (playerZone()?.id === 'till' || G.lvl.cashier))) c.pat -= dt * 0.8;
      if (c.pat <= 0) { angry({ x: c.pos.x, y: 2, z: c.pos.z }); c.mad = true; c.state = 'leave'; goTo(c, c.car ? { x: baySpot(c.car.pump).x - 1.25, z: baySpot(c.car.pump).z } : SPOTS.doorOut); reQueue(); }
    } else if (c.state === 'leave' && arrived) {
      if (dist(c.pos, SPOTS.doorOut) < 0.4 && !c.car) { c.state = 'exit'; goTo(c, c.home); }
      else if (c.car) { c.car.driverBack = true; c.car.mad = c.car.mad || c.mad; removePerson(c); continue; }
      else { c.state = 'exit'; goTo(c, c.home); }
    } else if (c.state === 'exit' && arrived) { removePerson(c); continue; }
    c.mesh.position.set(c.pos.x, groundY(c.pos.z), c.pos.z);
    if (c.face !== undefined) { let d = c.face - c.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.mesh.rotation.y += d * Math.min(1, dt * 10); }
    c.mesh.userData.anim(dt, Math.hypot(c.pos.x - prev.x, c.pos.z - prev.z) / Math.max(dt, 1e-4), !!c.item);
  }
}
function holdItem(c) {
  if (c.item) c.mesh.userData.hold.remove(c.item);
  const it = c.basket[c.basket.length - 1]; const o = models.clone(stations[it].model); o.position.set(0, -0.05, -0.12); c.mesh.userData.hold.add(o); c.item = o;
}
function nextWant(c) {
  if (c.wants.length) { const id = c.wants[0]; const s = id === 'coffee' ? SPOTS.coffee : shelfSpot(id); c.state = 'toStation'; goTo(c, { x: s.x + rnd(-0.35, 0.35), z: s.z + rnd(-0.1, 0.25) }); c.pat = Math.max(c.pat, c.patMax * 0.75); return; }
  if (!c.basket.length) { c.state = 'leave'; goTo(c, SPOTS.doorOut); return; }
  c.state = 'queue'; c.qi = ENT.people.filter((p) => p.state === 'queue' && p !== c).length; c.pat = c.patMax; goTo(c, queueSpot(c.qi));
}
function removePerson(c) { scene.remove(c.mesh); ENT.people.splice(ENT.people.indexOf(c), 1); dropLabel(c); }

function updateCars(dt) {
  for (const car of ENT.cars.slice()) {
    const m = car.mesh;
    if (car.state === 'in' || car.state === 'out') {
      let blocked = false; const hx = Math.sin(car.yaw), hz = Math.cos(car.yaw);
      for (const o of ENT.cars) { if (o === car) continue; const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z, d = Math.hypot(dx, dz); if (d < 5.6 && (dx * hx + dz * hz) > d * 0.75) { blocked = true; break; } }
      const pd = Math.hypot(player.position.x - car.pos.x, player.position.z - car.pos.z); if (!car.ambient && pd < 2.6 && ((player.position.x - car.pos.x) * hx + (player.position.z - car.pos.z) * hz) > pd * 0.6) blocked = true;
      car.v = clamp((car.v || car.speed) + (blocked ? -30 : 8) * dt, 0, car.speed * GEAR.drive[gi()]);
      const t = car.path[0]; if (t) {
        const dx = t.x - car.pos.x, dz = t.z - car.pos.z, d = Math.hypot(dx, dz); const near = car.state === 'in' && car.path.length === 1 ? Math.max(1.6, Math.min(car.v, d * 1.6)) : car.v;
        const step = Math.min(near, car.v) * dt;
        if (d <= Math.max(step, 0.05)) { car.pos.x = t.x; car.pos.z = t.z; car.path.shift(); }
        else { car.pos.x += (dx / d) * step; car.pos.z += (dz / d) * step; const want = Math.atan2(dx, dz); let a = want - car.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); car.yaw += a * Math.min(1, dt * 5); m.userData.roll(step); }
      }
      if (!car.path.length) {
        if (car.state === 'in') { car.state = 'wait'; car.yaw = Math.PI; audio.play('thud', { vol: 0.2, rate: 0.8 }); markCars(); }
        else { scene.remove(m); ENT.cars.splice(ENT.cars.indexOf(car), 1); dropLabel(car); continue; }
      }
    } else if (car.state === 'wait') {
      const pending = car.needs.fuel || car.needs.jerry || car.needs.tyre;
      if (pending) { car.pat -= dt; if (car.pat <= 0) { car.mad = true; angry({ x: car.pos.x, y: 2.2, z: car.pos.z }); audio.play('bong', { vol: 0.5, rate: 0.6 }); leaveCar(car); } }
      else if (car.shop && !car.driver) { car.state = 'park'; car.driver = spawnCustomer({ x: car.pos.x - 1.25, z: car.pos.z }, car, car.wants && car.wants.slice()); if (!car.driver) leaveCar(car); }
      else leaveCar(car);
    } else if (car.state === 'park') { if (car.driverBack) leaveCar(car); }
    m.position.set(car.pos.x, 0, car.pos.z); m.rotation.y = car.yaw;
  }
}
function leaveCar(car) { if (!car.mad) served(car.pos); const b = baySpot(car.pump); car.state = 'out'; car.v = 0; markCars(); car.path = [{ x: b.x, z: -0.4 }, { x: b.x + 1.8, z: -1.1 }, { x: 20.4, z: -1.1 }, { x: 21.4, z: 0.4 }, { x: 21.4, z: 10.6 }, { x: 23.4, z: 12.7 }, { x: 70, z: 12.7 }]; }

function spawner(dt) {
  if (G.tut < 6) return;
  G.spawnT -= dt; G.ambT -= dt;
  if (G.ambT <= 0) { G.ambT = rnd(4, 9) / GEAR.drive[gi()]; spawnAmbient(); }
  if (G.spawnT > 0) return;
  const S = SHIFTS[G.shift]; G.spawnT = GEAR.spawn[gi()] * S.rate * rnd(0.75, 1.25);
  const shopCount = ENT.people.filter((p) => !p.car).length;
  if (Math.random() < S.car) { if (!spawnCar() && shopCount < 9) spawnCustomer(Math.random() < 0.5 ? { x: -10, z: 9.2 } : { x: 24, z: 9.2 }); }
  else if (shopCount < 10) spawnCustomer(Math.random() < 0.5 ? { x: -10, z: 9.2 } : { x: 24, z: 9.2 });
}

// ---------------------------------------------------------------- staff (hired helpers)
function hire(kind) {
  const mesh = makePerson(models, 'staff'); scene.add(mesh); const s = { kind, mesh, pos: { x: 6, z: -2 }, path: null, state: 'idle', carry: 0, t: 0 };
  mesh.position.set(6, 0, -2); ENT.staff.push(s); toast(`Your new ${kind} clocked in!`, 'good');
}
function updateStaff(dt) {
  for (const s of ENT.staff) {
    const prev = { ...s.pos }; const arrived = moveAlong(s, dt, 3.4); s.t += dt;
    if (s.kind === 'cashier') { if (s.state !== 'till') { s.state = 'till'; goTo(s, { x: SPOTS.till.x - 0.35, z: SPOTS.till.z - 0.35 }); } else if (arrived) { if (playerZone()?.id !== 'till') checkout(dt, 0.75, null); } }
    if (s.kind === 'attendant') {
      if (s.state === 'idle' || (s.state === 'go' && !s.car?.needs?.fuel)) { const car = ENT.cars.find((c) => c.state === 'wait' && c.needs.fuel && !ENT.staff.some((o) => o !== s && o.car === c)); if (car) { s.car = car; s.state = 'go'; goTo(s, { x: pumpSpot(car.pump).x - 0.35, z: pumpSpot(car.pump).z + 0.2 }); } else if (s.state !== 'idle') { s.state = 'idle'; goTo(s, { x: 7, z: 6.6 }); } }
      if (s.state === 'go' && arrived && s.car && s.car.state === 'wait' && s.car.needs.fuel) { s.car.fuelP += dt / 4.2; if (s.car.fuelP >= 1) { s.car.needs.fuel = false; s.car.fuelP = 0; earn(priceOf('fuel'), s.car.mesh.position, s.car.pat / s.car.patMax * 0.5); s.state = 'idle'; s.car = null; } }
      if (s.state === 'go' && s.car && s.car.state !== 'wait') { s.state = 'idle'; s.car = null; }
    }
    if (s.kind === 'stocker') {
      if (s.state === 'idle') { const st = ['soda', 'cereal', 'oil', 'coffee'].map((id) => stations[id]).filter((x) => G.unlocked.has(x.id) && x.stock < x.cap * 0.5).sort((a, b) => a.stock / a.cap - b.stock / b.cap)[0]; if (st) { s.st = st; s.state = 'fetch'; goTo(s, { x: SPOTS.pallet.x + 0.4, z: SPOTS.pallet.z }); } else if (s.t > 2) { s.t = 0; goTo(s, { x: 11.6, z: -7.0 }); } }
      else if (s.state === 'fetch' && arrived) { s.state = 'load'; s.t = 0; }
      else if (s.state === 'load' && s.t > 1.2) { s.carry = 3; setStaffCarry(s, 3); s.state = 'deliver'; const sp = s.st.id === 'coffee' ? SPOTS.coffee : shelfSpot(s.st.id); goTo(s, { x: sp.x + 0.4, z: sp.z }); }
      else if (s.state === 'deliver' && !s.st) { s.state = 'idle'; s.carry = 0; setStaffCarry(s, 0); }
      else if (s.state === 'deliver' && arrived && s.t > 0.4) { s.t = 0; if (s.carry > 0 && s.st.stock < s.st.cap) { s.carry--; s.st.stock = Math.min(s.st.cap, s.st.stock + s.st.perCarton); s.st.inst.count = s.st.stock; setStaffCarry(s, s.carry); } else { s.carry = 0; setStaffCarry(s, 0); s.state = 'idle'; } }
    }
    s.mesh.position.set(s.pos.x, groundY(s.pos.z), s.pos.z); if (s.face !== undefined) s.mesh.rotation.y = s.face;
    s.mesh.userData.anim(dt, Math.hypot(s.pos.x - prev.x, s.pos.z - prev.z) / Math.max(dt, 1e-4), s.carry > 0);
  }
}
function setStaffCarry(s, n) { s.carryObjs = s.carryObjs || []; buildCarry(s.mesh.userData.hold, s.carryObjs, 'carton', n); }

// ---------------------------------------------------------------- day / night (the world shifts with the clock)
const SKY = [[0, 0xf2b88b, 0.9, 0xffc48a, 1.4], [0.12, 0x9fd3ef, 1.2, 0xfff2dc, 2.5], [0.33, 0x86c8ee, 1.25, 0xffffff, 2.8], [0.48, 0xf4a261, 1.0, 0xffb070, 2.0],
  [0.6, 0x5d4a72, 0.5, 0xff8a5c, 0.55], [0.68, 0x141f3d, 0.2, 0x8fa6ff, 0.28], [0.9, 0x0b1430, 0.18, 0x8fa6ff, 0.26], [1, 0x2c3160, 0.3, 0xffb38a, 0.4]];
const cA = new THREE.Color(), cB = new THREE.Color();
function setDayLight(p) {
  let i = 0; while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++; const a = SKY[i], b = SKY[i + 1], t = clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
  cA.setHex(a[1]).lerp(cB.setHex(b[1]), t); scene.background.copy(cA); scene.fog.color.copy(cA);
  W.hemi.intensity = a[2] + (b[2] - a[2]) * t; W.hemi.color.copy(cA).lerp(cB.setHex(0xffffff), 0.45); W.hemi.groundColor.setHex(0x6b5a45).lerp(cB.setHex(0x101830), clamp((p - 0.55) / 0.15, 0, 1) * (1 - clamp((p - 0.95) / 0.05, 0, 1)));
  W.sun.color.setHex(a[3]).lerp(cB.setHex(b[3]), t); W.sun.intensity = a[4] + (b[4] - a[4]) * t;
  const ang = -0.3 + p * 1.8 * Math.PI; W.sunDir = new THREE.Vector3(Math.cos(ang) * 0.8, 0.9 + 0.4 * Math.max(0, Math.sin(p * Math.PI * 1.4)), 0.55).normalize();
  const night = clamp((p - 0.56) / 0.1, 0, 1) * (1 - clamp((p - 0.97) / 0.03, 0, 1));
  for (const l of W.lamps) l.l.intensity = l.on * night; for (const n of W.nightMats) n.m.emissiveIntensity = (n.off || 0) + (n.on - (n.off || 0)) * night;
  for (const c of ENT.cars) if (c.mesh.userData.head) c.mesh.userData.head.emissiveIntensity = 0.25 + night * 2.5;
  renderer.toneMappingExposure = 1.05; G.night = night;
}

// ---------------------------------------------------------------- labels, pops, toasts
const labels = new Map(); const labRoot = $('labels');
function label(key, html, wp, cls = 'lab') {
  let el = labels.get(key); if (!el) { el = document.createElement('div'); el.className = cls; labRoot.appendChild(el); labels.set(key, el); el._h = ''; }
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  tmpV.set(wp.x, wp.y, wp.z).project(camera); const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2;
  el.style.display = vis ? '' : 'none'; if (vis) el.style.transform = `translate(${((tmpV.x + 1) / 2) * innerWidth}px,${((1 - tmpV.y) / 2) * innerHeight}px) translate(-50%,-100%)`;
  el._seen = frameNo;
}
function dropLabel(key) { const el = labels.get(key); if (el) { el.remove(); labels.delete(key); } }
function pop(text, wp, cls = '', delay = 0) { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; labRoot.appendChild(el); ENT.pops.push({ el, wp: { x: wp.x, y: (wp.y || 1.8), z: wp.z }, t: -delay }); }
let toastT = 0;
function toast(msg, cls = '') { const t = $('toast'); t.textContent = msg; t.className = 'chip on ' + cls; toastT = 2.6; }
const patBar = (f) => `<span class="pt"><i style="width:${Math.round(clamp(f, 0, 1) * 100)}%;background:${f > 0.5 ? '#3ddc84' : f > 0.25 ? '#ffb347' : '#ff4d5e'}"></i></span>`;
let frameNo = 0;
function updateLabels(dt) {
  frameNo++;
  for (const car of ENT.cars) {
    if (car.state !== 'wait' || car.ambient) continue; const f = car.pat / car.patMax; const ic = [car.needs.fuel && ICON.fuel, car.needs.jerry && ICON.jerry, car.needs.tyre && ICON.tyre].filter(Boolean).join('');
    if (ic) label(car, `<div class="bub${f < 0.25 ? ' mad' : ''}">${ic}${patBar(f)}</div>`, { x: car.pos.x, y: car.mesh.userData.h + 0.45, z: car.pos.z });
  }
  for (const c of ENT.people) {
    const f = c.pat / c.patMax;
    if (c.state === 'atStation' && stations[c.wants[0]] && stations[c.wants[0]].stock <= 0 && c.wait > 0.6) label(c, `<div class="bub${f < 0.25 ? ' mad' : ''}">${ICON[c.wants[0]]}${patBar(f)}</div>`, { x: c.pos.x, y: 2.15, z: c.pos.z });
    else if (c.state === 'queue' && (c.qi === 0 || f < 0.5)) label(c, `<div class="bub${f < 0.25 ? ' mad' : ''}">${ICON.pay}${patBar(f)}</div>`, { x: c.pos.x, y: 2.15, z: c.pos.z });
    else if (c.mad && c.state !== 'queue') label(c, `<div class="bub mad">${ICON.mad}</div>`, { x: c.pos.x, y: 2.15, z: c.pos.z });
  }
  for (const id of ['soda', 'cereal', 'oil', 'coffee']) { const st = stations[id]; if (!G.unlocked.has(id) || G.state !== 'play' || st.stock >= st.cap * 0.5) continue; const at = id === 'coffee' ? { x: -0.9, y: 1.2, z: -8.3 } : { x: SHELF_X[id], y: 2.65, z: -11.7 };
    label(st, `<div class="bub${st.stock ? '' : ' mad'}">${ICON[id]}${st.stock ? patBar(st.stock / st.cap) : '<b style="font-size:11px;color:#c00">EMPTY</b>'}</div>`, at); }
  for (const p of pads) if (padVisible(p)) label(p, `<div class="pad${G.cash < p.cost - p.paid ? ' cant' : ''}">$${p.cost - p.paid}<small>${p.label.toUpperCase()}</small></div>`, { x: p.x, y: 0.35, z: p.z });
  for (const [k, el] of labels) if (el._seen !== frameNo) { el.remove(); labels.delete(k); }
  for (const p of ENT.pops.slice()) {
    p.t += dt; if (p.t < 0) { p.el.style.display = 'none'; continue; } p.el.style.display = '';
    tmpV.set(p.wp.x, p.wp.y + p.t * 1.2, p.wp.z).project(camera);
    p.el.style.transform = `translate(${((tmpV.x + 1) / 2) * innerWidth}px,${((1 - tmpV.y) / 2) * innerHeight}px) translate(-50%,-50%) scale(${1 + Math.min(p.t, 0.15) * 2})`; p.el.style.opacity = String(clamp(1.6 - p.t * 1.6, 0, 1));
    if (p.t > 1.1) { p.el.remove(); ENT.pops.splice(ENT.pops.indexOf(p), 1); }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
}

// ---------------------------------------------------------------- HUD + panels
const starSvg = (f, i) => `<span class="st"><svg viewBox="0 0 24 24"><defs><clipPath id="sc${i}"><rect width="${24 * f}" height="24"/></clipPath></defs><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#3a4466"/><path clip-path="url(#sc${i})" d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd23f"/></svg></span>`;
let hudCache = {};
function updateHud(force) {
  const p = G.shift / 3 + G.shiftT / SHIFT_LEN / 3; const mins = Math.floor((6 * 60 + p * 24 * 60) % (24 * 60)); const clock = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60 - (mins % 60) % 15).padStart(2, '0');
  const set = (k, v, fn) => { if (force || hudCache[k] !== v) { hudCache[k] = v; fn(v); } };
  set('cash', G.cash, (v) => { $('cashN').textContent = '$' + v.toLocaleString('en-US'); });
  set('earned', G.earned, (v) => { $('earned').textContent = 'Day total $' + v.toLocaleString('en-US'); });
  set('clock', clock, (v) => { $('clock').textContent = v; });
  set('shiftn', G.shift, (v) => { $('shiftName').textContent = SHIFTS[v].name; });
  set('bar', Math.round(G.shiftT / SHIFT_LEN * 200), (v) => { $('shiftBar').style.width = v / 2 + '%'; });
  set('rep', Math.round(G.rep * 10), () => { $('rep').innerHTML = [0, 1, 2, 3, 4].map((i) => starSvg(clamp(G.rep - i, 0, 1), i)).join(''); $('rep').classList.toggle('warn', G.rep < 1.6); });
  set('gear', G.gear, (v) => { $('gUp').disabled = v >= 5; $('gDn').disabled = v <= 1; });
  const can = UPG.some((u) => G.lvl[u.id] < u.cost.length && G.cash >= u.cost[G.lvl[u.id]]);
  set('upgcan', can, (v) => $('upgBtn').classList.toggle('has', v));
}
function renderUpg() {
  const list = $('upgList'); list.innerHTML = '';
  for (const u of UPG) {
    const l = G.lvl[u.id], max = l >= u.cost.length, cost = u.cost[l];
    const row = document.createElement('div'); row.className = 'urow';
    row.innerHTML = `<div class="ic">${u.ic}</div><div class="tx"><b>${u.name}</b><small>${u.staff ? (l ? 'Hired' : u.desc(0)) : u.desc(l) + (max ? '' : ' → ' + u.desc(l + 1).replace(/^[^0-9]*/, ''))}</small>${u.staff ? '' : `<div class="lv">${u.vals.slice(1).map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>`}</div>`;
    const b = document.createElement('button'); b.className = 'buy' + (max ? ' max' : ''); b.dataset.upg = u.id; b.textContent = max ? (u.staff ? 'HIRED' : 'MAX') : '$' + cost; b.disabled = max || G.cash < cost;
    b.onclick = () => { if (buyUpgrade(u.id)) renderUpg(); }; row.appendChild(b); list.appendChild(row);
  }
}
function buyUpgrade(id) {
  const u = UPG.find((x) => x.id === id), l = G.lvl[id]; if (l >= u.cost.length || G.cash < u.cost[l]) { audio.bad(); return false; }
  G.cash -= u.cost[l]; G.lvl[id]++; audio.buy(); if (u.staff) hire(id); else toast(u.name + ' upgraded!', 'good');
  if (id === 'carry' && player.userData.carryType) setCarry(player.userData.carryType, carryCount()); updateHud(true); return true;
}
function openPanel(id) { if (G.state !== 'play') return; G.state = 'panel'; input.setEnabled(false); $(id).classList.remove('hidden'); audio.ui(); }
function closePanel(id) { $(id).classList.add('hidden'); if (G.state === 'panel') { G.state = 'play'; input.setEnabled(true); } audio.ui(); }
function showTitle() {
  $('title').classList.remove('hidden'); $('jamTag').classList.remove('hidden');
  $('bestLine').textContent = G.best > 0 ? `Personal best: $${G.best.toLocaleString('en-US')}` : '';
  if (TOUCH) $('howMove').innerHTML = '<b>Move:</b> joystick, bottom-left corner.<br><b>Work:</b> stand in a ring.';
  if (TOUCH) $('gearkeys').classList.add('hidden');
  if (TOUCH) $('howGear').innerHTML = '<b>Gearbox:</b> the &#9650; &#9660; buttons, bottom right. Higher gear = more customers, bigger prices.';
}
function setupUi() {
  $('startBtn').onclick = () => { audio.unlock(); startDay(); };
  $('againBtn').onclick = () => { $('end').classList.add('hidden'); audio.unlock(); startDay(); };
  $('upgBtn').onclick = () => { renderUpg(); openPanel('upg'); };
  $('upgX').onclick = () => closePanel('upg');
  $('upg').addEventListener('pointerdown', (e) => { if (e.target.id === 'upg') closePanel('upg'); });
  $('pauseBtn').onclick = () => pause(true); $('resumeBtn').onclick = () => pause(false);
  const muteUi = () => { $('muteBtn').innerHTML = audio.muted ? '&#128263;' : '&#9835;'; $('muteBtn').style.opacity = audio.muted ? 0.6 : 1; };
  $('muteBtn').onclick = () => { audio.unlock(); audio.setMuted(!audio.muted); store.set('muted', audio.muted); muteUi(); }; muteUi();
  const hold = (el, d) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); shiftGear(d); });
  hold($('gUp'), 1); hold($('gDn'), -1);
  addEventListener('keydown', (e) => { if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pause(true); else if (G.state === 'paused') pause(false); else if (G.state === 'panel') closePanel('upg'); }
    if (e.code === 'KeyU' && G.state === 'play') { renderUpg(); openPanel('upg'); }
    if ((e.code === 'Enter' || e.code === 'Space') && G.state === 'title') { e.preventDefault(); $('startBtn').click(); } });
  document.addEventListener('visibilitychange', () => { audio.setHidden(document.hidden); if (document.hidden && G.state === 'play') pause(true); });
}
function pause(on) { if (on && G.state === 'play') { G.state = 'paused'; input.setEnabled(false); $('pauseScr').classList.remove('hidden'); } else if (!on && G.state === 'paused') { G.state = 'play'; input.setEnabled(true); $('pauseScr').classList.add('hidden'); } }

// ---------------------------------------------------------------- camera + render loop
const camT = new THREE.Vector3(6, 0, 2); const PITCH = 1.0;
function updateCamera(dt, snap) {
  if (G.camOverride) { const o = G.camOverride; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); return; } // QA close-ups only
  let tx, tz;
  if (G.state === 'title' || G.state === 'loading') { const a = G.t * 0.08; tx = 6 + Math.sin(a) * 3; tz = -1 + Math.cos(a) * 2; }
  else { tx = clamp(player.position.x, -2, 17); tz = clamp(player.position.z - 0.8, camera.aspect < 1 ? -7.6 : -8.5, 6.5); }
  const k = snap ? 1 : 1 - Math.exp(-dt * 4); camT.x += (tx - camT.x) * k; camT.z += (tz - camT.z) * k;
  const portrait = camera.aspect < 1; const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
  const wantW = portrait ? 10.5 : 21, wantH = portrait ? 18 : 13.5; let d = Math.max(wantW / 2 / Math.tan(hf), wantH / 2 / Math.tan(vf)); if (G.state === 'title') d *= portrait ? 1.0 : 1.15;
  camera.position.set(camT.x, Math.sin(PITCH) * d, camT.z + Math.cos(PITCH) * d + (portrait ? 1.2 : 0.8)); camera.lookAt(camT.x, 0.6, camT.z - (portrait ? 0.4 : 0));
  const sd = W.sunDir || new THREE.Vector3(0.5, 1, 0.5); W.sun.position.set(camT.x + sd.x * 40, sd.y * 40, camT.z + sd.z * 40); W.sun.target.position.set(camT.x, 0, camT.z);
}
let last = performance.now(), fpsAcc = 0, fpsN = 0, lowT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++;
  if (fpsAcc > 0.5) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (G.fps < 38 && pixelRatio > 1) { lowT++; if (lowT > 3) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); lowT = 0; } } else lowT = 0; }
  const dt = rdt * G.timeScale; G.t += dt;
  if (G.state === 'play') {
    const n = Math.ceil(dt / 0.034), sdt = dt / n; // sub-steps: fast-forwarded QA runs must not tunnel through walls
    for (let k = 0; k < n && G.state === 'play'; k++) {
      G.shiftT += sdt; G.topGear = Math.max(G.topGear || 1, G.gear);
      if (api.botTick) api.botTick(sdt);
      movePlayer(sdt); work(sdt); tutTick(sdt); spawner(sdt); updateCars(sdt); updatePeople(sdt); updateStaff(sdt);
      if (G.shiftT >= SHIFT_LEN) { if (G.shift >= 2) endDay(false); else endShift(); }
    }
    setDayLight(clamp((G.shift + G.shiftT / SHIFT_LEN) / 3, 0, 1));
    updateHud();
  } else if (api.botTick) api.botTick(0); else if (G.state === 'title') { updateCars(dt); spawner(0); if (Math.random() < dt * 0.25) spawnAmbient(); }
  for (const g of popIns.slice()) { g.userData.popT += rdt; const t = g.userData.popT / 0.45; if (t >= 1) { g.scale.setScalar(1); popIns.splice(popIns.indexOf(g), 1); } else g.scale.setScalar(Math.max(0.01, t * (1 + 0.35 * Math.sin(t * Math.PI)))); }
  for (const z of zones) { if (!z.g.visible) continue; z.fill.scale.setScalar(Math.max(0.001, clamp(z.prog, 0, 1))); const pulse = guideTo && dist(z, guideTo) < 0.1 ? 0.6 + 0.4 * Math.sin(G.t * 8) : 0.85; z.ring.material.opacity = pulse; }
  updateGuide(rdt);
  if (W && player && G.state !== 'review') { updateCamera(rdt); updateLabels(rdt); }
  if ((frameNo & 1) === 0 || G.state === 'review') renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  if (G.state === 'play' && G.tut < 6 && frameNo % 15 === 0) tutShow();
}

// guide arrow: tutorial target, or the most urgent job after 4 s of standing still
const guide = new THREE.Group(); scene.add(guide); guide.visible = false;
{ const m = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.45, roughness: 0.4 });
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 20), m); c.rotation.x = Math.PI; c.position.y = 0.38; guide.add(c);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 14), m); s.position.y = 1.0; guide.add(s); }
let guideTo = null;
function updateGuide() {
  guideTo = null;
  if (G.state === 'play') { if (G.tut < 6 && TUT[G.tut].at) guideTo = TUT[G.tut].at(); else if (G.tut >= 6 && G.idleT > 4) { const s = suggest(); if (s) guideTo = s; } }
  guide.visible = !!guideTo; if (guideTo) { guide.position.set(guideTo.x, 1.1 + Math.abs(Math.sin(G.t * 4)) * 0.4, guideTo.z); }
}
// what should be done next (used by the guide arrow and the QA bot)
function suggest() {
  const u = player.userData;
  const q0 = ENT.people.find((p) => p.state === 'queue' && p.qi === 0); if (q0 && !G.lvl.cashier) return { ...SPOTS.till, why: 'till' };
  for (const need of ['tyre', 'jerry']) { const car = ENT.cars.filter((c) => c.state === 'wait' && c.needs[need]).sort((a, b) => a.pat - b.pat)[0]; if (car) return u.carryType === need ? { ...pumpSpot(car.pump), why: 'deliver-' + need } : { ...(need === 'tyre' ? SPOTS.tyre : SPOTS.jerry), why: 'get-' + need }; }
  const car = ENT.cars.filter((c) => c.state === 'wait' && c.needs.fuel).sort((a, b) => a.pat - b.pat)[0]; if (car) return { ...pumpSpot(car.pump), why: 'fuel' };
  const low = ['soda', 'cereal', 'oil', 'coffee'].filter((id) => G.unlocked.has(id)).map((id) => stations[id]).sort((a, b) => a.stock / a.cap - b.stock / b.cap)[0];
  if (low && (low.stock < low.cap * 0.55 || ENT.people.some((p) => p.state === 'atStation' && p.wants[0] === low.id))) return u.carryType === 'carton' ? { ...(low.id === 'coffee' ? SPOTS.coffee : shelfSpot(low.id)), why: 'stock-' + low.id } : { ...SPOTS.pallet, why: 'pallet' };
  if (q0) return { ...SPOTS.till, why: 'till' };
  return null;
}

// ---------------------------------------------------------------- QA / automation surface
const api = { G, ENT, W: () => W, stations: () => stations, zones: () => zones, pads: () => pads, player: () => player, input: () => input, scene, camera, renderer, models,
  suggest, findPath, startDay, tutTarget: () => (G.tut < TUT.length && TUT[G.tut].at ? TUT[G.tut].at() : null), shiftGear, buyUpgrade, takePerk, endShift, playerZone, priceOf, UPG, PAD_DEFS, padVisible, setDayLight, activeColliders, applyUnlocks,
  spawnCar, spawnCustomer, hire, setCarry, setStaffCarry, shelfSpot };
window.__fs = { api, ready: false, get fps() { return G.fps; }, get state() { return G.state; } };
boot().catch((e) => { console.error(e); $('loadTxt').textContent = 'Could not load the station: ' + e.message; });
