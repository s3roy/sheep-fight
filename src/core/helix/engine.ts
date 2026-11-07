/**
 * HELIX — original.
 * Dual counter-rotating rails; ball falls through phase-locked gates.
 * Outcome = which sector the ball exits after N gate collisions.
 * Hard to clone: phase coupling + gate mask + depth attenuation.
 */

import { fairFloat, fairInt } from '../fair-rng';

export const HELIX_SECTORS = 12;
export const HELIX_GATES = 7;

export type HelixSector = {
  id: number;
  label: string;
  /** Multiplier if ball exits here */
  mult: number;
};

export type HelixBet = {
  id: string;
  /** Sector ids (can multi-select) */
  sectors: number[];
  stake: number;
};

export type HelixRound = {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  sectors: HelixSector[];
  /** Gate open-mask per level (bitfield) */
  gateMasks: number[];
  /** Phase offsets for left/right rails (radians) */
  phaseL: number;
  phaseR: number;
  path: number[]; // sector visited each gate
  exitSector: number;
  settled: boolean;
  bets: HelixBet[];
  payouts: Record<string, number>;
};

const BASE_MULT = [12, 3, 1.5, 2, 1.2, 4, 1.5, 2.5, 1.2, 5, 1.8, 8];

export function defaultSectors(): HelixSector[] {
  return BASE_MULT.map((mult, id) => ({
    id,
    label: `H${id + 1}`,
    mult,
  }));
}

function wrapSector(n: number): number {
  return ((n % HELIX_SECTORS) + HELIX_SECTORS) % HELIX_SECTORS;
}

/**
 * Simulate drop: at each gate, ball must pass an open slot.
 * Closed → deflect ±1 by phase delta sign.
 */
export async function simulateHelix(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<{
  gateMasks: number[];
  phaseL: number;
  phaseR: number;
  path: number[];
  exitSector: number;
}> {
  const phaseL = (await fairFloat(serverSeed, clientSeed, nonce, 2)) * Math.PI * 2;
  const phaseR = (await fairFloat(serverSeed, clientSeed, nonce, 3)) * Math.PI * 2;
  const gateMasks: number[] = [];
  for (let g = 0; g < HELIX_GATES; g++) {
    // Prefer ~5–8 open sectors of 12
    let mask = 0;
    const openCount = 5 + (await fairInt(serverSeed, clientSeed, nonce, 4, 10 + g));
    for (let k = 0; k < openCount; k++) {
      const bit = await fairInt(serverSeed, clientSeed, nonce, HELIX_SECTORS, 20 + g * 16 + k);
      mask |= 1 << bit;
    }
    if (mask === 0) mask = 0b010101010101;
    gateMasks.push(mask);
  }

  let sector = await fairInt(serverSeed, clientSeed, nonce, HELIX_SECTORS, 4);
  const path: number[] = [sector];
  for (let g = 0; g < HELIX_GATES; g++) {
    const mask = gateMasks[g]!;
    const coupling = Math.sin(phaseL + g * 0.73) - Math.cos(phaseR - g * 0.61);
    if ((mask & (1 << sector)) === 0) {
      // Deflect toward stronger rail
      const dir = coupling >= 0 ? 1 : -1;
      const jump = 1 + (await fairInt(serverSeed, clientSeed, nonce, 2, 50 + g));
      sector = wrapSector(sector + dir * jump);
      // If still closed, spiral search
      for (let t = 0; t < HELIX_SECTORS && (mask & (1 << sector)) === 0; t++) {
        sector = wrapSector(sector + dir);
      }
    } else {
      // Soft drift from phase
      const drift = coupling > 0.35 ? 1 : coupling < -0.35 ? -1 : 0;
      sector = wrapSector(sector + drift);
      if ((mask & (1 << sector)) === 0) sector = wrapSector(sector - drift);
    }
    path.push(sector);
  }

  return { gateMasks, phaseL, phaseR, path, exitSector: sector };
}

export async function playHelixRound(input: {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  bets: HelixBet[];
  sectors?: HelixSector[];
}): Promise<HelixRound> {
  const sectors = input.sectors ?? defaultSectors();
  const sim = await simulateHelix(input.serverSeed, input.clientSeed, input.nonce);
  const exit = sectors[sim.exitSector]!;
  const payouts: Record<string, number> = {};
  for (const bet of input.bets) {
    if (!bet.sectors.includes(sim.exitSector)) {
      payouts[bet.id] = 0;
      continue;
    }
    // Split stake across selected sectors (anti-coverage abuse)
    const share = bet.stake / Math.max(1, bet.sectors.length);
    payouts[bet.id] = Math.floor(share * exit.mult * 100) / 100;
  }
  return {
    nonce: input.nonce,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    commit: input.commit,
    sectors,
    ...sim,
    settled: true,
    bets: input.bets,
    payouts,
  };
}
