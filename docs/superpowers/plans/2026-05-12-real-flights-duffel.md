# Plan 4: Real Flight Provider (Duffel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MockFlightProvider` with a real `DuffelFlightProvider` backed by Duffel's test API, behind the existing `FlightProvider` interface so routes, cache, and optimizer code do not change. Add provider selection via env so Mock remains usable for local dev and CI.

**Why Duffel:** Free test-mode key with no business-verification gate. Typed TS SDK (`@duffel/api`). Two-step shopping flow (offer_request → offers) maps cleanly onto our `getPrices(queries)` call without bookings. We stay in test mode for the whole plan — no money moves.

**Tech additions:** `@duffel/api` (Duffel TS SDK), MSW for HTTP-level tests, no new infra.

**Carry-over from prior sessions:**

- `apps/backend/src/plugins/auth.ts:29` — `clerk.authenticateRequest()` throws when `CLERK_PUBLISHABLE_KEY` is missing and the global error handler converts it to 500. Task 0 wraps it in try/catch and converts SDK throws to 401. (Quoted from memory; verify the line before editing.)

---

## Architecture

```
PriceQuery[]                       PriceResult[]
    │                                   ▲
    ▼                                   │
┌────────────────────────────────────────────┐
│ FlightService (unchanged)                  │
│  ├─ lookup cache (fresh)                   │
│  ├─ provider.getPrices(missing)  ◄──┐      │
│  ├─ upsert cache                    │      │
│  └─ on throw → stale-fallback       │      │
└─────────────────────────────────────┼──────┘
                                      │
            ┌─────────────────────────┴─────────────────────┐
            │ FlightProvider                                │
            ├───────────────────────────────────────────────┤
            │ MockFlightProvider     (when FLIGHT_PROVIDER  │
            │                         === "mock" or unset)  │
            │ DuffelFlightProvider   (when FLIGHT_PROVIDER  │
            │                         === "duffel")         │
            └───────────────────────────────────────────────┘
```

Provider is chosen once at boot in `server.ts` based on `FLIGHT_PROVIDER` and `DUFFEL_API_KEY`. If `FLIGHT_PROVIDER=duffel` but key is missing, server fails fast at boot — never silently downgrades to mock.

## Duffel Shopping Flow

We do not book. We only shop. The minimal path:

1. `POST /air/offer_requests` with slices `[{origin, destination, departure_date}]`, `passengers: [{ type: "adult" }]`, `cabin_class`. Returns an `offer_request` with embedded offers (or set `return_offers: false` and list separately — we use embedded for one round-trip).
2. From the response, take the *cheapest* `offer` per slice, extract:
   - `total_amount` + `total_currency` → `priceCents` (convert via FX or restrict to USD)
   - `slices[0].duration` (ISO 8601 like `"PT8H30M"`) → `durationMin`
   - `slices[0].segments.length - 1` → `stops`
   - `slices[0].segments[0].marketing_carrier.iata_code` → `carrier`
3. One `PriceQuery` = one `offer_request`. For N queries, N parallel requests with `Promise.allSettled` so a single failure doesn't poison the batch.

**Currency caveat:** Duffel returns prices in any of ~30 currencies. We restrict requests to USD via the `currency` field on offer_request when supported, or we filter offers to `total_currency === "USD"`. Non-USD offers are dropped (partial-success surfaces this).

## File Structure (delta from Plan 2)

```
apps/backend/src/
├── env.ts                                       # add FLIGHT_PROVIDER, DUFFEL_API_KEY
├── server.ts                                    # provider selection
├── plugins/auth.ts                              # Task 0: try/catch fix
└── services/flights/
    ├── provider.ts                              # interface unchanged; Mock unchanged
    ├── duffel/
    │   ├── index.ts                             # DuffelFlightProvider class
    │   ├── client.ts                            # thin SDK wrapper (DI seam for tests)
    │   ├── mappers.ts                           # PriceQuery↔Duffel; Offer→PriceResult
    │   └── errors.ts                            # error classification (retryable vs fatal)
    └── index.ts                                 # FlightService unchanged

apps/backend/tests/services/flights/duffel/
├── mappers.test.ts                              # pure mapper tests (no HTTP)
├── provider.test.ts                             # MSW-mocked HTTP tests
└── fixtures/
    ├── offer_request.success.json               # captured from Duffel docs / test mode
    ├── offer_request.no_offers.json
    └── offer_request.rate_limit.json
```

