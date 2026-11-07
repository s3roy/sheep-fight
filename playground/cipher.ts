import {
  loadWallet,
  saveWallet,
  money,
  mountShell,
  setWalletDisplay,
  stageFrame,
  sfx,
} from './shared';
import {
  randomClientSeed,
  randomServerSeed,
  commitServerSeed,
  playCipherRound,
  CIPHER_MODS,
  cipherPayout,
} from '../src/index';

let wallet = loadWallet();
const clientSeed = randomClientSeed();
let nonce = 1;

const app = document.getElementById('app')!;
mountShell(
  app,
  {
    id: 'CIPHER',
    name: 'Cipher',
    tagline: 'Dials unlock one by one. Raise after a hit — or walk with what you’ve got.',
    accent: 'var(--ec-rose)',
  },
  wallet,
);

const stage = document.getElementById('stage')!;
stage.innerHTML = stageFrame(
  'Vault',
  'Staged reveal: after dial A or B hits, you can raise (add stake) before the next dial.',
  `
  <div class="ec-canvas">
    <div class="ec-dials" id="cf-dials">
      <div class="ec-dial-wrap"><label>Dial A · mod ${CIPHER_MODS[0]}</label><div class="ec-dial" data-i="0"><span class="ec-dial-val">?</span></div></div>
      <div class="ec-dial-wrap"><label>Dial B · mod ${CIPHER_MODS[1]}</label><div class="ec-dial" data-i="1"><span class="ec-dial-val">?</span></div></div>
      <div class="ec-dial-wrap"><label>Dial C · mod ${CIPHER_MODS[2]}</label><div class="ec-dial" data-i="2"><span class="ec-dial-val">?</span></div></div>
    </div>
    <div class="ec-stage-actions" id="cf-stage-actions" hidden>
      <button class="ec-btn ec-btn-danger" id="cf-walk">Walk (take partial)</button>
      <button class="ec-btn ec-btn-primary" id="cf-raise">Raise +50%</button>
    </div>
  </div>
  <div class="ec-side">
    <div class="ec-field"><label>Stake</label><input id="cf-stake" type="number" value="100" min="1" /></div>
    <div class="ec-row">
      <div class="ec-field"><label>A (0–${CIPHER_MODS[0] - 1})</label><input id="cf-a" type="number" value="3" min="0" max="${CIPHER_MODS[0] - 1}" /></div>
      <div class="ec-field"><label>B (0–${CIPHER_MODS[1] - 1})</label><input id="cf-b" type="number" value="5" min="0" max="${CIPHER_MODS[1] - 1}" /></div>
    </div>
    <div class="ec-field"><label>C (0–${CIPHER_MODS[2] - 1})</label><input id="cf-c" type="number" value="7" min="0" max="${CIPHER_MODS[2] - 1}" /></div>
    <label class="ec-check"><input type="checkbox" id="cf-tri" /> Trifecta jackpot mode</label>
    <div class="ec-actions single"><button class="ec-btn ec-btn-primary" id="cf-go">Spin vault</button></div>
    <div class="ec-log" id="cf-log">Set residues. After each hit you can raise or walk.</div>
    <div class="ec-fair" id="cf-fair"></div>
  </div>`,
);

function setBal(n: number) {
  wallet = Math.max(0, Math.round(n * 100) / 100);
  saveWallet(wallet);
  setWalletDisplay(wallet);
}

function waitChoice(): Promise<'walk' | 'raise'> {
  const box = document.getElementById('cf-stage-actions')!;
  box.hidden = false;
  return new Promise((resolve) => {
    const walk = document.getElementById('cf-walk')!;
    const raise = document.getElementById('cf-raise')!;
    const done = (v: 'walk' | 'raise') => {
      box.hidden = true;
      walk.removeEventListener('click', onWalk);
      raise.removeEventListener('click', onRaise);
      resolve(v);
    };
    const onWalk = () => {
      sfx.play('click');
      done('walk');
    };
    const onRaise = () => {
      sfx.play('click');
      done('raise');
    };
    walk.addEventListener('click', onWalk);
    raise.addEventListener('click', onRaise);
  });
}

