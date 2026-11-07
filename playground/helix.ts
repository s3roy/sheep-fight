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
  playHelixRound,
  defaultSectors,
  HELIX_SECTORS,
} from '../src/index';

let wallet = loadWallet();
const clientSeed = randomClientSeed();
let nonce = 1;
const selected = new Set<number>([0, 3]);
const sectors = defaultSectors();

const app = document.getElementById('app')!;
mountShell(
  app,
  {
    id: 'HELIX',
    name: 'Helix',
    tagline: 'Charge the drop, watch the ball ricochet through phase gates.',
    accent: 'var(--ec-violet)',
  },
  wallet,
);

const stage = document.getElementById('stage')!;
stage.innerHTML = stageFrame(
  'Drop chamber',
  'Pick up to 3 sectors. Hold Charge, release in the green zone for a soft bias — then the fair drop runs.',
  `
  <div class="ec-canvas" id="hx-canvas">
    <svg class="ec-helix" id="hx-svg" viewBox="0 0 640 340"></svg>
    <div class="ec-charge" id="hx-charge-wrap" hidden>
      <div class="ec-charge-track"><div class="ec-charge-needle" id="hx-needle"></div><div class="ec-charge-sweet"></div></div>
      <p>Release in the bright band</p>
    </div>
  </div>
  <div class="ec-side">
    <div class="ec-field"><label>Stake</label><input id="hx-stake" type="number" value="100" min="1" /></div>
    <div class="ec-field"><label>Sectors (max 3)</label><div class="ec-sector-grid" id="hx-chips"></div></div>
    <div class="ec-actions">
      <button class="ec-btn ec-btn-ghost" id="hx-charge">Hold to charge</button>
      <button class="ec-btn ec-btn-primary" id="hx-go" disabled>Drop</button>
    </div>
    <div class="ec-log" id="hx-log">Select sectors → charge → drop.</div>
    <div class="ec-fair" id="hx-fair"></div>
  </div>`,
);

function setBal(n: number) {
  wallet = Math.max(0, Math.round(n * 100) / 100);
  saveWallet(wallet);
  setWalletDisplay(wallet);
}

const chips = document.getElementById('hx-chips')!;
const syncChips = () => {
  chips.querySelectorAll('.ec-chip').forEach((b) => {
    const id = Number((b as HTMLElement).dataset.id);
    b.classList.toggle('on', selected.has(id));
  });
};
chips.innerHTML = sectors
  .map(
    (s) =>
      `<button type="button" class="ec-chip ${selected.has(s.id) ? 'on' : ''}" data-id="${s.id}">${s.label}<small>${s.mult}×</small></button>`,
  )
  .join('');
chips.querySelectorAll('.ec-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.play('click');
    const id = Number((btn as HTMLElement).dataset.id);
    if (selected.has(id)) selected.delete(id);
    else {
      if (selected.size >= 3) selected.delete([...selected][0]!);
      selected.add(id);
    }
    if (!selected.size) selected.add(0);
    syncChips();
    paintHelix([0], -1, null);
  });
});

function paintHelix(path: number[], exit: number, ball: { x: number; y: number } | null) {
  const svg = document.getElementById('hx-svg')!;
  const cx = 320;
  const cy = 170;
  let rings = '';
  for (let r = 0; r < 7; r++) {
    const rad = 34 + r * 18;
    rings += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="rgba(155,123,255,${0.12 + r * 0.05})" stroke-width="2"/>`;
  }
  for (let s = 0; s < HELIX_SECTORS; s++) {
    const ang = (s / HELIX_SECTORS) * Math.PI * 2 - Math.PI / 2;
    const x2 = cx + Math.cos(ang) * 160;
    const y2 = cy + Math.sin(ang) * 160;
    const hit = s === exit;
    const picked = selected.has(s);
    rings += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${hit ? '#3defb0' : picked ? 'rgba(155,123,255,0.7)' : 'rgba(148,163,184,0.16)'}" stroke-width="${hit || picked ? 2.5 : 1}"/>`;
    const lx = cx + Math.cos(ang) * 176;
    const ly = cy + Math.sin(ang) * 176;
    rings += `<text x="${lx}" y="${ly}" fill="${hit ? '#3defb0' : picked ? '#c4b5fd' : '#64748b'}" font-size="11" font-family="Syne,sans-serif" text-anchor="middle" dominant-baseline="middle">H${s + 1}</text>`;
  }
  path.forEach((sec, i) => {
    if (i === path.length - 1 && ball) return;
    const ang = (sec / HELIX_SECTORS) * Math.PI * 2 - Math.PI / 2;
    const rad = 34 + Math.min(i, 6) * 18;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    rings += `<circle cx="${x}" cy="${y}" r="4" fill="#9b7bff" opacity="0.7"/>`;
  });
  if (ball) {
    rings += `<circle cx="${ball.x}" cy="${ball.y}" r="9" fill="#f0c14b" stroke="#fff" stroke-width="2"/>
      <circle cx="${ball.x}" cy="${ball.y}" r="16" fill="none" stroke="rgba(240,193,75,0.35)" stroke-width="2"/>`;
  }
  svg.innerHTML = rings;
}
paintHelix([0], -1, null);

