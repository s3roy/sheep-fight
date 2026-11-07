/**
 * CIPHER — original.
 * Three coupled dials (moduli 11, 13, 17). Player picks a target residue class
 * per dial. Reveal is sequential with dependency: dial2 = f(dial1), dial3 = f(1,2).
 * Number-theory coupling makes naive ports wrong.
 */

import { fairInt } from '../fair-rng';

export const CIPHER_MODS = [11, 13, 17] as const;

export type CipherPick = {
  /** Residue 0..mod-1 for each dial */
  residues: [number, number, number];
};

export type CipherBet = {
  id: string;
  stake: number;
  pick: CipherPick;
  /** Optional: bet that all three match (long shot) */
  trifecta?: boolean;
};

export type CipherRound = {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  /** Raw secret digits before coupling */
  raw: [number, number, number];
  /** Final revealed residues */
  revealed: [number, number, number];
  matches: [boolean, boolean, boolean];
  settled: boolean;
  bets: CipherBet[];
  payouts: Record<string, number>;
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Coupling map — intentional complexity:
 * d0 = raw0
 * d1 = (raw1 + 3*raw0 + floor(raw0/2)) mod 13
 * d2 = (raw2 + 5*d1 - 2*d0 + raw0*raw1) mod 17
 */
export function coupleDigits(raw: [number, number, number]): [number, number, number] {
  const d0 = mod(raw[0], CIPHER_MODS[0]);
  const d1 = mod(raw[1] + 3 * d0 + Math.floor(d0 / 2), CIPHER_MODS[1]);
  const d2 = mod(raw[2] + 5 * d1 - 2 * d0 + d0 * raw[1], CIPHER_MODS[2]);
  return [d0, d1, d2];
}

export async function rollCipherRaw(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<[number, number, number]> {
  const a = await fairInt(serverSeed, clientSeed, nonce, CIPHER_MODS[0], 1);
  const b = await fairInt(serverSeed, clientSeed, nonce, CIPHER_MODS[1], 2);
  const c = await fairInt(serverSeed, clientSeed, nonce, CIPHER_MODS[2], 3);
  return [a, b, c];
}

/** Per-dial hit pays; 2-hit bonus; 3-hit jackpot. */
export function cipherPayout(
  stake: number,
  matches: [boolean, boolean, boolean],
  trifecta: boolean,
): number {
  const hits = matches.filter(Boolean).length;
  if (hits === 0) return 0;
  const dialPay = [2.2, 2.6, 3.1];
  let pay = 0;
  for (let i = 0; i < 3; i++) {
    if (matches[i]) pay += (stake / 3) * dialPay[i]!;
  }
  if (hits === 2) pay *= 1.35;
  if (hits === 3) pay = stake * (trifecta ? 48 : 18);
  return Math.floor(pay * 100) / 100;
}

export async function playCipherRound(input: {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  bets: CipherBet[];
}): Promise<CipherRound> {
  const raw = await rollCipherRaw(input.serverSeed, input.clientSeed, input.nonce);
  const revealed = coupleDigits(raw);
  const payouts: Record<string, number> = {};
  let matches: [boolean, boolean, boolean] = [false, false, false];

  for (const bet of input.bets) {
    const m: [boolean, boolean, boolean] = [
      bet.pick.residues[0] === revealed[0],
      bet.pick.residues[1] === revealed[1],
      bet.pick.residues[2] === revealed[2],
    ];
    matches = m;
    payouts[bet.id] = cipherPayout(bet.stake, m, Boolean(bet.trifecta));
  }

  return {
    nonce: input.nonce,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    commit: input.commit,
    raw,
    revealed,
    matches,
    settled: true,
    bets: input.bets,
    payouts,
  };
}
