// Fuel Shift - people and cars come from our free CC0 packs:
//   people: 8 Free Blocky Characters (rigged, idle / walk / run clips played through a THREE.AnimationMixer)
//   cars:   5 Free Toy Cars (wheel_* nodes spin in code)
// The sample has no carry clip, so carrying is a pose layered on the walk: both arms are aimed forward after the mixer runs.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const mats = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o); if (mats.has(k)) return mats.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 });
  mats.set(k, m); return m;
}
const pick = (a) => a[(Math.random() * a.length) | 0];
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
const blobGeo = new THREE.CircleGeometry(0.34, 20), ringGeo = new THREE.RingGeometry(0.36, 0.46, 28);

const CUSTOMERS = ['blocky_03_knight', 'blocky_05_wizard', 'blocky_06_pirate', 'blocky_07_astronaut', 'blocky_19_princess'];
// light per-instance tints (multiplied over the palette texture) so repeated characters still look varied
const TINTS = [null, null, 0xffeedd, 0xe4ecff, 0xffe2ec, 0xe6ffe6, 0xfff6cc];
const tintCache = new Map();
function tinted(m, hex) { const k = m.uuid + hex; if (!tintCache.has(k)) { const c = m.clone(); c.color.setHex(hex); tintCache.set(k, c); } return tintCache.get(k); }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
// rotate `bone` (in world space) so the bone -> child direction points along `dir`
function aim(bone, child, dir) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _b.sub(_a); if (_b.lengthSq() < 1e-8) return; _b.normalize();
  _q.setFromUnitVectors(_b, dir); bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq))); bone.updateMatrixWorld(true);
}

// person: root at the feet, faces +z. kind: player (Hero) | staff (Robot) | customer (5 characters, Zombie on the night shift)
export function makePerson(models, kind = 'customer', { night = false } = {}) {
  const name = kind === 'player' ? 'blocky_01_hero' : kind === 'staff' ? 'blocky_08_robot' : night && Math.random() < 0.3 ? 'blocky_09_zombie' : pick(CUSTOMERS);
  const src = models.chars[name]; const g = new THREE.Group(); const m = skClone(src.scene); m.scale.setScalar(0.92);
  const tint = kind === 'customer' ? pick(TINTS) : null;
  m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; if (tint) o.material = tinted(o.material, tint); } });
  g.add(m);
  const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; g.add(blob);
  if (kind !== 'customer') { const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: kind === 'player' ? 0xff7a1a : 0x18c6b3, transparent: true, opacity: 0.9, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; g.add(r); }
  const hold = new THREE.Group(); hold.position.set(0, 0.74, 0.4); g.add(hold); // carried items sit here (in front, on the arms)
  const mixer = new THREE.AnimationMixer(m); const act = {};
  for (const c of ['idle', 'walk', 'run']) { const clip = THREE.AnimationClip.findByName(src.clips, c); if (clip) act[c] = mixer.clipAction(clip); }
  let cur = act.idle; cur.time = Math.random() * 2; cur.play();
  const B = (n) => m.getObjectByName('mixamorig' + n);
  const arms = [[B('LeftArm'), B('LeftForeArm'), B('LeftHand')], [B('RightArm'), B('RightForeArm'), B('RightHand')]];
  g.userData = {
    hold, mixer, name,
    anim(dt, speed, carrying) {
      const want = speed > 3.9 ? act.run : speed > 0.25 ? act.walk : act.idle;
      if (want !== cur) { want.reset().play(); cur.crossFadeTo(want, 0.15, false); cur = want; }
      if (cur === act.walk) cur.timeScale = THREE.MathUtils.clamp(speed / 1.7, 0.6, 2.2); else if (cur === act.run) cur.timeScale = THREE.MathUtils.clamp(speed / 5.2, 0.8, 1.6); else cur.timeScale = 1;
      mixer.update(dt);
      if (carrying && arms[0][0]) { // carry pose: upper arms forward and a little down, forearms level
        m.updateMatrixWorld(true); const yaw = g.rotation.y;
        for (const [up, fore, hand] of arms) {
          aim(up, fore, _d.set(Math.sin(yaw) * 0.82, -0.57, Math.cos(yaw) * 0.82).normalize());
          aim(fore, hand, _d.set(Math.sin(yaw) * 0.99, -0.12, Math.cos(yaw) * 0.99).normalize());
        }
      }
    },
  };
  return g;
}

// car: root on the ground at the centre, faces +z (front). Regular cars and night "trucks" (monster truck, fire truck).
const CAR_SCALE = { muscle_blue: 1, police_classic: 1, icecream_pink: 0.86, monster_orange: 0.78, fire_red: 0.93 };
export function makeCar(models, truck = false) {
  const name = truck ? pick(['monster_orange', 'fire_red']) : pick(['muscle_blue', 'police_classic', 'icecream_pink']);
  const src = models.cars[name], s = CAR_SCALE[name]; const g = new THREE.Group(); const o = src.scene.clone(true); o.scale.setScalar(s); g.add(o);
  const wheels = []; let radius = 0.39;
  o.traverse((n) => { if (/^wheel_/.test(n.name)) { wheels.push(n); radius = n.position.y; } });
  const size = src.box.getSize(new THREE.Vector3()).multiplyScalar(s);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.95, size.z * 1.02), blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015; g.add(blob);
  g.userData = { len: size.z, width: size.x, h: size.y, wheels, head: null, truck, name,
    roll(d) { for (const w of wheels) w.rotation.x += d / (radius * s); }, // wheel node origin = hub, spin axis = local X
  };
  return g;
}
