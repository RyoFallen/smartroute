# ADR-0006: The competitor benchmark prices from hand-recorded fares, not the flight API

**Status:** accepted (2026-10-03)

## Context

Spec §11.5 assumed SmartRoute's side of the competitor benchmark would be priced by its own flight
provider. The only provider wired in is Duffel, and the project runs on a `duffel_test_*` key: test
mode returns the synthetic "Duffel Airways" carrier with invented fares. A GA optimizing against
invented prices, compared with live Kiwi.com Nomad prices, measures nothing. Live Duffel access was
ruled out by the owner on cost.

## Decision

The benchmark prices every BenchmarkScenario from **RecordedFares**: real one-way economy prices,
price only, read by hand from Google Flights' date grids during a timestamped **CaptureSession** and
transcribed into JSON committed to the repo. A `RecordedFareProvider` implements the existing
`FlightProvider` boundary, so the benchmark drives the shipped `OptimizerService.optimize()` path and
its single leg-dating rule, never a re-implementation of it (the #34 lesson: a duplicated oracle
agreed with the bug it was meant to catch).

## Considered options

- **Duffel live mode** — real fares through the existing integration, rejected on cost and account
  verification.
- **Synthetic only** — benchmark algorithm properties on generated prices and drop the competitor
  comparison. Cheapest, but loses the thesis's headline real-world result.
- **Another live API** (Amadeus Self-Service, Kiwi Tequila) — new provider work against programmes
  that have been closing to new sign-ups.

## Consequences

- **Scenarios are restricted to the 8 curated cities.** The 56 directed pairs are recorded once per
  session and shared by every scenario, which is what makes manual capture feasible.
- **Price is the only objective measured.** With constant duration and stops on every RecordedFare,
  `fitnessScores`' min–max normalisation zeroes the other terms, so every preset ranks by cost; the
  `time` and `comfort` presets are out of the benchmark's scope.
- **Skyscanner and Google Flights are no longer priced competitors.** Their only contribution was
  "naive order on their inventory", which the RecordedFares already price; ordering value is now
  GA vs **NaiveOrder** (nearest-neighbour), both on RecordedFares. They stay in §2.5's feature table.
- **Every scenario pins an end city.** Nomad cannot leave a trip's end open (verified 2026-10-03),
  so sizes moved up by one (origin + 4–7 visited) to keep the smallest scenarios non-trivial.
- **Airports are an explicit, identical list per city** on both platforms, because Nomad searches
  whole cities (including low-cost airports such as BVA, SAW, CIA, WMI) and SmartRoute's seeded
  airports do not.
- **New threats to validity** for the thesis: Google's calendar prices are cached estimates (measured
  by live spot checks each session), and transcription error (measured by a 5% audit).

## Amendment (2026-11-23): one CaptureSession, not three

CaptureSessions 2 (Sat 7 Nov) and 3 (Sat 14 Nov) were not run. They cannot be run late: the
protocol requires every flight to be at least 2 weeks after its session, and the frozen scenarios'
first flights leave on 28 Nov. A session captured now would price a different market (fares five
days before departure). Comparing it with Session 1 would mix two booking lead times, and the
difference would look like run-to-run variation. Redrawing the scenarios for later dates would
leave Session 1 incomparable too.

**Decision:** the benchmark reports **Session 1 (Sun 1 Nov 2026)** alone. The code is unchanged.
Every across-session median is over one session, and the report says so.

**Consequences for the thesis:**

- The results are one market snapshot, not a median over three. How stable they are over time is
  **not measured**. This is stated as a threat to validity, not hidden.
- What each session was meant to give is still there for the one session: the audit gives the
  transcription error rate, the spot-checks give calendar-vs-live drift, and Nomad results are
  either valid or excluded with reasons.
- The GA results that do not depend on prices (orders evaluated, optimality gap, wall-clock time)
  are deterministic given the fares. More sessions would not have changed what they show.
