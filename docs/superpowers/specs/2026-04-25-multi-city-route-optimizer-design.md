# SmartRoute V1 — Multi-City Route Optimizer Design

**Date:** 2026-04-25
**Status:** Approved (pending user spec review)
**Owner:** Burak Berk Yılmaz

## 1. Purpose

A mobile app where a user picks 2–8 cities, dates, and travel preferences, and gets the **top alternative routes** (cheapest / fastest / most direct) with flight prices and a route map. Users sign up, save trips, and revisit them.

This is a **shippable real product**, not a thesis demo. Polish and time-to-launch matter more than algorithmic novelty.

## 2. Goals & Non-Goals

### Goals (V1)

- Optimize the **city ordering** for a multi-city trip across 2–8 cities to minimize a multi-objective cost (flight price, total time, directness).
- Return **multiple labeled options** so users see tradeoffs.
- Let users **sign up, save trips, and revisit them** on mobile.
- Visualize the chosen route on a map.
- Ship in ~7–10 weeks of solo evening/weekend work.

### Non-Goals (deferred to V2)

- Attraction recommendations / interest swipe cards.
- Daily itinerary generation / walking routes.
- Hotel pricing, food/transport per-diems.
- Sharing a trip via link.
- Push notifications / price-tracking.
- Multi-language UI.
- Web app (mobile-first now; web later).
- Trips with > 8 cities (algorithm cap).
- Detox/Maestro E2E.

## 3. Product Decisions Locked In

| Decision              | Choice                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| Primary value prop    | Cheapest / best-value city ordering with multi-objective tradeoffs         |
| Platform V1           | Mobile-only (iOS + Android via Expo)                                       |
| Definition of "best"  | Multi-objective composite: cost + time + directness, surface top-K options |
| City cap              | 2–8 cities per trip (brute-force search, no GA needed)                     |
| V1 features           | Auth + saved trips + route map + the optimizer                             |
| Architecture approach | Pragmatic hybrid (Approach 3 from brainstorming)                           |

## 4. Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     MOBILE (Expo / RN)                         │
│   Screens ──► Zustand stores ──► TanStack Query                │
│                                  │                             │
│                                  │ (HTTPS, Clerk JWT)           │
└──────────────────────────────────┼─────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────┐
│                  BACKEND (Fastify on Fly.io)                   │
│   Auth (Clerk JWT) ──► Routes ──► Services                     │
│                                                                │
│   /optimize   ──► OptimizerService (pure)                      │
│                  ├── FlightService.getPrices() ──► Cache ──► API│
│   /trips      ──► TripService                                  │
└───────┬───────────────────────────────────┬───────────────────┘
        ▼                                   ▼
┌────────────────┐                 ┌─────────────────────┐
│ Neon Postgres  │                 │  Flight API (TBD)   │
│   via Prisma   │                 └─────────────────────┘
└────────────────┘

         ▲
         │  (issues + verifies user JWTs)
┌────────────────┐
│  Clerk (auth)  │
└────────────────┘
```

### Stack

| Layer          | Choice                                                 | Why                                                   |
| -------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Mobile         | React Native + Expo (latest SDK), TypeScript           | Cross-platform, strong DX, EAS build pipeline         |
| State (mobile) | Zustand for app state, TanStack Query for server state | Spec-aligned; simpler than Redux                      |
| Backend        | Node 22 + Fastify + TypeScript                         | Modern alternative to Express; native Zod integration |
| ORM            | Prisma                                                 | Best-in-class DX, well-documented                     |
| DB             | Neon (managed Postgres 16)                             | Serverless, free tier, branching for dev              |
| Auth           | Clerk (managed)                                        | Saves 1–2 weeks of auth code; free under 10k MAU      |
| Hosting        | Fly.io                                                 | Cheap (~$5/mo), full control                          |
| Maps           | MapLibre GL Native                                     | OSS, no API key needed                                |
| Observability  | Sentry (mobile + backend); Pino logs                   | Industry standard                                     |
| Validation     | Zod everywhere                                         | Single source of truth for shapes                     |
| Tests          | Vitest + Postgres test container + RNTL                | Fast, accurate to prod                                |
| CI             | GitHub Actions                                         | Lint + typecheck + test on every push                 |

### Repository Structure

Plain pnpm workspaces (no Turborepo for V1).

```
smartroute/
├── apps/
│   ├── mobile/          # React Native Expo app
│   └── backend/         # Fastify API
├── packages/
│   └── shared/          # Zod schemas + types shared by both
├── docs/
├── docker-compose.yml   # local Postgres
├── pnpm-workspace.yaml
└── package.json
```

## 5. Components

### 5.1 Mobile screens (V1)

```
Auth Stack (unauthenticated)
├── Welcome
├── Sign In        (Clerk SDK)
└── Sign Up        (Clerk SDK)

