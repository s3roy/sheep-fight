import {
  loadWallet,
  saveWallet,
  money,
  mountShell,
  setWalletDisplay,
  stageFrame,
  shake,
  sfx,
} from './shared';
import {
  randomClientSeed,
  randomServerSeed,
  commitServerSeed,
  playLatticeRound,
  buildLattice,
} from '../src/index';

let wallet = loadWallet();
const clientSeed = randomClientSeed();
let nonce = 1;

const app = document.getElementById('app')!;
mountShell(
  app,
  {
    id: 'LATTICE',
    name: 'Lattice',
    tagline: 'Path multiplies as it walks. Cash out mid-run — or risk collapse.',
    accent: 'var(--ec-sky)',
  },
  wallet,
);

const stage = document.getElementById('stage')!;
stage.innerHTML = stageFrame(
  'Hex run',
  'Like Surge, but on a hex graph. Product climbs each step — collapse wipes everything.',
  `
  <div class="ec-canvas" id="lt-canvas">
    <div class="ec-product" id="lt-product">1.00×</div>
    <svg class="ec-lattice" id="lt-svg" viewBox="0 0 640 360"></svg>
    <div class="ec-legend">
      <span><i class="ec-dot" style="background:#1e293b"></i>Path</span>
      <span><i class="ec-dot" style="background:#14532d"></i>Boost</span>
      <span><i class="ec-dot" style="background:#7f1d1d"></i>Collapse</span>
      <span><i class="ec-dot" style="background:#1e3a5f"></i>Exit</span>
    </div>
  </div>
  <div class="ec-side">
    <div class="ec-row">
      <div class="ec-field"><label>Stake</label><input id="lt-stake" type="number" value="100" min="1" /></div>
      <div class="ec-field"><label>Start col</label><input id="lt-col" type="number" value="3" min="0" max="6" /></div>
    </div>
    <div class="ec-field"><label>Heat</label>
      <select id="lt-heat"><option value="1">Cool</option><option value="2" selected>Warm</option><option value="3">Hot</option></select>
    </div>
    <div class="ec-actions">
      <button class="ec-btn ec-btn-primary" id="lt-go">Run</button>
      <button class="ec-btn ec-btn-danger" id="lt-cash" disabled>Cash out</button>
    </div>
    <div class="ec-log" id="lt-log">Start a run, then cash out before a collapse node.</div>
    <div class="ec-fair" id="lt-fair"></div>
  </div>`,
);

function setBal(n: number) {
  wallet = Math.max(0, Math.round(n * 100) / 100);
  saveWallet(wallet);
  setWalletDisplay(wallet);
}

const productEl = document.getElementById('lt-product')!;
const go = document.getElementById('lt-go') as HTMLButtonElement;
const cash = document.getElementById('lt-cash') as HTMLButtonElement;
const canvas = document.getElementById('lt-canvas')!;

let running = false;
let cashed = false;
let currentProduct = 1;
let stakeInPlay = 0;
let abortRun: (() => void) | null = null;

function paint(
  nodes: Array<{ id: number; q: number; r: number; kind: string; mult: number }>,
  path: number[],
) {
  const svg = document.getElementById('lt-svg')!;
  const size = 24;
  const ox = 78;
  const oy = 40;
  const hex = (q: number, r: number) => ({
    x: ox + q * size * 1.75 + (r % 2) * size * 0.88,
    y: oy + r * size * 1.55,
  });
  let html = '';
  if (path.length > 1) {
    const pts = path
      .map((id) => {
        const n = nodes.find((x) => x.id === id)!;
        const { x, y } = hex(n.q, n.r);
        return `${x},${y}`;
      })
      .join(' ');
    html += `<polyline points="${pts}" fill="none" stroke="#4ec4ff" stroke-width="2.5" opacity="0.85"/>`;
  }
  for (const n of nodes) {
    const { x, y } = hex(n.q, n.r);
    const onPath = path.includes(n.id);
    const fill =
      n.kind === 'collapse'
        ? '#7f1d1d'
        : n.kind === 'boost'
          ? '#14532d'
          : n.kind === 'exit'
            ? '#1e3a5f'
            : '#1e293b';
    html += `<circle cx="${x}" cy="${y}" r="${onPath ? 13 : 11}" fill="${fill}" stroke="${onPath ? '#4ec4ff' : '#334155'}" stroke-width="${onPath ? 3 : 1}"/>`;
    if (n.kind !== 'path') {
      html += `<text x="${x}" y="${y + 3}" font-size="9" fill="#e2e8f0" text-anchor="middle" font-family="Syne,sans-serif">${n.kind[0]!.toUpperCase()}</text>`;
    }
  }
  svg.innerHTML = html;
}