async function spinDial(el: Element, value: number, hit: boolean) {
  el.classList.remove('hit', 'miss');
  el.classList.add('spinning');
  for (let k = 0; k < 10; k++) {
    el.querySelector('.ec-dial-val')!.textContent = String(Math.floor(Math.random() * 17));
    sfx.play('spin', k);
    await new Promise((r) => setTimeout(r, 45));
  }
  el.classList.remove('spinning');
  el.querySelector('.ec-dial-val')!.textContent = String(value);
  el.classList.add(hit ? 'hit' : 'miss');
  sfx.play(hit ? 'lock' : 'near');
}

document.getElementById('cf-go')!.addEventListener('click', async () => {
  let stake = Number((document.getElementById('cf-stake') as HTMLInputElement).value);
  const a = Number((document.getElementById('cf-a') as HTMLInputElement).value);
  const b = Number((document.getElementById('cf-b') as HTMLInputElement).value);
  const c = Number((document.getElementById('cf-c') as HTMLInputElement).value);
  const trifecta = (document.getElementById('cf-tri') as HTMLInputElement).checked;
  if (!(stake > 0) || stake > wallet) {
    sfx.play('lose');
    return;
  }
  const btn = document.getElementById('cf-go') as HTMLButtonElement;
  btn.disabled = true;
  setBal(wallet - stake);
  sfx.play('drop');

  const serverSeed = randomServerSeed();
  const commit = await commitServerSeed(serverSeed);
  const round = await playCipherRound({
    nonce: nonce++,
    serverSeed,
    clientSeed,
    commit,
    bets: [{ id: 'c', stake, trifecta, pick: { residues: [a, b, c] } }],
  });

  const dials = [...document.querySelectorAll('.ec-dial')];
  dials.forEach((d) => {
    d.classList.remove('hit', 'miss');
    d.querySelector('.ec-dial-val')!.textContent = '?';
  });

  let walked = false;
  let raisedMult = 1;

  for (let i = 0; i < 3; i++) {
    await spinDial(dials[i]!, round.revealed[i]!, round.matches[i]!);

    // After A or B, if hit, offer raise/walk
    if (i < 2 && round.matches[i] && !walked) {
      document.getElementById('cf-log')!.innerHTML =
        `Dial ${i + 1} hit — <strong>walk</strong> with partial credit or <strong>raise</strong> into the next dial`;
      const choice = await waitChoice();
      if (choice === 'walk') {
        walked = true;
        // Partial: pay only revealed hits so far at current stake
        const partialMatches: [boolean, boolean, boolean] = [
          round.matches[0]!,
          i >= 1 ? round.matches[1]! : false,
          false,
        ];
        const pay = cipherPayout(stake * raisedMult, partialMatches, false) * 0.85;
        const out = Math.floor(pay * 100) / 100;
        if (out > 0) {
          setBal(wallet + out);
          sfx.play('cash');
        }
        document.getElementById('cf-log')!.innerHTML =
          `Walked after dial ${i + 1} · paid <strong>${money(out)}</strong>`;
        document.getElementById('cf-fair')!.textContent = `commit ${commit.slice(0, 22)}…`;
        btn.disabled = false;
        return;
      }
      const add = Math.floor(stake * 0.5);
      if (add > 0 && add <= wallet) {
        setBal(wallet - add);
        raisedMult += 0.5;
        stake = Math.floor(stake * raisedMult);
        sfx.play('boost');
        document.getElementById('cf-log')!.textContent = `Raised — stake now effective ×${raisedMult.toFixed(1)}`;
      } else {
        document.getElementById('cf-log')!.textContent = 'Raise skipped (balance) — continuing';
      }
    }
  }

  const matches = round.matches;
  const pay = Math.floor(cipherPayout(Number((document.getElementById('cf-stake') as HTMLInputElement).value) * raisedMult, matches, trifecta) * 100) / 100;
  if (pay > 0) {
    setBal(wallet + pay);
    sfx.play('win');
  } else {
    sfx.play('lose');
  }
  const hits = matches.filter(Boolean).length;
  document.getElementById('cf-log')!.innerHTML =
    `${hits}/3 hits · paid <strong>${money(pay)}</strong>${raisedMult > 1 ? ` · raised ×${raisedMult}` : ''}`;
  document.getElementById('cf-fair')!.textContent =
    `commit ${commit.slice(0, 22)}… · [${round.revealed.join(', ')}]`;
  btn.disabled = false;
});