Main Tabs (authenticated)
├── Plan
│   ├── New Trip       — city picker + dates + travelers + class + directOnly
│   ├── Optimizing     — loading screen with cancel
│   ├── Results        — swipeable cards: cheapest / fastest / most direct
│   └── Route Detail   — flight legs + map + Save Trip
├── My Trips
│   ├── Trip List      — saved trips, newest first
│   └── Trip Detail    — same as Route Detail + delete
└── Profile
    ├── Account        (Clerk-managed)
    └── Sign Out
```

Total: ~10 screens.

### 5.2 Backend modules

```
apps/backend/src/
├── server.ts                        — Fastify bootstrap
├── plugins/
│   ├── auth.ts                      — Clerk JWT verification
│   └── prisma.ts                    — Prisma lifecycle
├── routes/
│   ├── optimize.route.ts
│   └── trips.route.ts
├── services/
│   ├── optimizer/
│   │   ├── index.ts                 — pure: (input) → top-K routes
│   │   └── score.ts                 — multi-objective scoring
│   ├── flights/
│   │   ├── index.ts                 — getPrices(triples) → Map
│   │   ├── cache.ts                 — Postgres-backed cache
│   │   └── provider.ts              — interface + mock + real provider
│   └── trips/
│       └── index.ts                 — CRUD over Prisma
└── schemas/                         — Zod request/response schemas
```

### 5.3 Data Model (Prisma)

```prisma
// No User table — Clerk owns identity. We just store Clerk's user ID.

model Trip {
  id          String   @id @default(cuid())
  userId      String                          // Clerk user ID
  name        String
  startDate   DateTime
  endDate     DateTime
  cabinClass  String                          // ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
  travelers   Int
  cities      String[]                        // ordered IATA codes
  flights     Json                            // FlightLeg[] snapshot
  totalPrice  Int                             // cents
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
}

model FlightPriceCache {
  id            String   @id @default(cuid())
  origin        String                         // IATA
  destination   String                         // IATA
  departDate    DateTime @db.Date
  cabinClass    String
  priceCents    Int
  durationMin   Int
  stops         Int
  carrier       String?
  fetchedAt     DateTime @default(now())

  @@unique([origin, destination, departDate, cabinClass])
  @@index([fetchedAt])
}

model City {
  iata      String  @id                        // CDG, FCO, ...
  name      String
  country   String
  lat       Float
  lon       Float
  timezone  String
}
```

Key choices:

- **No `User` table.** Clerk owns identity; we hold its user ID as a string FK. If app-specific user fields appear later, add a `UserProfile` keyed by Clerk's ID.
- **`flights` is JSONB snapshot.** A saved trip is read-only history. JSONB lets the schema evolve without migrations.
- **`City` is seeded** with ~500 popular IATA airports/cities. The picker queries this table; no flight-API call needed for autosuggest.

### 5.4 Shared package

`packages/shared` exports Zod schemas → derived TypeScript types:

- `OptimizeRequest`, `OptimizeResponse`
- `RouteOption` (label, ordered cities, legs, totalCost, totalDuration, score breakdown)
- `FlightLeg` (origin, destination, depart, arrive, carrier, priceCents, stops, durationMin)
- `Trip` (API shape, mirrors Prisma)
- `ApiError` (envelope; see §7)
- `ErrorCode` enum

Mobile and backend both depend on `shared` so they can't drift on shapes.

## 6. Data Flow

### 6.1 Optimize flow

```
[Mobile] POST /optimize { cities, startCity?, endCity?, departDate,
                          perCityDays, travelers, cabinClass, directOnly }
   // totalDays is derived = sum(perCityDays); not part of the request
   │
[Backend] auth ──► OptimizerService.optimize()
   │
   │  1. Generate orderings (≤8! = 40,320; pruned by start/end constraints)
   │  2. Compute departure date for each leg from order + perCityDays
   │  3. Collect every distinct (origin, dest, date) triple
   │  4. FlightService.getPrices(triples)
   │       cache lookups → batch missing → write back to cache
   │  5. Score every ordering: { totalCost, totalTime, directness }
   │  6. Pick winners: cheapest / fastest / most_direct (deduped)
   │
[Response] { options: RouteOption[], partial?: boolean, staleCache?: boolean }
   │