// Idle preview board so the canvas isn’t empty
void (async () => {
  const preview = await buildLattice(randomServerSeed(), clientSeed, 0);
  paint(preview, []);
})();

cash.onclick = () => {
  if (!running || cashed || currentProduct <= 1) return;
  cashed = true;
  const pay = Math.floor(stakeInPlay * Math.min(currentProduct, 50) * 100) / 100;
  setBal(wallet + pay);
  sfx.play('cash');
  cash.disabled = true;
  abortRun?.();
  running = false;
  go.disabled = false;
  productEl.classList.add('cashed');
  document.getElementById('lt-log')!.innerHTML =
    `Cashed mid-run @ <strong>${currentProduct.toFixed(2)}×</strong> · <strong>${money(pay)}</strong>`;
};

go.onclick = async () => {
  const stake = Number((document.getElementById('lt-stake') as HTMLInputElement).value);
  const startCol = Number((document.getElementById('lt-col') as HTMLInputElement).value);
  const heat = Number((document.getElementById('lt-heat') as HTMLSelectElement).value) as 1 | 2 | 3;
  if (!(stake > 0) || stake > wallet) {
    sfx.play('lose');
    return;
  }
  if (running) return;
  running = true;
  cashed = false;
  stakeInPlay = stake;
  currentProduct = 1;
  productEl.textContent = '1.00×';
  productEl.className = 'ec-product';
  setBal(wallet - stake);
  go.disabled = true;
  cash.disabled = false;
  sfx.play('drop');

  const serverSeed = randomServerSeed();
  const commit = await commitServerSeed(serverSeed);
  const round = await playLatticeRound({
    nonce: nonce++,
    serverSeed,
    clientSeed,
    commit,
    bets: [{ id: 'l', stake, startCol, heat }],
  });

  let stopped = false;
  abortRun = () => {
    stopped = true;
  };

  let prod = 1;
  const byId = new Map(round.nodes.map((n) => [n.id, n]));
  for (let i = 0; i < round.path.length; i++) {
    if (stopped) return;
    const id = round.path[i]!;
    const node = byId.get(id)!;
    paint(round.nodes, round.path.slice(0, i + 1));
    if (i > 0) {
      if (node.kind === 'collapse') {
        prod = 0;
        currentProduct = 0;
        productEl.textContent = '0.00×';
        productEl.classList.add('dead');
        shake(canvas);
        sfx.play('collapse');
        break;
      }
      if (node.kind === 'boost') sfx.play('boost');
      else sfx.play('tick', i);
      prod = Math.floor(prod * node.mult * 1000) / 1000;
      currentProduct = prod;
      productEl.textContent = `${prod.toFixed(2)}×`;
    }
    await new Promise((r) => setTimeout(r, 160 + heat * 20));
  }

  if (stopped) return;

  cash.disabled = true;
  running = false;
  go.disabled = false;
  const pay = round.payouts.l ?? 0;
  if (pay > 0) {
    setBal(wallet + pay);
    sfx.play('win');
    productEl.classList.add('cashed');
  } else if (!round.collapsed) {
    sfx.play('lose');
  }
  document.getElementById('lt-log')!.innerHTML = round.collapsed
    ? `Collapsed — wiped`
    : `Finished @ <strong>${round.product.toFixed(2)}×</strong> · paid <strong>${money(pay)}</strong>`;
  document.getElementById('lt-fair')!.textContent = `commit ${commit.slice(0, 22)}…`;
};
