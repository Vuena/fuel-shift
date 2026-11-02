// Coincident-face scan: node tools/coplanar.mjs [glb ...]  (default: every GLB in public/models, public/chars, public/cars)
// For each file, finds triangle pairs that lie in the same plane (normal within 0.5 deg, offset within 0.3 mm), face the same way
// (or either way when the material is double-sided) and overlap in area by more than 1 mm^2: those z-fight at any distance.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url));
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['public/models', 'public/chars', 'public/cars'].flatMap((d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.glb')).map((f) => join(ROOT, d, f)));
const T = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function mat(n) { // node TRS -> column-major 4x4
  if (n.matrix) return n.matrix.slice(); const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
function triOverlap2D(a, b) { // separating axis on two 2D triangles; returns true if interiors overlap by a margin
  const tris = [a, b];
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const p = t[i], q = t[(i + 1) % 3], ax = [-(q[1] - p[1]), q[0] - p[0]], L = Math.hypot(ax[0], ax[1]); if (L < 1e-9) continue; ax[0] /= L; ax[1] /= L;
    const pr = (tt) => tt.map((v) => v[0] * ax[0] + v[1] * ax[1]); const A = pr(a), B = pr(b);
    if (Math.max(...A) <= Math.min(...B) + 1e-3 || Math.max(...B) <= Math.min(...A) + 1e-3) return false; // 1 mm margin: touching edges do not count
  }
  return true;
}
let total = 0;
for (const f of files) {
  const b = readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bin = b.slice(20 + jl + 8);
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0), C = T[a.componentType], n = N[a.type];
    const stride = v.byteStride ? v.byteStride / C.BYTES_PER_ELEMENT : n, arr = new C(bin.buffer, bin.byteOffset + off, (a.count - 1) * stride + n), out = [];
    for (let k = 0; k < a.count; k++) out.push(Array.from(arr.slice(k * stride, k * stride + n))); return out; };
  const tris = []; // [p0,p1,p2, doubleSided, meshName]
  const walk = (ni, pm) => { const n = j.nodes[ni], m = mul(pm, mat(n));
    if (n.mesh != null && n.skin == null || n.mesh != null) for (const pr of j.meshes[n.mesh].primitives) {
      const P = acc(pr.attributes.POSITION).map((p) => xf(m, p)), I = pr.indices != null ? acc(pr.indices).map((x) => x[0]) : P.map((_, k) => k);
      const ds = !!(pr.material != null && j.materials[pr.material].doubleSided);
      for (let k = 0; k < I.length; k += 3) tris.push([P[I[k]], P[I[k + 1]], P[I[k + 2]], ds, j.meshes[n.mesh].name]);
    }
    for (const c of n.children || []) walk(c, m); };
  for (const r of j.scenes[j.scene || 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const buckets = new Map(); const hits = [];
  tris.forEach((t, i) => {
    const [a, bb, c] = t, u = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const L = Math.hypot(...n); if (L < 1e-10) return; n = n.map((x) => x / L);
    const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    // canonical (direction-free) key so opposite-facing coincident faces meet in one bucket
    const s = n[0] > 1e-6 || (Math.abs(n[0]) <= 1e-6 && (n[1] > 1e-6 || (Math.abs(n[1]) <= 1e-6 && n[2] > 0))) ? 1 : -1;
    const key = [n[0] * s, n[1] * s, n[2] * s].map((x) => Math.round(x * 100)).join(',') + '|' + Math.round(d * s / 0.0006);
    t.n = n; t.d = d; t.s = s; (buckets.get(key) || buckets.set(key, []).get(key)).push(i);
  });
  for (const ids of buckets.values()) {
    if (ids.length < 2 || ids.length > 4000) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const A = tris[ids[x]], B = tris[ids[y]]; const same = A.s === B.s; if (!same && !A[3] && !B[3]) continue; // back-to-back faces never show together
      if (Math.abs(A.d * A.s - B.d * B.s) > 0.0003) continue;
      const n = A.n, ax = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0], e1 = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]], l1 = Math.hypot(...e1), E1 = e1.map((q) => q / l1), E2 = [n[1] * E1[2] - n[2] * E1[1], n[2] * E1[0] - n[0] * E1[2], n[0] * E1[1] - n[1] * E1[0]];
      const p2 = (t) => [0, 1, 2].map((k) => [t[k][0] * E1[0] + t[k][1] * E1[1] + t[k][2] * E1[2], t[k][0] * E2[0] + t[k][1] * E2[1] + t[k][2] * E2[2]]);
      if (triOverlap2D(p2(A), p2(B))) hits.push({ a: A[4], b: B[4], same, at: A[0].map((q) => +q.toFixed(3)) });
    }
  }
  total += hits.length;
  const name = f.split(/[\\/]/).pop();
  if (hits.length) { const by = {}; for (const h of hits) { const k = `${h.a} / ${h.b}${h.same ? '' : ' (opposite, double-sided)'}`; by[k] = (by[k] || 0) + 1; } console.log(`${name}: ${hits.length} coincident pairs`, JSON.stringify(by), 'e.g.', JSON.stringify(hits[0].at)); }
  else console.log(`${name}: 0`);
}
console.log('TOTAL coincident pairs', total);