[Mobile] cache via TanStack Query → render swipeable Results cards
```

Key choices:

- **Batched pricing after enumeration**, not during. We enumerate first, then collect every distinct triple, then fetch in one batch — drops API calls from O(orderings) to O(unique pairs).
- **Dedupe** identical winners before responding (e.g., cheapest === fastest is common with few cities).
- **`directOnly` is a hard filter**, not a score weight; legs with stops are removed before scoring.

### 6.2 Save trip flow

```
[Mobile] POST /trips with { name?, RouteOption }
[Backend] TripService.create() — inserts row, freezes flights as JSON snapshot
[Mobile] invalidate "my trips" query
```

Snapshot is intentional: V1 doesn't track price changes (V2 feature).

### 6.3 List/View saved trips

Plain CRUD. `GET /trips` for the user; `GET /trips/:id`; `DELETE /trips/:id`. Detail view renders the saved snapshot with the same map component used in Results.

## 7. Error Handling

### 7.1 Taxonomy

| #   | Category                          | Status / Code              | UX                                                         |
| --- | --------------------------------- | -------------------------- | ---------------------------------------------------------- |
| 1   | Validation                        | 400 `INVALID_INPUT`        | Inline form errors                                         |
| 2   | Auth                              | 401 `UNAUTHORIZED`         | Mobile clears Clerk session, routes to Sign In             |
| 3   | Authorization (other user's trip) | 404 `NOT_FOUND`            | Don't leak existence — same as missing                     |
| 4   | Not found                         | 404 `NOT_FOUND`            | Standard not-found UI                                      |
| 5   | Flight API failure                | see 7.2                    | see 7.2                                                    |
| 6   | No viable route                   | 200 `options: []` + reason | Banner suggests relaxing `directOnly`                      |
| 7   | Optimizer timeout (>5s)           | 200 + `partial: true`      | Banner: "showing best so far"                              |
| 8   | Network (mobile)                  | n/a                        | Toast + retry; TanStack Query auto-retries idempotent GETs |
| 9   | Server crash / 500                | 500 `INTERNAL_ERROR`       | Generic "Something went wrong" + retry; Sentry captures    |

### 7.2 Flight API failure modes

- **Partial success (some legs 5xx):** if ≥90% of needed pairs succeeded, score what we have and respond with `partial: true`. Mobile shows a banner.
- **Vendor down (all legs 5xx):** fall back to cache even if stale; respond with `staleCache: true`. If cache is empty too, return 503 `FLIGHT_API_UNAVAILABLE`.
- **Rate-limited (429):** respect `Retry-After`. If can't serve within ~3s, return 503 `RATE_LIMITED` with a "try again" message.

### 7.3 Error envelope

```json
{
  "error": {
    "code": "FLIGHT_API_TIMEOUT",
    "message": "Human-readable, safe to display",
    "details": {
      /* validation only */
    }
  }
}
```

`ErrorCode` is an enum in `packages/shared`. Codes: `INVALID_INPUT`, `UNAUTHORIZED`, `NOT_FOUND`, `FLIGHT_API_TIMEOUT`, `FLIGHT_API_UNAVAILABLE`, `FLIGHT_API_NO_RESULTS`, `RATE_LIMITED`, `INTERNAL_ERROR`.

### 7.4 Logging & monitoring

- Sentry on mobile and backend.
- Pino structured logs on backend (request, cache hit/miss, flight-API latency).
- No PII (emails/names) in structured logs. User IDs OK.

### 7.5 Auth flow note

Sign up and sign in happen between the **mobile client and Clerk directly** via Clerk's React Native SDK — our backend is never on the password path. The backend only receives the Clerk-issued JWT in `Authorization: Bearer <jwt>` headers and verifies it with Clerk's JWKS.

### 7.6 Explicitly NOT in V1

- Retries on non-idempotent writes (`POST /trips`) — user retries manually to avoid duplicates.
- Circuit breakers — single external dep doesn't justify the complexity.
- Multi-region failover.
- Email alerting (Sentry UI is the alerting).

## 8. Testing

| Layer                                   | Tool                                   | What we test                                                              |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Pure logic (optimizer, scoring, dedupe) | Vitest unit                            | All branches: ties, single-city, infeasible `directOnly`, partial pricing |
| Service integration (FlightService)     | Vitest + msw                           | Cache hit, cache miss → API, stale fallback, batching, 429 backoff        |
| API routes                              | Vitest + Fastify `inject()`            | Auth, validation, happy paths                                             |
| DB layer                                | Prisma against Postgres test container | Migrations, unique constraints, cascades                                  |
| Mobile components                       | React Native Testing Library           | Critical screens render with mock data; navigation; form validation       |
| End-to-end (mobile)                     | Manual QA on Expo dev build            | Full optimize → save → reopen flow on a real device                       |

### Coverage targets

- Optimizer + scoring: 100% branch.
- FlightService cache logic: 100% branch.
- Routes: ≥80% line.
- Mobile screens: ≥60% line + navigation smoke tests.

### CI

GitHub Actions on every push: `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (with Postgres service container). No deploy gates in V1.

## 9. Deferred / Open Questions

| Item                                               | Decision needed by                      |
| -------------------------------------------------- | --------------------------------------- |
| Flight API vendor (Amadeus / Kiwi / Duffel / etc.) | Before flight-data implementation phase |
| Mapbox token vs MapLibre tile source               | Before map UI implementation phase      |
| App icon, brand name, color palette                | Before any App Store submission         |

## 10. Out of Scope for V1 (Reiteration)

- Itinerary generation, attractions, swipe cards.
- Hotel / per-diem cost.
- Trip sharing, push notifications, price tracking.
- Web app.
- Trips > 8 cities.
- E2E test automation.

---

**End of design.**
