# SmartRoute — Semester Progress Report

**Student:** Burak (GitHub: RyoFallen)
**Project:** SmartRoute — Multi-City Trip Planner Mobile Application
**Date:** June 2026

---

## 1. What SmartRoute Is

SmartRoute is a mobile application that solves a real travel problem: when you want to visit multiple cities in one trip, which order should you visit them in to spend the least money on flights?

**Example:** You want to visit Istanbul, Budapest, Warsaw, and Berlin. There are 24 possible orderings of those four cities. SmartRoute queries real flight prices for every possible route combination and tells you the cheapest order, the fastest order, and the most direct order — all in one screen.

This is the core feature. A second major feature is in design: after saving a trip, users will be able to tap "Plan" to get a per-city itinerary (must-see attractions + personalised recommendations based on a short preference questionnaire). That layer is the planned focus for the next semester.

---

## 2. Technical Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile app | React Native + Expo SDK 54 + TypeScript | Cross-platform iOS/Android from one codebase; Expo enables fast iteration without Xcode/Android Studio builds |
| Backend API | Node.js 22 + Fastify + TypeScript | Fastify is significantly faster than Express; TypeScript ensures shared types between backend and mobile |
| Database | PostgreSQL 16 + Prisma ORM | Prisma generates a fully-typed query client; schema changes are tracked as versioned migration files |
| Authentication | Clerk | Handles email + 6-digit OTP sign-in; JWT tokens are verified server-side on every authenticated request |
| Real flight data | Duffel API | Commercial flight data API; test mode returns synthetic offers so the app can be developed without spending money |
| Shared types | Custom `@smartroute/shared` package (Zod schemas) | Both the backend and mobile import the same Zod schemas — if a field changes, the TypeScript compiler catches mismatches in both places simultaneously |
| Monorepo tooling | pnpm workspaces | Manages the three packages (backend, mobile, shared) with a single `pnpm install` |
| CI/CD | GitHub Actions | Runs on every push to `main`: format check, lint, type check, 55 automated tests against a real PostgreSQL service |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  iOS / Android                       │
│              (React Native + Expo)                   │
│                                                      │
│  SignIn → Planner → Results → Save → Trips List      │
│                        │                             │
│               Apple Maps / Google Maps               │
└───────────────────┬─────────────────────────────────┘
                    │  HTTPS  (Clerk JWT in header)
┌───────────────────▼─────────────────────────────────┐
│               Fastify Backend (Node 22)              │
│                                                      │
│  POST /optimize  ──► OptimizerService                │
│                          │                           │
│                    FlightService (cache layer)       │
│                          │                           │
│                    DuffelFlightProvider              │
│                    (or MockFlightProvider in CI)     │
│                          │                           │
│  POST/GET/DELETE /trips ──► TripsService             │
│                          │                           │
└──────────────────┬───────┴──────────────────────────┘
                   │
      ┌────────────▼────────────┐     ┌─────────────────┐
      │   PostgreSQL 16         │     │  Duffel API      │
      │   (Prisma ORM)          │     │  (real flights)  │
      └─────────────────────────┘     └─────────────────┘
