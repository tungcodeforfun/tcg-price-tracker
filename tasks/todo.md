# TCG Price Tracker v2 — ground-up rewrite

Research: `tasks/research/price-data-sources.md`, `tasks/research/popular-tcgs-and-competitors.md`

## Architecture
- **Runtime:** Node 24 LTS, TypeScript, pnpm workspaces (no Turborepo until build times demand it).
- **Branch:** `v2` in this repo; the old `frontend/` and `tcgtracker/` are removed on that branch (history keeps them). `dev` stays on the Phase 0 app until cutover.
- **Layout:**
  - `apps/web`: React Router 8 framework mode (SSR). Loaders/actions call `packages/core` directly, so there's no separate REST API. Tailwind v4 + Radix/shadcn. Resource routes serve the Better Auth handler, the Stripe webhook and CSV export.
  - `apps/worker`: pg-boss consumers + cron. Jobs: catalog sync, price sync, portfolio snapshots, alert evaluation, email delivery.
  - `packages/db`: Drizzle schema, drizzle-kit migrations, pooled client.
  - `packages/core`: domain logic (catalog queries, collection valuation, realized/unrealized P&L, alerts, entitlements). Plain functions over a db handle.
  - `packages/pricing`: JustTCG v1 client (`GET /games`, `/sets`, `/cards`, `POST /cards` batch) behind a `PriceProvider` interface. Tracks quota in the DB (per minute/day/month) and hard-stops before the cap.
- **Infra:** Postgres 17 only; pg-boss runs on Postgres, so no Redis. Mailpit in local compose. Email via Resend in prod.
- **Deploy:** Fly.io, one image with two process groups (`web`, `worker`), Fly Managed Postgres, and `release_command` for migrations.

## Data model
- **Catalog:** `games`, `sets`, `cards` (JustTCG uuid, tcgplayer id, number, rarity), `variants` (card × condition × printing × language, latest price denormalized), `price_points` (variant, day, price; unique per variant/day, so size is bounded).
- **Accounts:** Better Auth tables (`user`, `session`, `account`, `verification`).
- **Portfolio:** `collection_items` (user, variant, qty, unit cost, acquired_at), `sales` (sold log feeding realized P&L), `portfolio_snapshots` (user, day, value, cost basis).
- **Alerts:** `alerts` (user, variant, above/below, threshold, cooldown, last_triggered_at), `notifications` (delivery log, dedupe key).
- **Billing:** `subscriptions` (Stripe customer/subscription, plan, status, period end). Entitlements are derived in `core` from the plan.
- **Ops:** `provider_quota` (provider, window, used), `sync_runs`.

## Optimization targets
- Public card/set pages are SSR with `Cache-Control: s-maxage` + stale-while-revalidate. Prices change at most every 6h upstream.
- Route JS budget: ≤120 KB gz on public pages; the chart library loads only on chart routes.
- Search uses a `pg_trgm` GIN index on card name. p95 < 100 ms on 50K cards.
- Portfolio value comes from a single SQL aggregate over `collection_items ⋈ variants`; history from daily `portfolio_snapshots`, never recomputed per request.
- Dashboard: one loader, parallel queries, zero client waterfalls.
- Vendor cost is flat in user count: set-level batch sync only, never per-user vendor calls.

## Constraints
- **JustTCG free tier:** 1,000 req/mo, 100/day, 10/min, 20 cards/req, **non-commercial**. Dev syncs an allowlist of a few sets. A paid plan (Professional $49 recommended) is **required before charging users**.
- **No card images yet:** JustTCG serves none, and Scrydex needs written commercial authorization. Cards render as a styled text placeholder behind an `imageUrl` field that's ready for a provider.
- **Free-tier promise:** card pages, current prices and CSV export stay free. Pro = unlimited cards, alerts with email, realized P&L + sold log + tax CSV, full history.

