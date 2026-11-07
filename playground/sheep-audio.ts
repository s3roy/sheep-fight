/**
 * Sheep Fight audio — bleats, finish-line hits, win jingles. Sparse, not spammy.
 */

export class SheepAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastBleat = 0;
  private lastThud = 0;
  private lastStep = 0;
  private lastFinish = 0;

  isEnabled() {
    return this.enabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  async unlock() {
    if (typeof window === 'undefined') return;
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private out() {
    this.ensure();
    return this.master!;
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number; q?: number } = {},
  ) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(4200, freq * 4.5);
    f.Q.value = opts.q ?? 0.7;
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, opts.slide), t + dur);
    const vol = opts.vol ?? 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.016);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noiseBurst(dur: number, vol: number, startHz: number, endHz: number, delay = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 0.9;
    filt.frequency.setValueAtTime(startHz, t);
    filt.frequency.exponentialRampToValueAtTime(endHz, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.out());
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Soft chord stab */
  private chord(freqs: number[], dur: number, vol: number, delay = 0, type: OscillatorType = 'triangle') {
    for (const f of freqs) this.tone(f, dur, { type, vol: vol / freqs.length, delay });
  }

  /** Double-pulse “baa-aa” */
  bleat(urgent = false) {
    const now = performance.now();
    if (now - this.lastBleat < (urgent ? 260 : 480)) return;
    this.lastBleat = now;
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const base = urgent ? 360 + Math.random() * 30 : 300 + Math.random() * 35;

    const makePulse = (start: number, f0: number, f1: number, vol: number, dur: number) => {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      o.type = 'triangle';
      lfo.type = 'sine';
      lfo.frequency.value = urgent ? 8 : 5.5;
      lfoG.gain.value = 22;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);
      o.frequency.setValueAtTime(f0, start);
      o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      bp.type = 'bandpass';
      bp.frequency.value = f0 * 1.1;
      bp.Q.value = 1.6;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(bp);
      bp.connect(g);
      g.connect(this.out());
      o.start(start);
      lfo.start(start);
      o.stop(start + dur + 0.02);
      lfo.stop(start + dur + 0.02);
    };

    makePulse(t, base, base * 0.78, urgent ? 0.1 : 0.07, 0.16);
    makePulse(t + 0.14, base * 0.92, base * 0.65, urgent ? 0.08 : 0.055, 0.2);
  }

  fightBleat() {
    // Quiet clash tick — no urgent bleat spam
    const now = performance.now();
    if (now - this.lastThud < 420) return;
    this.lastThud = now;
    this.tone(95, 0.06, { vol: 0.035, slide: 60 });
    this.noiseBurst(0.05, 0.022, 600, 200);
  }

  click() {
    this.tone(640, 0.028, { vol: 0.018 });
  }

  select() {
    this.tone(520, 0.05, { vol: 0.025 });
    this.tone(680, 0.06, { vol: 0.018, delay: 0.04 });
  }

  deploy(team: 'sheep' | 'deer') {
    this.noiseBurst(0.09, 0.032, 380, 1400);
    this.tone(160, 0.07, { vol: 0.038, slide: 95 });
    this.tone(team === 'sheep' ? 440 : 360, 0.06, { type: 'triangle', vol: 0.028, delay: 0.04 });
    if (team === 'sheep') window.setTimeout(() => this.bleat(false), 40);
    else this.tone(210, 0.1, { type: 'triangle', vol: 0.032, delay: 0.06, slide: 150 });
  }

  thud() {
    const now = performance.now();
    if (now - this.lastThud < 150) return;
    this.lastThud = now;
    this.tone(78, 0.11, { vol: 0.08, slide: 45 });
    this.noiseBurst(0.07, 0.05, 500, 120);
  }

  /** Very quiet hoof when moving — rare */
  step() {
    const now = performance.now();
    if (now - this.lastStep < 900) return;
    this.lastStep = now;
    this.tone(110, 0.04, { vol: 0.015, type: 'triangle' });
  }

  /** Unit reaches the finish line / base */
  finishCross(team: 'sheep' | 'deer') {
    const now = performance.now();
    if (now - this.lastFinish < 120) return;
    this.lastFinish = now;

    this.noiseBurst(0.12, 0.055, 700, 140);
    this.tone(90, 0.16, { vol: 0.085, slide: 42 });
    // Bright ding → rising cheer
    this.tone(523, 0.08, { type: 'sine', vol: 0.055, delay: 0.02 });
    this.tone(659, 0.1, { type: 'sine', vol: 0.05, delay: 0.08 });
    this.tone(784, 0.14, { type: 'triangle', vol: 0.045, delay: 0.16 });
    if (team === 'sheep') {
      this.chord([392, 494, 587], 0.18, 0.07, 0.22);
      window.setTimeout(() => this.bleat(true), 80);
    } else {
      this.chord([349, 440, 523], 0.18, 0.065, 0.22);
      this.tone(240, 0.12, { type: 'triangle', vol: 0.04, delay: 0.28, slide: 180 });
    }
  }

  /** @deprecated use finishCross */
  hitBase() {
    this.finishCross('sheep');
  }

  death() {
    this.tone(240, 0.12, { type: 'triangle', vol: 0.04, slide: 95 });
    this.noiseBurst(0.1, 0.03, 400, 90, 0.02);
  }

  manaPing() {
    this.tone(880, 0.04, { vol: 0.012, type: 'sine' });
  }

  win() {
    this.bleat(false);
    // Little fanfare
    this.tone(392, 0.1, { vol: 0.05, delay: 0.1 });
    this.tone(494, 0.1, { vol: 0.048, delay: 0.2 });
    this.tone(587, 0.12, { vol: 0.05, delay: 0.3 });
    this.tone(784, 0.22, { type: 'triangle', vol: 0.055, delay: 0.42 });
    this.chord([392, 523, 659, 784], 0.35, 0.08, 0.55);
    this.noiseBurst(0.2, 0.04, 1200, 400, 0.55);
    window.setTimeout(() => this.bleat(false), 400);
  }

  lose() {
    this.tone(311, 0.18, { vol: 0.05, slide: 180 });
    this.tone(247, 0.2, { vol: 0.04, delay: 0.12, slide: 140 });
    this.tone(196, 0.28, { type: 'triangle', vol: 0.045, delay: 0.26, slide: 110 });
    this.noiseBurst(0.18, 0.035, 500, 80, 0.1);
  }

  start() {
    this.chord([330, 415, 494], 0.2, 0.06);
    this.bleat(false);
    this.tone(520, 0.1, { vol: 0.03, delay: 0.22 });
  }
}

export const sheepAudio = new SheepAudio();