let charge = 0;
let charging = false;
let chargeRaf = 0;
let chargeQuality = 0; // 0..1 how close to sweet spot on release
const needle = document.getElementById('hx-needle')!;
const chargeWrap = document.getElementById('hx-charge-wrap')!;
const dropBtn = document.getElementById('hx-go') as HTMLButtonElement;
const chargeBtn = document.getElementById('hx-charge') as HTMLButtonElement;

function chargeLoop() {
  if (!charging) return;
  charge = (charge + 0.018) % 1;
  needle.style.left = `${charge * 100}%`;
  if (Math.random() < 0.08) sfx.play('tick', Math.floor(charge * 10));
  chargeRaf = requestAnimationFrame(chargeLoop);
}

chargeBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.play('click');
  charging = true;
  chargeWrap.hidden = false;
  dropBtn.disabled = true;
  chargeLoop();
});
const endCharge = () => {
  if (!charging) return;
  charging = false;
  cancelAnimationFrame(chargeRaf);
  // sweet band ~0.42–0.62
  const dist = Math.min(Math.abs(charge - 0.52), Math.abs(charge - 0.52 - 1));
  chargeQuality = Math.max(0, 1 - dist / 0.28);
  dropBtn.disabled = false;
  document.getElementById('hx-log')!.innerHTML =
    chargeQuality > 0.7
      ? `Clean charge <strong>${Math.round(chargeQuality * 100)}%</strong> — drop when ready`
      : `Charge <strong>${Math.round(chargeQuality * 100)}%</strong> — still droppable`;
  sfx.play(chargeQuality > 0.7 ? 'lock' : 'near');
};
chargeBtn.addEventListener('pointerup', endCharge);
chargeBtn.addEventListener('pointerleave', endCharge);

document.getElementById('hx-go')!.addEventListener('click', async () => {
  const stake = Number((document.getElementById('hx-stake') as HTMLInputElement).value);
  if (!(stake > 0) || stake > wallet || !selected.size) return;
  dropBtn.disabled = true;
  chargeBtn.disabled = true;
  setBal(wallet - stake);
  sfx.play('drop');
  chargeWrap.hidden = true;

  const serverSeed = randomServerSeed();
  const commit = await commitServerSeed(serverSeed);
  const round = await playHelixRound({
    nonce: nonce++,
    serverSeed,
    clientSeed,
    commit,
    bets: [{ id: 'h', stake, sectors: [...selected] }],
  });

  // Optional: if charge was strong and exit was adjacent to a pick, treat as near-miss juice only (payout stays fair)
  const cx = 320;
  const cy = 170;
  for (let i = 0; i < round.path.length; i++) {
    const sec = round.path[i]!;
    const ang = (sec / HELIX_SECTORS) * Math.PI * 2 - Math.PI / 2;
    const rad = 34 + Math.min(i, 6) * 18;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    paintHelix(round.path.slice(0, i + 1), -1, { x, y });
    sfx.play('gate', i);
    await new Promise((r) => setTimeout(r, 110 + (1 - chargeQuality) * 40));
  }
  paintHelix(round.path, round.exitSector, null);

  const pay = round.payouts.h ?? 0;
  const near =
    pay === 0 &&
    [...selected].some((s) => Math.min(Math.abs(s - round.exitSector), HELIX_SECTORS - Math.abs(s - round.exitSector)) === 1);

  if (pay > 0) {
    setBal(wallet + pay);
    sfx.play('win');
  } else if (near) {
    sfx.play('near');
    shake(document.getElementById('hx-canvas'));
  } else {
    sfx.play('lose');
  }

  document.getElementById('hx-log')!.innerHTML = near
    ? `Near miss on <strong>H${round.exitSector + 1}</strong> · paid <strong>${money(pay)}</strong>`
    : `Exit <strong>H${round.exitSector + 1}</strong> · paid <strong>${money(pay)}</strong>`;
  document.getElementById('hx-fair')!.textContent = `commit ${commit.slice(0, 22)}… · charge ${Math.round(chargeQuality * 100)}%`;
  dropBtn.disabled = false;
  chargeBtn.disabled = false;
});
