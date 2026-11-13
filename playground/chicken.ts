/**
 * Chicken Road — full-bleed lane-cashout UI.
 */
import './chicken.css';
import { randomClientSeed, randomServerSeed } from '../src/core/fair-rng';
import {
  CHICKEN_DIFFICULTIES,
  CHICKEN_MAX_BET,
  CHICKEN_MIN_BET,
  CHICKEN_QUICK_BETS,
  chickenLadder,
  chickenPendingWin,
  resolveChickenCrash,
  type ChickenDifficulty,
  type ChickenRound,
} from '../src/core/chicken/engine';
import {
  drawAnchored,
  drawImageAnchored,
  drawTintedAnchored,
  loadSpritePack,
  type SpritePack,
} from './chicken-sprites';
import { chickenAudio } from './chicken-audio';

/** Floor standing glow tints (chicken_highlight). */
const GLOW_GOLD = '#FFDA17';
const GLOW_RED = '#FF4E4E';
const GLOW_WIN = '#2FAA52';
/** Tall fire_0..21 plays at 18fps (animationSpeed .3). */
const FIRE_FPS = 18;
const FIRE_FRAMES = 22;
/** Show roasted chicken after flames erupt from the grate. */
const ROAST_AFTER_MS = 280;

const WALLET_KEY = 'cr-wallet-v1';
const START_BAL = 1_000_000;

/** Design-space canvas size. */
const DESIGN_H = 400;
const DESIGN_W_DESKTOP = 900;
const DESIGN_W_MOBILE = 330;
const AH = 155; // lane width
const AX = 400; // column origin Y
const VISIBLE = 7;
const BRICK_Y = [-342, -140, -370] as const;
/** Mobile when width/height ≤ 1.1 (or narrow phones). */
const MOBILE_ASPECT = 1.1;

/** Animation timings: desktop / mobile (seconds) */
const TIMES_DESKTOP = {
  twist: 0.2,
  chickenMove: 0.25,
  fieldMove: 0.4,
  restartDelay: 1.5,
  winRestartDelay: 3,
};
const TIMES_MOBILE = {
  twist: 0.15,
  chickenMove: 0.3,
  fieldMove: 0.3,
  restartDelay: 0.6,
  winRestartDelay: 3,
};

function isMobileViewport(sw?: number, sh?: number) {
  const stageEl = document.getElementById('cr-stage');
  const w = sw ?? stageEl?.clientWidth ?? window.innerWidth;
  const h = sh ?? stageEl?.clientHeight ?? window.innerHeight;
  // Mobile: max-aspect-ratio + narrow phones
  return w / Math.max(h, 1) <= MOBILE_ASPECT || w < 720;
}

function times() {
  return isMobileViewport() ? TIMES_MOBILE : TIMES_DESKTOP;
}

function designW() {
  return isMobileViewport() ? DESIGN_W_MOBILE : DESIGN_W_DESKTOP;
}

function lukeY() {
  return isMobileViewport() ? -220 : -225;
}
/**
 * Pixi animationSpeed × 60fps:
 * idle .3 → 18 · move/win .45 → 27 · mini_fire .5 → 30
 */
const ANIM_FPS = { idle: 18, move: 27, win: 27, fire: 30 };

const NAMES = [
  'Turquoise Sci…',
  'Jade Superi…',
  'Plum Uniform…',
  'Olive Maximu…',
  'Blue Ethnic Ox',
  'Pink Repulsiv…',
  '545009',
];
const AV = ['#e85d75', '#7c5cff', '#3cc55a', '#e8b020', '#5b9fd4'];

type Phase = 'idle' | 'playing' | 'fried' | 'cashed';
/** Chicken states: default | move | win | dead */
type Anim = 'idle' | 'move' | 'win' | 'dead';

/** Ping-pong frame list: [...fwd, ...fwd.slice(from).reverse()]. */
function pingPong(frames: string[], reverseFrom = 0): string[] {
  if (frames.length < 2) return frames;
  return frames.concat(frames.slice(reverseFrom).reverse());
}

