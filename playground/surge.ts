/**
 * Surge client — host-authoritative WS + smoothed flight presentation.
 */
import './surge.css';
import { surgeAudio as audio } from './surge-audio';
import type { SurgePublicState, SurgeServerMsg } from '../src/surge/server/protocol';

const WS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SURGE_WS ??
  `ws://${location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '127.0.0.1' : location.hostname}:5211`;

const app = document.getElementById('app')!;

app.innerHTML = `
  <header class="sg-top">
    <div class="sg-brand">
      <div class="sg-logo" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22"><path fill="currentColor" d="M16 2l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z"/></svg>
      </div>
      <div>
        <h1>Surge</h1>
        <p>Live host · cash out before crash</p>
      </div>
    </div>
    <div class="sg-top-right">
      <div class="sg-conn" id="sg-conn"><i></i><span>Connecting…</span></div>
      <button type="button" class="sg-icon-btn" id="sg-sound">Sound on</button>
      <div class="sg-bal"><label>Balance</label><strong id="sg-bal">—</strong></div>
    </div>
  </header>
  <div class="sg-main">
    <section class="sg-board" id="sg-board">
      <div class="sg-vignette"></div>
      <div class="sg-flash" id="sg-flash"></div>
      <div class="sg-hud">
        <div class="sg-phase" id="sg-phase">IDLE</div>
        <div class="sg-online" id="sg-online">0 online</div>
      </div>
      <canvas class="sg-canvas" id="sg-canvas"></canvas>
      <div class="sg-rocket" id="sg-rocket" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="44" height="44">
          <defs>
            <linearGradient id="sg-rg" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#2ee6ff"/>
              <stop offset="100%" stop-color="#ff2d9b"/>
            </linearGradient>
          </defs>
          <ellipse class="sg-flame" cx="24" cy="40" rx="5" ry="8" fill="#ffd54a" opacity="0.9"/>
          <path d="M24 4c6 8 8 16 8 24l-8 6-8-6c0-8 2-16 8-24z" fill="url(#sg-rg)"/>
          <circle cx="24" cy="18" r="3.5" fill="#07060f" stroke="#fff" stroke-width="1.2"/>
          <path d="M16 28l-6 4 6 2M32 28l6 4-6 2" fill="#b8ff3c"/>
        </svg>
      </div>
      <div class="sg-mult betting" id="sg-mult">—</div>
      <div class="sg-toast" id="sg-toast"></div>
      <div class="sg-history" id="sg-history"></div>
    </section>
    <aside class="sg-panel">
      <div class="sg-countdown" id="sg-cd">
        <strong id="sg-cd-n">—</strong>
        <span id="sg-cd-l">Waiting for host</span>
      </div>
      <div class="sg-row">
        <div class="sg-field">
          <label>Stake</label>
          <input id="sg-stake" type="number" value="100" min="10" step="10" />
        </div>
        <div class="sg-field">
          <label>Auto cashout</label>
          <input id="sg-auto" type="number" value="2" min="1.01" step="0.01" />
        </div>
      </div>
      <div class="sg-stakes">
        <button type="button" class="sg-stake-btn" data-s="50">₹50</button>
        <button type="button" class="sg-stake-btn" data-s="100">₹100</button>
        <button type="button" class="sg-stake-btn" data-s="250">₹250</button>
        <button type="button" class="sg-stake-btn" data-s="500">₹500</button>
      </div>
      <div class="sg-pills">
        <button type="button" class="sg-pill" data-m="1.5">1.5×</button>
        <button type="button" class="sg-pill" data-m="2">2×</button>
        <button type="button" class="sg-pill" data-m="3">3×</button>
        <button type="button" class="sg-pill" data-m="5">5×</button>
      </div>
      <div class="sg-actions">
        <button type="button" class="sg-btn sg-btn-bet" id="sg-bet" disabled>Place bet</button>
        <button type="button" class="sg-btn sg-btn-cash" id="sg-cash" disabled>Cash out</button>
      </div>
      <div class="sg-log" id="sg-log">Connecting to Surge host…</div>
      <div class="sg-fair" id="sg-fair"></div>
    </aside>
  </div>
  <footer class="sg-foot">
    <a href="/">← Games</a> · crash locked server-side before takeoff · demo ₹
  </footer>
`;

