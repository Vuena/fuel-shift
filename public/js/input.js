// Fuel Shift - input. Phones: a floating joystick that spawns in the bottom-left corner zone (it never covers the gear buttons).
// Desktop: WASD / arrows, or hold the left mouse button and drag (a floating stick at the press point).
// Gearbox: Right Shift / E = up, Left Shift / Q = down (the theme: the Shift keys are your gearbox).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input {
  constructor(canvas, { onGear, onAny, isTouch }) {
    this.c = canvas; this.onGear = onGear; this.onAny = onAny; this.touch = isTouch;
    this.keys = new Set(); this.R = 50; this.DEAD = 7;
    this.stick = { x: 0, y: 0, active: false }; this.s = { id: null, ox: 0, oy: 0 };
    this.bot = null; // QA autopilot writes {x,y} here
    this.enabled = true;
    this.ring = document.getElementById('stick'); this.knob = this.ring.querySelector('i');
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    addEventListener('blur', () => { this.keys.clear(); this.end(); });
    addEventListener('keydown', (e) => {
      if (this.onAny) this.onAny();
      if (e.code === 'ShiftRight' || e.code === 'KeyE') { if (!e.repeat) this.onGear(1); e.preventDefault(); return; }
      if (e.code === 'ShiftLeft' || e.code === 'KeyQ') { if (!e.repeat) this.onGear(-1); e.preventDefault(); return; }
      if (/^(Arrow|Key[WASD])/.test(e.code)) { this.keys.add(e.code); e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.layout();
  }
  // joystick home + zone (bottom-left): portrait 58% x 46% of the screen, landscape 36% x 60%
  zone() {
    const w = innerWidth, h = innerHeight, land = w > h;
    const zw = land ? w * 0.36 : w * 0.58, zh = land ? h * 0.6 : h * 0.46;
    return { x0: 0, x1: zw, y0: h - zh, y1: h, hx: Math.min(110, zw * 0.42), hy: h - Math.min(130, zh * 0.4) };
  }
  get home() { const z = this.zone(); return { x: z.hx, y: z.hy }; }
  layout() { if (this.s.id === null) { const h = this.home; this.place(h.x, h.y); } this.ring.classList.toggle('off', !this.touch || !this.enabled); }
  place(x, y) { this.ring.style.transform = `translate(${x}px,${y}px)`; }
  down(e) {
    if (this.onAny) this.onAny();
    if (!this.enabled || this.s.id !== null) return;
    const mouse = e.pointerType === 'mouse';
    if (mouse && e.button !== 0) return;
    if (!mouse) { const z = this.zone(); if (!(e.clientX <= z.x1 && e.clientY >= z.y0)) return; this.touch = true; this.layout(); }
    e.preventDefault();
    Object.assign(this.s, { id: e.pointerId, ox: e.clientX, oy: e.clientY, mouse });
    this.stick.active = true; this.ring.classList.add('live');
    if (mouse) this.ring.classList.remove('off');
    this.place(e.clientX, e.clientY); this.moveTo(e.clientX, e.clientY);
    try { this.c.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  }
  move(e) { if (e.pointerId === this.s.id) this.moveTo(e.clientX, e.clientY); }
  moveTo(x, y) {
    const s = this.s; let dx = x - s.ox, dy = y - s.oy, d = Math.hypot(dx, dy);
    if (d > this.R) { const k = (d - this.R) / d; s.ox += dx * k; s.oy += dy * k; this.place(s.ox, s.oy); dx = x - s.ox; dy = y - s.oy; d = Math.hypot(dx, dy); }
    const t = clamp((d - this.DEAD) / (this.R * 0.8 - this.DEAD), 0, 1);
    this.stick.x = d > 0 ? (dx / d) * t : 0; this.stick.y = d > 0 ? (dy / d) * t : 0;
    const kd = Math.min(d, this.R); this.knob.style.transform = d > 0 ? `translate(${(dx / d) * kd}px,${(dy / d) * kd}px)` : '';
  }
  up(e) { if (e.pointerId === this.s.id) this.end(); }
  end() {
    const wasMouse = this.s.mouse; this.s.id = null; Object.assign(this.stick, { x: 0, y: 0, active: false });
    this.knob.style.transform = ''; this.ring.classList.remove('live'); if (wasMouse && !this.touch) this.ring.classList.add('off'); this.layout();
  }
  setEnabled(on) { this.enabled = on; if (!on) { this.end(); this.keys.clear(); } this.layout(); }
  // screen-space move vector: x right, y down (forward = up the screen), length <= 1
  vec() {
    if (this.bot) return this.bot;
    let x = 0, y = 0; const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1; if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    return { x: this.stick.x, y: this.stick.y };
  }
}