function loadBal(): number {
  try {
    const v = localStorage.getItem(WALLET_KEY);
    if (v != null) return Math.max(0, Number(v));
  } catch {
    /* */
  }
  return START_BAL;
}
function saveBal(n: number) {
  try {
    localStorage.setItem(WALLET_KEY, String(n));
  } catch {
    /* */
  }
}
function fmtBal(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, ' ');
}
function fmtMoney(n: number) {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}
function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="cr-header">
    <div class="cr-wordmark">CHICKEN R<span class="cr-egg"></span>AD</div>
    <button type="button" class="cr-how" id="cr-how"><span class="cr-how-i">i</span>How to play?</button>
    <div class="cr-spacer"></div>
    <div class="cr-balance"><span id="cr-bal">${fmtBal(loadBal())}</span><span class="cr-coin">$</span></div>
    <button type="button" class="cr-icon" id="cr-fs" aria-label="Fullscreen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
    </button>
    <button type="button" class="cr-icon" id="cr-menu" aria-label="Menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </header>

  <div class="cr-stage" id="cr-stage">
    <div class="cr-loading" id="cr-loading">Loading Chicken Road…</div>
    <div class="cr-live">
      <div class="cr-live-row">Live wins: <span class="cr-dot"></span></div>
      <div class="cr-live-row">Online: <span id="cr-online">2300</span></div>
      <div class="cr-ticker">
        <div class="cr-tav" id="cr-tav"></div>
        <span class="cr-tname" id="cr-tname">—</span>
        <span class="cr-tamt" id="cr-tamt">+$0.00</span>
      </div>
    </div>
    <canvas id="cr-canvas"></canvas>
  </div>

  <footer class="cr-bar" id="cr-bar">
    <div class="cr-bet">
      <div class="cr-bet-row">
        <button type="button" class="cr-mm" id="cr-min">MIN</button>
        <input class="cr-stake" id="cr-stake" type="number" value="3" min="0.01" max="150" step="0.01" />
        <button type="button" class="cr-mm" id="cr-max">MAX</button>
      </div>
      <div class="cr-quick" id="cr-quick"></div>
    </div>
    <div class="cr-diff">
      <div class="cr-diff-top"><span>Difficulty</span><span>Chance of collision</span></div>
      <div class="cr-diffs" id="cr-diffs"></div>
    </div>
    <div class="cr-actions">
      <button type="button" class="cr-reload" id="cr-reload" aria-label="Reset">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M18 4v4h-4M6 20v-4h4"/></svg>
      </button>
      <button type="button" class="cr-play" id="cr-play">Play</button>
      <button type="button" class="cr-cash cr-hide" id="cr-cash"><small>CASH OUT</small><b id="cr-cash-amt">0 $</b></button>
      <button type="button" class="cr-go cr-hide" id="cr-go">GO</button>
    </div>
  </footer>
  <div class="cr-modal-bg cr-hide" id="cr-modal-bg"></div>
