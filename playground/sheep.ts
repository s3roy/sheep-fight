/**
 * Sheep Fight — top-down 5-lane · local 2-player (or 1P vs AI).
 */
import './sheep.css';
import { sheepAudio as audio } from './sheep-audio';
import {
  drawSheepTop,
  drawDeerTop,
  drawTrayIcon,
  paintAvatar,
  type SpritePose,
} from './sheep-sprites';

const LANES = 5;
const MAX_HP = 100;
const MAX_MANA = 10;

type Team = 'sheep' | 'deer';

type UnitKind = {
  id: string;
  team: Team;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  speed: number;
  radius: number;
  scale: number;
};

const SHEEP_KINDS: UnitKind[] = [
  { id: 'lamb', team: 'sheep', name: 'Lamb', cost: 2, hp: 28, atk: 6, speed: 40, radius: 16, scale: 0.85 },
  { id: 'sheep', team: 'sheep', name: 'Black Sheep', cost: 3, hp: 48, atk: 9, speed: 32, radius: 20, scale: 1 },
  { id: 'ram', team: 'sheep', name: 'Ram', cost: 4, hp: 70, atk: 14, speed: 26, radius: 24, scale: 1.12 },
  { id: 'king', team: 'sheep', name: 'King Ram', cost: 6, hp: 110, atk: 20, speed: 20, radius: 28, scale: 1.3 },
];

const DEER_KINDS: UnitKind[] = [
  { id: 'fawn', team: 'deer', name: 'Fawn', cost: 2, hp: 26, atk: 6, speed: 42, radius: 15, scale: 0.82 },
  { id: 'deer', team: 'deer', name: 'Deer', cost: 3, hp: 46, atk: 9, speed: 34, radius: 19, scale: 0.98 },
  { id: 'stag', team: 'deer', name: 'Stag', cost: 4, hp: 68, atk: 14, speed: 28, radius: 23, scale: 1.1 },
  { id: 'alpha', team: 'deer', name: 'Alpha', cost: 6, hp: 105, atk: 19, speed: 22, radius: 27, scale: 1.28 },
];

type Unit = {
  uid: number;
  kind: UnitKind;
  lane: number;
  y: number;
  hp: number;
  maxHp: number;
  fighting: boolean;
  squash: number;
  walk: number;
  dead: boolean;
  flash: number;
  born: number;
  push: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'dot' | 'star' | 'spark';
};