---

## Task 0: Fix auth plugin 500-on-missing-key gap (carry-over)

**Files:**

- Modify: `apps/backend/src/plugins/auth.ts`
- Modify (if needed): `apps/backend/tests/plugins/auth.test.ts`

- [ ] **Step 1:** Read `apps/backend/src/plugins/auth.ts` and confirm `clerk.authenticateRequest()` is the throwing call. Update the line reference here if it has drifted.
- [ ] **Step 2:** Wrap the call in `try/catch`. On catch, throw `ApiError.unauthorized()` (or whatever `lib/ApiError.ts` exposes — verify). Log the original error at `debug` so we keep the signal.
- [ ] **Step 3:** Add a test: with `CLERK_PUBLISHABLE_KEY` unset and a bogus bearer token, expect `401` with the `ApiError` envelope, not `500`.
- [ ] **Step 4:** `pnpm --filter @smartroute/backend test` green.

---

## Task 1: Add Duffel SDK and env

**Files:**

- Modify: `apps/backend/package.json` (add `@duffel/api`)
- Modify: `apps/backend/src/env.ts`
- Modify: `apps/backend/.env.example`
- Modify: `README.md` (Duffel setup section)

- [ ] **Step 1:** Install:

```bash
pnpm --filter @smartroute/backend add @duffel/api
```

