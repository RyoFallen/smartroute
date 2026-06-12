# SmartRoute

Mobile app that finds the cheapest order to visit multiple cities, with a route map and saved trips.

## Stack

- **Mobile:** React Native + Expo + TypeScript
- **Backend:** Node 22 + Fastify + Prisma + Postgres 16
- **Auth:** Clerk (added in Plan 2)
- **Hosting (later):** Fly.io + Neon

## Repo layout

```
apps/
  backend/   # Fastify API
  mobile/    # Expo app
packages/
  shared/    # Zod schemas + types
docs/
  superpowers/specs/   # design specs
  superpowers/plans/   # implementation plans
```

## Prerequisites

- Node 22+
- pnpm 9
- Docker (for local Postgres)

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d                # start Postgres
pnpm --filter @smartroute/backend db:migrate
pnpm --filter @smartroute/backend db:seed     # load must-go attractions (8 cities)
pnpm --filter @smartroute/backend dev   # backend on :3000
pnpm --filter @smartroute/mobile start  # Expo dev server
```

## Scripts

- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm typecheck` — TS across all packages
- `pnpm test` — Vitest across all packages

## Backend endpoints

- `GET /health` — liveness
- `POST /optimize` — auth required; returns top-K labeled routes (`cheapest`/`fastest`/`most_direct`) for 2–8 cities
- `POST /trips`, `GET /trips`, `GET /trips/:id`, `DELETE /trips/:id` — saved trips (auth required, user-scoped)
- `GET /trips/:id/plan` — auth required; per-city must-go attractions for a saved trip, in visiting order

All authenticated endpoints expect `Authorization: Bearer <Clerk JWT>`. Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` in `.env` before running the backend.

## Using real flight data (Duffel)

By default, the backend uses `MockFlightProvider` — deterministic fake prices. To use real flights:

1. Sign up at https://app.duffel.com/access/sign-up (no card required for test mode).
2. Verify your email, then in the dashboard click your **organisation name → Developers → Access tokens → New token**. Make sure the dashboard is in **Developer test mode**; test tokens start with `duffel_test_`.
3. In `apps/backend/.env`, set:
   ```
   FLIGHT_PROVIDER=duffel
   DUFFEL_API_KEY=duffel_test_xxx...
   ```
4. Restart the backend. It logs the selected provider at boot and refuses to start if `FLIGHT_PROVIDER=duffel` but `DUFFEL_API_KEY` is missing.

Test mode only returns offers from the synthetic carrier "Duffel Airways". Prices come back in the origin region's local currency (e.g. GBP for LHR origins); the mapper prefers USD when available and falls back to the cheapest offer in any currency. Direct cross-currency comparison is not correct for production — a real FX layer is a follow-up (see Plan 5+).

CI always runs with the mock provider (no `FLIGHT_PROVIDER` or `DUFFEL_API_KEY` in the workflow env), so tests stay deterministic and offline.

## Mobile setup

```bash
cd apps/mobile
cp .env.example .env
# Edit .env: set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (from your Clerk dashboard)
# EXPO_PUBLIC_API_URL defaults to http://localhost:3000 (use your LAN IP for physical devices)
pnpm --filter @smartroute/mobile start
```

Sign in with email + 6-digit code (Clerk). The planner accepts 2–8 IATA airport codes from a built-in list of ~50 popular airports (real geocoding lands in Plan 4).

## Specs and plans

See `docs/superpowers/`.
