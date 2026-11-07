/** Shared Surge socket protocol (host ↔ client). */

export type SurgePhase = 'betting' | 'flying' | 'crashed' | 'idle';

export type SurgeHistoryItem = {
  crashAt: number;
  at: number;
};

export type SurgePublicState = {
  phase: SurgePhase;
  roundId: number;
  /** Seconds left in betting window */
  betEndsIn: number;
  multiplier: number;
  crashAt: number | null; // only after crash
  commit: string | null;
  serverSeed: string | null; // revealed after crash
  history: SurgeHistoryItem[];
  players: number;
  online: number;
};

export type SurgeClientMsg =
  | { type: 'hello'; name?: string }
  | { type: 'bet'; stake: number; autoAt?: number | null }
  | { type: 'cashout' }
  | { type: 'ping' };

export type SurgeServerMsg =
  | { type: 'welcome'; playerId: string; balance: number; state: SurgePublicState }
  | { type: 'state'; state: SurgePublicState }
  | { type: 'tick'; roundId: number; multiplier: number; elapsedMs: number }
  | { type: 'crash'; roundId: number; crashAt: number; serverSeed: string }
  | { type: 'bet_ok'; roundId: number; stake: number; autoAt: number | null; balance: number }
  | { type: 'bet_reject'; reason: string }
  | { type: 'cashout_ok'; roundId: number; at: number; payout: number; balance: number }
  | { type: 'cashout_reject'; reason: string }
  | { type: 'balance'; balance: number }
  | { type: 'round_settle'; roundId: number; won: boolean; payout: number; balance: number }
  | { type: 'pong' }
  | { type: 'error'; message: string };
