// Fuel Shift - people and cars are built from code primitives (the sampler has no characters or vehicles);
// car wheels are the sampler's gs_tire model. Static parts are merged into one vertex-coloured mesh per body
// (a person is 6 draw calls, a car about 8) so a busy night shift stays fast on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const mats = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o); if (mats.has(k)) return mats.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 });
  mats.set(k, m); return m;
}
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const vcPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.25 });
const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1);
// one coloured, transformed copy of a geometry (uv dropped so every part merges)
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.deleteAttribute('uv');
  g.applyMatrix4(tmpM.compose(new THREE.Vector3(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, 0, 0)), new THREE.Vector3(sx, sy, sz)));
  tmpC.setHex(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const merged = (parts, m = vcMat) => { const o = new THREE.Mesh(mergeGeometries(parts), m); o.castShadow = true; o.receiveShadow = true; parts.forEach((p) => p.dispose()); return o; };

const G = {
  torso: new THREE.CapsuleGeometry(0.22, 0.34, 4, 12), head: new THREE.SphereGeometry(0.19, 16, 12), leg: new THREE.CapsuleGeometry(0.085, 0.36, 3, 8),
  arm: new THREE.CapsuleGeometry(0.065, 0.32, 3, 8), cap: new THREE.CylinderGeometry(0.2, 0.2, 0.09, 16), brim: new THREE.BoxGeometry(0.26, 0.025, 0.16),
  eye: new THREE.SphereGeometry(0.028, 8, 6), hand: new THREE.SphereGeometry(0.067, 8, 6), hair: new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  shadow: new THREE.CircleGeometry(0.32, 20), vest: new THREE.CapsuleGeometry(0.235, 0.2, 4, 12),
};
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0x3a86ff, 0x8338ec, 0x2ec4b6, 0xe63946, 0x6a994e, 0xf4a261, 0x457b9d, 0xb5838d, 0x264653, 0xffb703];
const PANTS = [0x22223b, 0x3d405b, 0x4a4e69, 0x2b2d42, 0x6c584c];
const HAIR = [0x2b1d0e, 0x4e342e, 0x8d6e63, 0xd4a017, 0x111111, 0xa0522d];
const pick = (a) => a[(Math.random() * a.length) | 0];
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

// chunky person: root at feet, faces +z; anim(dt, speed, carrying) swings limbs
export function makePerson(kind = 'customer') {
  const g = new THREE.Group(); const skin = pick(SKIN);
  const shirt = kind === 'player' ? 0xff7a1a : kind === 'staff' ? 0x18c6b3 : pick(SHIRTS);
  const pants = kind === 'player' ? 0x1d2f55 : pick(PANTS);
  const P = [part(G.torso, shirt, 0, 0.98, 0), part(G.head, skin, 0, 1.5, 0), part(G.eye, 0x1a1a1a, -0.07, 1.53, 0.17), part(G.eye, 0x1a1a1a, 0.07, 1.53, 0.17)];
  if (kind !== 'customer') P.push(part(G.vest, kind === 'player' ? 0xffd23f : 0xfff4e0, 0, 1.0, 0, 0, 1.04, 1, 1.04));
  if (kind === 'customer' && Math.random() < 0.6) P.push(part(G.hair, pick(HAIR), 0, 1.52, 0, -0.25));
  else { const cc = kind === 'player' ? 0xff7a1a : kind === 'staff' ? 0x18c6b3 : pick(SHIRTS); P.push(part(G.cap, cc, 0, 1.65, 0), part(G.brim, cc, 0, 1.625, 0.15)); }
  const body = new THREE.Group(); body.add(merged(P)); g.add(body);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(s * 0.11, 0.6, 0); const l = new THREE.Mesh(G.leg, mat(pants)); l.position.y = -0.27; l.castShadow = true; lp.add(l); g.add(lp); legs.push(lp);
    const ap = new THREE.Group(); ap.position.set(s * 0.29, 1.18, 0); ap.add(merged([part(G.arm, shirt, 0, -0.2, 0), part(G.hand, skin, 0, -0.4, 0)])); g.add(ap); arms.push(ap);
  }
  const blob = new THREE.Mesh(G.shadow, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; g.add(blob);
  const hold = new THREE.Group(); hold.position.set(0, 0.95, 0.42); g.add(hold); // carried items sit here (in front, on the arms)
  let ph = Math.random() * 6;
  g.userData = {
    hold, legs, arms, body,
    anim(dt, speed, carrying) {
      ph += dt * (4 + speed * 2.2); const sw = Math.min(1, speed / 2.5) * 0.65;
      legs[0].rotation.x = Math.sin(ph) * sw; legs[1].rotation.x = -Math.sin(ph) * sw;
      if (carrying) { arms[0].rotation.x = arms[1].rotation.x = -1.25; }
      else { arms[0].rotation.x = -Math.sin(ph) * sw * 0.8; arms[1].rotation.x = Math.sin(ph) * sw * 0.8; }
      body.position.y = Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, speed);
    },
  };
  return g;
}

