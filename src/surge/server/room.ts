/**
 * Host-authoritative Surge room.
 * Crash point is locked on the server before betting closes; clients only see commit until crash.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { SurgeHistoryItem, SurgePublicState } from './protocol';

export type SurgePlayer = {
  id: string;
  name: string;
  balance: number;
  stake: number;
  autoAt: number | null;
  cashedAt: number | null;
  payout: number;
};

export type SurgeRoomHooks = {
  broadcast: (msg: unknown) => void;
  send: (playerId: string, msg: unknown) => void;
};

const BET_MS = 5_000;
const CRASH_PAUSE_MS = 3_000;
const TICK_MS = 50;
const EDGE = 0.03;
const START_BAL = 10_000;

function crashFromU(u: number): number {
  const r = Math.max(0, Math.min(1 - 1e-12, u));
  if (r < EDGE) return 1.0;
  const m = (1 - EDGE) / (1 - r);
  return Math.max(1, Math.min(1_000, Math.floor(m * 100) / 100));
}

function multAt(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / 1000;
  return Math.max(1, Math.floor(Math.exp(0.06 * t) * 100) / 100);
}

function elapsedFor(mult: number): number {
  if (mult <= 1) return 0;
  return (Math.log(mult) / 0.06) * 1000;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export class SurgeRoom {
  private players = new Map<string, SurgePlayer>();
  private roundId = 0;
  private phase: SurgePublicState['phase'] = 'idle';
  private betEndsAt = 0;
  private flyStartedAt = 0;
  private crashAt = 1;
  private serverSeed = '';
  private commit: string | null = null;
  private history: SurgeHistoryItem[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private betPulse: ReturnType<typeof setInterval> | null = null;
  private hooks: SurgeRoomHooks;

  constructor(hooks: SurgeRoomHooks) {
    this.hooks = hooks;
  }

  start() {
    this.beginBetting();
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.betPulse) clearInterval(this.betPulse);
    this.tickTimer = null;
    this.phaseTimer = null;
    this.betPulse = null;
  }

  join(name?: string): SurgePlayer {
    const id = randomBytes(6).toString('hex');
    const p: SurgePlayer = {
      id,
      name: (name?.trim() || `Pilot-${id.slice(0, 4)}`).slice(0, 24),
      balance: START_BAL,
      stake: 0,
      autoAt: null,
      cashedAt: null,
      payout: 0,
    };
    this.players.set(id, p);
    this.broadcastState();
    return p;
  }

  leave(playerId: string) {
    this.players.delete(playerId);
    this.broadcastState();
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }

  publicState(): SurgePublicState {
    const now = Date.now();
    return {
      phase: this.phase,
      roundId: this.roundId,
      betEndsIn:
        this.phase === 'betting' ? Math.max(0, (this.betEndsAt - now) / 1000) : 0,
      multiplier: this.phase === 'flying' ? multAt(now - this.flyStartedAt) : this.phase === 'crashed' ? this.crashAt : 1,
      crashAt: this.phase === 'crashed' ? this.crashAt : null,
      commit: this.commit,
      serverSeed: this.phase === 'crashed' ? this.serverSeed : null,
      history: this.history.slice(0, 16),
      players: [...this.players.values()].filter((p) => p.stake > 0).length,
      online: this.players.size,
    };
  }

  placeBet(playerId: string, stake: number, autoAt: number | null) {
    const p = this.players.get(playerId);
    if (!p) return { ok: false as const, reason: 'Not seated' };
    if (this.phase !== 'betting') return { ok: false as const, reason: 'Betting closed' };
    if (!(stake >= 10) || stake > p.balance) return { ok: false as const, reason: 'Bad stake' };
    if (p.stake > 0) return { ok: false as const, reason: 'Already bet this round' };

    p.balance = Math.round((p.balance - stake) * 100) / 100;
    p.stake = stake;
    p.autoAt = autoAt && autoAt > 1 ? autoAt : null;
    p.cashedAt = null;
    p.payout = 0;

    this.hooks.send(playerId, {
      type: 'bet_ok',
      roundId: this.roundId,
      stake,
      autoAt: p.autoAt,
      balance: p.balance,
    });
    this.broadcastState();
    return { ok: true as const };
  }

  cashout(playerId: string) {
    const p = this.players.get(playerId);
    if (!p) return { ok: false as const, reason: 'Not seated' };
    if (this.phase !== 'flying') return { ok: false as const, reason: 'Not in flight' };
    if (!(p.stake > 0) || p.cashedAt != null) return { ok: false as const, reason: 'No open bet' };

    const m = multAt(Date.now() - this.flyStartedAt);
    if (m >= this.crashAt) return { ok: false as const, reason: 'Already crashed' };

    return this.settleCashout(p, m);
  }

  private settleCashout(p: SurgePlayer, at: number) {
    const payout = Math.floor(p.stake * at * 100) / 100;
    p.cashedAt = at;
    p.payout = payout;
    p.balance = Math.round((p.balance + payout) * 100) / 100;
    this.hooks.send(p.id, {
      type: 'cashout_ok',
      roundId: this.roundId,
      at,
      payout,
      balance: p.balance,
    });
    return { ok: true as const, at, payout };
  }

  private beginBetting() {
    this.roundId += 1;
    this.phase = 'betting';
    this.serverSeed = randomBytes(32).toString('hex');
    this.commit = sha256(`surge:v1:${this.serverSeed}:${this.roundId}`);
    // Lock crash now (hidden). 12 hex chars = 48 bits ∈ [0, 1).
    const u = Number.parseInt(sha256(`${this.serverSeed}:crash`).slice(0, 12), 16) / 0x1_0000_0000_0000;
    this.crashAt = crashFromU(u);
    this.betEndsAt = Date.now() + BET_MS;

    for (const p of this.players.values()) {
      p.stake = 0;
      p.autoAt = null;
      p.cashedAt = null;
      p.payout = 0;
    }

    this.broadcastState();
    if (this.betPulse) clearInterval(this.betPulse);
    this.betPulse = setInterval(() => this.broadcastState(), 250);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => this.beginFlight(), BET_MS);
  }

  private beginFlight() {
    if (this.betPulse) clearInterval(this.betPulse);
    this.betPulse = null;
    this.phase = 'flying';
    this.flyStartedAt = Date.now();
    this.broadcastState();

    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.onTick(), TICK_MS);
  }

  private onTick() {
    if (this.phase !== 'flying') return;
    const elapsed = Date.now() - this.flyStartedAt;
    const m = multAt(elapsed);

    // Auto cashouts
    for (const p of this.players.values()) {
      if (p.stake > 0 && p.cashedAt == null && p.autoAt != null && m >= p.autoAt && p.autoAt < this.crashAt) {
        this.settleCashout(p, p.autoAt);
      }
    }

    this.hooks.broadcast({
      type: 'tick',
      roundId: this.roundId,
      multiplier: Math.min(m, this.crashAt),
      elapsedMs: elapsed,
    });

    if (m >= this.crashAt || elapsed >= elapsedFor(this.crashAt)) {
      this.doCrash();
    }
  }

  private doCrash() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.phase = 'crashed';

    // Uncashed bets lose
    for (const p of this.players.values()) {
      if (p.stake > 0 && p.cashedAt == null) {
        this.hooks.send(p.id, {
          type: 'round_settle',
          roundId: this.roundId,
          won: false,
          payout: 0,
          balance: p.balance,
        });
      } else if (p.cashedAt != null) {
        this.hooks.send(p.id, {
          type: 'round_settle',
          roundId: this.roundId,
          won: true,
          payout: p.payout,
          balance: p.balance,
        });
      }
    }

    this.history.unshift({ crashAt: this.crashAt, at: Date.now() });
    if (this.history.length > 24) this.history.length = 24;

    this.hooks.broadcast({
      type: 'crash',
      roundId: this.roundId,
      crashAt: this.crashAt,
      serverSeed: this.serverSeed,
    });
    this.broadcastState();

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => this.beginBetting(), CRASH_PAUSE_MS);
  }

  private broadcastState() {
    this.hooks.broadcast({ type: 'state', state: this.publicState() });
  }
}
