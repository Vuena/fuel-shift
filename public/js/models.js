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

export class Models {
  constructor() { this.src = {}; this.box = {}; this.chars = {}; this.cars = {}; }
  async load(onProgress) {
    const L = new GLTFLoader(); let done = 0; const total = NAMES.length + CHARS.length + CARS.length;
    const prep = (s) => { s.updateMatrixWorld(true); s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = 4; } }); return s; };
    await Promise.all([
      ...NAMES.map((n) => L.loadAsync(`./models/${n}.glb`).then((g) => { const s = prep(g.scene); this.src[n] = s; this.box[n] = new THREE.Box3().setFromObject(s); onProgress(++done / total); })),
      ...CHARS.map((n) => L.loadAsync(`./chars/${n}.glb`).then((g) => { this.chars[n] = { scene: prep(g.scene), clips: g.animations }; onProgress(++done / total); })),
      ...CARS.map((n) => L.loadAsync(`./cars/${n}.glb`).then((g) => { this.cars[n] = { scene: prep(g.scene), box: new THREE.Box3().setFromObject(g.scene) }; onProgress(++done / total); })),
    ]);
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
