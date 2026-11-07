/**
 * Sheep Fight — even-money clash.
 * Two rams charge; fair float picks winner with a small house edge on payout.
 */
import { fairFloat, fairInt } from '../fair-rng';

export type SheepId = 'dolly' | 'ramsey';

export type SheepFightRound = {
  winner: SheepId;
  /** 0..1 clash intensity (visual only) */
  intensity: number;
  /** frames of stare-down before charge */
  stareFrames: number;
  payoutMult: number;
  fair: { commit: string; serverSeed: string; clientSeed: string; nonce: number };
};

export const SHEEP_META: Record<
  SheepId,
  { name: string; color: string; accent: string; emoji: string }
> = {
  dolly: { name: 'Dolly', color: '#f5f0e6', accent: '#7eb8ff', emoji: '🐑' },
  ramsey: { name: 'Ramsey', color: '#3d3548', accent: '#ff8f6b', emoji: '🐏' },
};

/** Even money with ~3.5% edge → ~1.93x */
export const SHEEP_PAYOUT = 1.93;

export async function resolveSheepFight(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  commit: string,
): Promise<SheepFightRound> {
  const u = await fairFloat(serverSeed, clientSeed, nonce, 0);
  const intensity = await fairFloat(serverSeed, clientSeed, nonce, 1);
  const stare = await fairInt(serverSeed, clientSeed, nonce, 40, 2);
  const winner: SheepId = u < 0.5 ? 'dolly' : 'ramsey';
  return {
    winner,
    intensity: 0.35 + intensity * 0.65,
    stareFrames: 18 + stare,
    payoutMult: SHEEP_PAYOUT,
    fair: { commit, serverSeed, clientSeed, nonce },
  };
}

export function settleSheepBet(
  pick: SheepId,
  round: SheepFightRound,
  stake: number,
): { won: boolean; payout: number } {
  const won = pick === round.winner;
  const payout = won ? Math.floor(stake * round.payoutMult * 100) / 100 : 0;
  return { won, payout };
}
