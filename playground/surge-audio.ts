/**
 * Surge audio — sparse, soft event hits only.
 * No engine drone, no chirp spam, no countdown beeps.
 */

export class SurgeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  /** Very quiet flight bed (sine only) — optional, starts muted */
  private bed: { osc: OscillatorNode; gain: GainNode } | null = null;

  isEnabled() {
    return this.enabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopBed();
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
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private out(): AudioNode {
    this.ensure();
    return this.master!;
  }

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      vol?: number;
      delay?: number;
      slideTo?: number;
    } = {},
  ) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(2800, freq * 4);
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    }
    const vol = opts.vol ?? 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private softNoise(dur: number, vol: number, startHz: number, endHz: number) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(startHz, t);
    filt.frequency.exponentialRampToValueAtTime(endHz, t + dur * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.out());
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Near-silent UI tap */
  click() {
    this.tone(640, 0.035, { type: 'sine', vol: 0.025 });
  }

  /** Bet confirmed — one soft pluck */
  lock() {
    this.tone(392, 0.12, { type: 'sine', vol: 0.045 });
    this.tone(523, 0.14, { type: 'sine', vol: 0.03, delay: 0.06 });
  }

  /** Kept for API compat — intentionally silent (countdown beeps were annoying) */
  countdownTick(_secondsLeft: number) {
    /* no-op */
  }

  /** Soft lift whoosh + start barely-audible bed */
  liftoff() {
    this.stopBed();
    this.softNoise(0.28, 0.045, 500, 1600);
    this.tone(110, 0.22, { type: 'sine', vol: 0.04, slideTo: 180 });
    this.startBed();
  }

  private startBed() {
    if (!this.enabled || this.bed) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 48;
    const gain = ctx.createGain();
    // Barely there — felt more than heard
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.018, t + 0.6);
    osc.connect(gain);
    gain.connect(this.out());
    osc.start(t);
    this.bed = { osc, gain };
  }

  /** Gentle pitch lift with multiplier — no chirps */
  setFlightMult(m: number) {
    if (!this.bed || !this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const clamped = Math.max(1, Math.min(m, 20));
    const f = 46 + Math.log(clamped) * 14; // slow, calm climb
    this.bed.osc.frequency.setTargetAtTime(f, t, 0.25);
  }

  stopEngine() {
    this.stopBed();
  }

  stopBed() {
    if (!this.bed) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const { osc, gain } = this.bed;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.stop(t + 0.25);
    } catch {
      /* */
    }
    this.bed = null;
  }

  /** Soft thud — not a noise bomb */
  crash() {
    this.stopBed();
    this.tone(70, 0.35, { type: 'sine', vol: 0.1, slideTo: 32 });
    this.softNoise(0.22, 0.06, 400, 90);
  }

  /** Two-note soft win — no arcade arpeggio */
  cashout(_mult: number) {
    this.tone(523.25, 0.16, { type: 'sine', vol: 0.055 });
    this.tone(659.25, 0.22, { type: 'sine', vol: 0.045, delay: 0.09 });
  }

  bust() {
    this.tone(180, 0.22, { type: 'sine', vol: 0.05, slideTo: 90 });
  }
}

export const surgeAudio = new SurgeAudio();
