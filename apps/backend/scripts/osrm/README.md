# Self-hosted OSRM (foot profile)

Real pedestrian travel times for Itinerary generation. Chosen over every hosted routing API in
[ADR-0005](../../../../docs/adr/0005-osm-geo-stack-google-maps-platform-excluded.md): the deciding
properties are that ODbL permits storing the data indefinitely, and that a pinned extract makes
thesis results re-derivable after submission, which no hosted provider can offer.

The backend never requires this. `WALKING_PROVIDER` defaults to `mock`, so tests, CI and a fresh
clone all work with no container running — the mock's straight-line-plus-detour times are
deterministic but will happily walk across the Golden Horn, which is the whole reason this exists.

## Build the extract

```bash
cd apps/backend
./scripts/osrm/prepare-extract.sh          # all eight seeded cities
./scripts/osrm/prepare-extract.sh IST      # one city — enough to develop against
```

Requires Docker, Node and curl on the host; the OSM tooling and OSRM themselves run in pinned
containers. Budget a few hundred MB of download per city and roughly ten minutes for the full set.
Output lands in `apps/backend/data/osrm/`, which is gitignored.

It runs in a 2 GB Docker VM — colima's and Docker Desktop's default on macOS — which is why the clip
uses `osmconvert` rather than the more usual `osmium extract`: the latter is OOM-killed on a
country-sized region at that size.

## Run it

```bash
docker compose --profile osrm up -d osrm   # from the repo root
```

The service sits behind a compose profile, so a plain `docker compose up -d` still means "postgres"
and does not crash-loop on a clone that has no extract yet. Then in `apps/backend/.env`:

```
WALKING_PROVIDER=osrm
OSRM_BASE_URL=http://localhost:5050
```

## What the recipe does

1. **Download** — one Geofabrik region per city, at the pinned dated snapshot in `regions.json`.
2. **Clip** — each region to that city's bounding box, derived by `city-bboxes.mjs` from the seeded
   Attraction coordinates plus `padDegrees` of margin.
3. **Merge** — the per-city boxes into one `merged.osm.pbf`.
4. **Preprocess** — `osrm-extract` with `foot-smartroute.lua`, then `osrm-partition` and
   `osrm-customize` for the MLD pipeline.
5. **Record** — a gitignored `PROVENANCE.txt` next to the graph (snapshot date, image tag, per-city
   bounding boxes, source checksums), plus `checksums.txt` in this directory, which **is committed**.

`checksums.txt` is the half of provenance that has to live in the repo. Geofabrik keeps dated
regional extracts for roughly 90 days, so `turkey-260815.osm.pbf` will 404 well before this thesis
is submitted — at which point "re-derivable from the pinned snapshot" only means something if a
substitute copy can be checked against the original. A run only rewrites the lines for the cities it
built, so `prepare-extract.sh IST` leaves the other seven records intact. **Commit it after a run.**

Three things are pinned deliberately, and all three matter for reproducibility:

- **The snapshot date, not `-latest`.** `-latest` moves daily, so a walking time measured today would
  not be re-derivable tomorrow. Bumping `snapshot` in `regions.json` is a deliberate act — record the
  new date in the table below when you do.
- **The OSRM image tag.** The `.osrm` file format is version-specific; `docker-compose.yml` and
  `prepare-extract.sh` must name the same tag or the service aborts at startup.
- **The bounding boxes are derived, never hand-listed.** A hand-maintained bbox list drifts from
  `attractions.json` silently, and the failure mode is an attraction sitting just outside the extract
  that routes to `null` at runtime.

Only Istanbul is recorded in `checksums.txt` so far — it is the only city built and verified to date.
The other seven get their line the first time someone runs the recipe for them.

## Provenance

| Field    | Value                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Source   | Geofabrik regional extracts of OpenStreetMap                                                           |
| Snapshot | `260815` (2026-08-15), dated files — not `-latest`                                                     |
| Regions  | `regions.json` — turkey, berlin, mazowieckie, hungary, greater-london, ile-de-france, centro, cataluna |
| Routing  | OSRM `ghcr.io/project-osrm/osrm-backend:v6.0.0`, `foot-smartroute.lua`, MLD                            |
| Licence  | ODbL — © OpenStreetMap contributors                                                                    |

ODbL attribution is required wherever this data is displayed or published (ADR-0005). Share-alike
under §4.4 attaches the moment the repo goes public, the dataset appears in the thesis, or the app
ships.

## The profile carries one deviation: no ferries

`foot-smartroute.lua` is OSRM's stock foot profile with ferry routing removed. The file itself
records the full reasoning; the short version is that the stock profile routed Galata Tower →
Dolmabahçe Palace over a Bosphorus sightseeing cruise at 48 km/h and reported it as walking. A
WalkingRoute is defined as a pedestrian route, so a boat cannot be part of one at any speed.

## Verifying it works

```bash
./scripts/osrm/prepare-extract.sh IST
docker compose --profile osrm up -d osrm
WALKING_PROVIDER=osrm pnpm --filter @smartroute/backend exec vitest run tests/services/itinerary/osrm.live.test.ts
```

Skipped unless `WALKING_PROVIDER=osrm` is set, so CI never needs the container. Istanbul alone is
enough — every assertion is about it.

Measured on the `260815` extract, all five pass:

| Check                | Result                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| Golden Horn crossing | Hagia Sophia → Galata Tower walks 541 m over **Galata Köprüsü**, mode `walking` |
| Barrier cost         | 2.09 km apart, **3.17 km on foot** (1.52×) — 39 min against the mock's 33       |
| Control, same bank   | Spice Bazaar → Hagia Sophia stays within the mock's 1.3 detour factor           |
| No ferries           | All 66 seeded Istanbul pairs travel at 5.0 km/h                                 |
| Table shape          | 12×12, zero diagonal, every pair routable                                       |

Note that the ticket estimated the crossing at "roughly double" the straight line. For the pair it
named — Süleymaniye Mosque → Galata Tower — the measured walk is 1.89 km against 1.34 km straight,
a 1.41× detour, because the Galata Bridge happens to sit almost on the direct line. The assertions
above use Hagia Sophia → Galata Tower instead, which crosses the same water with the detour actually
visible. The largest detour in the seeded set is not a water crossing at all: Hagia Sophia →
Topkapı Palace is 0.35 km apart and 1.28 km on foot (3.62×), because the palace coordinate sits
inside walled grounds that have to be walked around.
