// Fuel Shift - the 24 CC0 models of the Vuena Simulator Kits Sampler (public/models, unchanged GLBs).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const NAMES = ['ap_armchair', 'ap_coffee_table', 'ap_mug', 'ap_pillow_square', 'ap_plant_small', 'ap_table_lamp',
  'fk_barrel_steel', 'fk_box_closed', 'fk_item_box', 'fk_pallet_wood', 'fk_sign_forklift', 'fk_traffic_barrier_2m',
  'gs_bollard_steel', 'gs_cone_traffic', 'gs_jerry_can', 'gs_prod_oil_5l_a', 'gs_pump_modern', 'gs_tire',
  'sk_carton_s', 'sk_pos_till', 'sk_price_tag_shelf', 'sk_prod_can_soda_a', 'sk_prod_cereal_l_a', 'sk_shelf_wall_120'];

// our other free CC0 packs: 8 Free Blocky Characters (rigged, animated) and 5 Free Toy Cars (public/chars, public/cars, unchanged GLBs)
export const CHARS = ['blocky_01_hero', 'blocky_03_knight', 'blocky_05_wizard', 'blocky_06_pirate', 'blocky_07_astronaut', 'blocky_08_robot', 'blocky_09_zombie', 'blocky_19_princess'];
export const CARS = ['muscle_blue', 'police_classic', 'icecream_pink', 'monster_orange', 'fire_red'];

