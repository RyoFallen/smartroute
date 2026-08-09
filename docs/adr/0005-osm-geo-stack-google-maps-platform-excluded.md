# ADR-0005: Google Maps Platform excluded; the geo stack is OSM end to end

**Status:** accepted (2026-08-09)

## Context

Spec §8.2 named Google Places API as the "recommended" Places provider and §8.4 assumed "Google
Directions API with waypoint optimization" for walking-route optimization. Phase 7 (City Itinerary
Generation) is the first work that actually needs either: it requires per-attraction opening hours to
assign attractions to days, and pedestrian distances to order them within a day.

Investigating the choice against primary sources
(`docs/research/2026-08-09-places-api-selection.md`) surfaced three independent blockers, any one of
which rules Google out for this project.

**1. The data may not be stored.** The shipped `Attraction` model persists `name`, `description`,
`category`, `lat` and `lon` indefinitely. Google's master terms prohibit exactly that:

> **3.2.3(a) No Scraping.** Customer will not export, extract, or otherwise scrape Google Maps
> Content for use outside the Services. For example, Customer will not: (i) pre-fetch, index, store,
> reshare, or rehost Google Maps Content outside the services; … or (iii) copy and save business
> names, addresses, or user reviews.

The Service Specific Terms permit only two exceptions — place IDs indefinitely, and lat/lng for 30
days (§14.3). This binds regardless of which map renders, so no configuration makes Google a lawful
source for a seeded attractions table.

**2. Google content may not be paired with MapLibre.** ADR-0001 committed to MapLibre. The Service
Specific Terms forbid this for both products Phase 7 would need:

> **14.2 No use with a non-Google map.** Customer must not use Google Maps Content from the Places
> API in conjunction with a non-Google map.
>
> **19.2 No use with a non-Google map.** Customer must not use Google Maps Content from the Routes
> API in conjunction with a non-Google map.

This clause is boilerplate across essentially every Maps Platform API (Geocoding, Roads, Distance
Matrix, Route Optimization all carry an identical §x.2), so it closes the platform as a whole, not
just Places.

**3. The Directions API cannot be adopted at all.** Both the Directions API and the original Places
API became Legacy on 2025-03-01, and Legacy is not merely a deprecation warning:

> Legacy services are not available in new Cloud projects but remain fully supported for existing
> projects.

SmartRoute has no pre-existing Maps Platform Cloud project, so a project created today cannot enable
the product spec §8.4 was written against.

Sources retrieved 2026-08-09: [Maps Platform ToS](https://cloud.google.com/maps-platform/terms),
[Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms),
[Legacy products and features](https://developers.google.com/maps/legacy).

## Decision

Google Maps Platform is excluded from SmartRoute entirely — not merely for Places, but for routing
as well. The geo stack is OpenStreetMap end to end:

- **Opening hours** — OpenStreetMap via the Overpass API, seeded into the existing `Attraction`
  table. Measured coverage across the 95 curated attractions is 68/95 (72%), 92% for museums;
  remaining gaps are hand-filled. ODbL permits permanent storage, which is the deciding property.
- **Pedestrian distances** — self-hosted OSRM (foot profile) added to `docker-compose.yml`, fed by
  the eight city bounding boxes clipped and merged into one pinned extract. The preparation recipe is
  committed; the extract is not.
- **Route ordering** — computed in-house. At spec §7.3.3 intensity levels a day holds 3–8
  attractions and a city at most ~12, so exact TSP (Held–Karp, ~590k operations at n=12) is trivial
  and needs no external service.
- **Map rendering** — MapLibre, unchanged. ADR-0001 stands.

Foursquare was also rejected: its Pay-as-You-Go terms permit **no caching at all**, which is
stricter than Google's. OpenTripMap was rejected as stale (site © 2019, OpenAPI version 0.0.1) and
because its schema carries no opening-hours field.

## Consequences

- Spec §8.2 and §8.4 are superseded. §8.4's waypoint-optimization approach is replaced by in-process
  exact TSP; where spec text and this ADR disagree, this ADR wins.
- No vendor account, API key, quota or billing relationship exists for geo data. Itinerary generation
  runs fully offline and in CI, and thesis results are re-derivable from a pinned OSM extract — a
  reproducibility property no hosted provider could offer.
- ODbL attribution ("© OpenStreetMap contributors") is required wherever OSM-derived data is
  displayed or published. Share-alike under §4.4 does not currently apply because the repository is
  private, but it attaches the moment the repo goes public, the dataset appears in the thesis, or the
  app ships. OSM-derived hours are therefore kept in their own ODbL-marked seed file, separate from
  the hand-curated `attractions.json`, so provenance never has to be untangled retroactively.
- Per-attraction visit duration is unobtainable from any provider — verified absent from all four
  candidates' documented APIs. It is our own curated datum, with a documented per-`AttractionCategory`
  fallback. This is a methodological choice to justify in the thesis, since the spec presented it as
  API-supplied.
- Self-hosting OSRM adds an operational step (extract preparation) that a hosted API would not need.
  Accepted as the cost of reproducibility.
