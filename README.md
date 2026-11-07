# Game kit (5 titles)

Each game is a **standalone demo URL** — sell / embed one at a time (same idea as Ludo).

## URLs (dev)

```bash
cd tools/edge-casino
npm i
npm run dev
```

| Game | URL |
|------|-----|
| **Surge** | http://localhost:5210/surge.html |
| **Andar Bahar** | http://localhost:5210/andar.html |
| **Helix** | http://localhost:5210/helix.html |
| **Lattice** | http://localhost:5210/lattice.html |
| **Cipher** | http://localhost:5210/cipher.html |
| Catalog | http://localhost:5210/ |

## What’s inside

| Game | Pitch | Hard to clone |
|------|-------|----------------|
| Surge | Crash cashout + twin curve | House-edge fair float + trail lane |
| Andar Bahar | Joker match + Pulse-3 | Fair shoe shuffle |
| Helix | Dual-rail sector drop | Phase-locked gate masks |
| Lattice | Hex multiplier path | Axial graph + collapse FSM |
| Cipher | Three dials | Coupled mods 11·13·17 |

Engines live under `src/core/<game>/`. Playground pages under `playground/<game>.html`.

Not included: Plinko, Teen Patti, Mines, car race.