Pin the version that ships at install time (do not pre-pin in this doc — Duffel's SDK is on a regular cadence and we should take whatever is current).

- [ ] **Step 2:** Extend `env.ts` zod schema:

```ts
FLIGHT_PROVIDER: z.enum(['mock', 'duffel']).default('mock'),
DUFFEL_API_KEY: z.string().optional(),
DUFFEL_BASE_URL: z.string().url().default('https://api.duffel.com'),
```

Then add a refinement: when `FLIGHT_PROVIDER === 'duffel'`, `DUFFEL_API_KEY` is required. If missing, env parsing fails at boot with a clear error.

- [ ] **Step 3:** Update `apps/backend/.env.example` with the new vars and a comment pointing at https://app.duffel.com/access/sign-up.

- [ ] **Step 4:** README section: "Using real flight data (Duffel)" — 5 bullets: sign up, copy test-mode key, paste into `apps/backend/.env`, set `FLIGHT_PROVIDER=duffel`, restart.

---

## Task 2: DuffelFlightProvider — client + mappers (no HTTP yet)

**Files:**

- Create: `apps/backend/src/services/flights/duffel/client.ts`
- Create: `apps/backend/src/services/flights/duffel/mappers.ts`
- Create: `apps/backend/tests/services/flights/duffel/mappers.test.ts`

- [ ] **Step 1: `client.ts`** — a tiny wrapper around `Duffel` from `@duffel/api`. Exports `createDuffelClient(apiKey, baseUrl)` returning the SDK instance. This exists purely as a DI seam: tests pass a fake; prod passes the real one.

- [ ] **Step 2: `mappers.ts`** — pure functions:

```ts
export function queryToOfferRequest(q: PriceQuery): CreateOfferRequest { ... }
export function bestOfferToPriceResult(
  request: CreateOfferRequest,
  offers: Offer[]
): PriceResult | null
```

- Cabin map: our `CabinClass` ("economy"|"premium_economy"|"business"|"first") → Duffel's `cabin_class` ("economy"|"premium_economy"|"business"|"first"). Direct passthrough; document any rename if Duffel ever diverges.
- `bestOfferToPriceResult`: filter offers where `total_currency !== "USD"` (or skip if we set `currency=USD` on request and Duffel honors it), sort by `total_amount` ascending, pick `[0]`. Return `null` if none survive.
- Duration: parse ISO 8601 duration (`PT8H30M`) to minutes. Write a small parser (no `luxon` dep).
- Price: `Math.round(parseFloat(total_amount) * 100)` for cents. Duffel uses string amounts to avoid float issues — preserve that intent.
- Stops: `segments.length - 1`. Multi-slice journeys: we only send single-slice requests, so this is unambiguous.
- Carrier: prefer `slices[0].segments[0].marketing_carrier.iata_code`; fallback to operating carrier; finally `null`.

- [ ] **Step 3: `mappers.test.ts`** — pure-function tests, no HTTP. Cover:
  - Happy path (USD offer, single segment).
  - Multi-segment offer → `stops > 0`.
  - All offers non-USD → returns `null`.
  - Malformed duration → throws or returns `null` (decide; document choice).
  - Cabin class passthrough for all four enum values.

---

## Task 3: DuffelFlightProvider — HTTP layer with MSW

**Files:**

- Create: `apps/backend/src/services/flights/duffel/index.ts`
- Create: `apps/backend/src/services/flights/duffel/errors.ts`
- Create: `apps/backend/tests/services/flights/duffel/provider.test.ts`
- Create: `apps/backend/tests/services/flights/duffel/fixtures/*.json`

- [ ] **Step 1: `errors.ts`** — classify Duffel errors:

```ts
export type DuffelErrorClass = 'rate_limit' | 'auth' | 'validation' | 'network' | 'unknown';
export function classify(err: unknown): DuffelErrorClass { ... }
```

The SDK throws `DuffelError` with a `meta.status` and `errors[].code`. Map:
- 401/403 → `auth` (fatal — surface as `ApiError.providerAuth()`)
- 422 → `validation` (often "no offers found"; treat as empty result, not throw)
- 429 → `rate_limit` (retryable; one retry with backoff; then throw)
- network/timeouts → `network` (retryable; one retry; then throw)
- other → `unknown` (throw)

- [ ] **Step 2: `index.ts`** — `DuffelFlightProvider implements FlightProvider`:

```ts
class DuffelFlightProvider {
  constructor(private duffel: Duffel, private logger: Logger) {}
  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    const results = await Promise.allSettled(queries.map((q) => this.fetchOne(q)));
    // For each settled: fulfilled non-null → push; rejected → log+skip (partial success).
    // Auth errors short-circuit: if ANY result was an auth failure, throw immediately
    //  so FlightService's stale-fallback kicks in cleanly.
  }
}
```

Decision to document inline: `Promise.allSettled` + skip-on-failure gives us *partial success*, which is exactly what `FlightService.partial` was designed for. Do not switch to `Promise.all`.

- [ ] **Step 3: Fixtures.** Run a real test-mode call once locally with a real key and `curl -s 'https://api.duffel.com/...'`, capture three responses, scrub any PII (none expected, but check), commit as JSON. Document the capture date and Duffel API version (header `Duffel-Version`) in a `README.md` inside `fixtures/`.

- [ ] **Step 4: `provider.test.ts`** — MSW intercepts `https://api.duffel.com/air/offer_requests`. Cases:
  - 2 queries, both succeed → 2 `PriceResult`s.
  - 2 queries, one 422 (no offers) → 1 `PriceResult`, no throw.
  - All queries 401 → throws (so cache stale-fallback fires).
  - 429 once then 200 → retried, succeeds.
  - 429 twice → throws after retry.

- [ ] **Step 5:** `pnpm --filter @smartroute/backend test services/flights/duffel` green.

---

## Task 4: Wire provider selection at boot

**Files:**

- Modify: `apps/backend/src/server.ts` (or wherever `FlightService` is constructed)
- Modify: any existing test that constructs `FlightService` directly

- [ ] **Step 1:** Add a `createFlightProvider(env, logger)` factory:

```ts
function createFlightProvider(env: Env, logger: Logger): FlightProvider {
  if (env.FLIGHT_PROVIDER === 'duffel') {
    const duffel = createDuffelClient(env.DUFFEL_API_KEY!, env.DUFFEL_BASE_URL);
    return new DuffelFlightProvider(duffel, logger);
  }
  return new MockFlightProvider();
}
```

- [ ] **Step 2:** Log at boot which provider was selected (one info line). Helps debugging when `.env` is wrong.
- [ ] **Step 3:** Existing tests that wanted Mock should not break — Mock remains the default. Run full backend test suite: green.

---

## Task 5: End-to-end smoke against test mode

**Files:** none (manual verification)

- [ ] **Step 1:** Sign up at https://app.duffel.com (no card required). Copy a `duffel_test_*` key from Settings → Access tokens.
- [ ] **Step 2:** Paste into `apps/backend/.env`, set `FLIGHT_PROVIDER=duffel`, restart backend.
- [ ] **Step 3:** From iPhone (Expo Go), run a real query — pick a well-known route Duffel definitely has, e.g. LHR→JFK on a date 3 weeks out. Expect real airline names and prices in the results screen.
- [ ] **Step 4:** Run an obscure route (e.g. small regional airports) — expect partial-success or empty. App should not crash; results screen should show whatever the optimizer made of it.
- [ ] **Step 5:** Stop the backend mid-query — app should show the "network request timed out" path (same as before) without changing.

If anything in steps 3-4 produces a 500, the most likely culprit is a mapper edge case (currency, duration parsing, missing carrier). Add a test for the exact payload before fixing.

---

## Task 6: Docs + CI

**Files:**

- Modify: `README.md` (root)
- Modify: `apps/backend/README.md` if it exists
- Modify: `.github/workflows/ci.yml` if Duffel calls would ever run in CI (they should NOT — CI stays on Mock)

- [ ] **Step 1:** README: "Real flight data" section with the 5-step setup.
- [ ] **Step 2:** Confirm `FLIGHT_PROVIDER` is unset in CI so the Mock is used. CI should never call Duffel — no key in the workflow, no env override. Add a one-line comment in the CI job explaining this.
- [ ] **Step 3:** Final commit: `feat(backend): add Duffel flight provider with provider selection`. Push, watch CI go green.

---

## Out of scope (intentionally)

- **Bookings.** We do not call `/air/orders`. Test mode would let us, but it adds confirmation flows, payment intents, and order management — separate plan if we ever want it.
- **Multi-passenger.** We hardcode `[{ type: "adult" }]`. Multi-pax changes Duffel pricing and our optimizer scoring; that's a UX-led change, not infra.
- **Caching tiers.** The Plan 2 `PriceCache` (6h freshness) is sufficient. Duffel's own cache headers / offer expiry are not honored — offers technically expire in ~20min, but we never book, so a stale cached *price* is fine for optimizer scoring.
- **Currency conversion.** USD only. Plan 5 (deploy) can revisit if we want INR/EUR users.
- **Webhook handling.** Duffel offers webhooks for order lifecycle; irrelevant without bookings.

## Risks

1. **Duffel test-mode availability.** Test API has occasional gaps in inventory for obscure routes — symptoms look like our bugs. Mitigation: Task 5 step 4 explicitly checks this case; document expected behavior so we don't chase ghosts.
2. **Currency surprises.** A route we expected in USD comes back EUR. Mitigation: explicit filter + log dropped offers at `warn`.
3. **Rate limits.** Duffel test mode is rate-limited (last documented: 5 req/sec). The optimizer fires `routes.length * cities.length` queries — for a 4-city trip, ~12 requests. Our cache absorbs repeat queries, but a cold-cache demo could brush the limit. Mitigation: in `DuffelFlightProvider`, optional `pLimit(5)` around `fetchOne` — add only if Task 5 shows it's needed.
4. **SDK shape drift.** `@duffel/api` updates. Mitigation: types are imported, so breakage is compile-time; we'll see it.

## Definition of done

- [ ] Backend boots with `FLIGHT_PROVIDER=duffel` and a test key, fails fast without one.
- [ ] All existing tests still green; new mappers + provider tests added.
- [ ] iPhone smoke test on LHR→JFK shows real-looking carriers + prices.
- [ ] CI green on a commit that has the new code but Mock provider in effect.
- [ ] README explains the 5-step setup.
- [ ] Memory updated: `project_smartroute.md` notes Plan 4 done and which provider.
