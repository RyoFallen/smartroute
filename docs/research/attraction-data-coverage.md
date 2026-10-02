# Attraction data coverage

Where the `OpeningHours` and `VisitDuration` values in the Attraction dataset came from. This
is the raw material for the thesis methodology section: it is the honest account of how much of
the dataset is sourced, how much is our own judgement, and how much rests on a documented
assumption.

**Generated** — do not edit by hand. Regenerate with
`pnpm --filter @smartroute/backend exec tsx scripts/attraction-data-coverage.ts` after changing
any seed file.

Across **94 attractions** in **8 cities**.

## OpeningHours

| Basis                                |  Count |    Share |
| ------------------------------------ | -----: | -------: |
| OSM-sourced                          |      5 |       5% |
| Manually filled, with a cited source |     50 |      53% |
| Genuinely unconstrained (`24/7`)     |     24 |      26% |
| Deliberately left unknown            |     15 |      16% |
| Not yet examined                     |      0 |       0% |
| **Decided**                          | **94** | **100%** |

The three hand-made bases are distinct on purpose. "Genuinely unconstrained" is a fact about the
attraction — a square has no gates. "Deliberately left unknown" is a fact about our data — we
looked and there was nothing to record. "Not yet examined" is neither, and is the number that
has to reach zero before the dataset is finished.

## Assumed opening windows

Scheduled against an assumed window: **15 of 94** (16%) — every Attraction whose `OpeningHours` we do not
hold, whether it was deliberately left unknown or has not been examined yet. Each affected
VisitSlot is returned with `hoursAssumed` set and is badged in the app, so a traveler can tell
an opening time we know from one we guessed.

This mirrors the `VisitDuration` fallback below and is our own judgement for the same reason —
no provider publishes a per-category opening window either. The alternative of dropping such
Attractions from the Itinerary was rejected: silently losing a must-go landmark for a data
reason the traveler cannot see is worse than an approximate opening time. The windows are
deliberately wide, because an assumed window is a plausibility bound, and one narrower than
reality would push a visit off a day it could genuinely have happened on.

They are a **preference, not a constraint**. A visit is placed inside its window wherever the
stay allows one, and outside it — still disclosed — where nothing does; enforcing it strictly
would reintroduce the same silent exclusion by the back door. A published closure, which is a
fact rather than a guess, is itself only ever flagged, and a guess must not outrank one.

| AttractionCategory | Assumed open | Assumed close | Attractions using it |
| ------------------ | ------------ | ------------- | -------------------: |
| MUSEUM             | 10:00        | 18:00         |                    2 |
| HISTORICAL         | 09:00        | 18:00         |                    4 |
| RELIGIOUS          | 08:00        | 18:00         |                    5 |
| MARKET             | 09:00        | 19:00         |                    1 |
| PARK               | 08:00        | 20:00         |                    0 |
| VIEWPOINT          | 09:00        | 21:00         |                    1 |
| LANDMARK           | 08:00        | 20:00         |                    2 |

Attractions whose hours we _do_ hold — including the ones recorded as genuinely unconstrained
(`24/7`) — are never touched by this table and never marked as assumed. Note also what this
does not do: a published weekly schedule is honoured at the level of _which day_ a visit falls
on, not which hour of it (see `closures.ts`).

## VisitDuration

Curated per attraction: **16 of 94** (17%). The remaining
**78** fall back to the per-`AttractionCategory` default at read time.

Of the curated values, **2** quote a visit length the operator publishes and
**14** are our own judgement, each with its rationale beside it in
`attractions.json` (`visitMinutesProvenance`). Operators almost never publish one: three of 52
official sites did (`2026-08-18-opening-hours-citations.md` §6). A judgement value overrides the
default only where the default is visibly wrong for that attraction — usually because the
category describes the outside of a building whose ticketed inside is what the hours encode.

| City | Attraction                       | Category   | Default | Curated | Basis     |
| ---- | -------------------------------- | ---------- | ------: | ------: | --------- |
| IST  | Topkapı Palace                   | HISTORICAL |      90 |     180 | judgement |
| BER  | Reichstag Building               | LANDMARK   |      30 |      60 | judgement |
| BUD  | Széchenyi Thermal Baths          | LANDMARK   |      30 |     120 | judgement |
| LHR  | Tower of London                  | HISTORICAL |      90 |     180 | published |
| LHR  | Tower Bridge                     | LANDMARK   |      30 |      75 | judgement |
| LHR  | Buckingham Palace                | LANDMARK   |      30 |     120 | judgement |
| CDG  | Eiffel Tower                     | LANDMARK   |      30 |     120 | judgement |
| CDG  | Louvre Museum                    | MUSEUM     |     120 |     180 | judgement |
| CDG  | Arc de Triomphe                  | LANDMARK   |      30 |      60 | judgement |
| FCO  | Roman Forum & Palatine Hill      | HISTORICAL |      90 |     150 | judgement |
| FCO  | Vatican Museums & Sistine Chapel | MUSEUM     |     120 |     180 | judgement |
| FCO  | Trastevere                       | LANDMARK   |      30 |      90 | judgement |
| BCN  | Sagrada Família                  | RELIGIOUS  |      45 |      90 | judgement |
| BCN  | Casa Batlló                      | LANDMARK   |      30 |      75 | judgement |
| BCN  | Casa Milà — La Pedrera           | LANDMARK   |      30 |      75 | judgement |
| BCN  | Palau de la Música Catalana      | LANDMARK   |      30 |      50 | published |

No Places provider publishes a typical-visit-duration field — verified across Google Places,
Foursquare, OpenTripMap and OSM in `2026-08-09-places-api-selection.md` — so both the curated
values and this table are our own data, and a methodological choice the thesis has to justify
rather than a sourced figure.

| AttractionCategory | Default minutes | Attractions using it |
| ------------------ | --------------: | -------------------: |
| MUSEUM             |             120 |                   10 |
| HISTORICAL         |              90 |                   18 |
| RELIGIOUS          |              45 |                   15 |
| PARK               |              60 |                    6 |
| VIEWPOINT          |              45 |                    9 |
| MARKET             |              60 |                    6 |
| LANDMARK           |              30 |                   14 |

The values separate enclosed, ticketed visits from pass-through stops: an afternoon in a museum,
five minutes photographing a fountain. They are deliberately conservative, and a curated
per-attraction value overrides them wherever the default would be visibly wrong — which is
exactly where a major museum and a small chapel share an `AttractionCategory` but not a
realistic visit length.