## Prerequisites you own
- [ ] Resend API key + sending domain (needed for prod email; local uses Mailpit)
- [ ] Stripe test-mode keys (needed at V6)
- [ ] Fly.io account (needed at V8)
- [ ] JustTCG paid plan before launch; Scrydex written authorization for images
- [ ] Product name + domain

## Phases (each ends with its verification passing)
### V0 — Scaffold
- [x] `v2` branch; remove old app dirs, stale compose/CI/README content
- [x] Node 24 (`.nvmrc`), pnpm workspace, shared tsconfig, ESLint 10, Prettier, Vitest
- [x] Compose: postgres:17, mailpit. `.env.example`
- [x] CI: install, typecheck, lint, test (Postgres service), build
- [x] Verify: typecheck/lint/build green; SSR home renders, unknown route 404 (CI not yet run on GitHub)

### V1 — DB + pricing sync
- [x] Drizzle schema (catalog, ops) + first migration
- [x] JustTCG client against the official v1 spec; quota tracker; `PriceProvider` interface
- [x] Worker jobs: `sync-catalog` (games → sets for enabled games), `sync-prices` (allowlisted sets, batched, writes variants + daily `price_points`)
- [x] Integration tests against real Postgres with recorded JustTCG fixtures (pricing 14, worker 17)
- [x] Verify: real free-tier sync of 2 sets (30 cards, 78 variants, 1,921 price points); quota row updated from `_metadata`

### V2 — Auth
- [ ] Better Auth email/password, email verification, password reset, session cookies; protected route helper
- [ ] Rate limiting on auth routes
- **Verify:** browser signup → Mailpit verification link → login → logout → reset password

### V3 — Catalog UX (public, SSR)
- [ ] Game/set/card pages with price chart per variant, search with trigram + filters, SEO meta + sitemap
- **Verify:** pages render without JS, cache headers present, search p95 measured

### V4 — Collection & P&L
- [ ] Add/edit/remove items, sold log, realized/unrealized P&L, CSV import/export, daily portfolio snapshots job, dashboard
- **Verify:** core P&L unit tests on edge cases (partial sells, zero cost); browser flow add → sell → P&L updates

### V5 — Alerts & notifications
- [ ] CRUD, evaluation after each price sync, cooldown/dedupe, email delivery via worker
- **Verify:** fixture price change → exactly one Mailpit email; no repeat within cooldown

### V6 — Billing
- [ ] Stripe Checkout, Customer Portal, signature-verified idempotent webhook; entitlement checks in `core`
- **Verify:** Stripe CLI test purchase → Pro limits lift; cancel → downgrade at period end; replayed webhook is a no-op

### V7 — Product surface & polish
- [ ] Marketing home, pricing page, legal pages, light/dark, responsive, a11y pass, performance budgets enforced
- **Verify:** Lighthouse ≥ 90 perf/a11y on home + card page; mobile-width smoke of every route

### V8 — Deploy & cutover
- [ ] Fly config, release migrations, Sentry, Postgres backups, staging deploy
- [ ] Merge `v2` → `dev`/`main`; remove Phase 0 app
- **Verify:** staging end to end: signup → add cards → alert email → upgrade

## Review
### Phase 0 (2026-09-25) — superseded by v2 rewrite
- Phase 0 modernized the old Python/React app (commits `8141163`, `e46098a`, `03f82b6` on `dev`). It stays runnable on `dev` until V8 cutover.

### V0 + V1 (2026-09-25)
- Workspace TypeScript runs natively on Node 24 (no build step for packages/worker); relative imports use `.ts`.
- JustTCG `_metadata` usage counts lag real usage by a few requests; the client's 5-request daily reserve covers it.
- Set `cards_count` from `/v1/sets` can exceed what `/v1/cards` returns (One Piece set-sail: 26 vs 18).
- Known gaps, deferred: set selection budgets only the daily quota (monthly reserve still enforced by the client); `sync-set-prices` is serial per worker process, not across processes; `listSets` ignores pagination (all observed responses fit one page).
