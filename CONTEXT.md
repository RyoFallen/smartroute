# SmartRoute

Multi-city trip optimizer: the backend finds the cheapest city visiting order with real flight prices; the mobile app plans per-city itineraries personalized to the traveler's interests.

## Language

**InterestCategory**:
A user-facing category of travel interest (e.g. "Museums & Galleries", "Nightlife & Bars") that a traveler rates during onboarding. Describes what a _user likes_, not what an attraction is.
_Avoid_: category (unqualified), interest type

**AttractionCategory**:
The data-facing classification of an attraction (LANDMARK, MUSEUM, RELIGIOUS, PARK, VIEWPOINT, HISTORICAL, MARKET). Describes what an _attraction is_; related to InterestCategory only through an explicit mapping.
_Avoid_: category (unqualified)

**Interest**:
A traveler's rating of one InterestCategory: like (+1), neutral (0), or dislike (−1).
_Avoid_: preference (that word is reserved for trip-pacing settings)

**OptimizePreset**:
The traveler-facing optimizer preset on `POST /optimize` (`budget`, `time`, `comfort`, `balanced`) that selects the weight row of the GA's multi-objective fitness (cost / directness / travel time).
_Avoid_: preference (reserved for trip-pacing settings), profile

**OpeningHours**:
The published visiting window of an Attraction. Three states are distinct and must never be
conflated: _constrained_ (a specific weekly schedule), _always open_ (no restriction — typical of
squares, parks and streets), and _unknown_ (absent from our dataset). "Always open" is a fact about
the attraction; "unknown" is a fact about our data.
_Avoid_: hours (unqualified), availability

**AssumedOpeningWindow**:
The part of a day an Attraction of a given AttractionCategory is _assumed_ open for, used only where
its OpeningHours are unknown. Our own judgement, not a sourced figure — the OpeningHours twin of the
VisitDuration fallback — and always disclosed on the VisitSlot it placed. A _preference_, not a
constraint: where a stay leaves nowhere inside it, the visit is scheduled outside it and still
disclosed, because a guess must never be enforced harder than a published closure, which is itself
only ever flagged. Note the deliberate asymmetry it lives beside: OpeningHours we _do_ hold are
honoured at the level of which _day_ a visit falls on, not which hour of it.
_Avoid_: assumed hours, default hours, opening window (unqualified — that reads as a published one)

**VisitDuration**:
How long a traveler is expected to spend at one Attraction. Curated per attraction where known,
otherwise inferred from its AttractionCategory. This is our own datum — no external provider
publishes it.
_Avoid_: duration (unqualified — that word already means flight time on a FlightLeg), dwell time

### Trip pacing

**TripIntensity**:
The traveler's stored profile setting for how densely an itinerary should be scheduled (`RELAXED`,
`MODERATE`, `PACKED`). Set once on the profile; applies to every trip. It sets an _upper bound_ on
attractions per day, not a quota — a city with fewer available attractions than the bound yields a
lighter day, never a padded one.
_Avoid_: pace, density

**CityStay**:
The number of days a traveler plans to spend in one city of a multi-city trip (`perCityDays` on `POST /optimize`, one entry per city). Drives the optimizer's flight-date math and the trip planner's per-city duration input.
_Avoid_: duration, days (unqualified)

### Itinerary

**Itinerary**:
The day-by-day schedule of attraction visits generated for a saved Trip, one section per city in the
trip's visiting order. Always _derived_ from the Trip, the traveler's profile and the attraction
data — never authored or edited by the traveler.
_Avoid_: plan (that word means the flat must-go list served by `GET /trips/:id/plan`), schedule

**ItineraryDay**:
One calendar day of an Itinerary, belonging to exactly one city and holding an ordered sequence of
VisitSlots. A day may legitimately hold none — an evening arrival leaves no usable time.
_Avoid_: day (unqualified)

**VisitSlot**:
One scheduled visit to one Attraction within an ItineraryDay: which attraction, when it starts, and
how long the walk from the previous slot took.
_Avoid_: stop, activity, event

**WalkingRoute**:
The order in which one city's selected Attractions are walked — the shortest pedestrian route through
them, computed per city and then cut into contiguous per-day stretches. Distinct from _visiting
order_, which is reserved for the order of **cities** in a Trip; these are two different orderings
solved by two different algorithms (in-house Held–Karp here, the GA there).
_Avoid_: visiting order (that means the city order), tour, route (unqualified — that word already
means a flight itinerary option on `POST /optimize`)

**SchedulableWindow**:
The portion of a calendar day in which VisitSlots may be placed. Bounded by the traveler's wake-up
time and, on arrival and departure days, by the flight times plus transfer buffers.
_Avoid_: free time, availability

### Benchmark

**RecordedFare**:
A real one-way economy price between two curated cities' benchmark airport lists on one date — the cheapest fare a public
flight search's date grid shows, price only — read by hand and archived with a screenshot. It is the benchmark's only source of real prices, because the
flight provider's test mode returns synthetic fares.
_Avoid_: test fare, mock price (those are synthetic), quote

**NaiveOrder**:
The benchmark's baseline visiting order: start at the origin and always fly next to the nearest
unvisited city by great-circle distance. It is what a sensible traveler does with a map, not the
order the cities happen to be listed in.
_Avoid_: entry order, user order, default order

**CaptureSession**:
One continuous, timestamped sitting on one day in which every RecordedFare for the 56 curated city
pairs is read, followed by every scenario's competitor result. Prices from different sessions are
never mixed within one scenario's measurement.
_Avoid_: capture day (a day could hold two sessions), run, snapshot

**BenchmarkScenario**:
One frozen multi-city trip the benchmark prices: an origin with no stay, 4–7 visited curated cities
of which one is the pinned end city, a fixed CityStay for each, and one fixed departure date. Only
the order of the cities between the origin and the end city is optimized.
_Avoid_: test case, trip (a Trip is a traveler's saved plan), query

**CompetitorResult**:
Kiwi.com Nomad's cheapest all-flight itinerary for one BenchmarkScenario in one CaptureSession,
searched with the same airports, dates and stays. Its cheapest result in any transport mode is kept
beside it as context, never as the compared price.
_Avoid_: Nomad price (ambiguous between the two), competitor fare
