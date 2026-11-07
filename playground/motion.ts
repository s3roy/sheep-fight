/** Tiny DOM motion helpers — float payouts, bursts, mult pops. */

export function floatText(
  host: HTMLElement,
  text: string,
  opts: { x?: number; y?: number; cls?: string } = {},
) {
  const el = document.createElement('div');
  el.className = `ec-float ${opts.cls ?? 'good'}`;
  el.textContent = text;
  const rect = host.getBoundingClientRect();
  const x = opts.x ?? rect.width * 0.5;
  const y = opts.y ?? rect.height * 0.4;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('go'));
  window.setTimeout(() => el.remove(), 1200);
}

export function burst(host: HTMLElement, x: number, y: number, color = '#3defb0') {
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    p.className = 'ec-spark';
    const ang = (i / 12) * Math.PI * 2;
    const dist = 28 + Math.random() * 36;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = color;
    host.appendChild(p);
    window.setTimeout(() => p.remove(), 700);
  }
}

export function popClass(el: HTMLElement | null, cls: string, ms = 420) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

export function countUp(
  el: HTMLElement,
  from: number,
  to: number,
  ms: number,
  fmt: (n: number) => string,
) {
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