`;

let bal = loadBal();
let difficulty: ChickenDifficulty = 'medium';
let stake = 3;
let phase: Phase = 'idle';
let currentLane = 0; // 0 = door
let round: ChickenRound | null = null;
let clientSeed = randomClientSeed();
let nonce = 1;
let spaceToGo = true;
let soundOn = true;
let musicOn = false;
let pack: SpritePack | null = null;
let anim: Anim = 'idle';
let animT0 = performance.now();
let scrollX = 0;
let targetScrollX = 0;
let scrollFrom = 0;
let scrollT0 = 0;
let friedLane = 0;
let fireT0 = 0;
let ambient = new Set<number>();
let busy = false;
let shake = 0;
let chickenLaneF = 0; // fractional lane for move tween (0 = door)
let moveFrom = 0;
let moveTo = 0;
let moveT0 = 0;
let moving = false;
let bubblePulse = 0;
let twistT0 = 0;
let twistLane = 0;
/** When floor glow last became visible (fade-in over chickenMove). */
let glowT0 = 0;
let glowLane = 0;

const canvas = document.getElementById('cr-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const stage = document.getElementById('cr-stage')!;
const el = {
  bal: document.getElementById('cr-bal')!,
  bar: document.getElementById('cr-bar')!,
  stake: document.getElementById('cr-stake') as HTMLInputElement,
  diffs: document.getElementById('cr-diffs')!,
  quick: document.getElementById('cr-quick')!,
  play: document.getElementById('cr-play')!,
  cash: document.getElementById('cr-cash')!,
  cashAmt: document.getElementById('cr-cash-amt')!,
  go: document.getElementById('cr-go')!,
  reload: document.getElementById('cr-reload')!,
  modalBg: document.getElementById('cr-modal-bg')!,
  online: document.getElementById('cr-online')!,
  tav: document.getElementById('cr-tav')!,
  tname: document.getElementById('cr-tname')!,
  tamt: document.getElementById('cr-tamt')!,
  loading: document.getElementById('cr-loading')!,
};

function setBal(n: number) {
  bal = Math.round(n * 100) / 100;
  saveBal(bal);
  el.bal.textContent = fmtBal(bal);
}

function tickLive() {
  el.online.textContent = String(2200 + Math.floor(Math.random() * 220));
  el.tname.textContent = NAMES[Math.floor(Math.random() * NAMES.length)]!;
  el.tamt.textContent = `+$${(Math.random() * 80 + 2).toFixed(2)}`;
  el.tav.style.background = AV[Math.floor(Math.random() * AV.length)]!;
}
tickLive();
setInterval(tickLive, 4200);

function renderDiffs() {
  el.diffs.innerHTML = (Object.keys(CHICKEN_DIFFICULTIES) as ChickenDifficulty[])
    .map(
      (d) =>
        `<button type="button" data-diff="${d}" class="${d === difficulty ? 'on' : ''}">${CHICKEN_DIFFICULTIES[d].label}</button>`,
    )
    .join('');
}
el.quick.innerHTML = CHICKEN_QUICK_BETS.map(
  (q) => `<button type="button" data-q="${q}">${q} <span class="cr-coin">$</span></button>`,
).join('');
renderDiffs();

function unlockAudio() {
  chickenAudio.unlock();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });

el.diffs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button[data-diff]') as HTMLButtonElement | null;
  if (!btn || phase === 'playing' || busy) return;
  chickenAudio.click();
  difficulty = btn.dataset.diff as ChickenDifficulty;
  renderDiffs();
  pickAmbient();
});
el.quick.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button[data-q]') as HTMLButtonElement | null;
  if (!btn || phase === 'playing') return;
  chickenAudio.click();
  stake = Number(btn.dataset.q);
  el.stake.value = String(stake);
});
document.getElementById('cr-min')!.onclick = () => {
  if (phase === 'playing') return;
  chickenAudio.click();
  stake = CHICKEN_MIN_BET;
  el.stake.value = String(stake);
};
document.getElementById('cr-max')!.onclick = () => {
  if (phase === 'playing') return;
  chickenAudio.click();
  stake = Math.min(CHICKEN_MAX_BET, bal);
  el.stake.value = String(stake);
};

function setPlayingUi(on: boolean) {
  el.bar.classList.toggle('locked', on);
  el.stake.disabled = on;
  (document.getElementById('cr-min') as HTMLButtonElement).disabled = on;
  (document.getElementById('cr-max') as HTMLButtonElement).disabled = on;
  el.quick.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = on));
  renderDiffs();
  el.play.classList.toggle('cr-hide', on);
  el.reload.classList.toggle('cr-hide', on);
  el.cash.classList.toggle('cr-hide', !on);
  el.go.classList.toggle('cr-hide', !on);
}

function updateCash() {
  if (!round || currentLane <= 0) {
    el.cashAmt.textContent = '0 $';
    return;
  }
  const win = chickenPendingWin(stake, round.ladder[currentLane - 1]!);
  el.cashAmt.textContent = `${fmtMoney(win)} $`;
}

function pickAmbient() {
  ambient = new Set();
  const ladder = chickenLadder(difficulty);
  for (let i = 0; i < ladder.length; i++) {
    // Mini fire on disabled lukes — sprinkle ahead of chicken
    if (Math.random() < 0.28) ambient.add(i + 1);
  }
}

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Design fit: 900×400 desktop / 330×400 mobile. */
function fieldParams(sw: number, sh: number) {
  const dw = designW();
  const designAspect = dw / DESIGN_H;
  if (sw / sh > designAspect) {
    return { scale: sh / DESIGN_H, x: 0, y: 0 };
  }
  const scale = sw / dw;
  return { scale, x: 0, y: sh - DESIGN_H * scale };
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Chicken world X: ah/2 at door, ah*(lane)+ah/2 on lane. */
function chickenWorldX(lane: number) {
  if (lane <= 0) return AH / 2;
  return AH * lane + AH / 2;
}

function lukeStateFor(laneIdx: number): 'disable' | 'enable' | 'green' | 'red' | 'gold' {
  if (phase === 'idle' || !round) {
    return laneIdx === 1 ? 'enable' : 'disable';
  }
  if (phase === 'fried' && laneIdx === friedLane) return 'red';
  if ((phase === 'playing' || phase === 'cashed') && laneIdx === currentLane) return 'green';
  if (laneIdx < currentLane) return 'gold';
  if (laneIdx === currentLane + 1 && phase === 'playing') return 'enable';
  return 'disable';
}

function draw(now: number) {
  if (!pack) return;
  const w = stage.clientWidth;
  const h = stage.clientHeight;

  const T = times();
  if (scrollT0 > 0) {
    const t = Math.min(1, (now - scrollT0) / (T.fieldMove * 1000));
    scrollX = scrollFrom + (targetScrollX - scrollFrom) * easeInOutSine(t);
    if (t >= 1) scrollT0 = 0;
  }

  if (moving) {
    const t = Math.min(1, (now - moveT0) / (T.chickenMove * 1000));
    const e = easeInOutSine(t);
    chickenLaneF = moveFrom + (moveTo - moveFrom) * e;
    if (t >= 1) {
      chickenLaneF = moveTo;
      moving = false;
      // Keep visual lane ahead of currentLane until stepTo commits —
      // never snap-draw using stale currentLane (causes previous-lane blink).
    }
  }

  if (shake > 0) shake *= 0.86;
  if (bubblePulse > 0) bubblePulse *= 0.9;

  ctx.clearRect(0, 0, w, h);
  // Transparent canvas — HTML stage #212E3B shows through
  ctx.fillStyle = '#212E3B';
  ctx.fillRect(0, 0, w, h);

  const fp = fieldParams(w, h);
  ctx.save();
  if (shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  ctx.translate(fp.x, fp.y);
  ctx.scale(fp.scale, fp.scale);

  // Field scroll
  ctx.translate(scrollX, 0);

  const ladder = round?.ladder ?? chickenLadder(difficulty);
  const n = ladder.length;

  drawStartColumn(now);
  for (let i = 0; i < n; i++) {
    drawLaneColumn(now, i, ladder[i]!, i === n - 1);
  }

  // Tall collision flames (as): fire_0..21 from bottom, then roasted chicken
  if (phase === 'fried' && friedLane > 0) {
    drawCrashFire(now, friedLane);
  }

  drawChickenWorld(now);

  ctx.restore();
  requestAnimationFrame(draw);
}

/** Collision fire: scale .5, y:87, x: ah*(lane)+80, ~18fps, play once. */
function drawCrashFire(now: number, lane: number) {
  if (!pack?.fireImgs.length) return;
  const age = (now - fireT0) / 1000;
  const fi = Math.floor(age * FIRE_FPS);
  if (fi < 0 || fi >= FIRE_FRAMES) return;
  const img = pack.fireImgs[fi]!;
  // Flame world position: ah*(n+1)+80, y:87 (n = 0-based crash index)
  const x = AH * lane + 80;
  const y = 87;
  const scale = 0.5;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
}

function drawStartColumn(_now: number) {
  if (!pack) return;
  // Start assembly (ao) — wall + arch + road under chicken spawn
  drawImageAnchored(ctx, pack.wallColor, 80, 92.5, 1.6, 5.7, 0.5, 0.5);
  drawAnchored(ctx, pack.decorsImg, pack.decors, 'brick_dark', 20, 0, 0.25, 0, 0);
  drawAnchored(ctx, pack.wallsImg, pack.walls, 'start_decoration', 128, AX - 6, 0.25, 1, 1);
  drawAnchored(ctx, pack.wallsImg, pack.walls, 'start_front_decoration', 77.5, 365, 0.25, 1, 1);
  drawAnchored(ctx, pack.decorsImg, pack.decors, 'bottomRect0', 0, AX, 0.25, 0, 1);
}

function drawLaneColumn(now: number, index: number, mult: number, isLast: boolean) {
  if (!pack) return;
  const colX = index * AH + 1.5 * AH; // column x
  const laneIdx = index + 1;
  const state = lukeStateFor(laneIdx);
  const p = (index + 1) % 2;
  const m = (index + 1) % 3;

  ctx.save();
  ctx.translate(colX, AX);

  // Road color strip + dashes + decor + brick
  drawImageAnchored(ctx, pack.roadColor, 0, -307.5, 1.55, 5.7, 0.5, 0.5);
  drawAnchored(ctx, pack.wallsImg, pack.walls, 'dash_line', AH / 2 - 2, -173, 0.25, 0.5, 0.5);
  drawAnchored(ctx, pack.wallsImg, pack.walls, 'dash_line', AH / 2 - 2, -450.5, 0.25, 0.5, 0.5);
  drawAnchored(ctx, pack.decorsImg, pack.decors, 'road_decor', 0, -55, 0.25, 0.5, 0.5);
  drawAnchored(ctx, pack.decorsImg, pack.decors, `brick${m}`, -56, BRICK_Y[m]!, 0.25, 0, 0);

  if (isLast) {
    drawAnchored(ctx, pack.wallsImg, pack.walls, 'exit_decoration', 0, -25, 0.25, 0.5, 1);
    drawEggLuke(now, state, mult);
  } else {
    drawCoeffLuke(now, state, mult, laneIdx);
  }

  // Floor whiteRect hatch (at) y:-22
  const hatchY = state === 'green' || state === 'red' ? -14 : -22;
  drawAnchored(ctx, pack.decorsImg, pack.decors, 'whiteRect', -1, hatchY, 0.25, 0.5, 1);

  // Road platform — chicken stands on this (anchor bottom at column origin)
  drawAnchored(ctx, pack.decorsImg, pack.decors, `bottomRect${p}`, 0, 0, 0.25, 0.5, 1);

  // Standing glow ON TOP of road (ae after Road): gold while playing, green on cashout
  if (state === 'green' || state === 'red') {
    if (glowLane !== laneIdx) {
      glowLane = laneIdx;
      glowT0 = now;
    }
    const fade = Math.min(1, (now - glowT0) / (times().chickenMove * 1000));
    const isWinGlow = phase === 'cashed' && state === 'green';
    const tint = state === 'red' ? GLOW_RED : isWinGlow ? GLOW_WIN : GLOW_GOLD;
    // Cashout: bright pulsing green (#2FAA52); playing: soft gold (#FFDA17)
    const pulse = isWinGlow
      ? 0.85 + 0.15 * Math.sin(now / 160)
      : 0.75 + 0.2 * Math.sin(now / 320);
    const alpha = fade * pulse;
    const scale = isWinGlow ? 0.32 : 0.25;
    drawTintedAnchored(
      ctx,
      pack.lightsImg,
      pack.lights,
      'chicken_highlight',
      0,
      -32,
      scale,
      tint,
      Math.min(1, alpha * (isWinGlow ? 1.15 : 0.95)),
      0.5,
      1,
    );
    // Cashout: second pass + green light pool under feet
    if (isWinGlow) {
      drawTintedAnchored(
        ctx,
        pack.lightsImg,
        pack.lights,
        'chicken_highlight',
        0,
        -28,
        0.34,
        GLOW_WIN,
        0.45 * pulse,
        0.5,
        1,
      );
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * pulse;
      const grd = ctx.createRadialGradient(0, -10, 2, 0, -10, 85);
      grd.addColorStop(0, 'rgba(94,243,100,0.9)');
      grd.addColorStop(0.35, 'rgba(47,170,82,0.45)');
      grd.addColorStop(1, 'rgba(47,170,82,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, -8, 88, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // mini_fire ambient on disable lukes (r7: y:-85, scale:.25, speed .5)
  if (state === 'disable' || (ambient.has(laneIdx) && state !== 'green' && state !== 'red')) {
    const frames = pack.miniFireFrames;
    const fi = frames[Math.floor((now / 1000) * ANIM_FPS.fire) % frames.length]!;
    drawAnchored(ctx, pack.miniFireImg, pack.miniFire, fi, 0, -85, 0.25, 0.5, 0.5);
  }

  ctx.restore();
}

function drawCoeffLuke(now: number, state: string, mult: number, laneIdx: number) {
  if (!pack) return;
  const y = lukeY();
  let sx = 1;
  if (twistLane === laneIdx && twistT0 > 0) {
    sx = Math.max(0.001, easeInOutSine(Math.min(1, (now - twistT0) / (times().twist * 1000))));
  }
  const pulse = state === 'green' ? 1 + bubblePulse * 0.08 : 1;

  ctx.save();
  ctx.translate(0, y);
  ctx.scale(sx * pulse, pulse);
  ctx.globalAlpha = state === 'disable' ? 0.6 : 1;

  // empty base always
  drawAnchored(ctx, pack.objectsImg, pack.objects, 'luke_empty', 0, 0, 0.25, 0.5, 0.5);
  if (state === 'enable' || state === 'disable') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'luke_default', 0, 0, 0.25, 0.5, 0.5);
  } else if (state === 'gold') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'luke_gold', 0, 0, 0.25, 0.5, 0.5);
  } else if (state === 'green') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'luke_green', 0, 0, 0.25, 0.5, 0.5);
  } else if (state === 'red') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'luke_red', 0, 0, 0.25, 0.5, 0.5);
  }

  // Coeff text (Pixi fontSize 50 × scale .5) — hide on gold/red
  if (state !== 'gold' && state !== 'red') {
    const stroke = '#265446';
    const shadow = state === 'disable' ? '#8491D9' : '#5EF364';
    ctx.font = 'bold 25px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 2.5;
    const label = `${Number(mult).toFixed(2)}x`;
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();
}

function drawEggLuke(now: number, state: string, mult: number) {
  if (!pack) return;
  const y = lukeY();
  let sx = 1;
  if (twistLane === VISIBLE && twistT0 > 0) {
    sx = Math.max(0.001, easeInOutSine(Math.min(1, (now - twistT0) / (times().twist * 1000))));
  }
  ctx.save();
  ctx.translate(0, y);
  ctx.scale(sx, 1);
  ctx.globalAlpha = state === 'disable' ? 0.6 : 1;
  if (state === 'gold' || state === 'disable' || state === 'enable') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'egg_gold', 0, 0, 0.25, 0.5, 0.5);
  } else if (state === 'green') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'egg_green', 0, 0, 0.25, 0.5, 0.5);
  } else if (state === 'red') {
    drawAnchored(ctx, pack.objectsImg, pack.objects, 'egg_red', 0, 0, 0.25, 0.5, 0.5);
  }
  if (state !== 'gold' && state !== 'red') {
    ctx.font = 'bold 25px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#89680B';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFD12F';
    ctx.shadowOffsetY = 2.5;
    const label = `${Number(mult).toFixed(2)}x`;
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();
}

function drawChickenWorld(now: number) {
  if (!pack) return;
  // Always render from chickenLaneF (tween source of truth). Using currentLane
  // when moving flips false caused a 1-frame blink back on the previous lane.
  const cx = chickenWorldX(chickenLaneF);
  const cy = 309; // chicken container y

  // Death: flames erupt first, then roasted chicken_dead appears
  if (anim === 'dead' || phase === 'fried') {
    const ageMs = now - fireT0;
    if (ageMs >= ROAST_AFTER_MS) {
      // Pop-up then settle (slight bounce into place)
      const t = Math.min(1, (ageMs - ROAST_AFTER_MS) / 220);
      const pop = Math.sin(t * Math.PI) * 18 * (1 - t);
      drawImageAnchored(ctx, pack.deadImg, cx, cy + 74 - pop, 0.3, 0.3, 0.5, 1);
    }
    return;
  }

  let img = pack.idleImg;
  let atlas = pack.idle;
  let frames = pingPong(pack.idleFrames, 1);
  let fps = ANIM_FPS.idle;
  let yOff = 0;
  if (anim === 'move' || moving) {
    img = pack.goImg;
    atlas = pack.go;
    frames = pack.goFrames;
    fps = ANIM_FPS.move;
  } else if (anim === 'win') {
    img = pack.jumpImg;
    atlas = pack.jump;
    frames = pingPong(pack.jumpFrames, 0);
    fps = ANIM_FPS.win;
    yOff = -27;
    // Soft green rim under celebrating chicken
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 160);
    const g = ctx.createRadialGradient(cx, cy + 70, 2, cx, cy + 70, 60);
    g.addColorStop(0, 'rgba(94,243,100,0.85)');
    g.addColorStop(1, 'rgba(47,170,82,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 72, 55, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const elapsed = (now - animT0) / 1000;
  const fi = Math.floor(elapsed * fps) % Math.max(frames.length, 1);
  const name = frames[fi] ?? frames[0];
  if (!name) {
    drawImageAnchored(ctx, pack.chickenImg, cx, cy + yOff, 0.5, 0.5, 0.5, 0.5);
    return;
  }
  drawAnchored(ctx, img, atlas, name, cx, cy + yOff, 0.5, 0.5, 0.5);
}

function setAnim(a: Anim) {
  anim = a;
  animT0 = performance.now();
}

function syncScroll(lane = currentLane) {
  // Field scroll — desktop: lineNumber<=1 → 0; else -(ah*lineNumber)
  // mobile: ah*(-lineNumber-1)+10
  const lineNumber = lane - 1;
  scrollFrom = scrollX;
  scrollT0 = performance.now();
  if (isMobileViewport()) {
    if (lineNumber < 0) targetScrollX = 0;
    else targetScrollX = AH * (-lineNumber - 1) + 10;
  } else if (lineNumber <= 1) {
    targetScrollX = 0;
  } else {
    targetScrollX = -(AH * lineNumber);
  }
}

function tweenChickenTo(lane: number) {
  moveFrom = chickenLaneF;
  moveTo = lane;
  moveT0 = performance.now();
  moving = true;
  // Field + chicken tweens start together
  syncScroll(lane);
  // Don't reset animT0 if already moving — avoids a one-frame idle flash
  if (anim !== 'move') setAnim('move');
  else anim = 'move';
  chickenAudio.step();
  return wait(times().chickenMove * 1000);
}

function triggerTwist(lane: number) {
  twistLane = lane;
  twistT0 = performance.now();
  bubblePulse = 1;
  glowLane = lane;
  glowT0 = performance.now();
}

async function startRound() {
  if (busy || phase === 'playing') return;
  chickenAudio.unlock(); // soundtrack + unlock autoplay on first gesture
  chickenAudio.click();
  stake = Math.min(CHICKEN_MAX_BET, Math.max(CHICKEN_MIN_BET, Number(el.stake.value) || 3));
  el.stake.value = String(stake);
  if (stake > bal) return;
  busy = true;
  setBal(bal - stake);
  const serverSeed = randomServerSeed();
  round = await resolveChickenCrash(serverSeed, clientSeed, nonce++, difficulty);
  phase = 'playing';
  currentLane = 0;
  chickenLaneF = 0;
  friedLane = 0;
  setPlayingUi(true);
  pickAmbient();
  syncScroll(0);
  await stepTo(1);
  busy = false;
}

async function stepTo(lane: number) {
  if (!round || phase !== 'playing') return;
  await tweenChickenTo(lane);

  currentLane = lane;
  chickenLaneF = lane;

  if (lane === round.crashLane) {
    // Flames from bottom grate → roasted chicken → restart
    friedLane = lane;
    fireT0 = performance.now();
    setAnim('dead');
    phase = 'fried';
    triggerTwist(lane);
    shake = 16;
    el.cashAmt.textContent = '0 $';
    chickenAudio.lose();
    // Hold through full tall-fire burst (~22 frames @ 18fps ≈ 1.2s) + beat
    await wait(Math.max(times().restartDelay * 1000, (FIRE_FRAMES / FIRE_FPS) * 1000 + 200));
    endIdle();
    return;
  }

  setAnim('idle');
  triggerTwist(lane);
  updateCash();
  if (currentLane >= round.ladder.length) {
    await settleWin();
  }
}

async function goNext() {
  if (busy || !round || phase !== 'playing') return;
  chickenAudio.click();
  busy = true;
  await stepTo(currentLane + 1);
  busy = false;
}

async function settleWin() {
  if (!round || currentLane <= 0) return;
  const win = chickenPendingWin(stake, round.ladder[currentLane - 1]!);
  setBal(bal + win);
  phase = 'cashed';
  // Force green glow fade-in + win jump + luke twist
  glowLane = currentLane;
  glowT0 = performance.now();
  setAnim('win'); // jump ping-pong + green floor glow (#2FAA52)
  triggerTwist(currentLane);
  bubblePulse = 1.4;
  el.cashAmt.textContent = `${fmtMoney(win)} $`;
  chickenAudio.win();
  await wait(times().winRestartDelay * 1000);
  endIdle();
}

async function cashOut() {
  if (busy || !round || phase !== 'playing' || currentLane <= 0) return;
  chickenAudio.click();
  busy = true;
  await settleWin();
  busy = false;
}

function endIdle() {
  phase = 'idle';
  currentLane = 0;
  chickenLaneF = 0;
  round = null;
  friedLane = 0;
  moving = false;
  setAnim('idle');
  setPlayingUi(false);
  scrollFrom = scrollX;
  targetScrollX = 0;
  scrollT0 = performance.now();
  pickAmbient();
}

el.play.onclick = () => void startRound();
el.go.onclick = () => void goNext();
el.cash.onclick = () => void cashOut();
el.reload.onclick = () => {
  if (phase === 'playing') return;
  chickenAudio.click();
  pickAmbient();
};
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !spaceToGo) return;
  e.preventDefault();
  chickenAudio.unlock();
  if (phase === 'idle') void startRound();
  else if (phase === 'playing') void goNext();
});
document.getElementById('cr-fs')!.onclick = () => {
  chickenAudio.click();
  if (!document.fullscreenElement) void app.requestFullscreen?.();
  else void document.exitFullscreen?.();
};

function openModal(html: string) {
  el.modalBg.classList.remove('cr-hide');
  el.modalBg.innerHTML = `<div class="cr-modal">${html}<button type="button" class="cr-modal-x" id="cr-modal-x">Close</button></div>`;
  document.getElementById('cr-modal-x')!.onclick = closeModal;
  el.modalBg.onclick = (e) => {
    if (e.target === el.modalBg) closeModal();
  };
}
function closeModal() {
  el.modalBg.classList.add('cr-hide');
  el.modalBg.innerHTML = '';
}

document.getElementById('cr-how')!.onclick = () => {
  chickenAudio.click();
  openModal(`
    <h2>How to play?</h2>
    <p>Guide the chicken lane by lane. Cash out anytime — or GO and risk getting fried.</p>
    <ul>
      <li><b>Easy</b> — 24 lines</li>
      <li><b>Medium</b> — 22 lines</li>
      <li><b>Hard</b> — 20 lines</li>
      <li><b>Hardcore</b> — 15 lines</li>
    </ul>
    <p>Min ${CHICKEN_MIN_BET} · Max ${CHICKEN_MAX_BET} · Max win 10 000</p>
  `);
};

document.getElementById('cr-menu')!.onclick = () => {
  chickenAudio.click();
  openModal(`
    <h2>Settings</h2>
    <div class="cr-menu-row">Sound <button type="button" class="cr-tog ${soundOn ? 'on' : ''}" id="t-s"></button></div>
    <div class="cr-menu-row">Music <button type="button" class="cr-tog ${musicOn ? 'on' : ''}" id="t-m"></button></div>
    <div class="cr-menu-row">«Space» to spin &amp; go <button type="button" class="cr-tog ${spaceToGo ? 'on' : ''}" id="t-sp"></button></div>
    <button type="button" class="cr-menu-link" id="l-fair">Provably fair settings</button>
    <button type="button" class="cr-menu-link" id="l-rules">Game rules</button>
    <p class="cr-powered">Chicken Road</p>
  `);
  document.getElementById('t-s')!.onclick = (e) => {
    soundOn = !soundOn;
    chickenAudio.setSfx(soundOn);
    chickenAudio.click();
    (e.currentTarget as HTMLElement).classList.toggle('on', soundOn);
  };
  document.getElementById('t-m')!.onclick = (e) => {
    musicOn = !musicOn;
    chickenAudio.setMusic(musicOn);
    chickenAudio.click();
    (e.currentTarget as HTMLElement).classList.toggle('on', musicOn);
  };
  document.getElementById('t-sp')!.onclick = (e) => {
    spaceToGo = !spaceToGo;
    (e.currentTarget as HTMLElement).classList.toggle('on', spaceToGo);
  };
  document.getElementById('l-fair')!.onclick = () => {
    openModal(`
      <h2>Provably fair settings</h2>
      <p>This game uses Provably Fair technology to determine game result</p>
      <div class="cr-fair">
        <label>Next client (Your) seed:</label><code>${clientSeed}</code>
        <label>Next server seed SHA256:</label><code>${round?.serverCommit ?? '— start a round'}</code>
      </div>
    `);
  };
  document.getElementById('l-rules')!.onclick = () => {
    openModal(`
      <h2>Game rules</h2>
      <p>Min bet: ${CHICKEN_MIN_BET} USD</p>
      <p>Max bet: ${CHICKEN_MAX_BET} USD</p>
      <p>Max win: 10 000 USD</p>
    `);
  };
};

async function boot() {
  layout();
  window.addEventListener('resize', layout);
  pickAmbient();
  setPlayingUi(false);
  try {
    await Promise.all([loadSpritePack().then((p) => (pack = p)), chickenAudio.load()]);
    el.loading.classList.add('hide');
    requestAnimationFrame(draw);
  } catch (e) {
    el.loading.textContent = 'Failed to load assets';
    console.error(e);
  }
}
void boot();
