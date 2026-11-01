// Fuel Shift - sound. One-shots are Kenney CC0 samples (see CREDITS.md); the engine hum, the gear-shift clunk
// and the road ambience are synthesised here with WebAudio.
const FILES = ['click', 'sale', 'drop', 'error', 'upgrade', 'select', 'pluck', 'toggle', 'bong', 'metal', 'plank', 'thud', 'glass', 'bell', 'step0', 'step1', 'win', 'start'];

export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.hidden = false; this.buf = {}; this.last = {}; this.gear = 1; }

  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running' && !this.hidden) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    for (const n of FILES) fetch(`./sfx/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).then((b) => { this.buf[n] = b; }).catch(() => {});
    this.startBed();
  }
  // road / engine bed: low filtered noise (traffic) + a soft two-oscillator engine hum whose pitch follows the gear
  startBed() {
    const c = this.ctx, len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
    const n = c.createBufferSource(); n.buffer = nb; n.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.road = c.createGain(); this.road.gain.value = 0.05; n.connect(lp); lp.connect(this.road); this.road.connect(this.master); n.start();
    this.hum = c.createGain(); this.hum.gain.value = 0.0; this.hum.connect(this.master);
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 300; hf.connect(this.hum);
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'triangle';
    this.o1.connect(hf); this.o2.connect(hf); this.o1.start(); this.o2.start();
    this.setGear(this.gear, true);
  }
  setGear(g, quiet) {
    this.gear = g; if (!this.ctx || !this.o1) return; const t = this.ctx.currentTime;
    const f = 38 + g * 9;
    this.o1.frequency.setTargetAtTime(f, t, 0.25); this.o2.frequency.setTargetAtTime(f * 1.5, t, 0.25);
    this.hum.gain.setTargetAtTime(0.012 + g * 0.006, t, 0.3);
    this.road.gain.setTargetAtTime(0.035 + g * 0.012, t, 0.4);
    if (!quiet) { // revving sweep + clunk
      this.o1.frequency.setValueAtTime(f * 1.7, t); this.o1.frequency.setTargetAtTime(f, t + 0.05, 0.18);
      this.play('metal', { vol: 0.35, rate: 0.7 + g * 0.06 }); this.play('toggle', { vol: 0.5, rate: 0.8 });
    }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }
  setHidden(h) { this.hidden = h; if (!this.ctx) return; try { h ? this.ctx.suspend() : this.ctx.resume(); } catch (e) { /* ignore */ } }
  play(name, { rate = 1, vol = 0.6, delay = 0, gap = 0.03 } = {}) {
    if (!this.ctx || this.muted || this.hidden) return; const b = this.buf[name]; if (!b) return;
    const c = this.ctx; if (gap && this.last[name] && c.currentTime - this.last[name] < gap) return; this.last[name] = c.currentTime;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start(c.currentTime + delay);
  }
  cash(n = 1) { this.play('sale', { vol: 0.42, rate: 0.95 + Math.min(0.5, n * 0.02) + Math.random() * 0.06, gap: 0.06 }); }
  coin(i) { this.play('pluck', { vol: 0.35, rate: 1 + (i % 6) * 0.09, gap: 0.04 }); }
  pick() { this.play('plank', { vol: 0.35, rate: 1.15 + Math.random() * 0.15, gap: 0.08 }); }
  drop() { this.play('drop', { vol: 0.45, rate: 0.95 + Math.random() * 0.1, gap: 0.06 }); }
  fuel() { this.play('glass', { vol: 0.12, rate: 0.6 + Math.random() * 0.1, gap: 0.25 }); }
  bad() { this.play('error', { vol: 0.5 }); }
  buy() { this.play('upgrade', { vol: 0.55 }); this.play('bell', { vol: 0.25, rate: 1.4 }); }
  ui() { this.play('click', { vol: 0.5 }); }
  bell() { this.play('bell', { vol: 0.35, rate: 1.0 }); }
  shiftEnd() { this.play('win', { vol: 0.6 }); }
  start() { this.play('start', { vol: 0.55 }); }
  step(i) { this.play(i % 2 ? 'step1' : 'step0', { vol: 0.12, rate: 1 + Math.random() * 0.1, gap: 0.12 }); }
}