```

**Key architectural decisions:**

- **Shared Zod schemas** (`packages/shared`): The `OptimizeRequest`, `OptimizeResponse`, `Trip`, and `FlightLeg` types are defined once as Zod schemas and imported by both the backend and the mobile app. This means the API contract is enforced at compile time, not discovered at runtime.

- **Provider pattern for flights**: The backend has a `FlightProvider` interface. In production, it is satisfied by `DuffelFlightProvider`. In CI tests, it is satisfied by `MockFlightProvider` (returns deterministic fake prices). This is a software design pattern called *dependency injection* — it means the optimizer logic can be tested without making real network calls to Duffel.

- **In-memory price cache**: Flight prices are cached in memory for 10 minutes. If Duffel is slow or returns stale data, the cache serves the previous result and flags it as `staleCache: true` in the response.

---

## 4. What Is Currently Working

### 4.1 User Authentication
- Email + 6-digit code sign-in via Clerk
- JWT token stored on device; sent with every API request
- Backend rejects any request without a valid JWT with HTTP 401

### 4.2 Route Optimizer
- User enters 2–8 IATA airport codes (e.g. IST, BER, WAW, BUD), a departure date, days per city, and optionally "direct flights only"
- Backend enumerates all valid city orderings (fixing the start city, optionally fixing the end city)
- Queries Duffel API for the price of every needed flight leg
- Returns up to 3 labeled routes: **cheapest**, **fastest**, **most direct**
- Each route shows: city order, total price, total duration, number of stops per leg, airline carrier

**Verified live example:** Istanbul → Mexico City returned $422, 16 hours, 1 connection.

### 4.3 Results Screen with Map
- Results screen shows the three route options as cards
- Tapping a route opens Apple Maps (iOS) / Google Maps (Android) with each city plotted as a pin in the chosen order

### 4.4 Saved Trips
- User can save any route result to their account
- Saved trips are stored in PostgreSQL, scoped to the authenticated user
- Trips list screen shows all saved trips with summary info
- Trip detail screen shows the full route
- User can delete trips

### 4.5 Real Flight Data via Duffel
- Backend connects to Duffel's test-mode API
- Duffel test mode returns synthetic flight offers (carrier name: "Duffel Airways") with realistic prices and durations
- The mapper handles a currency edge case: Duffel returns prices in the origin airport's local currency (e.g. GBP for London Heathrow). The backend prefers USD offers but falls back to the cheapest offer in any currency when no USD offers are available.

### 4.6 Automated Test Suite
- **55 tests** passing across backend services
- Tests cover: optimizer logic, route enumeration, flight pricing mapper, Duffel provider retry behaviour (tests that a 429 rate-limit triggers a retry, a 401 auth failure returns the right error code, a 422 "no offers" is silently skipped)
- Tests run in CI on every push — no Duffel credentials in CI, so tests are offline and deterministic

---

## 5. System Demo Flow

A live demo would show:

1. **Sign in** — enter email, receive 6-digit code, tap confirm
2. **Plan a trip** — add IST, BER, WAW, BUD, set departure date, tap "Find routes"
3. **View results** — three cards appear: cheapest order, fastest order, most direct order, each with price and duration
4. **View on map** — tap a route to see the cities plotted in order on Apple Maps
5. **Save the trip** — tap Save, navigate to "My saved trips", see the trip appear
6. **Trip detail** — tap the saved trip to see the full flight-by-flight breakdown

---

## 6. Contribution to Engineering Thesis

The thesis topic is building a full-stack mobile application from scratch, covering:

- **System design**: how to structure a monorepo with a shared type layer that enforces API contracts between a backend and a mobile client
- **Algorithm design**: the route enumeration algorithm (fixed-start permutation with date-shifting for multi-day stays) and the three-objective ranking (cheapest / fastest / most direct)
- **Third-party integration**: connecting to a commercial flight data API (Duffel), handling authentication, error classification (rate limits vs auth failure vs no offers), retries, and currency normalisation
- **Testing strategy**: how to design a `FlightProvider` interface that allows deterministic offline testing of complex optimizer logic that depends on real-world data
- **Authentication and security**: Clerk JWT flow, server-side token verification, user-scoped database queries

### Planned work for next semester (to be described in thesis):

- **Algorithm improvements**: the current optimizer enumerates all city orderings and picks the best by price, duration, or stops. Planned improvements include smarter pruning for larger city counts, better handling of layover constraints, and potentially incorporating budget-per-leg constraints so users can set a maximum spend on any single flight.

- **Completed user interface**: the current UI is functional but minimal. The next phase will deliver a polished, production-quality interface — improved city input with autocomplete, a cleaner results presentation, and a better trip detail view.

- **Trip planning layer**: after saving a route, users answer preference questions (Tinder-style swipe cards: history vs nightlife, budget vs luxury, packed schedule vs relaxed, etc.). The app then generates a per-city itinerary with:
  - **Must-go attractions** (curated database, preference-independent — e.g. "Brandenburg Gate is in Berlin, you are going to Berlin, therefore it appears")
  - **Might-like suggestions** (preference-filtered — e.g. "you swiped right on museums, here are the top 3 museums in Berlin that match your taste")

---

## 7. Repository Structure

```
smartroute/
├── apps/
│   ├── backend/           # Fastify API (Node 22 + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/    # HTTP route handlers (optimize, trips, health)
│   │   │   ├── services/  # Business logic (optimizer, flights, trips)
│   │   │   └── plugins/   # Fastify plugins (auth, prisma, error handler)
│   │   ├── prisma/        # Schema + migrations
│   │   └── tests/         # 55 Vitest unit tests
│   └── mobile/            # Expo + React Native app
│       └── src/
│           ├── screens/   # SignIn, Planner, Results, TripsList, TripDetail
│           ├── components/ # CityPicker, RouteMap, RouteOption, Screen
│           └── navigation/ # React Navigation stack
├── packages/
│   └── shared/            # Zod schemas shared between backend + mobile
└── .github/workflows/     # CI pipeline (GitHub Actions)
```

---

## 8. GitHub Repository

**https://github.com/RyoFallen/smartroute** (private — can be made available to the lecturer on request)

Current state: `main` branch, last commit `1b55488`, 55/55 tests passing.
