// Fuel Shift - the station: ground, road, forecourt, canopy, mini-mart shell (code-built), and every sampler prop.
// Every placed sampler model is registered in `props` (tag: 'floor' | 'on' | 'hang') for the layout gate (qa.js).
import * as THREE from 'three';
import { mat } from './actors.js';

export const PUMP_X = [0, 4.5, 9, 13.5];
export const PUMP_Z = 2.4;
export const SHOP = { x0: -3, x1: 13, z0: -12, z1: -3, door: [5, 7], side: [-10, -8.6] };
export const SHELF_X = { soda: 3.2, cereal: 5.4, oil: 7.6 };
export const SPOTS = {
  till: { x: 1.3, z: -6.45 }, queue0: { x: 1.3, z: -4.05 }, pallet: { x: 14.9, z: -8.2 }, jerry: { x: -3.4, z: 3.9 }, tyre: { x: 17.6, z: 3.9 },
  coffee: { x: -0.9, z: -7.15 }, doorOut: { x: 6, z: -2.2 }, doorIn: { x: 6, z: -4.2 },
};
export const shelfSpot = (id) => ({ x: SHELF_X[id], z: -10.75 });
export const pumpSpot = (i) => ({ x: PUMP_X[i], z: 3.95 });
export const baySpot = (i) => ({ x: PUMP_X[i] + 2.15, z: 3.05 });

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const noise = (g, w, h, a, n = 2600) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };

export function buildWorld(scene, models) {
  const colliders = [], props = [], lamps = [], nightMats = [];
  const W = { colliders, props, lamps, nightMats, stations: {}, pumps: [], unlockables: {} };
  const box = (w, h, d, m, x, y, z, { cast = true, recv = true, coll = false } = {}) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = recv; scene.add(o);
    if (coll) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return o;
  };
  // register a sampler model placement; tag: floor (rests on ground), on (rests on another surface), hang (mounted)
  const place = (name, x, y, z, ry = 0, tag = 'floor', parent = scene, s = 1) => {
    const o = models.clone(name); o.position.set(x, y, z); o.rotation.y = ry; if (s !== 1) o.scale.setScalar(s); parent.add(o); props.push({ o, name, tag }); return o;
  };

  // ---------- ground ----------
  const grassT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6fa35a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { g.fillStyle = `hsl(${95 + Math.random() * 20},${35 + Math.random() * 20}%,${30 + Math.random() * 18}%)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); } }, [30, 30]);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.02; grass.receiveShadow = true; scene.add(grass);
  const concT = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#b9b5ad'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.08, 9000); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); } }, [6, 3]);
  const fore = new THREE.Mesh(new THREE.PlaneGeometry(26, 12.6), new THREE.MeshStandardMaterial({ map: concT, roughness: 0.92 }));
  fore.rotation.x = -Math.PI / 2; fore.position.set(7, 0, 2.3); fore.receiveShadow = true; scene.add(fore);
  // back lane + shop apron (asphalt)
  const asphT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4d55'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.12, 6000); }, [16, 3]);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.4), new THREE.MeshStandardMaterial({ map: asphT, roughness: 0.95 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(7, 0.003, -1.0); lane.receiveShadow = true; scene.add(lane);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 13), new THREE.MeshStandardMaterial({ map: asphT, roughness: 0.95 }));
  side.rotation.x = -Math.PI / 2; side.position.set(17.6, 0.004, -8.2); side.receiveShadow = true; scene.add(side);
  const exitL = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 13.6), new THREE.MeshStandardMaterial({ map: asphT, roughness: 0.95 }));
  exitL.rotation.x = -Math.PI / 2; exitL.position.set(21.4, 0.003, 4.6); exitL.receiveShadow = true; scene.add(exitL);
  // road + sidewalk
  const roadT = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#3b3e45'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.1, 5000); g.fillStyle = '#f2f2f2'; for (let x = 0; x < w; x += 128) g.fillRect(x + 20, h / 2 - 3, 70, 6); g.fillStyle = '#e9c46a'; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4); }, [24, 1]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 4.4), new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.005, 12); road.receiveShadow = true; scene.add(road);
  const walkM = mat(0xcfc9bd, { r: 0.95 });
  box(160, 0.12, 1.4, walkM, 0, 0.06, 9.2, { cast: false }); box(160, 0.12, 1.2, walkM, 0, 0.06, 14.8, { cast: false });
  // forecourt markings: bay lines + arrows
  const lineM = mat(0xffffff, { r: 0.6 }), yellowM = mat(0xffcc33, { r: 0.6 });
  for (const px of PUMP_X) { box(0.12, 0.01, 4.6, lineM, px + 1.0, 0.012, 3.4, { cast: false }); box(0.12, 0.01, 4.6, lineM, px + 3.3, 0.012, 3.4, { cast: false }); }

  // ---------- pump islands + canopy ----------
  const kerbM = mat(0xe8e4dc, { r: 0.8 }), stripeM = mat(0xff7a1a, { r: 0.6 });
  PUMP_X.forEach((px, i) => {
    const g = new THREE.Group(); g.position.set(px, 0, 0); scene.add(g);
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.3), kerbM); island.position.set(0, 0.075, PUMP_Z); island.castShadow = island.receiveShadow = true; g.add(island);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 1.32), stripeM); edge.position.set(0, 0.125, PUMP_Z); // top flush with the kerb (0.15) g.add(edge);
    place('gs_pump_modern', 0, 0.15, PUMP_Z - 0.05, 0, 'on', g);
    for (const s of [-1, 1]) place('gs_bollard_steel', s * 0.66, 0.15, PUMP_Z - 0.48, 0, 'on', g);
    colliders.push({ x0: px - 0.8, x1: px + 0.8, z0: PUMP_Z - 0.65, z1: PUMP_Z + 0.65, unlock: i ? 'pump' + i : undefined });
    W.pumps.push({ i, group: g, x: px });
  });
  // night lighting for the forecourt comes from two point lights (see lights); no posts: from the top-down camera they read as stray sticks
  const pillarM = mat(0xdedede, { r: 0.5, m: 0.2 });

  // ---------- mini-mart shell (cutaway: no roof, glass front) ----------
  const wallM = mat(0xf2e8d5, { r: 0.85 }), wallIn = mat(0x9fd8cf, { r: 0.85 }), trimM = mat(0x1d2f55, { r: 0.6 }), frameM = mat(0xdfe6ee, { r: 0.4, m: 0.3 });
  const floorT = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#e9e3d7' : '#d6cfc0'; g.fillRect(x * 64, y * 64, 64, 64); } noise(g, w, h, 0.05, 3000); }, [8, 4.5]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(5, 0.01, -7.5); floor.receiveShadow = true; scene.add(floor);
  const WH = 2.9, T = 0.2;
  const bw = box(16 + T * 2, WH, T, wallIn, 5, WH / 2, SHOP.z0 - T / 2, { coll: true }); // back
  box(16 + T * 2, 0.3, T + 0.04, trimM, 5, WH - 0.15, SHOP.z0 - T / 2);
  // west wall
  box(T, WH, 9, wallM, SHOP.x0 - T / 2, WH / 2, -7.5, { coll: true });
  // east wall with side door (z -10 .. -8.6)
  box(T, WH, 2.0, wallM, SHOP.x1 + T / 2, WH / 2, -11.0, { coll: true });
  box(T, WH, 5.6, wallM, SHOP.x1 + T / 2, WH / 2, -5.8, { coll: true });
  box(T, 0.6, 1.4, wallM, SHOP.x1 + T / 2, WH - 0.3, -9.3);
  // front: low sill + glass + frame, door gap x 5..7
  const glassM = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, emissive: 0xffd28a, emissiveIntensity: 0 }); nightMats.push({ m: glassM, on: 0.5 });
  for (const [a, b] of [[SHOP.x0, SHOP.door[0]], [SHOP.door[1], SHOP.x1]]) {
    const w = b - a, cx = (a + b) / 2;
    box(w, 0.45, T, wallM, cx, 0.225, SHOP.z1 + T / 2, { coll: true });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.9), glassM); gl.position.set(cx, 1.4, SHOP.z1 + T / 2); gl.renderOrder = 3; scene.add(gl);
    for (let x = a; x <= b + 0.01; x += w / Math.max(1, Math.round(w / 2))) box(0.06, 1.95, 0.1, frameM, x, 1.4, SHOP.z1 + T / 2, { recv: false });
    box(w, 0.06, 0.1, frameM, cx, 2.38, SHOP.z1 + T / 2, { recv: false });
  }
  for (const x of SHOP.door) box(0.1, 2.4, 0.12, frameM, x, 1.2, SHOP.z1 + T / 2);
  // door mat
  box(2, 0.02, 1.2, mat(0x1d2f55, { r: 1 }), 6, 0.02, -3.7, { cast: false });
  // store sign over the back wall (inside, readable from the camera)
  const signT = canvasTex(1024, 160, (g, w, h) => { g.fillStyle = '#1d2f55'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff7a1a'; g.fillRect(0, h - 16, w, 16);
    g.font = '900 96px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('FUEL SHIFT MART', w / 2, h / 2 - 6); g.fillStyle = '#ffb347'; g.font = '900 34px Segoe UI, Arial'; g.fillText('OPEN 24/7', w * 0.88, h / 2 + 34); });
  const signM = new THREE.MeshStandardMaterial({ map: signT, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: 0.15 }); nightMats.push({ m: signM, on: 0.9, off: 0.15 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.72), signM); sign.position.set(5, 2.46, SHOP.z0 + 0.02); scene.add(sign);

  // ---------- counter + till ----------
  const counterTop = mat(0x1d2f55, { r: 0.4 }), counterFront = mat(0xff7a1a, { r: 0.6 });
  box(3.0, 0.92, 0.8, counterFront, 1.3, 0.46, -5.2, { coll: true }); box(3.1, 0.06, 0.9, counterTop, 1.3, 0.95, -5.2);
  const till = place('sk_pos_till', 0.6, 0.98, -5.25, Math.PI, 'on');
  place('ap_mug', 1.3, 0.98, -5.0, 0.6, 'on');
  place('ap_plant_small', 2.35, 0.98, -5.3, 0.4, 'on');

  // ---------- shelves (one per product) ----------
  const BOARDS = [0.291, 0.691, 1.091, 1.491];
  const prodSpec = { soda: { m: 'sk_prod_can_soda_a', w: 0.086, rows: 2 }, cereal: { m: 'sk_prod_cereal_l_a', w: 0.215, rows: 1 }, oil: { m: 'gs_prod_oil_5l_a', w: 0.225, rows: 1 } };
  const makeShelf = (id) => {
    const sx = SHELF_X[id], sz = SHOP.z0, g = new THREE.Group(); scene.add(g);
    const sh = place('sk_shelf_wall_120', sx, 0, sz, 0, 'floor', g);
    const spec = prodSpec[id]; const per = Math.floor(1.08 / spec.w); const slots = [];
    for (let r = 0; r < spec.rows; r++) for (let b = BOARDS.length - 1; b >= 0; b--) for (let k = 0; k < per; k++) slots.push({ x: sx - 0.54 + spec.w * (k + 0.5), y: BOARDS[b], z: sz + 0.29 - r * 0.12 });
    for (let b = 0; b < BOARDS.length; b++) place('sk_price_tag_shelf', sx - 0.42 + (b % 2) * 0.7, BOARDS[b] - 0.02, sz + 0.4022, 0, 'hang', g); // on the board's front lip (z 0.4022, y -0.021..+0.03)
    colliders.push({ x0: sx - 0.62, x1: sx + 0.62, z0: sz, z1: sz + 0.45, unlock: id === 'soda' ? undefined : id });
    return { id, group: g, slots, model: spec.m, cap: Math.min(slots.length, id === 'soda' ? 24 : 16) };
  };
  for (const id of ['soda', 'cereal', 'oil']) W.stations[id] = makeShelf(id);
  place('ap_plant_small', SHELF_X.soda - 0.32, 1.96, SHOP.z0 + 0.2, 0.7, 'on', W.stations.soda.group);

  // ---------- coffee corner (unlockable): armchair, table with mugs, lamp, plant, cushion ----------
  const lounge = new THREE.Group(); scene.add(lounge);
  place('ap_coffee_table', -0.9, 0, -8.3, 0, 'floor', lounge);
  place('ap_armchair', -2.1, 0, -10.6, Math.PI / 4, 'floor', lounge);
  place('ap_pillow_square', -2.18, 0.523, -10.68, Math.PI / 4, 'on', lounge).rotation.x = 0; // cushion against the backrest
  place('ap_table_lamp', -0.56, 0.42, -8.3, 0, 'on', lounge);
  // backstock corner inside the side door (fills the shop's east half)
  place('fk_pallet_wood', 11.7, 0, -11.35, 0, 'floor');
  for (const [dx, dz, r] of [[-0.3, -0.2, 0], [0.3, -0.2, 0], [-0.3, 0.2, 0]]) place('fk_box_closed', 11.7 + dx, 0.144, -11.35 + dz, r, 'on');
  place('sk_carton_s', 11.7 + 0.28, 0.144, -11.35 + 0.22, 0.25, 'on');
  place('fk_item_box', 11.7 - 0.3, 0.545, -11.35 - 0.2, 0.15, 'on');
  place('sk_carton_s', 11.7 + 0.3, 0.545, -11.35 - 0.18, -0.2, 'on');
  place('fk_box_closed', 10.4, 0, -11.6, Math.PI / 2, 'floor');
  place('sk_carton_s', 10.4, 0.401, -11.6, 0.4, 'on');
  colliders.push({ x0: 10.15, x1: 12.35, z0: -11.95, z1: -10.9 });
  const coffeeSlots = []; for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) coffeeSlots.push({ x: -1.35 + k * 0.16, y: 0.42, z: -8.42 + r * 0.22 });
  W.stations.coffee = { id: 'coffee', group: lounge, slots: coffeeSlots, model: 'ap_mug', cap: 8 };
  colliders.push({ x0: -1.45, x1: -0.35, z0: -8.6, z1: -8.0, unlock: 'coffee' }, { x0: -2.6, x1: -1.6, z0: -11.1, z1: -10.1, unlock: 'coffee' });
  const lampLight = new THREE.PointLight(0xffc27a, 0, 5, 1.6); lampLight.position.set(-0.56, 1.1, -8.3); lounge.add(lampLight); lamps.push({ l: lampLight, on: 2.2 });

  // ---------- stock pallet (outside the side door) ----------
  const stock = new THREE.Group(); scene.add(stock);
  place('fk_pallet_wood', 15.8, 0, -9.6, 0, 'floor', stock);
  for (const [dx, dz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) place('fk_box_closed', 15.8 + dx, 0.144, -9.6 + dz, 0, 'on', stock);
  for (const [dx, dz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2]]) place('fk_box_closed', 15.8 + dx, 0.545, -9.6 + dz, 0, 'on', stock);
  place('sk_carton_s', 15.8 + 0.25, 0.545, -9.6 + 0.2, 0.3, 'on', stock);
  place('sk_carton_s', 15.8 - 0.3, 0.946, -9.6 - 0.2, -0.2, 'on', stock);
  place('fk_item_box', 15.8 + 0.3, 0.946, -9.6 - 0.15, 0.1, 'on', stock);
  colliders.push({ x0: 15.2, x1: 16.4, z0: -10.0, z1: -9.2 });
  place('fk_sign_forklift', SHOP.x1 + T, 1.25, -11.2, Math.PI / 2, 'hang');
  for (const [x, z] of [[17.5, -11.2], [18.2, -10.7], [17.6, -10.4]]) place('fk_barrel_steel', x, 0, z, Math.random() * 3, 'floor');
  colliders.push({ x0: 17.1, x1: 18.6, z0: -11.6, z1: -10.1 });
  place('fk_traffic_barrier_2m', 16.7, 0, -6.4, 0, 'floor');
  colliders.push({ x0: 16.7, x1: 18.7, z0: -6.75, z1: -6.35 });

  // ---------- jerry can rack (unlockable) ----------
  const jerry = new THREE.Group(); scene.add(jerry);
  place('fk_pallet_wood', -3.4, 0, 2.4, 0, 'floor', jerry);
  const jerrySlots = [];
  for (const [dx, dz] of [[-0.4, -0.12], [0, -0.12], [0.4, -0.12], [-0.4, 0.18], [0, 0.18], [0.4, 0.18]]) jerrySlots.push({ x: -3.4 + dx, y: 0.144, z: 2.4 + dz });
  jerrySlots.forEach((s) => place('gs_jerry_can', s.x, s.y, s.z, 0, 'on', jerry));
  W.unlockables.jerry = jerry; colliders.push({ x0: -4.0, x1: -2.8, z0: 2.0, z1: 2.8, unlock: 'jerry' });

  // ---------- tyre bay (unlockable) ----------
  const tyres = new THREE.Group(); scene.add(tyres);
  for (const [x, z, n] of [[17.2, 2.3, 4], [18.0, 2.5, 3]]) for (let k = 0; k < n; k++) {
    const t = models.clone('gs_tire'); tyres.add(lyingTyre(t, x, k * 0.206, z, k * 0.7)); props.push({ o: t, name: 'gs_tire', tag: k ? 'on' : 'floor' });
  }
  W.unlockables.tyre = tyres; colliders.push({ x0: 16.7, x1: 18.5, z0: 1.8, z1: 2.9, unlock: 'tyre' });
  place('gs_cone_traffic', 16.4, 0, 3.0, 0, 'floor', tyres);

  // ---------- forecourt dressing ----------
  for (const [x, z] of [[-4.4, 7.6], [-4.4, 5.6], [19.4, 7.6], [19.4, 5.6]]) place('gs_cone_traffic', x, 0, z, 0, 'floor');
  for (const x of [-2.6, 4.4, 7.6, 12.6]) { place('gs_bollard_steel', x, 0, -2.45, 0, 'floor'); colliders.push({ x0: x - 0.12, x1: x + 0.12, z0: -2.57, z1: -2.33 }); }
  // price pylon by the road
  const pyl = new THREE.Group(); pyl.position.set(-6.2, 0, 7.6); scene.add(pyl);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.6, 0.22), pillarM); p.position.set(s * 0.9, 2.3, 0); p.castShadow = true; pyl.add(p); }
  const pylC = document.createElement('canvas'); pylC.width = 256; pylC.height = 320; const pylT = new THREE.CanvasTexture(pylC); pylT.colorSpace = THREE.SRGBColorSpace;
  const pylM = new THREE.MeshStandardMaterial({ map: pylT, emissive: 0xffffff, emissiveMap: pylT, emissiveIntensity: 0.2 }); nightMats.push({ m: pylM, on: 1.0, off: 0.2 });
  const pb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.75, 0.3), [mat(0x1d2f55), mat(0x1d2f55), mat(0x1d2f55), mat(0x1d2f55), pylM, mat(0x1d2f55)]); pb.position.y = 4.2; pb.castShadow = true; pyl.add(pb);
  colliders.push({ x0: -7.3, x1: -5.1, z0: 7.4, z1: 7.8 });
  W.drawPylon = (price, gear) => {
    const g = pylC.getContext('2d'), w = 256, h = 320; g.fillStyle = '#1d2f55'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, 78); g.font = '900 42px Segoe UI, Arial'; g.textAlign = 'left'; const wf = g.measureText('FUEL ').width, ws = g.measureText('SHIFT').width, x0 = (w - wf - ws) / 2; g.fillStyle = '#fff'; g.fillText('FUEL ', x0, 55); g.fillStyle = '#1d2f55'; g.fillText('SHIFT', x0 + wf, 55); g.textAlign = 'center';
    g.fillStyle = '#0c1428'; g.fillRect(16, 98, w - 32, 110); g.fillStyle = '#ffd23f'; g.font = '900 84px Consolas, monospace'; g.fillText('$' + price.toFixed(2), w / 2, 184);
    g.fillStyle = '#fff4e0'; g.font = '900 34px Segoe UI, Arial'; g.fillText('GEAR ' + gear, w / 2, 262); g.fillStyle = '#18c6b3'; g.font = '800 22px Segoe UI, Arial'; g.fillText('OPEN 24/7', w / 2, 300);
    pylT.needsUpdate = true;
  };
  W.drawPylon(8, 1);

  // ---------- low-poly trees around the lot (code-built, instanced) ----------
  { let seed = 7; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spots = [];
    const ok = (x, z) => !(x > -9 && x < 25 && z > -14 && z < 16.5) && !(z > 8.3 && z < 15.6) && spots.every((p) => Math.hypot(p[0] - x, p[1] - z) > 2.6);
    for (let i = 0; spots.length < 46 && i < 4000; i++) { const x = -26 + rr() * 64, z = -30 + rr() * 58; if (ok(x, z)) spots.push([x, z, 0.75 + rr() * 0.6, rr()]); }
    const trunkG = new THREE.CylinderGeometry(0.14, 0.2, 1.3, 7), leafG = new THREE.ConeGeometry(1.15, 2.1, 8), leafG2 = new THREE.IcosahedronGeometry(1.2, 0);
    const trunk = new THREE.InstancedMesh(trunkG, mat(0x7a5233), spots.length), pine = new THREE.InstancedMesh(leafG, mat(0x3f7d4a), spots.length * 2), round = new THREE.InstancedMesh(leafG2, mat(0x5a9a45, { r: 0.9 }), spots.length);
    let np = 0, nr = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    spots.forEach(([x, z, k, t], i) => {
      sc.set(k, k, k); m4.compose(new THREE.Vector3(x, 0.65 * k, z), q, sc); trunk.setMatrixAt(i, m4);
      if (t < 0.55) { for (let j = 0; j < 2; j++) { m4.compose(new THREE.Vector3(x, (1.9 + j * 0.95) * k, z), q, sc.set(k * (1 - j * 0.25), k, k * (1 - j * 0.25))); pine.setMatrixAt(np++, m4); } }
      else { m4.compose(new THREE.Vector3(x, 2.1 * k, z), q.setFromEuler(new THREE.Euler(0, t * 6, 0)), sc.set(k, k * 0.9, k)); round.setMatrixAt(nr++, m4); q.identity(); }
    });
    pine.count = np; round.count = nr;
    for (const im of [trunk, pine, round]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x6b5a45, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.castShadow = true; scene.add(sun); scene.add(sun.target);
  const s = sun.shadow; s.camera.left = -22; s.camera.right = 22; s.camera.top = 22; s.camera.bottom = -22; s.camera.near = 1; s.camera.far = 90; s.bias = -0.0006; s.normalBias = 0.03;
  const canopyL = new THREE.PointLight(0xfff0d0, 0, 14, 1.2); canopyL.position.set(1.0, 4.6, 5.2); scene.add(canopyL); lamps.push({ l: canopyL, on: 26 });
  const canopyL2 = new THREE.PointLight(0xfff0d0, 0, 14, 1.2); canopyL2.position.set(11.0, 4.6, 5.2); scene.add(canopyL2); lamps.push({ l: canopyL2, on: 26 });
  const shopL = new THREE.PointLight(0xffe7c2, 0, 15, 1.1); shopL.position.set(5, 3.2, -7.5); scene.add(shopL); lamps.push({ l: shopL, on: 16 });
  Object.assign(W, { hemi, sun, scene });
  return W;
}

// a tyre lying flat (axis vertical), centred on (x, z), bottom at y. The upright tyre spans x +-0.103, y 0..0.654, z +-0.327;
// turned 90 deg about z it spans x -0.654..0, y +-0.103, so the child is offset by (+0.327, +0.103). Returns the holder group.
export function lyingTyre(o, x, y, z, spin = 0) {
  const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = spin; o.rotation.set(0, 0, Math.PI / 2); o.position.set(0.327, 0.103, 0); h.add(o); return h;
}