const el = {
  conn: document.getElementById('sg-conn')!,
  bal: document.getElementById('sg-bal')!,
  phase: document.getElementById('sg-phase')!,
  online: document.getElementById('sg-online')!,
  mult: document.getElementById('sg-mult')!,
  rocket: document.getElementById('sg-rocket')!,
  history: document.getElementById('sg-history')!,
  board: document.getElementById('sg-board')!,
  canvas: document.getElementById('sg-canvas') as HTMLCanvasElement,
  flash: document.getElementById('sg-flash')!,
  toast: document.getElementById('sg-toast')!,
  cd: document.getElementById('sg-cd')!,
  cdN: document.getElementById('sg-cd-n')!,
  cdL: document.getElementById('sg-cd-l')!,
  stake: document.getElementById('sg-stake') as HTMLInputElement,
  auto: document.getElementById('sg-auto') as HTMLInputElement,
  bet: document.getElementById('sg-bet') as HTMLButtonElement,
  cash: document.getElementById('sg-cash') as HTMLButtonElement,
  log: document.getElementById('sg-log')!,
  fair: document.getElementById('sg-fair')!,
  sound: document.getElementById('sg-sound')!,
};

function money(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function log(msg: string) {
  const line = document.createElement('div');
  line.innerHTML = msg;
  el.log.prepend(line);
  while (el.log.children.length > 28) el.log.lastChild?.remove();
}

function toast(text: string, kind: 'win' | 'lose' | 'info' = 'info') {
  el.toast.textContent = text;
  el.toast.className = `sg-toast show ${kind}`;
  window.clearTimeout((toast as unknown as { _t?: number })._t);
  (toast as unknown as { _t?: number })._t = window.setTimeout(() => {
    el.toast.classList.remove('show');
  }, 1800);
}

function flash(kind: 'crash' | 'cash' | 'lift') {
  el.flash.className = `sg-flash ${kind}`;
  void el.flash.offsetWidth;
  el.flash.classList.add('go');
}

let balance = 0;
let hasOpenBet = false;
let cashedThisRound = false;
let state: SurgePublicState | null = null;
let lastPhase: SurgePublicState['phase'] | null = null;
/** Server samples */
let samples: { t: number; m: number }[] = [];
let displayM = 1;
let crashed = false;
let crashAt = 1;
let particles: { x: number; y: number; vx: number; vy: number; life: number; hue: number }[] = [];
let stars: { x: number; y: number; z: number; s: number }[] = [];

const ctx = el.canvas.getContext('2d')!;
let cssW = 0;
let cssH = 0;

function resizeCanvas() {
  const r = el.board.getBoundingClientRect();
  cssW = r.width;
  cssH = r.height;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  el.canvas.width = Math.floor(cssW * dpr);
  el.canvas.height = Math.floor(cssH * dpr);
  el.canvas.style.width = `${cssW}px`;
  el.canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (stars.length === 0) seedStars();
}
window.addEventListener('resize', resizeCanvas);

function seedStars() {
  stars = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    s: 0.6 + Math.random() * 1.4,
  }));
}

function multToXY(m: number, maxM: number) {
  const span = Math.max(2, maxM);
  const t = Math.min(0.98, Math.log(Math.max(1, m)) / Math.log(span));
  // Ease curve to the upper-right like classic crash boards
  const ease = t * t * (3 - 2 * t);
  const x = 36 + ease * (cssW - 72);
  const y = cssH - 52 - ease * (cssH - 110);
  return { x, y };
}

function smoothMult(now: number): number {
  if (crashed) return crashAt;
  if (samples.length === 0) return displayM;
  if (samples.length === 1) return samples[0]!.m;

  const a = samples[samples.length - 2]!;
  const b = samples[samples.length - 1]!;
  const dt = Math.max(1, b.t - a.t);
  // Extrapolate slightly past last sample for butter
  const u = Math.min(1.35, (now - a.t) / dt);
  const m = a.m + (b.m - a.m) * Math.min(1, u);
  // Cap extrapolation so we don't overshoot crash before message
  return Math.max(1, m);
}

function spawnBurst(x: number, y: number, n: number, hue: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.55,
      hue,
    });
  }
}

