import {
  loadWallet,
  saveWallet,
  money,
  mountShell,
  setWalletDisplay,
  stageFrame,
  flash,
  sfx,
} from './shared';
import {
  randomClientSeed,
  randomServerSeed,
  commitServerSeed,
  playAndarRound,
  cardLabel,
  cardColor,
  type Card,
  type AndarSide,
} from '../src/index';

let wallet = loadWallet();
const clientSeed = randomClientSeed();
let nonce = 1;
const history: Array<{ winner: AndarSide; matchIndex: number }> = [];

const app = document.getElementById('app')!;
mountShell(
  app,
  {
    id: 'ANDAR BAHAR',
    name: 'Andar Bahar',
    tagline: 'Watch cards slap down. First joker-rank match takes the pot.',
    accent: 'var(--ec-gold)',
  },
  wallet,
);

const stage = document.getElementById('stage')!;
stage.innerHTML = stageFrame(
  'Table',
  'Bahar gets the first card after joker. Pulse-3 pays if the hit is within 3 cards.',
  `
  <div class="ec-canvas ec-andar-canvas">
    <div class="ec-history" id="ab-history"></div>
    <div class="ec-tension"><div class="ec-tension-bar" id="ab-tension"></div></div>
    <div class="ec-cards" id="ab-board">
      <div class="ec-col" id="ab-andar-col"><h3>Andar</h3><div class="ec-card-stack" id="ab-andar"></div></div>
      <div class="ec-col ec-joker-col"><h3>Joker</h3><div class="ec-card-stack" id="ab-joker"></div></div>
      <div class="ec-col" id="ab-bahar-col"><h3>Bahar</h3><div class="ec-card-stack" id="ab-bahar"></div></div>
    </div>
    <div class="ec-match-banner" id="ab-banner" hidden></div>
  </div>
  <div class="ec-side">
    <div class="ec-row">
      <div class="ec-field"><label>Stake</label><input id="ab-stake" type="number" value="100" min="1" /></div>
      <div class="ec-field"><label>Side</label>
        <select id="ab-side"><option value="andar">Andar</option><option value="bahar" selected>Bahar</option></select>
      </div>
    </div>
    <div class="ec-side-picks">
      <button type="button" class="ec-side-chip on" data-side="bahar">Bahar</button>
      <button type="button" class="ec-side-chip" data-side="andar">Andar</button>
    </div>
    <label class="ec-check"><input type="checkbox" id="ab-pulse" /> Pulse-3 side (+½ stake)</label>
    <div class="ec-actions single">
      <button class="ec-btn ec-btn-primary" id="ab-go">Deal</button>
    </div>
    <div class="ec-log" id="ab-log">Pick a side. Cards deal one-by-one until a match.</div>
    <div class="ec-fair" id="ab-fair"></div>
  </div>`,
);

function setBal(n: number) {
  wallet = Math.max(0, Math.round(n * 100) / 100);
  saveWallet(wallet);
  setWalletDisplay(wallet);
}

const sideSelect = document.getElementById('ab-side') as HTMLSelectElement;
document.querySelectorAll('.ec-side-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.play('click');
    const side = (btn as HTMLElement).dataset.side!;
    sideSelect.value = side;
    document.querySelectorAll('.ec-side-chip').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.side === side));
  });
});

function paintCard(c: Card, joker = false, match = false) {
  const color = cardColor(c);
  const label = cardLabel(c);
  const rank = label.slice(0, -1);
  const suit = label.slice(-1);
  return `<span class="ec-card ${color} ${joker ? 'joker' : ''} ${match ? 'match' : ''}"><span>${rank}</span><span class="ec-suit">${suit}</span></span>`;
}

function renderHistory() {
  const el = document.getElementById('ab-history')!;
  el.innerHTML = history
    .slice(-12)
    .map(
      (h) =>
        `<span class="ec-hist ${h.winner}">${h.winner === 'bahar' ? 'B' : 'A'}<small>#${h.matchIndex}</small></span>`,
    )
    .join('');
}
renderHistory();

document.getElementById('ab-go')!.addEventListener('click', async () => {
  const stake = Number((document.getElementById('ab-stake') as HTMLInputElement).value);
  const side = sideSelect.value as AndarSide;
  const pulse3 = (document.getElementById('ab-pulse') as HTMLInputElement).checked;
  const cost = pulse3 ? stake * 1.5 : stake;
  if (!(stake > 0) || cost > wallet) {
    document.getElementById('ab-log')!.textContent = 'Insufficient balance.';
    sfx.play('lose');
    return;
  }
  setBal(wallet - cost);
  const btn = document.getElementById('ab-go') as HTMLButtonElement;
  btn.disabled = true;
  const banner = document.getElementById('ab-banner')!;
  banner.hidden = true;

  const serverSeed = randomServerSeed();
  const commit = await commitServerSeed(serverSeed);
  const round = await playAndarRound({
    nonce: nonce++,
    serverSeed,
    clientSeed,
    commit,
    bets: [{ id: 'main', side, stake, pulse3 }],
  });

  const j = document.getElementById('ab-joker')!;
  const a = document.getElementById('ab-andar')!;
  const b = document.getElementById('ab-bahar')!;
  const tension = document.getElementById('ab-tension')!;
  document.getElementById('ab-andar-col')!.classList.remove('winner');
  document.getElementById('ab-bahar-col')!.classList.remove('winner');
  j.innerHTML = paintCard(round.joker, true);
  sfx.play('lock');
  a.innerHTML = '';
  b.innerHTML = '';

  const max = Math.max(round.andar.length, round.bahar.length);
  for (let i = 0; i < max; i++) {
    const progress = (i + 1) / Math.max(max, 1);
    tension.style.width = `${Math.min(100, progress * 100)}%`;
    await new Promise((r) => setTimeout(r, 140 + Math.min(i, 8) * 18));
    if (round.bahar[i]) {
      const isMatch = i === round.bahar.length - 1 && round.winner === 'bahar';
      b.innerHTML += paintCard(round.bahar[i]!, false, isMatch);
      sfx.play(isMatch ? 'win' : 'deal');
    }
    await new Promise((r) => setTimeout(r, 90));
    if (round.andar[i]) {
      const isMatch = i === round.andar.length - 1 && round.winner === 'andar';
      a.innerHTML += paintCard(round.andar[i]!, false, isMatch);
      sfx.play(isMatch ? 'win' : 'deal');
    }
  }
  tension.style.width = '100%';

  document.getElementById(`ab-${round.winner}-col`)?.classList.add('winner');
  flash(document.getElementById(`ab-${round.winner}-col`), 'ec-pulse');
  history.push({ winner: round.winner!, matchIndex: round.matchIndex });
  renderHistory();

  const pay = round.payouts.main ?? 0;
  if (pay > 0) {
    setBal(wallet + pay);
    sfx.play('cash');
  } else {
    sfx.play('lose');
  }
  banner.hidden = false;
  banner.textContent = `${round.winner?.toUpperCase()} wins on card #${round.matchIndex}`;
  banner.className = `ec-match-banner ${round.winner === side ? 'good' : 'bad'}`;
  document.getElementById('ab-log')!.innerHTML =
    `Winner <strong>${round.winner?.toUpperCase()}</strong> @ #${round.matchIndex} · paid <strong>${money(pay)}</strong>`;
  document.getElementById('ab-fair')!.textContent =
    `commit ${commit.slice(0, 22)}… · seed ${serverSeed.slice(0, 18)}…`;
  btn.disabled = false;
});