type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  vy: number;
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="sf-sky" aria-hidden="true">
    <div class="sf-cloud" style="width:54px;height:22px;top:18%;left:8%"></div>
    <div class="sf-cloud" style="width:72px;height:26px;top:28%;left:55%;animation-delay:-8s"></div>
    <div class="sf-hill"></div>
    <div class="sf-tree" style="left:18%"></div>
    <div class="sf-tree" style="left:72%;transform:scale(0.85)"></div>
    <div class="sf-rock" style="left:40%"></div>
  </div>

  <div class="sf-topbar">
    <button type="button" class="sf-mini" id="sf-sound">Sound</button>
    <button type="button" class="sf-mini"><a href="/">Exit</a></button>
  </div>

  <header class="sf-hud-top">
    <div class="sf-avatar enemy"><canvas id="sf-av-p2" width="64" height="64"></canvas></div>
    <div class="sf-bar-wrap">
      <div class="sf-nameplate" id="sf-name-p2">Player 2 · Deer</div>
      <div class="sf-hp-frame">
        <div class="sf-hp-fill" id="sf-hp-enemy" style="width:100%"></div>
        <span class="sf-hp-pct" id="sf-hp-enemy-pct">100%</span>
      </div>
      <div class="sf-mana sf-mana-top" id="sf-mana-p2"></div>
    </div>
  </header>

  <aside class="sf-tray sf-tray-p2" id="sf-tray-p2"></aside>

  <div class="sf-board-wrap">
    <div class="sf-board" id="sf-board">
      <div class="sf-finish sf-finish-top" id="sf-finish-top" aria-hidden="true">
        <span class="sf-finish-label">FINISH</span>
      </div>
      <div class="sf-zone sf-zone-p2" aria-hidden="true"></div>
      <div class="sf-zone sf-zone-p1" aria-hidden="true"></div>
      <div class="sf-lanes" id="sf-lanes"></div>
      <canvas class="sf-canvas" id="sf-canvas"></canvas>
      <div class="sf-finish sf-finish-bot" id="sf-finish-bot" aria-hidden="true">
        <span class="sf-finish-label">FINISH</span>
      </div>
      <div class="sf-hint" id="sf-hint">Drag a unit onto a lane — or tap after selecting</div>
      <div class="sf-banner" id="sf-banner"></div>
    </div>
  </div>

  <div class="sf-ghost" id="sf-ghost" aria-hidden="true"><canvas width="72" height="72"></canvas></div>

  <aside class="sf-tray sf-tray-p1" id="sf-tray-p1"></aside>

  <button type="button" class="sf-emote" id="sf-emote" aria-label="Emote">🐑</button>

  <footer class="sf-hud-bot">
    <div class="sf-avatar"><canvas id="sf-av-p1" width="64" height="64"></canvas></div>
    <div class="sf-bar-wrap">
      <div class="sf-nameplate" id="sf-name-p1">Player 1 · Sheep</div>
      <div class="sf-hp-frame">
        <div class="sf-hp-fill" id="sf-hp-you" style="width:100%"></div>
        <span class="sf-hp-pct" id="sf-hp-you-pct">100%</span>
      </div>
      <div class="sf-mana" id="sf-mana-p1"></div>
    </div>
  </footer>

  <div class="sf-start-overlay" id="sf-start">
    <div class="sf-start-card">
      <h1>Sheep Fight</h1>
      <p>Top-down lane clash. Two players on one device — or solo vs AI.</p>
      <div class="sf-mode-row">
        <button type="button" class="sf-start-go" id="sf-2p">2 Players</button>
        <button type="button" class="sf-start-alt" id="sf-1p">1P vs AI</button>
      </div>
      <p class="sf-help">Drag a unit from the tray onto a lane.<br/>Or select → tap lane (P1 bottom / P2 top).</p>
    </div>
  </div>
