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

### Trip pacing

**TripIntensity**:
The traveler's stored profile setting for how densely an itinerary should be scheduled (`RELAXED`, `MODERATE`, `PACKED`). Set once on the profile; applies to every trip.
_Avoid_: pace, density

**CityStay**:
The number of days a traveler plans to spend in one city of a multi-city trip (`perCityDays` on `POST /optimize`, one entry per city). Drives the optimizer's flight-date math and the trip planner's per-city duration input.
_Avoid_: duration, days (unqualified)
