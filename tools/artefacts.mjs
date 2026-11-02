// Render-artefact check: node tools/artefacts.mjs <tag> [mobile 0|1] [port]   then   python tools/artefacts.py shots/art-<tag>
// 1) nudge test: frozen frame rendered twice, camera moved by exactly 1 px; static surfaces must match after re-alignment
//    (z-fighting, shadow acne and shadow shimmer change pixels on flat surfaces). Views: overview (shop / forecourt, three times
//    of day) and close-ups of the wall trim, the counter top (till + plant), a wizard hat and shadows on the forecourt.
// 2) clip: 3 s (60 frames) stepped deterministically while characters walk and the camera pans 1 px per frame; consecutive
//    frames are compared the same way with every character / car masked out -> flicker on static surfaces.
// Frames are read straight from the WebGL canvas (no HUD), so DOM labels do not count.
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os'; import { mkdirSync, writeFileSync } from 'node:fs';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [tag = 'x', mob = '0', port = '9505'] = process.argv.slice(2); const mobile = mob === '1';
const W = mobile ? 390 : 1280, H = mobile ? 844 : 720, out = ROOT + `shots/art-${tag}${mobile ? '-phone' : ''}/`; mkdirSync(out, { recursive: true });
const tab = await chrome('art-' + tag + mob, +port, TMP + 'go26-art-' + mob, { args: ['--window-size=' + W + ',' + H] });
const save = (name, dataUrl) => writeFileSync(out + name + '.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
const meta = { views: [], clips: [] };
try {
  await tab.size(W, H, mobile); await tab.go((process.env.URL || 'http://localhost:8811/public/') + '?art' + (mobile ? '&touch' : '')); // real render path (merged static meshes), not ?qa
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  meta.coplanar = await tab.ev('__fs.api.models.coplanar');
  await tab.ev(`(() => { localStorage.setItem('fuelshift.tutDone', 'true'); const a = __fs.api, G = a.G; a.startDay(); G.spawnT = 1e9; G.ambT = 1e9; G.noGuide = true;
    for (const id of ['pump1','pump2','pump3','cereal','oil','coffee','jerry','tyre']) G.unlocked.add(id); a.applyUnlocks();
    for (const id of ['soda','cereal','oil','coffee']) { const st = a.stations()[id]; st.stock = Math.round(st.cap * 0.7); st.inst.count = st.stock; }
    a.player().position.set(4.2, 0, -6.2); a.hire('stocker'); for (let i = 0; i < 3; i++) a.spawnCar();
    for (let i = 0; i < 40 && !a.ENT.people.some(p => p.mesh.userData.name === 'blocky_05_wizard'); i++) a.spawnCustomer({ x: 6 + (i % 4) * 0.5, z: -4.4 });
    G.qaHold = true; G.state = 'qa'; })()`);
  if (process.env.SELFTEST) await tab.ev(`(async () => { const THREE = await import('three'); const a = __fs.api, s = a.W().sun.shadow; // inject known artefacts: they MUST fail
    s.bias = 0; s.normalBias = 0; s.mapSize.set(512, 512); if (s.map) { s.map.dispose(); s.map = null; }
    const z = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0xff3366 })); z.rotation.x = -Math.PI / 2; z.position.set(4, 0.026, -6.5); z.receiveShadow = true; a.scene.add(z); })()`);
  // let actors settle a little (cars drive in) with deterministic steps, then freeze
  await tab.ev(`(() => { const a = __fs.api, G = a.G; G.state = 'play'; for (let i = 0; i < 80; i++) a.frame(0.05); G.state = 'qa'; })()`);
  const pxWorldAt = `(() => { const THREE_V = (x, y, z) => { const v = __fs.api.camera.position.clone(); v.set(x, y, z); return v.project(__fs.api.camera); };
      return (p) => { const a = THREE_V(p.x, p.y, p.z), b = THREE_V(p.x + 1, p.y, p.z); return 1 / Math.abs((b.x - a.x) / 2 * innerWidth); }; })()`;
  // ---- 1) nudge views
  const views = [
    { name: 'shop-morning', p: 0.15, target: { x: 5, z: -6.5 } }, { name: 'forecourt-morning', p: 0.15, target: { x: 7, z: 3 } },
    { name: 'shop-evening', p: 0.5, target: { x: 5, z: -6.5 } }, { name: 'forecourt-evening', p: 0.5, target: { x: 7, z: 3 } },
    { name: 'shop-night', p: 0.85, target: { x: 5, z: -6.5 } },
    { name: 'close-trim', p: 0.5, cam: [9.5, 3.4, -9.4, 9.5, 2.7, -12.1] }, { name: 'close-counter', p: 0.5, cam: [2.4, 2.3, -4.0, 1.0, 0.95, -5.6] },
    { name: 'close-shadows', p: 0.5, cam: [3.5, 4.0, 8.0, 3.5, 0.0, 3.5] }, { name: 'close-wizard', p: 0.5, wizard: true },
  ];
  for (const v of views) {
    const r = await tab.ev(`(() => { const a = __fs.api, G = a.G, cam = a.camera; a.setDayLight(${v.p}); G.camOverride = null; G.qaTarget = null;
      ${v.wizard ? `const w = a.ENT.people.find(p => p.mesh.userData.name === 'blocky_05_wizard'); if (w) { w.pos = { x: 8.0, z: -5.2 }; w.mesh.position.set(8.0, 0.015, -5.2); w.mesh.rotation.y = 0.4; for (const o of a.ENT.people) if (o !== w && Math.hypot(o.pos.x - 8, o.pos.z + 5.2) < 3) { o.pos = { x: o.pos.x, z: -10.6 }; o.mesh.position.set(o.pos.x, 0.015, -10.6); } } const wp = w ? w.mesh.position : { x: 4, y: 0, z: -4.4 }; G.camOverride = [wp.x + 1.1, 2.6, wp.z + 1.6, wp.x, 1.7, wp.z];`
        : v.cam ? `G.camOverride = ${JSON.stringify(v.cam)};` : `G.qaTarget = ${JSON.stringify(v.target)};`}
      a.updateCamera(0, true); cam.updateMatrixWorld(); const pw = ${pxWorldAt}; const look = G.camOverride ? { x: G.camOverride[3], y: G.camOverride[4], z: G.camOverride[5] } : { x: G.qaTarget.x, y: 0, z: G.qaTarget.z };
      const step = pw(look); a.renderer.render(a.scene, cam); const A = a.renderer.domElement.toDataURL('image/png');
      const W = a.W(), sd0 = W.sunDir.clone(); W.sunDir.applyAxisAngle(new (cam.position.constructor)(0, 1, 0), 0.1 * Math.PI / 180).applyAxisAngle(new (cam.position.constructor)(1, 0, 0), 0.07 * Math.PI / 180);
      a.updateCamera(0, true); a.renderer.render(a.scene, cam); const C = a.renderer.domElement.toDataURL('image/png'); W.sunDir.copy(sd0); a.updateCamera(0, true);
      // move the camera 1 px to the right (screen x) at the look point: for the game camera through the target, so the sun follows too
      if (G.camOverride) { const r = new (cam.position.constructor)(); cam.matrixWorld.extractBasis(r, new (cam.position.constructor)(), new (cam.position.constructor)()); const o = G.camOverride.slice(); o[0] += r.x * step; o[1] += r.y * step; o[2] += r.z * step; o[3] += r.x * step; o[4] += r.y * step; o[5] += r.z * step; G.camOverride = o; }
      else G.qaTarget = { x: G.qaTarget.x + step, z: G.qaTarget.z };
      a.updateCamera(0, true); a.renderer.render(a.scene, cam); const B = a.renderer.domElement.toDataURL('image/png'); return { A, B, C, step }; })()`);
    save(v.name + '-a', r.A); save(v.name + '-b', r.B); save(v.name + '-c', r.C); meta.views.push({ name: v.name, step: r.step });
  }
  // ---- 2) clips: characters walking, camera panning 1 px per frame (day and night)
  for (const [cn, p, tgt] of [['clip-shop-day', 0.3, { x: 4.5, z: -6.5 }], ['clip-forecourt-night', 0.85, { x: 7, z: 2.5 }]]) {
    await tab.ev(`(() => { const a = __fs.api, G = a.G; G.camOverride = null; G.qaTarget = ${JSON.stringify(tgt)}; G.shift = ${p > 0.66 ? 2 : p > 0.33 ? 1 : 0}; G.shiftT = ${((p * 3) % 1) * 240}; G.state = 'play'; for (let i = 0; i < 4; i++) a.spawnCustomer({ x: 6, z: -3.6 }); window.__clip = []; })()`);
    for (let i = 0; i < 60; i++) {
      const r = await tab.ev(`(() => { const a = __fs.api, G = a.G, cam = a.camera; const pw = ${pxWorldAt}; const step = pw({ x: G.qaTarget.x, y: 0, z: G.qaTarget.z });
        G.qaTarget = { x: G.qaTarget.x + step, z: G.qaTarget.z }; G.spawnT = 1e9; a.frame(0.05); const img = a.renderer.domElement.toDataURL('image/png');
        const ents = [...a.ENT.people.map(p => [p.pos.x, 1.0, p.pos.z, 1.3]), ...a.ENT.staff.map(p => [p.pos.x, 1.0, p.pos.z, 1.3]), [a.player().position.x, 1.0, a.player().position.z, 1.6], ...a.ENT.cars.map(c => [c.pos.x, 1.0, c.pos.z, 3.0])];
        const px = 1 / step; const marks = ents.map(([x, y, z, rr]) => { const v = cam.position.clone().set(x, y, z).project(cam); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight), Math.round(rr * px)]; });
        return { img, marks }; })()`);
      save(`${cn}-${String(i).padStart(2, '0')}`, r.img); meta.clips.push({ clip: cn, i, marks: r.marks });
    }
  }
  meta.cssW = await tab.ev('innerWidth');
  writeFileSync(out + 'meta.json', JSON.stringify(meta));
  console.log(`[art ${tag}${mobile ? ' phone' : ''}] coplanar`, JSON.stringify(meta.coplanar), 'views', meta.views.length, 'clip frames', meta.clips.length);
} catch (e) { console.log('FAIL', e.message); }
console.log('console errors', tab.errs.length, JSON.stringify(tab.errs.slice(0, 5)));
await tab.close(); process.exit(0);
