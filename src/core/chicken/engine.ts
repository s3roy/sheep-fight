/**
 * CHICKEN ROAD — lane-step cashout.
 * Crash lane locked from fair float before Play; reveal on settle.
 */
import { fairFloat, commitServerSeed } from '../fair-rng';

export type ChickenDifficulty = 'easy' | 'medium' | 'hard' | 'hardcore';

export const CHICKEN_DIFFICULTIES: Record<
  ChickenDifficulty,
  { label: string; lines: number; fryRisk: number }
> = {
  easy: { label: 'Easy', lines: 24, fryRisk: 0.03 },
  medium: { label: 'Medium', lines: 22, fryRisk: 0.09 },
  hard: { label: 'Hard', lines: 20, fryRisk: 0.18 },
  hardcore: { label: 'Hardcore', lines: 15, fryRisk: 0.31 },
};

/** Difficulty multiplier ladders. Hardcore = highest risk / reward. */
const LADDERS: Record<ChickenDifficulty, number[]> = {
  easy: [
    1.03, 1.07, 1.12, 1.17, 1.23, 1.29, 1.36, 1.44, 1.53, 1.63, 1.75, 1.88, 2.04, 2.22, 2.45, 2.72, 3.06, 3.5,
    4.08, 4.9, 6.13, 6.61, 9.81, 19.44,
  ],
  medium: [
    1.12, 1.28, 1.47, 1.7, 1.98, 2.33, 2.76, 3.32, 4.03, 4.96, 6.2, 6.91, 8.9, 11.74, 15.99, 22.61, 33.58,
    53.2, 92.17, 182.51, 451.71, 1788.8,
  ],
  hard: [
    1.23, 1.55, 1.98, 2.56, 3.36, 4.49, 5.49, 7.53, 10.56, 15.21, 22.59, 34.79, 55.97, 94.99, 172.42, 341.4,
    760.46, 2007.63, 6956.47, 41321.43,
  ],
  hardcore: [
    1.63, 2.8, 4.95, 9.08, 15.21, 30.12, 62.96, 140.24, 337.19, 890.19, 2643.89, 9161.08, 39301.05, 233448.29,
    2542251.93,
  ],
};

export function chickenLadder(diff: ChickenDifficulty): number[] {
  return [...LADDERS[diff]];
}

export const CHICKEN_MIN_BET = 0.01;
export const CHICKEN_MAX_BET = 150;
export const CHICKEN_MAX_WIN = 10_000;
export const CHICKEN_QUICK_BETS = [2, 3, 8, 20] as const;

export type ChickenRound = {
  difficulty: ChickenDifficulty;
  ladder: number[];
  crashLane: number;
  serverSeed: string;
  serverCommit: string;
  clientSeed: string;
  nonce: number;
};

export async function resolveChickenCrash(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  difficulty: ChickenDifficulty,
): Promise<ChickenRound> {
  const ladder = chickenLadder(difficulty);
  const n = ladder.length;
  const p = CHICKEN_DIFFICULTIES[difficulty].fryRisk;
  const u = await fairFloat(serverSeed, clientSeed, nonce, 0);

  let crashLane = n + 1;
  let cum = 0;
  for (let k = 1; k <= n; k++) {
    cum += Math.pow(1 - p, k - 1) * p;
    if (u < cum) {
      crashLane = k;
      break;
    }
  }

  const serverCommit = await commitServerSeed(serverSeed);
  return { difficulty, ladder, crashLane, serverSeed, serverCommit, clientSeed, nonce };
}

export function chickenPendingWin(stake: number, mult: number): number {
  return Math.min(Math.round(stake * mult * 100) / 100, CHICKEN_MAX_WIN);
}
