# ADR-0003: Multi-airport city pricing resolves via Duffel metro codes, not client-side fan-out

**Status:** accepted (2026-07-22)

## Context

Some curated cities serve multiple airports (`London` → `LHR`/`LGW`,
`Paris` → `CDG`/`ORY`), recorded today as `City.altCodes`. Flight-price
queries built by `collectPriceTriples` used the trip's literal airport code
straight through to the flight provider, never considering the sibling
airports — a trip priced only against Heathrow could miss a cheaper Gatwick
fare Duffel would otherwise have found. Duffel's `offer_requests` API
accepts either a specific airport IATA code or a metro/city-level code (e.g.
`LON`, `PAR`), and resolves the latter across every constituent airport
server-side.

## Decision

We let Duffel do the multi-airport search itself rather than fanning out one
query per sibling airport and picking the cheapest client-side. `City`
gained a nullable `metroIata` field (set only for the two known
multi-airport cities); `DuffelFlightProvider` resolves each query's airport
code to `metroIata ?? iata` via one batched `City` lookup per `getPrices()`
call, and substitutes it **only** in the outbound Duffel request. The
returned `PriceResult` still carries the original query's airport code, so
`FlightService`'s cache keys and the optimizer's GA lookups (`legsFor`,
keyed by the trip's literal city codes) are untouched — the translation is
invisible outside `DuffelFlightProvider`.

Rejected alternative: query `iata` and every `altCodes` entry as separate
requests, compare client-side. This would have multiplied Duffel calls per
multi-airport city (compounding the concurrency-limiting problem solved
alongside this) for no benefit we currently use — nothing in the product
surfaces which specific airport a priced leg used.

## Consequences

- `DuffelFlightProvider` now depends on `PrismaClient` directly (mirroring
  `PriceCache`), whereas it was previously DB-free. `MockFlightProvider` and
  the `FlightProvider` interface are unaffected — the mock has no real-world
  metro concept to resolve.
- We cannot report which specific airport within a metro a priced itinerary
  actually uses (Duffel doesn't echo it back in a way we consume). If a
  future feature needs airport-level display (e.g. "flies out of Gatwick"),
  this decision should be revisited — a fan-out approach would need to
  replace the metro-code shortcut.
- Only cities with a populated `metroIata` are affected; single-airport
  cities resolve to themselves and see no behavior change.