const CAR_COLORS = [0xe63946, 0x3a86ff, 0xf1faee, 0x2a9d8f, 0xffb703, 0x1d3557, 0x8d99ae, 0x6a4c93, 0xff7a1a, 0x222222];
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CG = { body: box(1.8, 0.62, 4.0), cabin: box(1.6, 0.58, 2.1), glassF: box(1.52, 0.5, 0.05), glassS: box(0.05, 0.42, 1.8), light: box(0.36, 0.14, 0.06),
  bumper: box(1.84, 0.18, 0.16), truckBody: box(2.0, 0.8, 5.0), truckCab: box(1.9, 0.9, 1.7), bed: box(1.9, 0.12, 2.6), bedSide: box(0.1, 0.45, 2.6), bedBack: box(1.9, 0.45, 0.1) };
const headM = () => new THREE.MeshStandardMaterial({ color: 0xfff8d6, emissive: 0xfff1b0, emissiveIntensity: 0.25 });
const tailM = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 0.4 });
// car: root at ground centre, faces +z (front); wheels from the sampler tyre
export function makeCar(models, truck = false) {
  const g = new THREE.Group(); const col = truck ? pick([0x5c677d, 0x8d0801, 0x33415c, 0x6b705c]) : pick(CAR_COLORS);
  const GL = 0x1b263b, DK = 0x1a1a1a; const P = [], H = [], T = []; const head = headM();
  let len;
  if (!truck) {
    len = 4.0; P.push(part(CG.body, col, 0, 0.62, 0), part(CG.cabin, col, 0, 1.2, -0.25), part(CG.glassF, GL, 0, 1.2, 0.83, -0.35), part(CG.glassF, GL, 0, 1.2, -1.33, 0.35));
    for (const s of [-1, 1]) P.push(part(CG.glassS, GL, s * 0.79, 1.22, -0.25));
    for (const s of [-1, 1]) { H.push(part(CG.light, 0xffffff, s * 0.6, 0.72, 2.0)); T.push(part(CG.light, 0xffffff, s * 0.6, 0.72, -2.0)); }
    P.push(part(CG.bumper, DK, 0, 0.36, 2.0), part(CG.bumper, DK, 0, 0.36, -2.0));
  } else {
    len = 5.2; P.push(part(CG.truckBody, col, 0, 0.75, 0), part(CG.truckCab, col, 0, 1.55, 1.1), part(CG.glassF, GL, 0, 1.6, 1.96, 0, 1.15, 1.2, 1));
    for (const s of [-1, 1]) P.push(part(CG.glassS, GL, s * 0.96, 1.62, 1.1, 0, 1, 1.3, 0.8));
    P.push(part(CG.bed, DK, 0, 1.2, -1.15)); for (const s of [-1, 1]) P.push(part(CG.bedSide, col, s * 0.9, 1.45, -1.15)); P.push(part(CG.bedBack, col, 0, 1.45, -2.45));
    for (const s of [-1, 1]) { H.push(part(CG.light, 0xffffff, s * 0.7, 0.9, 2.5)); T.push(part(CG.light, 0xffffff, s * 0.75, 0.9, -2.5)); }
    P.push(part(CG.bumper, DK, 0, 0.4, 2.52, 0, 1.1), part(CG.bumper, DK, 0, 0.4, -2.52, 0, 1.1));
    const barrel = models.clone('fk_barrel_steel'); barrel.position.set(-0.35, 1.26, -1.6); barrel.scale.setScalar(0.8); g.add(barrel); // cargo, standing on the bed
  }
  g.add(merged(P, vcPaint)); g.add(merged(H, head)); g.add(merged(T, tailM));
  const wheels = []; const wx = truck ? 0.92 : 0.86, wz = truck ? 1.65 : 1.3, ws = truck ? 1.12 : 1.0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = models.clone('gs_tire'); const hub = new THREE.Group(); hub.position.set(sx * wx, 0.327 * ws, sz * wz); w.scale.setScalar(ws);
    w.position.y = -0.327 * ws; hub.add(w); g.add(hub); wheels.push(hub); // spin about the hub, not the tyre's bottom pivot
  }
  g.userData = { len, wheels, head, truck,
    roll(d) { for (const w of wheels) w.rotation.x += d / (0.327 * ws); }, // tyre radius 0.327 m
  };
  return g;
}
