# Uptime Showdown

A browser game where you build a software architecture by drag-and-drop, then a simulation pushes traffic through it. Keep uptime high, latency low and cost under budget.

Phase 1 is a single-player sandbox. Everything is mouse-only: drag, click, scroll.

## Run it

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the engine unit tests once |
| `npm run test:watch` | Run tests on change |
| `npm run typecheck` | Type-check the project |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build to `dist/` |

## Layout

- `src/engine/` is the simulation: pure TypeScript with no React, so it can later run on a server for multiplayer. A lint rule blocks framework imports here.
- `src/ui/` holds the React Flow canvas, palette, HUD and node renderers.
- `src/levels/` holds level definitions as data.
- `src/store.ts` is the Zustand store that connects them.
