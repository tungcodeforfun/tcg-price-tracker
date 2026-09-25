# TCG Price Tracker

Track trading card prices and your collection's value.

## Stack

- Node 24, TypeScript, pnpm workspaces
- `apps/web`: React Router 8 (framework mode, SSR), Tailwind CSS v4
- Postgres 17 (Drizzle ORM); background jobs on Postgres via pg-boss
- Price data: [JustTCG](https://justtcg.com)

## Getting started

```bash
nvm use                # Node 24 from .nvmrc
cp .env.example .env   # add JUSTTCG_API_KEY
docker compose up -d   # Postgres on :5432, Mailpit UI on :8025
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test    # integration tests use TEST_DATABASE_URL
pnpm build
```