// characters (and what they carry) write 1 into the stencil buffer, so the x-ray silhouette only shows where something else hides them
// ---- coincident faces: triangles of one mesh that lie in the same plane and overlap z-fight at any distance (found in the
// characters, toy cars, till drawer, soda can, jerry can, pump, shelf, cushion). The GLB files stay unchanged: at load time the
// smaller face of every pair is pushed 1 mm out along its normal (in memory). coplanarPairs() is also used to verify 0 remain.
export function coplanarPairs(geo, doubleSided) {
  const pos = geo.attributes.position, ix = geo.index ? geo.index.array : null, nT = (ix ? ix.length : pos.count) / 3, tris = [], buckets = new Map(), pairs = [];
  for (let t = 0; t < nT; t++) {
    const v = [0, 1, 2].map((k) => (ix ? ix[t * 3 + k] : t * 3 + k)), p = v.map((k) => [pos.getX(k), pos.getY(k), pos.getZ(k)]);
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(n[0], n[1], n[2]); if (L < 1e-10) continue; n = n.map((q) => q / L);
    const d = n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2], s = n[0] > 1e-6 || (Math.abs(n[0]) <= 1e-6 && (n[1] > 1e-6 || (Math.abs(n[1]) <= 1e-6 && n[2] > 0))) ? 1 : -1;
    const key = [n[0] * s, n[1] * s, n[2] * s].map((q) => Math.round(q * 100)).join(',') + '|' + Math.round((d * s) / 0.0006);
    const T = { t, v, p, n, d, s, area: L / 2 }; tris.push(T); (buckets.get(key) || buckets.set(key, []).get(key)).push(T);
  }
  const ov = (a, b) => { for (const tt of [a, b]) for (let i = 0; i < 3; i++) { const P = tt[i], Q = tt[(i + 1) % 3]; let ax = -(Q[1] - P[1]), ay = Q[0] - P[0]; const l = Math.hypot(ax, ay); if (l < 1e-9) continue; ax /= l; ay /= l;
    const A = a.map((q) => q[0] * ax + q[1] * ay), B = b.map((q) => q[0] * ax + q[1] * ay); if (Math.max(...A) <= Math.min(...B) + 1e-3 || Math.max(...B) <= Math.min(...A) + 1e-3) return false; } return true; };
  for (const list of buckets.values()) {
    if (list.length < 2 || list.length > 3000) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j]; if (A.s !== B.s && !doubleSided) continue; if (Math.abs(A.d * A.s - B.d * B.s) > 0.0003) continue;
      const n = A.n, ax = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]; let e1 = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((q) => q / l1);
      const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]], pr = (T) => T.p.map((q) => [q[0] * e1[0] + q[1] * e1[1] + q[2] * e1[2], q[0] * e2[0] + q[1] * e2[1] + q[2] * e2[2]]);
      if (ov(pr(A), pr(B))) pairs.push([A, B]);
    }
  }
  return pairs;
}
export function fixCoplanar(geo, doubleSided) {
  const pairs = coplanarPairs(geo, doubleSided); if (!pairs.length) return 0; const pos = geo.attributes.position, moved = new Set();
  for (const [A, B] of pairs) { const T = A.area <= B.area ? A : B; for (const k of T.v) { if (moved.has(k)) continue; moved.add(k); pos.setXYZ(k, pos.getX(k) + T.n[0] * 0.001, pos.getY(k) + T.n[1] * 0.001, pos.getZ(k) + T.n[2] * 0.001); } }
  pos.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere(); return pairs.length;
}
// the same check across the different meshes of one model (e.g. the shelf's back panel top flush with its frame top)
export function fixCoplanarAcross(root) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4(), meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); }); if (meshes.length < 2) return 0;
  const tris = [], buckets = new Map(); let fixed = 0; const v = new THREE.Vector3();
  meshes.forEach((m, mi) => { const pos = m.geometry.attributes.position, ix = m.geometry.index ? m.geometry.index.array : null, nT = (ix ? ix.length : pos.count) / 3; const M = m.matrixWorld.clone().premultiply(inv.copy(root.matrixWorld).invert());
    for (let t = 0; t < nT; t++) { const vi = [0, 1, 2].map((k) => (ix ? ix[t * 3 + k] : t * 3 + k)), p = vi.map((k) => v.fromBufferAttribute(pos, k).applyMatrix4(M).toArray());
      const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]]; let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...n); if (L < 1e-10) continue; n = n.map((q) => q / L);
      const T = { mi, m, vi, p, n, d: n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2], area: L / 2 }; const key = n.map((q) => Math.round(q * 100)).join(',') + '|' + Math.round(T.d / 0.0006); (buckets.get(key) || buckets.set(key, []).get(key)).push(T); } });
  const ov = (a, b) => { for (const tt of [a, b]) for (let i = 0; i < 3; i++) { const P = tt[i], Q = tt[(i + 1) % 3]; let ax = -(Q[1] - P[1]), ay = Q[0] - P[0]; const l = Math.hypot(ax, ay); if (l < 1e-9) continue; ax /= l; ay /= l;
    const A = a.map((q) => q[0] * ax + q[1] * ay), B = b.map((q) => q[0] * ax + q[1] * ay); if (Math.max(...A) <= Math.min(...B) + 1e-3 || Math.max(...B) <= Math.min(...A) + 1e-3) return false; } return true; };
  const moved = new Set();
  for (const list of buckets.values()) { if (list.length < 2 || list.length > 3000) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const A = list[i], B = list[j]; if (A.mi === B.mi || Math.abs(A.d - B.d) > 0.0003) continue;
      const n = A.n, ax = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]; let e1 = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((q) => q / l1);
      const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]], pr = (T) => T.p.map((q) => [q[0] * e1[0] + q[1] * e1[1] + q[2] * e1[2], q[0] * e2[0] + q[1] * e2[1] + q[2] * e2[2]]);
      if (!ov(pr(A), pr(B))) continue; fixed++;
      const T = A.area <= B.area ? A : B, pos = T.m.geometry.attributes.position; // move the smaller face 1 mm out (normal mapped back into that mesh's space)
      const nl = new THREE.Vector3(...T.n).transformDirection(inv.copy(T.m.matrixWorld).invert().multiply(root.matrixWorld));
      for (const k of T.vi) { const key = T.m.geometry.uuid + ':' + k; if (moved.has(key)) continue; moved.add(key); pos.setXYZ(k, pos.getX(k) + nl.x * 0.001, pos.getY(k) + nl.y * 0.001, pos.getZ(k) + nl.z * 0.001); }
      pos.needsUpdate = true; } }
  return fixed;
}
// last resort for faces that share already-moved vertices: collapse the smaller face of a coincident pair (the larger one covers it)
export function collapseCoplanar(geo, doubleSided) {
  const pairs = coplanarPairs(geo, doubleSided); if (!pairs.length) return 0; const ix = geo.index; let n = 0;
  for (const [A, B] of pairs) { const T = A.area <= B.area ? A : B; if (T.dead) continue; T.dead = true; n++;
    if (ix) { ix.array[T.t * 3 + 1] = ix.array[T.t * 3]; ix.array[T.t * 3 + 2] = ix.array[T.t * 3]; ix.needsUpdate = true; }
    else { const pos = geo.attributes.position; for (const k of [1, 2]) pos.setXYZ(T.t * 3 + k, pos.getX(T.t * 3), pos.getY(T.t * 3), pos.getZ(T.t * 3)); pos.needsUpdate = true; } }
  return n;
}
export function eachGeometry(root, fn) { const seen = new Set(); root.traverse((o) => { if (o.isMesh && !seen.has(o.geometry)) { seen.add(o.geometry); const m = Array.isArray(o.material) ? o.material : [o.material]; fn(o.geometry, m.some((q) => q.side === THREE.DoubleSide), o); } }); }