`;

const el = {
  trayP1: document.getElementById('sf-tray-p1')!,
  trayP2: document.getElementById('sf-tray-p2')!,
  board: document.getElementById('sf-board')!,
  lanes: document.getElementById('sf-lanes')!,
  canvas: document.getElementById('sf-canvas') as HTMLCanvasElement,
  finishTop: document.getElementById('sf-finish-top')!,
  finishBot: document.getElementById('sf-finish-bot')!,
  ghost: document.getElementById('sf-ghost')!,
  ghostCanvas: document.querySelector('#sf-ghost canvas') as HTMLCanvasElement,
  manaP1: document.getElementById('sf-mana-p1')!,
  manaP2: document.getElementById('sf-mana-p2')!,
  hint: document.getElementById('sf-hint')!,
  banner: document.getElementById('sf-banner')!,
  hpYou: document.getElementById('sf-hp-you')!,
  hpEnemy: document.getElementById('sf-hp-enemy')!,
  pctYou: document.getElementById('sf-hp-you-pct')!,
  pctEnemy: document.getElementById('sf-hp-enemy-pct')!,
  nameP1: document.getElementById('sf-name-p1')!,
  nameP2: document.getElementById('sf-name-p2')!,
  emote: document.getElementById('sf-emote')!,
  start: document.getElementById('sf-start')!,
  btn2p: document.getElementById('sf-2p')!,
  btn1p: document.getElementById('sf-1p')!,
  sound: document.getElementById('sf-sound')!,
  avP1: document.getElementById('sf-av-p1') as HTMLCanvasElement,
  avP2: document.getElementById('sf-av-p2') as HTMLCanvasElement,
};

const ctx = el.canvas.getContext('2d')!;
paintAvatar(el.avP1, 'sheep');
paintAvatar(el.avP2, 'deer');

for (let i = 0; i < LANES; i++) {
  const lane = document.createElement('div');
  lane.className = 'sf-lane';
  lane.dataset.lane = String(i);
  el.lanes.appendChild(lane);
}

el.manaP1.innerHTML = Array.from({ length: MAX_MANA }, () => '<i></i>').join('');
el.manaP2.innerHTML = Array.from({ length: MAX_MANA }, () => '<i></i>').join('');

type DragState = {
  team: Team;
  kindIdx: number;
  pointerId: number;
};

let drag: DragState | null = null;

function clearDropHighlight() {
  [...el.lanes.children].forEach((l) => {
    l.classList.remove('drop', 'drop-p1', 'drop-p2');
  });
}

function setGhost(clientX: number, clientY: number, kind: UnitKind, team: Team) {
  el.ghost.classList.add('on');
  el.ghost.style.left = `${clientX}px`;
  el.ghost.style.top = `${clientY}px`;
  drawTrayIcon(el.ghostCanvas, kind.id, team);
  app.classList.add('dragging');
}

function clearGhost() {
  el.ghost.classList.remove('on');
  app.classList.remove('dragging');
  clearDropHighlight();
}

function laneFromPoint(clientX: number, clientY: number): number | null {
  const rect = el.lanes.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }
  const x = (clientX - rect.left) / rect.width;
  return Math.min(LANES - 1, Math.max(0, Math.floor(x * LANES)));
}

function highlightDrop(clientX: number, clientY: number, team: Team) {
  const lane = laneFromPoint(clientX, clientY);
  [...el.lanes.children].forEach((l, i) => {
    const on = i === lane;
    l.classList.toggle('drop', on);
    l.classList.toggle('drop-p1', on && team === 'sheep');
    l.classList.toggle('drop-p2', on && team === 'deer');
  });
}

function buildTray(
  root: HTMLElement,
  kinds: UnitKind[],
  team: Team,
  onSelect: (idx: number) => void,
) {
  kinds.forEach((k, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sf-unit-btn' + (idx === 0 ? ' sel' : '');
    btn.dataset.kind = k.id;
    btn.title = k.name;
    btn.innerHTML = `<canvas width="72" height="72"></canvas><span class="sf-cost">${k.cost}</span>`;
    drawTrayIcon(btn.querySelector('canvas')!, k.id, team);

    btn.addEventListener('pointerdown', async (e) => {
      if (e.button !== 0) return;
      if (!running || over) return;
      if (btn.classList.contains('dim')) {
        await audio.unlock();
        audio.click();
        el.hint.textContent = 'Not enough energy';
        el.hint.classList.add('show');
        return;
      }
      e.preventDefault();
      await audio.unlock();
      audio.select();
      [...root.children].forEach((b) => b.classList.remove('sel'));
      btn.classList.add('sel');
      onSelect(idx);
      drag = {
        team,
        kindIdx: idx,
        pointerId: e.pointerId,
      };
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setGhost(e.clientX, e.clientY, k, team);
    });

    root.appendChild(btn);
  });
}

let selP1 = 0;
let selP2 = 0;
let manaP1 = 5;
let manaP2 = 5;
let hpYou = MAX_HP;
let hpEnemy = MAX_HP;
let units: Unit[] = [];
let particles: Particle[] = [];
let floaters: Floater[] = [];
let uid = 1;
let running = false;
let over = false;
let vsAi = false;
let lastTs = 0;
let manaAcc = 0;
let aiAcc = 0;
let cssW = 0;
let cssH = 0;
/** Sticky fight highlight per lane — stops on/off flicker */
const fightHold = Array.from({ length: LANES }, () => 0);

buildTray(el.trayP1, SHEEP_KINDS, 'sheep', (i) => {
  selP1 = i;
});
buildTray(el.trayP2, DEER_KINDS, 'deer', (i) => {
  selP2 = i;
});

function resize() {
  const r = el.board.getBoundingClientRect();
  cssW = r.width;
  cssH = r.height;
  const dpr = Math.min(2.5, devicePixelRatio || 1);
  el.canvas.width = Math.floor(cssW * dpr);
  el.canvas.height = Math.floor(cssH * dpr);
  el.canvas.style.width = `${cssW}px`;
  el.canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

function setHp(side: 'you' | 'enemy', value: number) {
  const pct = Math.max(0, Math.round((value / MAX_HP) * 100));
  const fill = side === 'you' ? el.hpYou : el.hpEnemy;
  const label = side === 'you' ? el.pctYou : el.pctEnemy;
  fill.style.width = `${pct}%`;
  label.textContent = `${pct}%`;
  fill.classList.toggle('low', pct <= 40 && pct > 18);
  fill.classList.toggle('crit', pct <= 18);
}

function paintMana(node: HTMLElement, value: number, kinds: UnitKind[], tray: HTMLElement) {
  [...node.children].forEach((n, i) => n.classList.toggle('on', i < Math.floor(value)));
  // Use class (not disabled) so pointer drag still works when affordable
  [...tray.children].forEach((b, i) => {
    const dim = !running || over || kinds[i]!.cost > value;
    (b as HTMLButtonElement).classList.toggle('dim', dim);
    (b as HTMLButtonElement).setAttribute('aria-disabled', dim ? 'true' : 'false');
  });
}

function syncMana() {
  paintMana(el.manaP1, manaP1, SHEEP_KINDS, el.trayP1);
  paintMana(el.manaP2, manaP2, DEER_KINDS, el.trayP2);
}

function laneW() {
  return cssW / LANES;
}

/** Exact center of a 1/5 lane column — matches grass + hit grid. */
function laneX(lane: number) {
  return (lane + 0.5) * laneW();
}

/** Fit sprite inside one lane so wool never bleeds into neighbors. */
function drawScaleFor(kind: UnitKind) {
  const maxDiam = laneW() * 0.78;
  const baseDiam = 48; // sprite extent at scale 1
  return Math.min(kind.scale * 0.92, maxDiam / baseDiam);
}

function spawn(kind: UnitKind, lane: number, team: Team) {
  const gap = Math.max(0.1, (drawScaleFor(kind) * 46) / Math.max(1, cssH));
  const mates = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === team);
  let y = team === 'sheep' ? 0.88 : 0.12;
  if (mates.length) {
    if (team === 'sheep') {
      // Spawn behind the rearmost sheep (highest y)
      const rear = mates.reduce((a, b) => (a.y > b.y ? a : b));
      y = Math.min(0.96, rear.y + gap);
    } else {
      const rear = mates.reduce((a, b) => (a.y < b.y ? a : b));
      y = Math.max(0.04, rear.y - gap);
    }
  }
  const u: Unit = {
    uid: uid++,
    kind: { ...kind, team },
    lane,
    y,
    hp: kind.hp,
    maxHp: kind.hp,
    fighting: false,
    squash: 1,
    walk: Math.random(),
    dead: false,
    flash: 0,
    born: 0,
    push: 0,
  };
  units.push(u);
  audio.deploy(team);
  return u;
}

function trySpawn(team: Team, lane: number, kindIdx?: number) {
  if (!running || over) return false;
  if (team === 'deer' && vsAi) return false;

  const kinds = team === 'sheep' ? SHEEP_KINDS : DEER_KINDS;
  const sel = kindIdx ?? (team === 'sheep' ? selP1 : selP2);
  const kind = kinds[sel]!;
  const mana = team === 'sheep' ? manaP1 : manaP2;
  if (mana < kind.cost) {
    audio.click();
    el.hint.textContent = `${team === 'sheep' ? 'P1' : 'P2'}: not enough energy`;
    el.hint.classList.add('show');
    return false;
  }
  const count = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === team).length;
  if (count >= 4) {
    el.hint.textContent = 'Lane full';
    el.hint.classList.add('show');
    return false;
  }
  if (team === 'sheep') manaP1 -= kind.cost;
  else manaP2 -= kind.cost;
  syncMana();
  spawn(kind, lane, team);
  el.hint.classList.remove('show');
  const laneEl = el.lanes.children[lane] as HTMLElement;
  laneEl.classList.add('hot');
  window.setTimeout(() => laneEl.classList.remove('hot'), 250);
  return true;
}

window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const kinds = drag.team === 'sheep' ? SHEEP_KINDS : DEER_KINDS;
  setGhost(e.clientX, e.clientY, kinds[drag.kindIdx]!, drag.team);
  highlightDrop(e.clientX, e.clientY, drag.team);
});

function endDrag(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const { team, kindIdx } = drag;
  const lane = laneFromPoint(e.clientX, e.clientY);
  drag = null;
  clearGhost();
  // Drop on a lane → spawn. Release over tray = select only.
  if (lane != null) trySpawn(team, lane, kindIdx);
}

window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

el.lanes.addEventListener('pointerdown', async (e) => {
  if (drag) return; // drop handled by pointerup
  const t = (e.target as HTMLElement).closest('.sf-lane') as HTMLElement | null;
  if (!t) return;
  await audio.unlock();
  const lane = Number(t.dataset.lane);
  const rect = t.getBoundingClientRect();
  const localY = (e.clientY - rect.top) / rect.height;
  // Top half → P2 (deer), bottom half → P1 (sheep)
  if (localY < 0.45) trySpawn('deer', lane);
  else trySpawn('sheep', lane);
});

function aiThink(dt: number) {
  if (!vsAi) return;
  aiAcc += dt;
  if (aiAcc < 0.9) return;
  aiAcc = 0;
  if (!running || over) return;

  const scores = Array.from({ length: LANES }, (_, lane) => {
    const sheep = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === 'sheep');
    const deer = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === 'deer');
    let s = Math.random() * 2;
    if (sheep.length > deer.length) s += 4;
    for (const u of sheep) s += (1 - u.y) * 2;
    return s;
  });
  let lane = 0;
  for (let i = 1; i < LANES; i++) if (scores[i]! > scores[lane]!) lane = i;

  const threat = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === 'sheep').length;
  let kind = DEER_KINDS[1]!;
  if (threat >= 2 || Math.random() < 0.3) kind = DEER_KINDS[Math.min(3, 2 + (Math.random() < 0.4 ? 1 : 0))]!;
  else if (Math.random() < 0.35) kind = DEER_KINDS[0]!;

  if (manaP2 >= kind.cost) {
    const deerCount = units.filter((u) => !u.dead && u.lane === lane && u.kind.team === 'deer').length;
    if (deerCount < 4) {
      manaP2 -= kind.cost;
      syncMana();
      spawn(kind, lane, 'deer');
    }
  }
}

function bumpParticles(
  x: number,
  y: number,
  n: number,
  color: string,
  kind: Particle['kind'] = 'dot',
) {
  for (let i = 0; i < n; i++) {
    const life = 0.35 + Math.random() * 0.45;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (kind === 'star' ? 140 : 90),
      vy: (Math.random() - 0.5) * (kind === 'star' ? 140 : 90) - (kind === 'star' ? 40 : 0),
      life,
      maxLife: life,
      color,
      size: kind === 'star' ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
      kind,
    });
  }
}

function floatText(x: number, y: number, text: string, color: string) {
  floaters.push({ x, y, text, life: 0.9, color, vy: -42 });
}

function flashFinish(side: 'top' | 'bot') {
  const node = side === 'top' ? el.finishTop : el.finishBot;
  node.classList.remove('hit');
  void node.offsetWidth;
  node.classList.add('hit');
  window.setTimeout(() => node.classList.remove('hit'), 520);
}

function onFinishCross(team: Team, lane: number, kind: UnitKind) {
  const dmg = Math.round(8 + kind.scale * 4);
  const x = laneX(lane);
  if (team === 'sheep') {
    hpEnemy = Math.max(0, hpEnemy - dmg);
    setHp('enemy', hpEnemy);
    bumpParticles(x, cssH * 0.07, 22, '#ffe08a', 'star');
    bumpParticles(x, cssH * 0.07, 14, '#fff', 'spark');
    floatText(x, cssH * 0.1, `−${dmg}`, '#ffe08a');
    flashFinish('top');
  } else {
    hpYou = Math.max(0, hpYou - dmg);
    setHp('you', hpYou);
    bumpParticles(x, cssH * 0.93, 22, '#ff9a6a', 'star');
    bumpParticles(x, cssH * 0.93, 14, '#fff', 'spark');
    floatText(x, cssH * 0.88, `−${dmg}`, '#ffb08a');
    flashFinish('bot');
  }
  audio.finishCross(team);
  shake();
}

function update(dt: number) {
  if (!running || over) return;

  manaAcc += dt;
  if (manaAcc >= 0.55) {
    manaAcc = 0;
    if (manaP1 < MAX_MANA) manaP1 += 1;
    if (manaP2 < MAX_MANA) manaP2 += 1;
    syncMana();
  }

  aiThink(dt);

  const byLane: Unit[][] = Array.from({ length: LANES }, () => []);
  for (const u of units) if (!u.dead) byLane[u.lane]!.push(u);

  for (let lane = 0; lane < LANES; lane++) {
    const list = byLane[lane]!;
    for (const u of list) {
      u.fighting = false;
      if (u.flash > 0) u.flash -= dt * 3;
      if (u.born < 1) u.born = Math.min(1, u.born + dt * 4.5);
      u.push *= Math.max(0, 1 - dt * 6);
    }

    const sheep = list.filter((u) => u.kind.team === 'sheep');
    const deer = list.filter((u) => u.kind.team === 'deer');
    let fighting = false;

    /** Visual diameter → min center-to-center gap in normalized Y */
    const unitGap = (u: Unit) => Math.max(0.1, (drawScaleFor(u.kind) * 46) / cssH);
    const pairGap = (a: Unit, b: Unit) => (unitGap(a) + unitGap(b)) * 0.52;

    const shovePower = (u: Unit) => u.kind.atk * (0.65 + u.kind.scale * 0.45);

    /** Keep same-team units in a single-file line — never collapse on top of each other */
    const spaceTeam = (teamUnits: Unit[], team: Team) => {
      if (teamUnits.length < 2) return;
      if (team === 'sheep') {
        // Front = lowest y (toward top finish)
        teamUnits.sort((a, b) => a.y - b.y);
        for (let i = 1; i < teamUnits.length; i++) {
          const prev = teamUnits[i - 1]!;
          const cur = teamUnits[i]!;
          const need = pairGap(prev, cur);
          if (cur.y < prev.y + need) cur.y = prev.y + need;
        }
        for (const u of teamUnits) u.y = Math.min(0.96, u.y);
      } else {
        // Front = highest y (toward bottom finish)
        teamUnits.sort((a, b) => b.y - a.y);
        for (let i = 1; i < teamUnits.length; i++) {
          const prev = teamUnits[i - 1]!;
          const cur = teamUnits[i]!;
          const need = pairGap(prev, cur);
          if (cur.y > prev.y - need) cur.y = prev.y - need;
        }
        for (const u of teamUnits) u.y = Math.max(0.04, u.y);
      }
    };

    // Front clash: lead sheep (lowest y) vs lead deer (highest y)
    sheep.sort((a, b) => a.y - b.y);
    deer.sort((a, b) => b.y - a.y);
    const leadS = sheep[0];
    const leadD = deer[0];
    const clashReach = leadS && leadD ? pairGap(leadS, leadD) * 1.15 : 0.12;
    const clashing =
      !!leadS && !!leadD && leadS.y > leadD.y && leadS.y - leadD.y < clashReach;

    if (clashing && leadS && leadD) {
      fighting = true;
      // Supports within ~2 body lengths add weight, but only leads move from shove
      const pileS = sheep.filter((u) => u.y - leadS.y < unitGap(leadS) * 2.8);
      const pileD = deer.filter((u) => leadD.y - u.y < unitGap(leadD) * 2.8);
      for (const u of [...pileS, ...pileD]) {
        u.fighting = true;
        u.squash += (0.94 - u.squash) * Math.min(1, dt * 6);
        u.walk += dt * 1.1;
        u.flash = 0;
      }

      let sheepP = 0;
      let deerP = 0;
      for (const u of pileS) sheepP += shovePower(u) * (u === leadS ? 1 : 0.55);
      for (const u of pileD) deerP += shovePower(u) * (u === leadD ? 1 : 0.55);

      const total = Math.max(1, sheepP + deerP);
      const net = (sheepP - deerP) / total;
      const drift = net * 0.09 * dt;
      const sheepDrive = (leadS.kind.speed / cssH) * dt * 0.12;
      const deerDrive = (leadD.kind.speed / cssH) * dt * 0.12;

      // Only front units take the shove — rears keep spacing via spaceTeam
      leadS.y -= sheepDrive + drift;
      leadD.y += deerDrive - drift;

      const want = pairGap(leadS, leadD) * 0.92;
      const gap = leadS.y - leadD.y;
      if (gap < want) {
        const fix = (want - gap) * 0.5;
        leadS.y += fix;
        leadD.y -= fix;
      }
      leadS.y = Math.min(0.96, Math.max(0.04, leadS.y));
      leadD.y = Math.min(0.96, Math.max(0.04, leadD.y));

      // Rears ease toward the front but stop at spacing (filled by spaceTeam)
      for (const s of sheep) {
        if (s === leadS) continue;
        s.y -= (s.kind.speed / cssH) * dt * 0.35;
      }
      for (const d of deer) {
        if (d === leadD) continue;
        d.y += (d.kind.speed / cssH) * dt * 0.35;
      }

      if (Math.random() < dt * 1.2) {
        bumpParticles(laneX(lane), ((leadS.y + leadD.y) / 2) * cssH, 2, '#fff8e0', 'spark');
        audio.fightBleat();
      }
    }

    // Advance when not locked in a shove
    for (const s of sheep) {
      if (s.fighting || s.dead) continue;
      s.y -= (s.kind.speed / cssH) * dt * 0.52;
      s.walk += dt * (s.kind.speed / 26);
      s.squash += (1 - s.squash) * Math.min(1, dt * 8);
      if (Math.random() < dt * 0.4) audio.step();
    }

    for (const d of deer) {
      if (d.fighting || d.dead) continue;
      d.y += (d.kind.speed / cssH) * dt * 0.52;
      d.walk += dt * (d.kind.speed / 26);
      d.squash += (1 - d.squash) * Math.min(1, dt * 8);
    }

    // Hard spacing pass — fixes collapse after shove / chase
    spaceTeam(sheep, 'sheep');
    spaceTeam(deer, 'deer');

    // Keep opposing fronts from merging through each other
    sheep.sort((a, b) => a.y - b.y);
    deer.sort((a, b) => b.y - a.y);
    if (sheep[0] && deer[0] && sheep[0].y <= deer[0].y) {
      const mid = (sheep[0].y + deer[0].y) / 2;
      const half = pairGap(sheep[0], deer[0]) * 0.5;
      sheep[0].y = mid + half;
      deer[0].y = mid - half;
      spaceTeam(sheep, 'sheep');
      spaceTeam(deer, 'deer');
    } else if (sheep[0] && deer[0]) {
      const need = pairGap(sheep[0], deer[0]) * 0.92;
      if (sheep[0].y - deer[0].y < need) {
        const mid = (sheep[0].y + deer[0].y) / 2;
        sheep[0].y = mid + need / 2;
        deer[0].y = mid - need / 2;
        spaceTeam(sheep, 'sheep');
        spaceTeam(deer, 'deer');
      }
    }

    if (fighting) fightHold[lane] = 0.4;
    else fightHold[lane] = Math.max(0, fightHold[lane]! - dt);
    const showFight = fightHold[lane]! > 0;
    const laneEl = el.lanes.children[lane] as HTMLElement;
    if (laneEl.classList.contains('fight') !== showFight) {
      laneEl.classList.toggle('fight', showFight);
    }

    for (const s of sheep) {
      if (!s.dead && s.y <= 0.08) {
        s.dead = true;
        onFinishCross('sheep', lane, s.kind);
      }
    }
    for (const d of deer) {
      if (!d.dead && d.y >= 0.92) {
        d.dead = true;
        onFinishCross('deer', lane, d.kind);
      }
    }
  }

  units = units.filter((u) => !u.dead);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]!;
    f.y += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }

  if (hpYou <= 0 || hpEnemy <= 0) endMatch(hpEnemy <= 0);
}

function shake() {
  el.board.classList.remove('sf-shake');
  void el.board.offsetWidth;
  el.board.classList.add('sf-shake');
  window.setTimeout(() => el.board.classList.remove('sf-shake'), 220);
}

function endMatch(p1Wins: boolean) {
  over = true;
  running = false;
  el.banner.textContent = p1Wins ? (vsAi ? 'Victory!' : 'Player 1 wins!') : vsAi ? 'Defeat…' : 'Player 2 wins!';
  el.banner.classList.add('show');
  if (p1Wins) audio.win();
  else audio.lose();
  window.setTimeout(() => {
    el.start.style.display = 'grid';
  }, 1600);
}

function draw() {
  if (!cssW) return;
  ctx.clearRect(0, 0, cssW, cssH);

  // Midfield dashed line
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(8, cssH * 0.5);
  ctx.lineTo(cssW - 8, cssH * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Subtle finish marks (wood rails carry the look)
  const drawFinishStripe = (y: number) => {
    ctx.strokeStyle = 'rgba(255, 240, 180, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(cssW - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawFinishStripe(cssH * 0.08);
  drawFinishStripe(cssH * 0.92);

  const sorted = [...units].sort((a, b) => a.y - b.y);
  for (const u of sorted) {
    const x = laneX(u.lane);
    const y = u.y * cssH;
    const sc = drawScaleFor(u.kind);
    ctx.save();
    ctx.translate(x, y);
    if (u.kind.team === 'sheep') ctx.rotate(Math.PI);
    ctx.scale(sc, sc);

    const pose: SpritePose = {
      walk: u.walk,
      fighting: u.fighting,
      flash: u.flash,
      squash: u.squash,
      born: u.born,
    };
    if (u.kind.team === 'sheep') drawSheepTop(ctx, u.kind.id as 'lamb' | 'sheep' | 'ram' | 'king', pose);
    else drawDeerTop(ctx, u.kind.id as 'fawn' | 'deer' | 'stag' | 'alpha', pose);
    ctx.restore();

    // No unit HP bars — clashes shove, only finish-line hits score damage
  }

  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.kind === 'star') {
      const r = p.size * (0.7 + a * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const ox = Math.cos(ang) * r;
        const oy = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(p.x + ox, p.y + oy);
        else ctx.lineTo(p.x + ox, p.y + oy);
        const ang2 = ang + Math.PI / 5;
        ctx.lineTo(p.x + Math.cos(ang2) * r * 0.4, p.y + Math.sin(ang2) * r * 0.4);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? 0.7 + a : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
    ctx.font = '800 16px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function frame(ts: number) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function resetMatch() {
  units = [];
  particles = [];
  floaters = [];
  hpYou = MAX_HP;
  hpEnemy = MAX_HP;
  manaP1 = 5;
  manaP2 = 5;
  setHp('you', hpYou);
  setHp('enemy', hpEnemy);
  syncMana();
  manaAcc = 0;
  aiAcc = 0.5;
  over = false;
  for (let i = 0; i < LANES; i++) {
    fightHold[i] = 0;
    (el.lanes.children[i] as HTMLElement).classList.remove('fight', 'hot', 'drop', 'drop-p1', 'drop-p2');
  }
  el.banner.classList.remove('show');
}

async function startMatch(ai: boolean) {
  await audio.unlock();
  audio.start();
  vsAi = ai;
  el.nameP1.textContent = 'Player 1 · Sheep';
  el.nameP2.textContent = ai ? 'AI · Deer' : 'Player 2 · Deer';
  el.trayP2.classList.toggle('ai-locked', ai);
  el.trayP2.classList.toggle('hidden', ai);
  el.start.style.display = 'none';
  resetMatch();
  running = true;
  syncMana();
  el.hint.textContent = ai
    ? 'Drag a sheep onto a lane (or select → tap bottom)'
    : 'Drag units onto lanes · P1 bottom / P2 top to tap';
  el.hint.classList.add('show');
  window.setTimeout(() => el.hint.classList.remove('show'), 3600);
}

el.btn2p.addEventListener('click', () => void startMatch(false));
el.btn1p.addEventListener('click', () => void startMatch(true));

el.emote.addEventListener('click', async () => {
  await audio.unlock();
  audio.bleat(false);
  const em = document.createElement('div');
  em.className = 'sf-float-emote';
  em.textContent = ['🐑', '😎', '🔥', '💪'][Math.floor(Math.random() * 4)]!;
  em.style.left = `${50 + Math.random() * 30}%`;
  em.style.bottom = '22%';
  el.board.appendChild(em);
  window.setTimeout(() => em.remove(), 1200);
});

el.sound.addEventListener('click', async () => {
  await audio.unlock();
  audio.toggle();
  audio.click();
  el.sound.textContent = audio.isEnabled() ? 'Sound' : 'Muted';
});

let trayT = 0;
window.setInterval(() => {
  trayT += 0.1;
  [...el.trayP1.children].forEach((btn, i) => {
    const c = btn.querySelector('canvas');
    if (c) drawTrayIcon(c, SHEEP_KINDS[i]!.id, 'sheep', 0.1 + Math.sin(trayT + i) * 0.1);
  });
  [...el.trayP2.children].forEach((btn, i) => {
    const c = btn.querySelector('canvas');
    if (c) drawTrayIcon(c, DEER_KINDS[i]!.id, 'deer', 0.1 + Math.sin(trayT + i + 1) * 0.1);
  });
}, 90);

resize();
setHp('you', hpYou);
setHp('enemy', hpEnemy);
syncMana();
requestAnimationFrame(frame);
