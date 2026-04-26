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

All authenticated endpoints expect `Authorization: Bearer <Clerk JWT>`. Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` in `.env` before running the backend.

## Specs and plans

See `docs/superpowers/`.
