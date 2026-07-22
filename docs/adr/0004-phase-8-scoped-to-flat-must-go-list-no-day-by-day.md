# ADR-0004: Phase 8 mobile UI scoped to the flat must-go list; day-by-day deferred

**Status:** accepted (2026-07-22)

## Context

Thesis spec §13 Phase 8 ("Trip Planning UI") lists "walking route map" and
"day-by-day navigation" among its deliverables. Both depend on Phase 7
(City Itinerary Generation: proximity clustering, daily schedule generator,
opening-hours handling, walking-route optimization) — none of which exists.
The only itinerary-adjacent backend endpoint today is `GET /trips/:id/plan`,
which returns a flat must-go-attractions list per city (no day slots, no
walking directions). The legacy Expo app's `TripPlanScreen` already
demonstrates this flat shape end-to-end.

## Decision

This round of mobile work (city picker, trip config with per-city
`CityStay` and a preset selector, `/optimize` results, saved trips,
trip detail, and the flat must-go plan view — porting and extending the
legacy Expo screens into KMP/Compose) builds against what the backend
**can** support today. Day-by-day scheduling and walking-route
visualization are explicitly deferred to a future phase, once Phase 7's
backend itinerary generation exists. Real map rendering (route polylines,
markers) is also deferred within this round — Results and Trip Detail show
routes as ordered lists/cards, not a rendered map — since evolving
`RouteMap` past its current data-free spike is itself a meaningful
cross-platform slice (MapLibre `expect`/`actual`, the iOS Swift-injection
bridge from ADR-0001).

## Consequences

- The shipped `TripPlanScreen` port will look identical in shape to the
  legacy app's — a flat per-city section list — not the spec's "day-by-day
  navigation." Comparing the app against the spec's Phase 8 checklist will
  show this as intentionally incomplete, not an oversight.
- Building real day-by-day UI later requires Phase 7 backend work first
  (clustering, scheduling, opening hours) — this ADR doesn't do that work,
  it only defers the UI that would consume it.
- Map rendering can be added later without restructuring: `RouteMap`
  already exists as an `expect`/`actual` composable taking no data; giving
  it a state-holder parameter (per the existing note in `AGENTS.md`) is an
  additive change, not a rewrite.
