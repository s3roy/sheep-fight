/**
 * ANDAR BAHAR — popular Indian card game.
 * Twist: "Joker pulse" side lanes + shoe entropy lanes for fair shuffle.
 */

import { fairInt } from '../fair-rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export type Card = { rank: Rank; suit: Suit; id: string };

export type AndarSide = 'andar' | 'bahar';

export type AndarBet = {
  id: string;
  side: AndarSide;
  stake: number;
  /** Optional side: win if match within first 3 cards */
  pulse3?: boolean;
};

export type AndarRound = {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  joker: Card;
  andar: Card[];
  bahar: Card[];
  winner: AndarSide | null;
  matchIndex: number; // 1-based position of matching card
  settled: boolean;
  bets: AndarBet[];
  payouts: Record<string, number>;
};

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function buildDeck(): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      out.push({ rank, suit, id: `${rank}${suit}` });
    }
  }
  return out;
}

/** Fisher–Yates driven by fair ints (lane-indexed). */
export async function fairShuffle(
  deck: Card[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<Card[]> {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = await fairInt(serverSeed, clientSeed, nonce, i + 1, 100 + i);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function sameRank(a: Card, b: Card): boolean {
  return a.rank === b.rank;
}

/**
 * Deal: joker = top. Then alternate Bahar, Andar (classic IN tables:
 * first card after joker goes to Bahar).
 */
export function dealAndarBahar(shuffled: Card[]): {
  joker: Card;
  andar: Card[];
  bahar: Card[];
  winner: AndarSide;
  matchIndex: number;
} {
  const shoe = [...shuffled];
  const joker = shoe.shift()!;
  const andar: Card[] = [];
  const bahar: Card[] = [];
  let matchIndex = 0;
  let winner: AndarSide = 'bahar';
  let i = 0;
  while (shoe.length) {
    i += 1;
    const card = shoe.shift()!;
    // Odd positions → Bahar, even → Andar (first card Bahar)
    if (i % 2 === 1) {
      bahar.push(card);
      if (sameRank(card, joker)) {
        winner = 'bahar';
        matchIndex = i;
        break;
      }
    } else {
      andar.push(card);
      if (sameRank(card, joker)) {
        winner = 'andar';
        matchIndex = i;
        break;
      }
    }
  }
  return { joker, andar, bahar, winner, matchIndex };
}

/** Main side payout table by match depth (house edge baked in). */
export function andarMainOdds(matchIndex: number, side: AndarSide, winner: AndarSide): number {
  if (side !== winner) return 0;
  // Classic-ish: Bahar first-card often 1:1 with slight edge; deeper pays more
  if (matchIndex === 1 && winner === 'bahar') return 0.9; // 1:0.9
  if (matchIndex <= 3) return 1.0;
  if (matchIndex <= 10) return 1.0;
  if (matchIndex <= 20) return 1.15;
  return 1.3;
}

export function pulse3Odds(matchIndex: number, side: AndarSide, winner: AndarSide): number {
  if (side !== winner) return 0;
  if (matchIndex <= 3) return 3.5;
  return 0;
}

export async function playAndarRound(input: {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  bets: AndarBet[];
}): Promise<AndarRound> {
  const shuffled = await fairShuffle(buildDeck(), input.serverSeed, input.clientSeed, input.nonce);
  const dealt = dealAndarBahar(shuffled);
  const payouts: Record<string, number> = {};
  for (const bet of input.bets) {
    let pay = 0;
    const main = andarMainOdds(dealt.matchIndex, bet.side, dealt.winner);
    pay += bet.stake * main;
    if (bet.pulse3) {
      pay += bet.stake * 0.5 * pulse3Odds(dealt.matchIndex, bet.side, dealt.winner);
    }
    payouts[bet.id] = Math.floor(pay * 100) / 100;
  }
  return {
    nonce: input.nonce,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    commit: input.commit,
    joker: dealt.joker,
    andar: dealt.andar,
    bahar: dealt.bahar,
    winner: dealt.winner,
    matchIndex: dealt.matchIndex,
    settled: true,
    bets: input.bets,
    payouts,
  };
}

export function cardLabel(c: Card): string {
  const suit = { S: '♠', H: '♥', D: '♦', C: '♣' }[c.suit];
  return `${c.rank}${suit}`;
}

export function cardColor(c: Card): 'red' | 'black' {
  return c.suit === 'H' || c.suit === 'D' ? 'red' : 'black';
}
