# Attraction data coverage

Where the `OpeningHours` and `VisitDuration` values in the Attraction dataset came from. This
is the raw material for the thesis methodology section: it is the honest account of how much of
the dataset is sourced, how much is our own judgement, and how much rests on a documented
assumption.

**Generated** — do not edit by hand. Regenerate with
`pnpm --filter @smartroute/backend exec tsx scripts/attraction-data-coverage.ts` after changing
any seed file.

Across **95 attractions** in **8 cities**.

## OpeningHours

| Basis                                |  Count |   Share |
| ------------------------------------ | -----: | ------: |
| OSM-sourced                          |      5 |      5% |
| Manually filled, with a cited source |      0 |      0% |
| Genuinely unconstrained (`24/7`)     |      8 |      8% |
| Deliberately left unknown            |      0 |      0% |
| Not yet examined                     |     82 |     86% |
| **Decided**                          | **13** | **14%** |

The three hand-made bases are distinct on purpose. "Genuinely unconstrained" is a fact about the
attraction — a square has no gates. "Deliberately left unknown" is a fact about our data — we
looked and there was nothing to record. "Not yet examined" is neither, and is the number that
has to reach zero before the dataset is finished.

## Still to decide (82)

| City | Attraction                                 | Category   |
| ---- | ------------------------------------------ | ---------- |
| IST  | Blue Mosque (Sultanahmet Camii)            | RELIGIOUS  |
| IST  | Basilica Cistern                           | HISTORICAL |
| IST  | Galata Tower                               | VIEWPOINT  |
| IST  | Süleymaniye Mosque                         | RELIGIOUS  |
| IST  | Dolmabahçe Palace                          | HISTORICAL |
| IST  | Hippodrome & Sultanahmet Square            | HISTORICAL |
| BER  | Brandenburg Gate                           | LANDMARK   |
| BER  | Reichstag Building                         | LANDMARK   |
| BER  | Museum Island                              | MUSEUM     |
| BER  | Memorial to the Murdered Jews of Europe    | HISTORICAL |
| BER  | East Side Gallery                          | HISTORICAL |
| BER  | Berlin Wall Memorial — Bernauer Straße     | HISTORICAL |
| BER  | Berliner Dom                               | RELIGIOUS  |
| BER  | TV Tower — Alexanderplatz                  | VIEWPOINT  |
| BER  | Tiergarten                                 | PARK       |
| BER  | Charlottenburg Palace                      | HISTORICAL |
| WAW  | Old Town Market Square                     | LANDMARK   |
| WAW  | Royal Castle                               | HISTORICAL |
| WAW  | Łazienki Park                              | PARK       |
| WAW  | Warsaw Uprising Museum                     | MUSEUM     |
| WAW  | POLIN Museum of the History of Polish Jews | MUSEUM     |
| WAW  | Palace of Culture and Science              | VIEWPOINT  |
| WAW  | Wilanów Palace                             | HISTORICAL |
| WAW  | Copernicus Science Centre                  | MUSEUM     |
| WAW  | Krakowskie Przedmieście                    | LANDMARK   |
| WAW  | Holy Cross Church                          | RELIGIOUS  |
| WAW  | Warsaw Barbican                            | HISTORICAL |
| BUD  | Hungarian Parliament Building              | LANDMARK   |
| BUD  | Buda Castle                                | HISTORICAL |
| BUD  | Fisherman's Bastion                        | VIEWPOINT  |
| BUD  | Matthias Church                            | RELIGIOUS  |
| BUD  | St. Stephen's Basilica                     | RELIGIOUS  |
| BUD  | Széchenyi Chain Bridge                     | LANDMARK   |
| BUD  | Széchenyi Thermal Baths                    | LANDMARK   |
| BUD  | Great Market Hall                          | MARKET     |
| BUD  | Gellért Hill & Citadella                   | VIEWPOINT  |
| BUD  | Dohány Street Synagogue                    | RELIGIOUS  |
| BUD  | Shoes on the Danube Bank                   | HISTORICAL |
| LHR  | Tower of London                            | HISTORICAL |
| LHR  | Tower Bridge                               | LANDMARK   |
| LHR  | British Museum                             | MUSEUM     |
| LHR  | Westminster Abbey                          | RELIGIOUS  |
| LHR  | Big Ben & Houses of Parliament             | LANDMARK   |
| LHR  | Buckingham Palace                          | LANDMARK   |
| LHR  | London Eye                                 | VIEWPOINT  |
| LHR  | National Gallery & Trafalgar Square        | MUSEUM     |
| LHR  | St Paul's Cathedral                        | RELIGIOUS  |
| LHR  | Hyde Park                                  | PARK       |
| LHR  | Borough Market                             | MARKET     |
| LHR  | Natural History Museum                     | MUSEUM     |
| CDG  | Eiffel Tower                               | LANDMARK   |
| CDG  | Louvre Museum                              | MUSEUM     |
| CDG  | Notre-Dame Cathedral                       | RELIGIOUS  |
| CDG  | Sacré-Cœur & Montmartre                    | RELIGIOUS  |
| CDG  | Arc de Triomphe                            | LANDMARK   |
| CDG  | Champs-Élysées                             | LANDMARK   |
| CDG  | Musée d'Orsay                              | MUSEUM     |
| CDG  | Sainte-Chapelle                            | RELIGIOUS  |
| CDG  | Luxembourg Gardens                         | PARK       |
| CDG  | Panthéon                                   | HISTORICAL |
| CDG  | Centre Pompidou                            | MUSEUM     |
| CDG  | Trocadéro                                  | VIEWPOINT  |
| FCO  | Colosseum                                  | HISTORICAL |
| FCO  | Roman Forum & Palatine Hill                | HISTORICAL |
| FCO  | Pantheon                                   | HISTORICAL |
| FCO  | Vatican Museums & Sistine Chapel           | MUSEUM     |
| FCO  | St. Peter's Basilica                       | RELIGIOUS  |
| FCO  | Castel Sant'Angelo                         | HISTORICAL |
| FCO  | Galleria Borghese                          | MUSEUM     |
| FCO  | Campo de' Fiori                            | MARKET     |
| FCO  | Trastevere                                 | LANDMARK   |
| BCN  | Sagrada Família                            | RELIGIOUS  |
| BCN  | Park Güell                                 | PARK       |
| BCN  | Casa Batlló                                | LANDMARK   |
| BCN  | Casa Milà — La Pedrera                     | LANDMARK   |
| BCN  | Gothic Quarter & Barcelona Cathedral       | HISTORICAL |
| BCN  | La Boqueria Market                         | MARKET     |
| BCN  | Picasso Museum                             | MUSEUM     |
| BCN  | Montjuïc & Magic Fountain                  | VIEWPOINT  |
| BCN  | Palau de la Música Catalana                | LANDMARK   |
| BCN  | Bunkers del Carmel                         | VIEWPOINT  |
| BCN  | Barcelona Beach — Barceloneta              | PARK       |

