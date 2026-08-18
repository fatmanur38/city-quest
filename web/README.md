# CityQuest — web app

Next.js app, route handlers and the database layer. See the [root README](../README.md) for the
architecture, the reasoning and the full setup guide.

## Quick start

```bash
npm install
npm run dev          # needs a chain: run `anvil` and deploy from ../contracts first
```

Runs with no database configured — user state falls back to `.data/cityquest.json`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sync:abis` | Copy contract ABIs from `../contracts/out` into `src/lib/chain/abis.ts` |
| `npm run demo:e2e` | Drive the whole demo journey against the running app and assert every step |

## Layout

```
src/
  app/          pages + API route handlers
  components/   UI primitives (Button, Card, Badge, QrCode, TechnicalDetails…)
  features/     auth · passport · activities · quests · rewards · institution · admin · scan
  lib/          chain clients, credential catalogue, QR payloads, env validation
  server/       database adapters, sessions, institution signing, transactions
```

`src/server/**` is server-only: it holds institution signing keys and the service-role database
client. Never import it from a client component.
