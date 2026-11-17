// All sound in Solano Heat is synthesized live with WebAudio: no audio
// files, no network. Engine hum, sirens, gunshots, punches, pickups and
// a small looping bass-and-hats groove are all oscillators and noise.

import { clamp } from './utils.js';

/** Build one shared noise buffer for bursts (gunshots, crashes, skids). */
function makeNoiseBuffer(ctx) {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  /** Create the AudioContext on the first user gesture (browsers require it). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.noise = makeNoiseBuffer(this.ctx);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineHum();
    this.startMusic();
    this.started = true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** A short tone: frequency, duration, waveform, volume, optional slide. */
  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise, for impacts and gunfire. */
  noiseBurst(dur, vol, filterFreq = 1200, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- one-shot effects -------------------------------------------------

  shoot() {
    this.noiseBurst(0.14, 0.5, 2800, 'highpass');
    this.blip(180, 0.08, 'square', 0.18, 60);
  }

  punch() {
    this.noiseBurst(0.09, 0.35, 500);
  }

  crash(strength = 1) {
    this.noiseBurst(0.25, clamp(0.25 + strength * 0.4, 0, 0.7), 900);
    this.blip(90, 0.2, 'triangle', 0.3, 40);
  }

  explosion() {
    this.noiseBurst(0.7, 0.7, 500);
    this.blip(70, 0.6, 'sine', 0.5, 28);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.22);
    setTimeout(() => this.blip(990, 0.14, 'sine', 0.22), 70);
  }

  cash() {
    this.blip(880, 0.08, 'triangle', 0.2);
    setTimeout(() => this.blip(1174, 0.08, 'triangle', 0.2), 60);
    setTimeout(() => this.blip(1568, 0.16, 'triangle', 0.2), 120);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.22), i * 110));
  }

  missionFail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sawtooth', 0.14), i * 140));
  }

  busted() {
    [440, 415, 392].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'square', 0.12), i * 160));
  }

  click() {
    this.blip(1200, 0.04, 'square', 0.12);
  }

  door() {
    this.noiseBurst(0.12, 0.2, 700);
    this.blip(160, 0.1, 'triangle', 0.15, 90);
  }

  // ---- continuous: engine hum -------------------------------------------

  startEngineHum() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** Call every frame: engine pitch follows speed, silent on foot. */
  setEngine(speedRatio, inCar) {
    if (!this.ctx || !this.engineGain) return;
    const target = inCar ? 0.05 + speedRatio * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, this.ctx.currentTime, 0.1);
  }

  /** A two-tone police siren while any police car is near. */
  setSiren(active, dt) {
    if (!this.ctx) return;
    if (!active) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    }
    this.sirenTimer += dt;
    const hi = Math.floor(this.sirenTimer * 1.6) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.045, this.ctx.currentTime, 0.1);
  }

  // ---- music: a quiet 8-step bass groove --------------------------------

  startMusic() {
    // Bass notes of a minor-key loop, one step every 190 ms.
    const bass = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn) return;
      const step = this.musicStep++ % 8;
      const f = bass[step];
      if (f) this.blip(f, 0.16, 'triangle', 0.07);
      if (step % 2 === 0) this.noiseBurst(0.03, 0.03, 6000, 'highpass');
    }, 190);
  }
}