function drawFrame(now: number) {
  if (!cssW || !cssH) return;
  ctx.clearRect(0, 0, cssW, cssH);

  // Starfield drift
  const flying = state?.phase === 'flying' && !crashed;
  for (const s of stars) {
    if (flying) s.x += 0.00035 * s.z * (0.5 + displayM * 0.08);
    if (s.x > 1) s.x -= 1;
    ctx.beginPath();
    ctx.fillStyle = `rgba(180,220,255,${0.25 + s.z * 0.45})`;
    ctx.arc(s.x * cssW, s.y * cssH, s.s * s.z, 0, Math.PI * 2);
    ctx.fill();
  }

  const maxM = Math.max(
    2,
    crashAt,
    ...samples.map((s) => s.m),
    displayM,
    2,
  );

  // Build path from samples (smooth polyline)
  const pathPts: { x: number; y: number }[] = [];
  if (samples.length) {
    for (const s of samples) pathPts.push(multToXY(s.m, maxM));
    // Tip at interpolated display
    pathPts.push(multToXY(displayM, maxM));
  }

  if (pathPts.length >= 2) {
    const tip = pathPts[pathPts.length - 1]!;

    // Glow fill
    const grad = ctx.createLinearGradient(pathPts[0]!.x, cssH, tip.x, tip.y);
    if (crashed) {
      grad.addColorStop(0, 'rgba(255,77,109,0.05)');
      grad.addColorStop(1, 'rgba(255,45,155,0.4)');
    } else {
      grad.addColorStop(0, 'rgba(46,230,255,0.04)');
      grad.addColorStop(0.55, 'rgba(184,255,60,0.18)');
      grad.addColorStop(1, 'rgba(255,45,155,0.35)');
    }

    ctx.beginPath();
    ctx.moveTo(pathPts[0]!.x, cssH - 40);
    for (const p of pathPts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(tip.x, cssH - 40);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.lineWidth = crashed ? 3.5 : 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = crashed ? '#ff4d6d' : '#b8ff3c';
    ctx.shadowColor = crashed ? '#ff2d9b' : '#2ee6ff';
    ctx.shadowBlur = crashed ? 22 : 16;
    ctx.moveTo(pathPts[0]!.x, pathPts[0]!.y);
    for (let i = 1; i < pathPts.length; i++) ctx.lineTo(pathPts[i]!.x, pathPts[i]!.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Trail dots near tip
    if (flying) {
      ctx.fillStyle = 'rgba(46,230,255,0.55)';
      for (let i = 0; i < 5; i++) {
        const idx = Math.max(0, pathPts.length - 2 - i * 2);
        const p = pathPts[idx]!;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 - i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Engine particles
      if (Math.random() < 0.55) {
        particles.push({
          x: tip.x - 6,
          y: tip.y + 8,
          vx: -0.8 - Math.random(),
          vy: 0.6 + Math.random() * 1.2,
          life: 0.35 + Math.random() * 0.25,
          hue: 40 + Math.random() * 40,
        });
      }
    }

    // Rocket DOM follow
    el.rocket.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
    const prev = pathPts[Math.max(0, pathPts.length - 4)]!;
    const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    el.rocket.style.setProperty('--ang', `${ang + Math.PI / 2}rad`);
    el.rocket.classList.toggle('on', state?.phase === 'flying' || crashed);
    el.rocket.classList.toggle('boom', crashed);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 0.016;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${Math.min(1, p.life)})`;
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function setBalance(n: number) {
  balance = n;
  el.bal.textContent = money(n);
  el.bal.classList.remove('bump');
  void el.bal.offsetWidth;
  el.bal.classList.add('bump');
}

function renderHistory(items: SurgePublicState['history']) {
  el.history.innerHTML = items
    .map((h) => {
      const cls = h.crashAt < 1.5 ? 'low' : h.crashAt < 3 ? 'mid' : 'high';
      return `<span class="sg-chip ${cls}">${h.crashAt.toFixed(2)}×</span>`;
    })
    .join('');
}

function applyState(s: SurgePublicState) {
  const prev = lastPhase;
  state = s;
  lastPhase = s.phase;
  el.phase.textContent = s.phase.toUpperCase();
  el.online.textContent = `${s.online} online · ${s.players} betting`;
  renderHistory(s.history);

  if (s.commit) {
    el.fair.textContent = s.serverSeed
      ? `Round #${s.roundId} · revealed · commit ${s.commit.slice(0, 18)}…`
      : `Round #${s.roundId} · commit ${s.commit.slice(0, 22)}…`;
  }

  if (s.phase === 'betting') {
    if (prev && prev !== 'betting') {
      audio.stopEngine();
      crashed = false;
      samples = [];
      particles = [];
      displayM = 1;
      el.rocket.classList.remove('on', 'boom');
    }
    hasOpenBet = false;
    cashedThisRound = false;
    el.mult.className = 'sg-mult betting';
    const sec = Math.max(0, s.betEndsIn);
    el.mult.textContent = String(Math.ceil(sec));
    el.cdN.textContent = sec.toFixed(1) + 's';
    el.cdL.textContent = 'Betting open — crash already locked';
    el.cd.classList.toggle('urgent', sec <= 2);
    el.bet.disabled = false;
    el.cash.disabled = true;
    el.board.classList.remove('sg-shake');

  } else if (s.phase === 'flying') {
    if (prev !== 'flying') {
      crashed = false;
      samples = [{ t: performance.now(), m: 1 }];
      displayM = 1;
      audio.liftoff();
      flash('lift');
      el.rocket.classList.add('on');
      el.rocket.classList.remove('boom');
      log(`Round <b>#${s.roundId}</b> launched`);
    }
    el.mult.className = 'sg-mult flying';
    el.cd.classList.remove('urgent');
    el.cdL.textContent = hasOpenBet && !cashedThisRound ? 'Tap cash out anytime' : 'Spectating flight';
    el.bet.disabled = true;
    el.cash.disabled = !(hasOpenBet && !cashedThisRound);
  } else if (s.phase === 'crashed') {
    el.mult.className = 'sg-mult crash';
    el.mult.textContent = `${(s.crashAt ?? s.multiplier).toFixed(2)}×`;
    el.cdN.textContent = 'CRASHED';
    el.cdL.textContent = `Next round soon · #${s.roundId}`;
    el.bet.disabled = true;
    el.cash.disabled = true;
  }
}

function onTick(m: number, _elapsedMs: number) {
  const now = performance.now();
  samples.push({ t: now, m });
  if (samples.length > 240) samples.shift();
  audio.setFlightMult(m);
}

// —— rAF loop ——
function loop(now: number) {
  if (state?.phase === 'flying' && !crashed) {
    displayM = smoothMult(now);
    el.mult.textContent = `${displayM.toFixed(2)}×`;
    el.cdN.textContent = `${displayM.toFixed(2)}×`;
    // Color shifts hotter with mult
    const heat = Math.min(1, (displayM - 1) / 8);
    el.mult.style.setProperty('--heat', String(heat));
  }
  drawFrame(now);
  requestAnimationFrame(loop);
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect() {
  el.conn.classList.remove('live');
  el.conn.querySelector('span')!.textContent = 'Connecting…';
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    el.conn.querySelector('span')!.textContent = 'Failed';
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    el.conn.classList.add('live');
    el.conn.querySelector('span')!.textContent = 'Live host';
    send({ type: 'hello', name: 'Pilot' });
    log('<b>Connected</b> to Surge host');
  };

  ws.onclose = () => {
    el.conn.classList.remove('live');
    el.conn.querySelector('span')!.textContent = 'Disconnected';
    el.bet.disabled = true;
    el.cash.disabled = true;
    audio.stopEngine();
    scheduleReconnect();
  };

  ws.onerror = () => {
    log('Host unreachable — run <b>npm run surge:server</b>');
  };

  ws.onmessage = (ev) => {
    let msg: SurgeServerMsg;
    try {
      msg = JSON.parse(String(ev.data)) as SurgeServerMsg;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'welcome':
        setBalance(msg.balance);
        applyState(msg.state);
        break;
      case 'state':
        applyState(msg.state);
        break;
      case 'tick':
        if (state?.phase !== 'flying' && state) {
          applyState({ ...state, phase: 'flying', multiplier: msg.multiplier });
        }
        onTick(msg.multiplier, msg.elapsedMs);
        el.cash.disabled = !(hasOpenBet && !cashedThisRound);
        break;
      case 'crash': {
        crashed = true;
        crashAt = msg.crashAt;
        displayM = msg.crashAt;
        samples.push({ t: performance.now(), m: msg.crashAt });
        audio.crash();
        flash('crash');
        el.board.classList.remove('sg-shake');
        void el.board.offsetWidth;
        el.board.classList.add('sg-shake');
        el.mult.className = 'sg-mult crash';
        el.mult.textContent = `${msg.crashAt.toFixed(2)}×`;
        const tip = multToXY(msg.crashAt, Math.max(2, msg.crashAt));
        spawnBurst(tip.x, tip.y, 36, 0);
        spawnBurst(tip.x, tip.y, 18, 320);
        log(`Crashed at <b>${msg.crashAt.toFixed(2)}×</b>`);
        if (hasOpenBet && !cashedThisRound) {
          toast('Busted', 'lose');
          // crash() already played — skip extra bust sting
        }
        hasOpenBet = false;
        el.cash.disabled = true;
        break;
      }
      case 'bet_ok':
        hasOpenBet = true;
        cashedThisRound = false;
        setBalance(msg.balance);
        audio.lock();
        toast(`Bet ${money(msg.stake)}`, 'info');
        log(`Bet ${money(msg.stake)} · auto ${msg.autoAt ? msg.autoAt.toFixed(2) + '×' : 'off'}`);
        el.bet.disabled = true;
        break;
      case 'bet_reject':
        audio.bust();
        toast(msg.reason, 'lose');
        break;
      case 'cashout_ok':
        cashedThisRound = true;
        hasOpenBet = false;
        setBalance(msg.balance);
        audio.cashout(msg.at);
        flash('cash');
        toast(`+${money(msg.payout)} @ ${msg.at.toFixed(2)}×`, 'win');
        log(`Cashed <b>${msg.at.toFixed(2)}×</b> → ${money(msg.payout)}`);
        el.cash.disabled = true;
        {
          const tip = multToXY(msg.at, Math.max(2, displayM, msg.at));
          spawnBurst(tip.x, tip.y, 20, 120);
        }
        break;
      case 'cashout_reject':
        log(`Cashout: ${msg.reason}`);
        break;
      case 'round_settle':
        setBalance(msg.balance);
        if (!msg.won) hasOpenBet = false;
        break;
      case 'balance':
        setBalance(msg.balance);
        break;
      case 'error':
        log(msg.message);
        break;
      default:
        break;
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 1500);
}

el.bet.addEventListener('click', async () => {
  await audio.unlock();
  audio.click();
  send({
    type: 'bet',
    stake: Number(el.stake.value),
    autoAt: (() => {
      const a = Number(el.auto.value);
      return Number.isFinite(a) && a > 1 ? a : null;
    })(),
  });
});

el.cash.addEventListener('click', async () => {
  await audio.unlock();
  audio.click();
  send({ type: 'cashout' });
});

document.querySelectorAll('.sg-pill').forEach((b) => {
  b.addEventListener('click', () => {
    audio.click();
    el.auto.value = (b as HTMLElement).dataset.m!;
    b.classList.add('sel');
    document.querySelectorAll('.sg-pill').forEach((x) => {
      if (x !== b) x.classList.remove('sel');
    });
  });
});

document.querySelectorAll('.sg-stake-btn').forEach((b) => {
  b.addEventListener('click', () => {
    audio.click();
    el.stake.value = (b as HTMLElement).dataset.s!;
    b.classList.add('sel');
    document.querySelectorAll('.sg-stake-btn').forEach((x) => {
      if (x !== b) x.classList.remove('sel');
    });
  });
});

const syncSound = () => {
  el.sound.textContent = audio.isEnabled() ? 'Sound on' : 'Sound off';
};
syncSound();
el.sound.addEventListener('click', async () => {
  await audio.unlock();
  audio.toggle();
  audio.click();
  syncSound();
});

window.addEventListener(
  'pointerdown',
  () => {
    void audio.unlock();
  },
  { once: true },
);

resizeCanvas();
requestAnimationFrame(loop);
connect();