export function stencilMark(m) { m.stencilWrite = true; m.stencilRef = 1; m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp; return m; }

export class Models {
  constructor() { this.src = {}; this.box = {}; this.chars = {}; this.cars = {}; }
  async load(onProgress) {
    const L = new GLTFLoader(); let done = 0; const total = NAMES.length + CHARS.length + CARS.length;
    const prep = (s) => { s.updateMatrixWorld(true); s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = 4; } }); return s; };
    await Promise.all([
      ...NAMES.map((n) => L.loadAsync(`./models/${n}.glb`).then((g) => { const s = prep(g.scene); this.src[n] = s; this.box[n] = new THREE.Box3().setFromObject(s); onProgress(++done / total); })),
      ...CHARS.map((n) => L.loadAsync(`./chars/${n}.glb`).then((g) => { prep(g.scene).traverse((o) => { if (o.isMesh) stencilMark(o.material); }); this.chars[n] = { scene: g.scene, clips: g.animations }; onProgress(++done / total); })),
      ...CARS.map((n) => L.loadAsync(`./cars/${n}.glb`).then((g) => { this.cars[n] = { scene: prep(g.scene), box: new THREE.Box3().setFromObject(g.scene) }; onProgress(++done / total); })),
    ]);
    // coincident-face fix (see fixCoplanar) on every loaded model; this.coplanar = { fixed, remaining } for the QA report
    let fixed = 0, remaining = 0; const roots = [...Object.values(this.src), ...Object.values(this.chars).map((c) => c.scene), ...Object.values(this.cars).map((c) => c.scene)];
    for (let pass = 0; pass < 3; pass++) for (const r of roots) eachGeometry(r, (g, ds) => { fixed += fixCoplanar(g, ds); }); // a vertex moves once per pass
    for (const r of roots) fixed += fixCoplanarAcross(r);
    for (const r of roots) eachGeometry(r, (g, ds) => { fixed += collapseCoplanar(g, ds); });
    const by = {}; for (const [n, r] of [...Object.entries(this.src), ...Object.entries(this.chars).map(([k, c]) => [k, c.scene]), ...Object.entries(this.cars).map(([k, c]) => [k, c.scene])]) eachGeometry(r, (g, ds) => { const k = coplanarPairs(g, ds).length; if (k) { remaining += k; by[n] = (by[n] || 0) + k; } });
    this.coplanar = { fixed, remaining, by };
    // shelf: the dark steel frame and the very metallic slotted uprights render near-black from above without an environment map;
    // give the fixture a light powder-coated finish so stocked shelves read from the top-down camera
    this.src.sk_shelf_wall_120.traverse((o) => { if (!o.isMesh) return; const m = o.material;
      if (m.name === 'M_Steel_Dark') { m.color.setHex(0xc4cad3); m.roughness = 0.55; }
      if (m.name === 'M_Steel_Slotted') { m.metalness = 0.2; m.color.setRGB(1.35, 1.38, 1.42); }
      if (m.name === 'M_Steel_Light') { m.color.setHex(0xe6e9ee); }
      if (m.name === 'M_Pegboard') { m.color.setRGB(1.6, 1.6, 1.6); } });
  }
  clone(n) { const o = this.src[n].clone(true); o.userData.model = n; return o; }
  size(n) { return this.box[n].getSize(new THREE.Vector3()); }
  // one InstancedMesh per mesh of the model; set(i, matrix) places copy i; count = how many are drawn
  instancer(n, max, shadows = true) {
    const g = new THREE.Group(), parts = [];
    this.src[n].traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, max); im.castShadow = shadows; im.receiveShadow = true;
      im.count = 0; im.frustumCulled = false; parts.push({ im, base: o.matrixWorld.clone() }); g.add(im);
    });
    const m = new THREE.Matrix4();
    return {
      group: g, max,
      set(i, mat) { for (const p of parts) { m.multiplyMatrices(mat, p.base); p.im.setMatrixAt(i, m); p.im.instanceMatrix.needsUpdate = true; } },
      set count(c) { for (const p of parts) p.im.count = Math.min(c, max); },
      get count() { return parts[0] ? parts[0].im.count : 0; },
    };
  }
  // top surfaces of a model under a vertical ray at local (x, z): sorted list of heights (normal pointing up)
  surfaces(n, x, z) {
    const rc = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)); const out = [];
    for (const h of rc.intersectObject(this.src[n], true)) {
      if (!h.face) continue; const nrm = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (nrm.y > 0.9 && !out.some((y) => Math.abs(y - h.point.y) < 0.02)) out.push(h.point.y);
    }
    return out.sort((a, b) => a - b);
  }
}
