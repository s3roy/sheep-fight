export * from './core/fair-rng';
export * from './core/surge/engine';
export * from './core/andar/engine';
export * from './core/helix/engine';
export * from './core/lattice/engine';
export * from './core/cipher/engine';
export * from './core/sheep/engine';

export const GAMES = [
  {
    id: 'surge',
    name: 'Surge',
    tag: 'Popular · Crash',
    popular: true,
    blurb: 'Twin-curve crash. Cash out before the surge dies — trail bets ride the twin.',
  },
  {
    id: 'andar',
    name: 'Andar Bahar',
    tag: 'Popular · Cards',
    popular: true,
    blurb: 'Joker match race. Bahar vs Andar with Pulse-3 side action.',
  },
  {
    id: 'sheep',
    name: 'Sheep Fight',
    tag: 'Original · Clash',
    popular: false,
    blurb: 'Dolly vs Ramsey. Stare, charge, clash — even-money fair fight.',
  },
  {
    id: 'helix',
    name: 'Helix',
    tag: 'Original',
    popular: false,
    blurb: 'Dual counter-rotating rails. Phase-locked gates decide the exit sector.',
  },
  {
    id: 'lattice',
    name: 'Lattice',
    tag: 'Original',
    popular: false,
    blurb: 'Hex-path multiplier run. Boosts stack — collapse nodes wipe the product.',
  },
  {
    id: 'cipher',
    name: 'Cipher',
    tag: 'Original',
    popular: false,
    blurb: 'Coupled moduli dials (11·13·17). Wrong ports of the coupling map fail.',
  },
] as const;

export type GameId = (typeof GAMES)[number]['id'];
