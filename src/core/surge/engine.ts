/**
 * SURGE — Aviator / Crash style (popular).
 * Twist: dual-curve "twin surge" with optional trail-bet on peak slope.
 * Crash point from fair float via house-edge transform (not raw 1/r).
 */

import { fairFloat } from '../fair-rng';

export type SurgeBetKind = 'main' | 'trail';

export type SurgeBet = {
  id: string;
  kind: SurgeBetKind;
  stake: number;
  /** Auto cashout multiplier; null = manual */
  autoAt: number | null;
  cashedAt: number | null;
  payout: number;
};

export type SurgeRound = {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  crashAt: number;
  /** Secondary curve crash (always ≥ primary for trail drama) */
  twinCrashAt: number;
  startedAt: number;
  ended: boolean;
  bets: SurgeBet[];
};

/** House edge ~3% classic crash transform. */
export function crashFromFair(u: number, edge = 0.03): number {
  // Avoid 0; clamp tiny
  const r = Math.max(1e-12, Math.min(1 - 1e-12, u));
  if (r < edge) return 1.0;
  const m = (1 - edge) / (1 - r);
  return Math.max(1, Math.floor(m * 100) / 100);
}

export async function resolveSurgeCrash(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<{ crashAt: number; twinCrashAt: number }> {
  const a = await fairFloat(serverSeed, clientSeed, nonce, 0);
  const b = await fairFloat(serverSeed, clientSeed, nonce, 1);
  const crashAt = crashFromFair(a);
  const twinRaw = crashFromFair(b, 0.04);
  const twinCrashAt = Math.max(crashAt, twinRaw);
  return { crashAt, twinCrashAt };
}

export function createSurgeRound(input: {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  crashAt: number;
  twinCrashAt: number;
}): SurgeRound {
  return {
    ...input,
    startedAt: Date.now(),
    ended: false,
    bets: [],
  };
}

export function placeSurgeBet(
  round: SurgeRound,
  bet: Omit<SurgeBet, 'cashedAt' | 'payout'>,
): SurgeRound {
  if (round.ended) return round;
  return {
    ...round,
    bets: [...round.bets, { ...bet, cashedAt: null, payout: 0 }],
  };
}

/** Current multiplier from elapsed ms — exponential ease. */
export function surgeMultiplier(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / 1000;
  // ~e^(0.06t) style growth, starts at 1.00
  return Math.max(1, Math.floor(Math.exp(0.06 * t) * 100) / 100);
}

export function elapsedForMultiplier(mult: number): number {
  if (mult <= 1) return 0;
  return (Math.log(mult) / 0.06) * 1000;
}

export function cashoutSurgeBet(
  round: SurgeRound,
  betId: string,
  atMult: number,
): SurgeRound {
  if (round.ended) return round;
  const bets = round.bets.map((b) => {
    if (b.id !== betId || b.cashedAt != null) return b;
    if (atMult > round.crashAt) return b;
    const payout = Math.floor(b.stake * atMult * 100) / 100;
    return { ...b, cashedAt: atMult, payout };
  });
  return { ...round, bets };
}

export function settleSurgeRound(round: SurgeRound, finalMult: number): SurgeRound {
  const bets = round.bets.map((b) => {
    if (b.cashedAt != null) return b;
    // Auto cashout if set and before crash
    if (b.autoAt != null && b.autoAt <= round.crashAt && b.autoAt <= finalMult) {
      const payout = Math.floor(b.stake * b.autoAt * 100) / 100;
      return { ...b, cashedAt: b.autoAt, payout };
    }
    // Trail bets pay if twin survives past crash by ≥0.5x
    if (b.kind === 'trail') {
      const edge = round.twinCrashAt - round.crashAt;
      if (edge >= 0.5) {
        const payout = Math.floor(b.stake * (1 + edge) * 100) / 100;
        return { ...b, cashedAt: round.crashAt, payout };
      }
    }
    return { ...b, cashedAt: null, payout: 0 };
  });
  return { ...round, ended: true, bets };
}