## Assumed opening windows

Scheduled against an assumed window: **82 of 95** (86%) — every Attraction whose `OpeningHours` we do not
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
| MUSEUM             | 10:00        | 18:00         |                   13 |
| HISTORICAL         | 09:00        | 18:00         |                   19 |
| RELIGIOUS          | 08:00        | 18:00         |                   14 |
| MARKET             | 09:00        | 19:00         |                    4 |
| PARK               | 08:00        | 20:00         |                    6 |
| VIEWPOINT          | 09:00        | 21:00         |                    9 |
| LANDMARK           | 08:00        | 20:00         |                   17 |

Attractions whose hours we _do_ hold — including the ones recorded as genuinely unconstrained
(`24/7`) — are never touched by this table and never marked as assumed. Note also what this
does not do: a published weekly schedule is honoured at the level of _which day_ a visit falls
on, not which hour of it (see `closures.ts`).

## VisitDuration

Curated per attraction: **0 of 95** (0%). The remaining
**95** fall back to the per-`AttractionCategory` default at read time.

No Places provider publishes a typical-visit-duration field — verified across Google Places,
Foursquare, OpenTripMap and OSM in `2026-08-09-places-api-selection.md` — so both the curated
values and this table are our own data, and a methodological choice the thesis has to justify
rather than a sourced figure.

| AttractionCategory | Default minutes | Attractions using it |
| ------------------ | --------------: | -------------------: |
| MUSEUM             |             120 |                   13 |
| HISTORICAL         |              90 |                   21 |
| RELIGIOUS          |              45 |                   16 |
| PARK               |              60 |                    6 |
| VIEWPOINT          |              45 |                    9 |
| MARKET             |              60 |                    6 |
| LANDMARK           |              30 |                   24 |

The values separate enclosed, ticketed visits from pass-through stops: an afternoon in a museum,
five minutes photographing a fountain. They are deliberately conservative, and a curated
per-attraction value overrides them wherever the default would be visibly wrong — which is
exactly where a major museum and a small chapel share an `AttractionCategory` but not a
realistic visit length.
