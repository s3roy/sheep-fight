/**
 * LATTICE — original.
 * Hex grid run: pick a start edge, path unfolds via neighbor weights.
 * Collapse nodes wipe the run; relic nodes boost. Graph + bankroll FSM.
 */

import { fairFloat, fairInt } from '../fair-rng';

export type LatticeNodeKind = 'path' | 'boost' | 'collapse' | 'exit';

export type LatticeNode = {
  id: number;
  q: number;
  r: number;
  kind: LatticeNodeKind;
  mult: number;
};

export type LatticeBet = {
  id: string;
  stake: number;
  /** Start column 0..cols-1 */
  startCol: number;
  /** Aggression 1–3 (riskier neighbor picks) */
  heat: 1 | 2 | 3;
};

export type LatticeRound = {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  nodes: LatticeNode[];
  cols: number;
  rows: number;
  path: number[];
  product: number;
  collapsed: boolean;
  settled: boolean;
  bets: LatticeBet[];
  payouts: Record<string, number>;
};

const HEX_DIRS: Array<[number, number]> = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];

export function axialKey(q: number, r: number): string {
  return `${q},${r}`;
}

export async function buildLattice(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cols = 7,
  rows = 8,
): Promise<LatticeNode[]> {
  const nodes: LatticeNode[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const u = await fairFloat(serverSeed, clientSeed, nonce, 200 + id);
      let kind: LatticeNodeKind = 'path';
      let mult = 1.05 + u * 0.25;
      if (r === rows - 1) {
        kind = 'exit';
        mult = 1.4 + u * 1.6;
      } else if (u < 0.08) {
        kind = 'collapse';
        mult = 0;
      } else if (u > 0.82) {
        kind = 'boost';
        mult = 1.35 + u * 0.9;
      }
      nodes.push({ id, q, r, kind, mult: Math.floor(mult * 100) / 100 });
      id += 1;
    }
  }
  return nodes;
}

function neighbors(
  node: LatticeNode,
  byKey: Map<string, LatticeNode>,
): LatticeNode[] {
  const out: LatticeNode[] = [];
  for (const [dq, dr] of HEX_DIRS) {
    const n = byKey.get(axialKey(node.q + dq, node.r + dr));
    if (n) out.push(n);
  }
  return out;
}

export async function runLatticePath(
  nodes: LatticeNode[],
  startCol: number,
  heat: 1 | 2 | 3,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<{ path: number[]; product: number; collapsed: boolean }> {
  const byKey = new Map(nodes.map((n) => [axialKey(n.q, n.r), n]));
  const cols = Math.max(...nodes.map((n) => n.q)) + 1;
  const start = nodes.find((n) => n.r === 0 && n.q === Math.min(startCol, cols - 1));
  if (!start) return { path: [], product: 0, collapsed: true };

  const path: number[] = [start.id];
  let product = start.mult;
  let cur = start;
  let step = 0;

  while (cur.kind !== 'exit' && cur.kind !== 'collapse') {
    const opts = neighbors(cur, byKey).filter((n) => n.r >= cur.r);
    if (!opts.length) break;
    // Weight by kind + heat
    const weights = opts.map((n) => {
      if (n.kind === 'collapse') return heat === 3 ? 0.35 : heat === 2 ? 0.18 : 0.08;
      if (n.kind === 'boost') return 0.9 + heat * 0.25;
      if (n.kind === 'exit') return 1.1;
      return 1;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let pick = await fairFloat(serverSeed, clientSeed, nonce, 400 + step);
    pick *= sum;
    let acc = 0;
    let next = opts[0]!;
    for (let i = 0; i < opts.length; i++) {
      acc += weights[i]!;
      if (pick <= acc) {
        next = opts[i]!;
        break;
      }
    }
    // Prefer downward progress
    if (next.r < cur.r) {
      const down = opts.filter((n) => n.r > cur.r);
      if (down.length) {
        const j = await fairInt(serverSeed, clientSeed, nonce, down.length, 500 + step);
        next = down[j]!;
      }
    }
    path.push(next.id);
    if (next.kind === 'collapse') {
      return { path, product: 0, collapsed: true };
    }
    product = Math.floor(product * next.mult * 1000) / 1000;
    cur = next;
    step += 1;
    if (step > 40) break;
  }

  return { path, product, collapsed: false };
}

export async function playLatticeRound(input: {
  nonce: number;
  serverSeed: string;
  clientSeed: string;
  commit: string;
  bets: LatticeBet[];
}): Promise<LatticeRound> {
  const cols = 7;
  const rows = 8;
  const nodes = await buildLattice(input.serverSeed, input.clientSeed, input.nonce, cols, rows);
  // Use first bet's path for shared board (multiplayer-style); payouts per bet heat/start
  const primary = input.bets[0];
  const sim = primary
    ? await runLatticePath(
        nodes,
        primary.startCol,
        primary.heat,
        input.serverSeed,
        input.clientSeed,
        input.nonce,
      )
    : { path: [], product: 0, collapsed: true };

  const payouts: Record<string, number> = {};
  for (const bet of input.bets) {
    const run =
      bet === primary
        ? sim
        : await runLatticePath(
            nodes,
            bet.startCol,
            bet.heat,
            input.serverSeed,
            input.clientSeed,
            input.nonce + bet.startCol * 17 + bet.heat,
          );
    payouts[bet.id] = run.collapsed
      ? 0
      : Math.floor(bet.stake * Math.min(run.product, 50) * 100) / 100;
  }

  return {
    nonce: input.nonce,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    commit: input.commit,
    nodes,
    cols,
    rows,
    path: sim.path,
    product: sim.product,
    collapsed: sim.collapsed,
    settled: true,
    bets: input.bets,
    payouts,
  };
}
