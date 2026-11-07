import '../src/ui/styles.css';
import { sfx } from '../src/audio/sfx';

const WALLET_KEY = 'edge-game-wallet-v1';

export function loadWallet(): number {
  const raw = localStorage.getItem(WALLET_KEY);
  const n = raw ? Number(raw) : 10_000;
  return Number.isFinite(n) ? n : 10_000;
}

export function saveWallet(n: number) {
  localStorage.setItem(WALLET_KEY, String(Math.max(0, Math.round(n * 100) / 100)));
}

export function money(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export type GameShell = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
};

export function mountShell(app: HTMLElement, game: GameShell, wallet: number): void {
  document.title = `${game.name}`;
  document.documentElement.style.setProperty('--tab', game.accent);
  app.innerHTML = `
    <header class="ec-hero">
      <div>
        <p class="ec-kicker">${game.id}</p>
        <h1 class="ec-brand">${game.name}</h1>
        <p class="ec-sub">${game.tagline}</p>
      </div>
      <div class="ec-hero-right">
        <button type="button" class="ec-sound" id="ec-sound" aria-label="Toggle sound">Sound on</button>
        <div class="ec-wallet">
          <label>Demo balance</label>
          <strong data-wallet>${money(wallet)}</strong>
        </div>
      </div>
    </header>
    <section class="ec-stage" id="stage"></section>
    <p class="ec-foot"><a class="ec-back" href="/">All games</a> · commit/reveal fair rounds · demo money</p>
  `;

  const soundBtn = document.getElementById('ec-sound')!;
  const syncSound = () => {
    soundBtn.textContent = sfx.isEnabled() ? 'Sound on' : 'Sound off';
    soundBtn.classList.toggle('off', !sfx.isEnabled());
  };
  syncSound();
  soundBtn.addEventListener('click', async () => {
    await sfx.unlock();
    sfx.toggle();
    sfx.play('click');
    syncSound();
  });

  // Unlock audio on first interaction anywhere
  const unlock = () => {
    void sfx.unlock();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
}

export function setWalletDisplay(n: number) {
  const el = document.querySelector('[data-wallet]');
  if (el) el.textContent = money(n);
}

export function stageFrame(title: string, blurb: string, body: string): string {
  return `
    <div class="ec-stage-head">
      <div>
        <h2>${title}</h2>
        <p>${blurb}</p>
      </div>
    </div>
    <div class="ec-body">${body}</div>
  `;
}

export function shake(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove('ec-shake');
  void el.offsetWidth;
  el.classList.add('ec-shake');
}

export function flash(el: HTMLElement | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export { sfx };
