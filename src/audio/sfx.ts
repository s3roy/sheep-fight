/**
 * Web Audio synth SFX — no asset files. Unlock on first user gesture.
 */

export type SfxName =
  | 'click'
  | 'tick'
  | 'deal'
  | 'rise'
  | 'crash'
  | 'cash'
  | 'win'
  | 'lose'
  | 'drop'
  | 'gate'
  | 'boost'
  | 'collapse'
  | 'spin'
  | 'lock'
  | 'near';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export class GameSfx {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.55;

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  async unlock() {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.ensure();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* */
      }
    }
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* */
    }
  }

  play(name: SfxName, detail = 0) {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.ensure();
    if (ctx.state !== 'running') {
      void ctx.resume().then(() => this.tone(name, detail));
      return;
    }
    this.tone(name, detail);
  }

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(name: SfxName, detail: number) {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);

    const beep = (
      freq: number,
      dur: number,
      type: OscillatorType = 'sine',
      vol = 0.2,
      delay = 0,
    ) => {
      const o = ctx.createOscillator();
      const gg = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      gg.gain.setValueAtTime(0.0001, now + delay);
      gg.gain.exponentialRampToValueAtTime(vol * this.volume, now + delay + 0.01);
      gg.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      o.connect(gg);
      gg.connect(ctx.destination);
      o.start(now + delay);
      o.stop(now + delay + dur + 0.02);
    };

    switch (name) {
      case 'click':
        beep(420, 0.04, 'triangle', 0.12);
        break;
      case 'tick':
        beep(880 + detail * 40, 0.03, 'square', 0.06);
        break;
      case 'deal':
        beep(180, 0.05, 'triangle', 0.1);
        beep(260, 0.06, 'sine', 0.08, 0.03);
        break;
      case 'rise': {
        const f = 220 + Math.min(detail, 20) * 35;
        beep(f, 0.08, 'sine', 0.07);
        break;
      }
      case 'crash':
        beep(120, 0.25, 'sawtooth', 0.18);
        beep(60, 0.35, 'square', 0.1, 0.02);
        break;
      case 'cash':
        beep(523, 0.08, 'sine', 0.14);
        beep(784, 0.12, 'sine', 0.12, 0.06);
        break;
      case 'win':
        beep(523, 0.1, 'sine', 0.14);
        beep(659, 0.1, 'sine', 0.12, 0.08);
        beep(784, 0.18, 'sine', 0.14, 0.16);
        break;
      case 'lose':
        beep(200, 0.12, 'triangle', 0.12);
        beep(140, 0.2, 'sine', 0.1, 0.08);
        break;
      case 'drop':
        beep(660, 0.06, 'sine', 0.1);
        beep(220, 0.14, 'triangle', 0.12, 0.04);
        break;
      case 'gate':
        beep(400 + (detail % 8) * 30, 0.05, 'square', 0.07);
        break;
      case 'boost':
        beep(440, 0.06, 'sine', 0.1);
        beep(660, 0.1, 'sine', 0.12, 0.05);
        break;
      case 'collapse':
        beep(90, 0.3, 'sawtooth', 0.16);
        break;
      case 'spin':
        beep(300 + (detail % 12) * 25, 0.04, 'square', 0.05);
        break;
      case 'lock':
        beep(360, 0.07, 'triangle', 0.11);
        beep(540, 0.09, 'sine', 0.09, 0.05);
        break;
      case 'near':
        beep(740, 0.05, 'square', 0.08);
        beep(520, 0.08, 'triangle', 0.07, 0.05);
        break;
      default:
        beep(440, 0.05, 'sine', 0.08);
    }
    void g;
  }
}

export const sfx = new GameSfx();
