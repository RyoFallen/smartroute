# Places API selection for Phase 6/7

## 1. Question & date

**Researched:** 2026-08-09. All prices, quotas and terms below were retrieved on that date; every one of them is volatile and must be re-checked before it is quoted in the thesis.

**Decision under investigation:** spec §8.2 leaves the Places API "TBD" with three candidates — Google Places API ("recommended"), Foursquare API, OpenTripMap ("free"). This blocks Phase 7 (City Itinerary Generation).

The decision matters for exactly two fields. The shipped `Attraction` model (`apps/backend/prisma/schema.prisma`) has neither:

- **opening hours** — required by spec §7.3.1 step 4 ("Consider opening hours for day assignment")
- **per-attraction visit duration** — required by spec §7.3.2 step 5 ("Attraction duration")

So the operative question is not "which API has the best POI data" but **which provider supplies these two fields for landmark/museum/market POIs, and permits them to be stored in Postgres.**

A fourth option not listed in the spec — **OpenStreetMap direct, via the Overpass API** — is evaluated alongside the three, because it turned out to be the only candidate that satisfies both halves of that question.

### Volume assumption — verified

The spec's Phase 6 deliverables do list a live "attraction search endpoint", and spec §6.5 `GET /cities/:code/attractions` returns `"id": "place-123"`, `rating`, `reviewCount`, `typicalDuration` and `openingHours` — i.e. **the spec as written intends live, per-request Places API queries.** The spec's own Prisma schema (§5.2) has no `Attraction` model at all, which corroborates that reading.

**The shipped code does the opposite.** `PlanService` (`apps/backend/src/services/plan/index.ts`) reads attractions exclusively from Postgres via `this.db.city.findMany({ include: { attractions: ... } })`. There is no Places provider in the backend. The dataset is 8 cities and **95 hand-curated attractions** (`apps/backend/prisma/seed/attractions.json`, verified by count), seeded once.

Both cases were priced below. **Both come out at $0/month at this project's volume** on every candidate's free tier, which confirms the framing in the brief: per-call price is irrelevant here, and **the binding constraint is the terms of service on storage.**

---

## 2. Bottom line

**Recommendation: use OpenStreetMap directly (Overpass API) as the opening-hours source, seeded into the existing Postgres `Attraction` table, attributed under ODbL. Do not adopt Google Places. Derive visit duration from a category heuristic, because no provider sells it.**

Four findings invalidate spec assumptions. The first two are the loud ones.

### 2.1 SPEC-BREAKING — the Directions API in §8.4 cannot be adopted by this project at all

Spec §8.4 assumes "Google Directions API with waypoint optimization". The Directions API went to **Legacy status on March 1, 2025**, and Legacy status is not merely a deprecation warning:

> Legacy services are not available in new Cloud projects but remain fully supported for existing projects.
>
> — [Legacy products and features](https://developers.google.com/maps/legacy), retrieved 2026-08-09, page last updated 2026-07-31

SmartRoute has no pre-existing Google Maps Platform Cloud project. **A project created today cannot enable the Directions API.** The spec is targeting a product new projects can no longer adopt. Google's documented replacement is the **Routes API**; waypoint optimization there is `optimizeWaypointOrder`, billed on **Compute Routes Pro** ($10.00/1,000 after 5,000 free calls/month).

The same applies to the Places API itself: the **original Places API is also Legacy as of March 1, 2025**, replaced by **Places API (New)**. Any Google option here means Places API (New), not the product the spec's authors had in mind.

### 2.2 SPEC-BREAKING — Google Maps Platform content may not be used with MapLibre, which ADR-0001 already committed to

This is a systemic collision, not a Places-only problem. The Maps Service Specific Terms prohibit non-Google maps for **both** products Phase 7 would need:

> **14.2 No use with a non-Google map.** Customer must not use Google Maps Content from the Places API in conjunction with a non-Google map.
>
> **19.2 No use with a non-Google map.** Customer must not use Google Maps Content from the Routes API in conjunction with a non-Google map.
>
> — [Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), retrieved 2026-08-09, last modified 2026-06-10

SmartRoute renders **MapLibre** (ADR-0001, `demotiles` style). Under these clauses, Google Places content cannot be displayed alongside it, and neither can Routes API output such as an optimized walking order or polyline. Adopting either Google product would require either replacing the map with a Google map or accepting a terms violation.

### 2.3 The storage finding — Google Places forbids persisting exactly what the `Attraction` table stores

Only two things may be retained: `place_id`, indefinitely; and lat/lng, for 30 days. Everything else — names, opening hours, ratings, descriptions — must not be stored. The shipped `Attraction` model persists `name`, `description`, `category`, `lat`, `lon` permanently. **It could not lawfully be populated from Google Places.** Full clauses in §4.1.

### 2.4 Visit duration does not exist in any provider's public API

Checked against each provider's own field reference: **no** documented public API among the four candidates exposes a typical-visit-duration field. Google Maps' UI shows "People typically spend…", but it is absent from the Place resource, and harvesting it from the UI would breach the No Scraping clause. **Phase 7 must derive duration itself** — this hole exists no matter which provider is chosen, so it cannot be used to discriminate between them.

### 2.5 Consequence for Phase 7's route optimization

With Google off the table, walking-route optimization needs a different mechanism. Worth noting: at spec §7.3.3 intensity levels the per-day attraction count is **3–8**, so exact TSP over walking distances is trivially computable in-process (Held–Karp on n≤8 is ~2^8·8² operations) and needs no external API at all. The repo already owns a GA optimizer for the city-order problem. Choosing between in-process exact TSP, a self-hosted OSRM/Valhalla, or a hosted OSM routing service is a genuine design decision and is flagged in §6.

---

## 3. Decision table

All figures retrieved 2026-08-09.

| Option                    | Cost at this volume                                             | Opening hours                                               | Visit duration | Storage / caching permission                                                                 | Attribution burden                                                           | Maintenance status                                            |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Google Places (New)**   | $0 — 95 calls fits the 1,000/month Enterprise free cap          | Yes — `regularOpeningHours`, **Enterprise SKU**             | **No**         | **Blocking.** `place_id` indefinite; lat/lng 30 days; **everything else must not be stored** | High — Google logo, third-party + photo credits, ToU/Privacy Policy required | Current (Places API **New**; old Places API is Legacy)        |
| **Foursquare Places API** | $0 — 500 free Pro calls/month (from 2026-06-01)                 | Yes — `hours`, but **Premium tier only**                    | **No**         | **Blocking, worse.** PAYG/Sandbox: **"no caching permitted"**; only `fsq_place_id` unlimited | Medium — "Powered by Foursquare" visual or contextual credit                 | Active; legacy V3 endpoints deprecated **2026-05-15**         |
| **FSQ OS Places** (bonus) | $0 — bulk download, Apache 2.0                                  | **No — absent from the schema**                             | **No**         | **Unrestricted** — Apache 2.0, storable and redistributable                                  | Low — preserve `NOTICE.txt` in developer docs                                | Active, monthly refresh                                       |
| **OpenTripMap**           | $0 — free tier 5,000 req/day, 10 req/s, **non-commercial only** | **No — absent from the OpenAPI schema**                     | **No**         | **Permissive** — ODbL; explicitly "You can pre-fetch, index, store, or cache data"           | Low — ODbL attribution                                                       | **Stale** — site © 2019, spec version 0.0.1; API host live    |
| **OSM direct (Overpass)** | $0 — public Overpass instances, fair-use                        | **Yes — measured 68/95 (72%) of the seed set; museums 92%** | **No**         | **Permissive** — ODbL; private Postgres storage fine, no share-alike on published results    | Low — "© OpenStreetMap contributors" + link to openstreetmap.org/copyright   | **Actively maintained**; Overpass served live data 2026-08-09 |

---

## 4. Per-option detail

### 4.1 Google Places API (New)

#### Pricing SKUs and where opening hours sit

Places API (New) is billed by **field mask**: the fields you request determine the SKU. From [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) (retrieved 2026-08-09, last updated 2026-08-06), the tiers are Essentials IDs Only → Essentials → Pro → Enterprise → Enterprise + Atmosphere. Verbatim:

> The following fields trigger the Place Details Enterprise SKU:
> `currentOpeningHours`, `currentSecondaryOpeningHours`, `internationalPhoneNumber`, `nationalPhoneNumber`, `priceLevel`, `priceRange`, `rating`, `regularOpeningHours`, `regularSecondaryOpeningHours`, `transitStation`, `userRatingCount`, `websiteUri`

So **both opening-hours fields, and `rating`/`userRatingCount`, are Enterprise** — the second-most expensive tier. Note that `displayName` is Pro and `location` is Essentials, so a realistic request touching name + coords + hours + rating bills at Enterprise (the highest tier touched wins).

The same split holds for search: [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) (last updated 2026-08-06) lists `places.regularOpeningHours` and `places.rating` under "the Nearby Search Enterprise SKU".

Prices per 1,000 calls, from [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) (retrieved 2026-08-09, last updated 2026-07-31):

| SKU                                        | Free cap/month | Cap–100k | 100k–500k |
| ------------------------------------------ | -------------- | -------- | --------- |
| Place Details Essentials (IDs Only)        | Unlimited      | —        | —         |
| Place Details Essentials                   | 10,000         | $5.00    | $4.00     |
| Place Details Pro                          | 5,000          | $17.00   | $13.60    |
| **Place Details Enterprise**               | **1,000**      | $20.00   | $16.00    |
| Place Details Enterprise + Atmosphere      | 1,000          | $25.00   | $20.00    |
| Nearby Search Pro / Text Search Pro        | 5,000          | $32.00   | $25.60    |
| **Nearby Search / Text Search Enterprise** | **1,000**      | $35.00   | $28.00    |

#### Free allowance — the $200 credit is gone

The widely-cited "$200 monthly credit" no longer exists. Per the [billing FAQ](https://developers.google.com/maps/billing-and-pricing/faq) (retrieved 2026-08-09), as of **March 1, 2025** Google is "modifying the USD $200 monthly recurring credit by offering a free monthly usage threshold for each Core Services SKU" — 10,000/month for Essentials-tier SKUs, 5,000 for Pro, 1,000 for Enterprise. Caps are **per SKU, per month**, and usage is aggregated across all projects on a billing account.

**Cost at this project's volume:** 95 one-time Place Details Enterprise calls sit inside the 1,000/month free cap → **$0**. Even the live-query reading of Phase 6 is $0: one Nearby Search Enterprise call per city-itinerary generation gives ~1,000 free generations/month. Price is genuinely not the deciding factor.

#### Terms of service on caching — the governing clauses

This is the single most important finding in the report. Two documents govern, and they must be read together.

The master terms prohibit storage, then defer the exceptions to a second document:

> **3.2.3 Restrictions Against Misusing the Services.**
>
> **(a) No Scraping.** Customer will not export, extract, or otherwise scrape Google Maps Content for use outside the Services. For example, Customer will not: (i) pre-fetch, index, store, reshare, or rehost Google Maps Content outside the services; (ii) bulk download Google Maps tiles, Street View images, geocodes, directions, distance matrix results, roads information, places information, elevation values, and time zone details; (iii) copy and save business names, addresses, or user reviews; or (iv) use Google Maps Content with text-to-speech services.
>
> **(b) No Caching.** Customer will not cache Google Maps Content except as expressly permitted under the Maps Service Specific Terms.
>
> **(c) No Creating Content From Google Maps Content.** Customer will not create content based on Google Maps Content. For example, Customer will not: … (iv) use latitude/longitude values from the Places API as an input for point-in-polygon analysis; … or (vii) use Google Maps Content to improve machine learning and artificial intelligence models…
>
> — [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms) §3.2.3, retrieved 2026-08-09, last modified 2026-06-23

Note §3.2.3(a)(i) and (iii) specifically: **"pre-fetch, index, store"** and **"copy and save business names"**. A seed script that writes attraction names into Postgres is the named example of a prohibited act.

The permitted exceptions are narrow. There are exactly two:

> **3. Google ID Caching.** Customer may cache the Google ID values from the Services that return such field and allow caching, in accordance with its Documentation. For example, Customer may cache (a) `place_id` from Places API, Directions API, Geolocation API and Routes API…
>
> **14.3 Caching.** Customer may temporarily cache latitude and longitude values from the Places API for up to 30 consecutive calendar days, after which Customer must delete the cached latitude and longitude values.
>
> — [Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) §3 and §14.3, retrieved 2026-08-09, last modified 2026-06-10

The developer documentation states the same rule more bluntly:

> You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions, although the `place_id` is exempt from caching restrictions.
>
> Note that the place ID, used to uniquely identify a place, is exempt from the caching restrictions. You can therefore store place ID values **indefinitely**.
>
> — [Policies and attributions for Places API](https://developers.google.com/maps/documentation/places/web-service/policies), retrieved 2026-08-09, last updated 2026-07-31

**The place-ID-vs-other-content distinction, stated plainly:**

| Data                                                                                | May it be stored?                             |
| ----------------------------------------------------------------------------------- | --------------------------------------------- |
| `place_id`                                                                          | Yes, **indefinitely**                         |
| lat / lng                                                                           | Yes, but **max 30 consecutive calendar days** |
| `displayName`, `regularOpeningHours`, `rating`, `editorialSummary`, everything else | **No**                                        |

There is no clause permitting storage of opening hours for any duration. And §3.2.3(c) is a broad prohibition on **building anything derived** from Google Maps Content — it explicitly names using Places lat/lng as an input to further geometric analysis, which is close to what spec §7.3.1's k-means clustering step does.

**Consequence for SmartRoute:** a Google-Places-sourced `Attraction` table is not a licensing grey area. It is the specific thing the No Scraping clause forbids. The only compliant Google architecture is to store `place_id` only and re-fetch names and hours live on every request, never persisting them — which contradicts the shipped seeded-Postgres design, and still runs into §14.2's non-Google-map prohibition.

#### Attribution requirements

From the same [policies page](https://developers.google.com/maps/documentation/places/web-service/policies) (last updated 2026-07-31):

- **In the app:** "Attribution should take the form of the Google Maps logo whenever possible. In cases where space is limited, the text **Google Maps** is acceptable." It must be "always visible and legible. Never remove, hide, obscure, or modify it," and positioned "near the top or bottom of the content, and within the same visual container."
- **Without a Google map:** you "must include the Google logo, adhering to the provided style guidelines and attribution requirements."
- **Third-party data:** "the text of your attribution must say the name 'Google Maps' and the relevant data provider(s)."
- **Photos and reviews:** "You must always credit the author when displaying photos or reviews."
- Applications must also publish Terms of Use and a Privacy Policy incorporating Google's own.

**In a written document (the thesis):** Google publishes no attribution guideline for reproducing Places content in an academic paper, and the caching rules mean the underlying data may not be retained to be reproduced in the first place. Reproducing a table of Google-sourced opening hours in a published thesis is not covered by any exception I could locate — see §5.

#### Visit duration — definitively no

**No.** Verified against the [Place resource REST reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places) and the complete field-mask lists across all five SKU tiers. The only time-related fields are `regularOpeningHours`, `currentOpeningHours`, `regularSecondaryOpeningHours`, `currentSecondaryOpeningHours`, `timeZone`, `utcOffsetMinutes`, `openingDate`, plus `publishTime`/`visitDate` inside review objects. There is no dwell-time, average-visit or typical-duration field anywhere in the API surface.

The Google Maps consumer UI does surface "People typically spend 1–2 hr here" for many attractions. It is **not exposed in any documented public API**, and extracting it would fall squarely under §3.2.3(a) No Scraping.

### 4.2 Foursquare Places

#### Commercial status and pricing

The self-serve tier still exists and remains free to sign up for, on a pay-as-you-go basis. Two dated changes matter, both from [Upcoming Places API Changes](https://docs.foursquare.com/developer/reference/upcoming-changes) (retrieved 2026-08-09, page footer "Updated 2 months ago"):

> Please note the legacy V3 endpoints will be deprecated on **May 15, 2026**. You should migrate to the new Places API.
>
> Our new Places API endpoints, powered by FSQ OS Places, provide more accurate and up-to-date POI data…

> **Beginning June 1, 2026,** the following Places API & V2 Pro endpoint rates go into effect for all users:
>
> - **0 - 500 calls** – $0.00 CPM
> - **501 - 100,000 calls** – $15.00 CPM
> - **100,001 - 500,000 calls** – $12.00 CPM
> - **500,001 - 1,000,000 calls** – $9.00 CPM
>
> You will now receive **500** free Pro calls.

Also relevant: `/v2/venues/X/hours` is among the endpoints reclassified as **Premium** (the highest tier), and Premium pricing is not published on that page.

**Cost at this volume:** 95 calls sits inside 500 free Pro calls/month → **$0** (assuming hours can be obtained at Pro rates, which per below they cannot — Premium pricing is unpublished, so the true cost of an hours-bearing request is **unverified**).

#### Opening hours and visit duration

Hours exist, but only in the paid **Premium** tier. From [Places Pro and Premium Data Schemas](https://docs.foursquare.com/data-products/docs/places-pro-and-premium) (retrieved 2026-08-09, last updated 2026-02-12), `hours` is Premium-only — "a JSON representation of hours of operation" in 24-hour local time. Also Premium-only: `hours_popular`, `rating`, `popularity`, `price`, `description`, `tips`, `tastes`.

The [response fields reference](https://docs.foursquare.com/fsq-developers-places/reference/response-fields) describes `hours` as "An array containing the `regular` hours of operation, `is_local_holiday`, `open_now`, and a formatted `display` string."

**Visit duration: no.** `hours_popular` is "An array containing the hours during the week when a FSQ Place is most often visited" — that is _when_ people visit, derived from check-in histograms, not _how long_ they stay. No dwell-time or duration field exists.

**Coverage for major landmarks: unverified.** I could not obtain an API key and Foursquare publishes no per-field coverage statistics. Foursquare's data heritage is check-in-driven and commercially oriented (its amenity fields are `servesBeer`, `takeout`, `outdoorSeating`), which suggests venue-type bias, but that is inference, not a measured figure. Do not cite a coverage number for Foursquare.

#### Terms on storage and redistribution — the hard blocker

The [Places API PAYG license agreement](https://foursquare.com/legal/terms/apilicenseagreement/) (last updated 2024-02-29) §2.1 requires compliance with "the Places API caching and query rate limitations applicable to your Account-type" as set out in the Usage Guidelines. Those guidelines are unambiguous:

> **Data Retention**
>
> We understand that caching Foursquare data may increase the speed of your application. However, you must abide by the following rules around retaining data from the Places API:
>
> - **fsq_place_id**: unlimited caching (solely to improve the performance of your application).
> - **Photo IDs**: unlimited caching
> - **fsq_addr_id**: unlimited caching
>
> All Other Attributes:
>
> - **Enterprise Customers**: 24-hour local-device caching only (no server-based caching is permitted); or
> - **Pay as You Go & Sandbox Customers**: **no caching permitted.**
>
> — [Places API Usage Guidelines](https://docs.foursquare.com/fsq-developers-places/reference/usage-guidelines), retrieved 2026-08-09, page content updated 2026-02-12

"Enterprise Customer" is defined on the same page as "only those customers with a duly executed agreement that expressly provides 'enterprise access'". A solo self-funded student is a Pay-as-You-Go customer, for whom the rule is **no caching permitted at all** — stricter than Google's 30-day lat/lng allowance. Even an Enterprise agreement would only permit 24-hour _on-device_ caching with "no server-based caching," which rules out a Postgres seed either way.

Redistribution is separately prohibited: §2.5 forbids providing Places Data to third parties except as integrated into your service, making it "available to third parties in bulk," or allowing third parties to "systematically query Places Data to obtain all or substantially all Places Data for a given locality."

**Attribution:** §2.2 requires "branded attribution (i.e., 'Powered by Foursquare')" on any page or screen where Places Data appears; the Usage Guidelines allow either "visual credit (i.e., buttons, our developer logo, etc.) or contextual credit (i.e., woven into copy, etc.)."

#### Foursquare Open Source Places — real, permissive, and hours-free

An open release does exist and is genuinely permissive, but it lacks the one field that matters.

The [Places OS Data Schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema) (retrieved 2026-08-09) lists the complete open dataset: `fsq_place_id`, `name`, `latitude`/`longitude`, `address`, `locality`, `region`, `postcode`, `admin_region`, `post_town`, `po_box`, `country`, `date_created`, `date_refreshed`, `date_closed`, `tel`, `website`, `email`, `facebook_id`, `instagram`, `twitter`, `fsq_category_ids`, `fsq_category_labels`, `placemaker_url`, `unresolved_flags`, `geom`, `bbox`.

**There is no `hours` field, and no `rating` or `popularity`.** The page states plainly: "If you're interested in accessing additional attributes, please see our Places Pro & Premium Data Schemas." `date_closed` records when a POI was marked permanently closed — it is not opening hours.

Licensing is clean, and this is the one part of the Foursquare offering that would survive academic scrutiny:

> The Foursquare OS Places dataset (the "Data") is licensed under the Apache License, Version 2.0… if you use, modify, or distribute the Data, you must: – provide recipients with a copy of the License. – if applicable, include prominent notices to the extent you've changed the Data. – preserve attribution to Foursquare, including preserving the full content of this NOTICE.txt file.
>
> — [Foursquare OS Places Notice](https://opensource.foursquare.com/places-notice-txt/), retrieved 2026-08-09, "© 2026 Foursquare Labs, Inc."

Apache 2.0 permits permanent storage, modification and redistribution, with no share-alike. **If the project needed a storable global POI base layer, this would be an excellent choice — but it cannot supply opening hours, so it does not solve Phase 7.**

### 4.3 OpenTripMap

#### Operational status — alive, but visibly unmaintained

Mixed signals, and one active red herring:

- **`api.opentripmap.com` is live.** A request without a valid key returns a well-formed `{"error":"Unauthorized (401) - The request requires user authentication"}` (checked 2026-08-09), so the API host is up and enforcing auth.
- **`dev.opentripmap.org` serves the developer portal**, docs, pricing and registration. `opentripmap.com` and `opentripmap.org` were both registered 2017-03-17 and are renewed to 2027-03-17 (WHOIS, 2026-08-09) — someone is still paying for them.
- **`opentripmap.io` is not the project.** It was registered 2023-12-23 via Dynadot, and its root returns a nonstandard HTTP 436 redirect to `ww1.opentripmap.io/?sub1=…`, the signature of a parked/monetised domain. Do not cite it.
- **Staleness is unmistakable.** Every page on the developer portal carries "**© 2019 OpenTripMap**", and the OpenAPI document declares `"version": "0.0.1"`. I could find no changelog, status page, blog or release feed anywhere on the site. **Last visible sign of content maintenance: 2019.**

For a thesis whose results must be reproducible over the next several years, a service with a seven-year-old copyright notice and no changelog is a meaningful continuity risk.

#### Opening hours — no

Fetched the machine-readable spec directly: [`https://dev.opentripmap.org/openapi.en.json`](https://dev.opentripmap.org/openapi.en.json) (retrieved 2026-08-09). The strings `opening_hours`, `openingHours`, `hours`, `duration` and `visit` occur **zero times** in the entire document.

The `Places` schema returned by `/{lang}/places/xid/{xid}` contains exactly: `xid`, `name`, `kinds`, `osm`, `wikidata`, `rate` (popularity rating), `image`, `preview{source,width,height}`, `wikipedia`, `wikipedia_extracts{title,text,html}`, `voyage`, `url`, `otm`, `sources{geometry,attributes}`, `info{src,src_id,descr}`, `bbox`, `point{lon,lat}`.

So: **no opening hours, no visit duration.** What it does offer is a `rate` popularity score (useful for spec §7.2.1's `popularity` term) and — importantly — **`osm` and `wikidata` identifiers**, which make it usable as a _bridge_ to OSM rather than an endpoint in itself.

#### Data source, license and terms — the most permissive of the commercial candidates

> OpenTripMap based on cooperative processing of different open data sources (OpenStreetMap, Wikidata, Wikipedia, Ministry of Culture and Ministry of Natural Resources and Environment of the Russian Federation) and encompasses over 10 million tourist attractions and facilities around the world.
>
> **Policies and Terms**
>
> OpenTripMap is available under the Open Data Commons Open Database License (ODbL)
>
> Unlike other similar services such as Google Places we do not apply a number of restrictions
>
> - You can display Places API results on any map.
> - You can pre-fetch, index, store, or cache data
> - You can modifying data before show it to the user
> - You can use data in any territories without restrictions
>
> — [dev.opentripmap.org/product](https://dev.opentripmap.org/product), retrieved 2026-08-09 (page © 2019)

This is the exact inverse of Google's terms on all four points, and it confirms the OSM-derived provenance.

#### Rate limits and tier

From [dev.opentripmap.org/price](https://dev.opentripmap.org/price) (retrieved 2026-08-09): free tier is **$0/mo, 5,000 requests/day, 10 requests/second, "Non-commercial use", email support.** Paid tier prices were not rendered on the page (a PayPal flow and RUB billing are referenced) — **paid pricing is unverified.**

"Non-commercial use" is a good fit for an academic thesis, but it is a constraint to record explicitly if SmartRoute is ever positioned as a product.

### 4.4 OpenStreetMap direct (Overpass API) — the recommended source

#### Measured coverage, not guessed

I queried the live Overpass API for **all 95 attractions** in `seed/attractions.json`, matching each seed row against named OSM features within 400 m by normalised name similarity (diacritic-folded, parenthetical-stripped, checked against `name`, `name:en`, `int_name`, `alt_name`, `official_name`, `old_name`), then recorded whether any matching element carried an `opening_hours` tag. Overpass returned live data (`timestamp_osm_base: 2026-08-09T10:42:44Z`); between 4,592 and 11,812 named features were examined per city.

**Result: 68 of 95 seed attractions (72%) have an `opening_hours` tag; 89 of 95 matched an OSM feature at all.**

| City          | opening_hours present |
| ------------- | --------------------- |
| CDG Paris     | 11/12                 |
| BER Berlin    | 10/12                 |
| LHR London    | 10/12                 |
| BUD Budapest  | 9/12                  |
| FCO Rome      | 9/12                  |
| BCN Barcelona | 7/12                  |
| IST Istanbul  | 6/12                  |
| WAW Warsaw    | 6/11                  |

Coverage by the project's own `AttractionCategory` vocabulary — this is the more decision-relevant cut:

| Category   | With hours | Share |
| ---------- | ---------- | ----- |
| MUSEUM     | 12/13      | 92%   |
| MARKET     | 5/6        | 83%   |
| HISTORICAL | 15/21      | 71%   |
| RELIGIOUS  | 11/16      | 68%   |
| LANDMARK   | 16/24      | 66%   |
| PARK       | 4/6        | 66%   |
| VIEWPOINT  | 5/9        | 55%   |

**72% is a lower bound, for two reasons.**

First, the automated matcher under-counts. Targeted spot-checks of rows it scored as misses found the data present:

| Attraction         | Verified `opening_hours`            | How found                                                                                                                                        |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hagia Sophia**   | `Mo-Su 09:00-19:30`                 | `wikidata=Q12506`, way 109862851 (`name=Ayasofya`, `name:en=Hagia Sophia`) — sits ~400 m from the seed coordinate, just outside the match window |
| **Topkapı Palace** | `Mo, We-Su 09:00-18:00`             | `wikidata=Q170495`, node 10284696709 (`tourism=museum`)                                                                                          |
| **Grand Bazaar**   | `Mo-Sa 9:00-19:00`                  | way 303807317 (`Kapalı Çarşı`)                                                                                                                   |
| **Spice Bazaar**   | `Mo-Sa 08:00-19:00; Su 09:30-19:00` | way 24234971 (`Mısır Çarşısı`)                                                                                                                   |
| **Chora Church**   | `09:00-18:00`                       | relation 7614527 (`Kariye Camii`)                                                                                                                |

All three attractions the brief named explicitly **do** carry `opening_hours`. Correcting just these five raises measured coverage to **72/95 ≈ 76%**. A production importer keyed on `wikidata`/`osm` IDs rather than fuzzy name matching would do better still — and OpenTripMap conveniently returns exactly those two IDs.

Second, **most of the remaining misses are semantically correct absences.** The rows without hours are dominated by open-air public space where "opening hours" is not a meaningful attribute: Trevi Fountain, Spanish Steps, Piazza Navona, La Rambla, İstiklal Street, Heroes' Square, Shoes on the Danube Bank, Montmartre, Museum Island, Checkpoint Charlie, Gendarmenmarkt. For spec §7.3.1 these should be treated as unconstrained-availability, not as missing data. Genuine gaps needing manual fill are a small handful of ticketed sites (e.g. Warsaw's Royal Castle and Palace of Culture, Buda Castle).

**Practical read:** OSM covers the enclosed, ticketed POIs where hours actually constrain the itinerary (museums 92%) and correctly omits them for public squares. With ~20 manual fills over a 95-row curated dataset — a few hours of work, entirely tractable for a one-time seed — Phase 7 gets complete hours coverage.

#### ODbL — what it means for Postgres and for the thesis

The relevant distinction in [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) is **Derivative Database** vs **Produced Work**.

- A **Produced Work** is "a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents (via a search or other query)" (§1.0). An itinerary, a generated schedule, a figure or a table in a thesis is a Produced Work.
- **Share-alike attaches only to Derivative Databases, and only on public use.** §4.4(a) requires a "Derivative Database that You Publicly Use" to be licensed under ODbL or a compatible license. §4.5(b) then carves out: "Using this Database, a Derivative Database, or this Database as part of a Collective Database to create a Produced Work does not create a Derivative Database for purposes of Section 4.4."
- **Produced Works carry attribution only.** §4.3: "if You Publicly Use a Produced Work, You must include a notice associated with the Produced Work reasonably calculated to make any Person that uses, views, accesses, interacts with, or is otherwise exposed to the Produced Work aware that Content was obtained from the Database."

Applied to this project:

1. **Seeding OSM-derived hours into SmartRoute's Postgres is fine.** The database is not publicly conveyed — it backs an application. No share-alike obligation is triggered by internal storage.
2. **Publishing itineraries, screenshots, figures and tables in the thesis is fine**, and requires attribution only — not relicensing the thesis, and not publishing the database.
3. **If the seed file itself were published** (e.g. an appendix data dump, or a public repo containing an enriched `attractions.json`), that would be publicly using a Derivative Database and **would** trigger §4.4 share-alike: the data file would have to be ODbL-licensed. This is a live concern because `seed/attractions.json` is already committed to the repo. Flagged in §6.
4. §4.7(a) keep-open: the license "does not allow You to impose … any terms or any technological measures on the Database … that alter or restrict the terms of this License."

**Required attribution wording**, from the [OSMF Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) (last modified 2022-03-16): credit "OpenStreetMap"; "© OpenStreetMap contributors" is the standard form. "Attribution must also make it clear that the data is available under the Open Database License. This may be done by making the text 'OpenStreetMap' a link to openstreetmap.org/copyright." In an app the credit goes in a map corner, adjacent to the map, or on a startup/about screen. **In a printed or written work** it goes "beside the map…, in a footnote/endnote, or in the acknowledgements section", and "The URL to openstreetmap.org/copyright must be printed out."

This is a genuinely low burden and, unlike Google's, it is explicitly designed to work in a published document.

#### `opening_hours` syntax — machine-parseable, with a maintained TS-typed parser

The tag has a **formal specification**: [Key:opening_hours/specification](https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification), referenced from [Key:opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours) (last modified 2026-08-03) as "a formal specification".

Usage, from the [taginfo API](https://taginfo.openstreetmap.org/api/4/key/stats?key=opening_hours) (`data_until: 2026-08-08`): **4,728,289 objects** carry `opening_hours` (3,682,675 nodes, 966,087 ways, 79,527 relations), across 1,034,599 distinct values.

The syntax is expressive and genuinely needs a real parser, not a regex — the measured values include seasonal and holiday rules, e.g. Budapest's Dohány Street Synagogue:

```
Mar-Oct Sa-Th 10:00-20:00; Mar-Oct Fr 10:00-16:30; Nov-Feb Sa-Th 10:00-16:00; ...
```

the Louvre's `Mo,Th,Sa-Su 09:00-18:00; Tu off; We,Fr 09:00-21:00; Jan 01,May 01,Dec 25 off`, and sun-relative forms like Łazienki Park's `sunrise-sunset`.

**Maintained Node/TS parser:** [`opening_hours`](https://www.npmjs.com/package/opening_hours) (repo: [opening-hours/opening_hours.js](https://github.com/opening-hours/opening_hours.js)).

- Latest version **3.14.0**, published **2026-07-15** (npm registry, retrieved 2026-08-09) — actively maintained, three weeks old at time of research.
- The OSM wiki states it "does follow the formal specification".
- **License: `LGPL-3.0-only`.**

The LGPL is the one thing to weigh here. Consuming it as an unmodified runtime dependency in a Node backend is the ordinary, intended use and does not impose obligations on SmartRoute's own source. But it is a copyleft license, and if the library were forked or modified, changes would have to be released under LGPL. Worth an explicit note in the thesis' dependency discussion; not a blocker.

---

## 5. Open questions for the human

These are judgment calls or gaps, not facts I can settle.

1. **The MapLibre-vs-Google collision is an architectural decision, not a Places decision.** §14.2 and §19.2 both forbid pairing Google Maps Content with a non-Google map. That means the choice is: (a) keep MapLibre (ADR-0001) and drop Google Maps Platform entirely, including for routing; (b) replace the map with a Google map and accept the SDK/interop cost plus the storage limits; or (c) use Google only for computations never rendered near the map — legally strained, and §19.3 permits caching only lat/lng from the Routes API for 30 days, so walking durations could not be persisted anyway. **My recommendation assumes (a), but the call is yours.**

2. **Which walking-route optimizer replaces the Directions API.** With n=3–8 attractions per day (spec §7.3.3), exact in-process TSP is viable and needs no vendor. Alternatives are self-hosted OSRM/Valhalla or a hosted OSM routing service. Each has different reproducibility properties for the thesis. Not researched here — outside the Places question, but it now blocks Phase 7.

3. **How `typicalDuration` gets filled.** No provider sells it, so it must be derived. Options: a per-`AttractionCategory` default (e.g. MUSEUM 120 min, VIEWPOINT 45 min, MARKET 60 min), a per-attraction hand-curated value in the existing seed file (95 rows — entirely feasible, and consistent with the dataset already being hand-curated), or a hybrid. **A hand-curated field is the more defensible choice for a thesis** because it is transparent and reproducible, but it is a methodological choice you should own and justify in writing, since the spec presented it as an API-supplied value.

4. **Whether the enriched seed file will be published — this determines an ODbL obligation.** `seed/attractions.json` is committed to the repo. If OSM-derived `openingHours` are merged into it and the repo is public, that is public use of a Derivative Database and §4.4 share-alike applies to the data file. Mitigations: license the seed data file ODbL with a header notice, keep OSM-derived hours in a separate ODbL-marked file, or fetch hours at seed time rather than committing them. **Needs a deliberate decision before Phase 7 code lands.**

5. **The ~20 manual opening-hours fills.** Filling gaps by hand from official venue websites creates data whose provenance is neither OSM nor a vendor. That is fine and arguably better for a thesis, but it needs a documented sourcing method and a retrieval date per row to be reproducible. Also consider contributing them back to OSM.

6. **Google's EEA terms.** The Places policies page notes: "This product has different Terms of Service for customers with a billing address in the European Economic Area (EEA)". I read the standard (non-EEA) terms. If a Google product is adopted with an EEA billing address, the caching clauses must be re-read against the EEA variant. Türkiye is not in the EEA, but the billing address governs, not the developer's location.

7. **Unverified items.** (a) Foursquare **Premium** tier pricing — not published on any page I could reach, so the true cost of an hours-bearing Foursquare request is unknown; (b) Foursquare's actual opening-hours **coverage** for major landmarks — no key obtained, no published coverage stats, so no number should be cited; (c) OpenTripMap **paid** tier prices — the pricing page did not render them; (d) whether OpenTripMap is still meaningfully operated by anyone — the API answers, but I found no changelog, status page or dated activity signal after 2019.

8. **Re-verify before publication.** Every price and terms clause here has a retrieval date of 2026-08-09. Google's ToS was last modified 2026-06-23 and the Service Specific Terms 2026-06-10 — both recent, both liable to change again before December. Re-check anything quoted in the final document.

---

## 6. Sources

All retrieved **2026-08-09**.

**Google Maps Platform**

- [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms) — §3.2.2(b) attribution, §3.2.3 No Scraping / No Caching / No Creating Content. Last modified 2026-06-23.
- [Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) — §3 Google ID Caching, §14 Places API, §19 Routes API. Last modified 2026-06-10.
- [Legacy products and features](https://developers.google.com/maps/legacy) — Directions API and Places API Legacy as of 2025-03-01; "not available in new Cloud projects". Last updated 2026-07-31.
- [Directions API (Legacy) overview](https://developers.google.com/maps/documentation/directions/overview) — Legacy status banner. Last updated 2026-07-31.
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) — field-mask SKU tiers. Last updated 2026-08-06.
- [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) — search field-mask SKU tiers. Last updated 2026-08-06.
- [Place resource REST reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places) — confirms absence of any visit-duration field.
- [Policies and attributions for Places API](https://developers.google.com/maps/documentation/places/web-service/policies) — caching prohibition, place-ID exemption, attribution rules. Last updated 2026-07-31.
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) — SKU prices and per-SKU free caps. Last updated 2026-07-31.
- [Billing and pricing FAQ](https://developers.google.com/maps/billing-and-pricing/faq) — $200 credit replaced by per-SKU free thresholds, 2025-03-01.
- [Routes API waypoint optimization](https://developers.google.com/maps/documentation/routes/opt-way) — `optimizeWaypointOrder` billed on Compute Routes Pro. Last updated 2026-07-31.
- [Routes API usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing) — Essentials/Pro/Enterprise tier definitions. Last updated 2026-07-31.

**Foursquare**

- [Upcoming Places API Changes](https://docs.foursquare.com/developer/reference/upcoming-changes) — V3 deprecation 2026-05-15; rates effective 2026-06-01; 500 free Pro calls; Premium endpoint list.
- [Places API PAYG License Agreement](https://foursquare.com/legal/terms/apilicenseagreement/) — §2.1 caching, §2.2 attribution, §2.5 redistribution. Last updated 2024-02-29.
- [Places API Usage Guidelines](https://docs.foursquare.com/fsq-developers-places/reference/usage-guidelines) — Data Retention: PAYG "no caching permitted". Content updated 2026-02-12.
- [Places Pro and Premium Data Schemas](https://docs.foursquare.com/data-products/docs/places-pro-and-premium) — `hours` is Premium-only. Last updated 2026-02-12.
- [Places API response fields](https://docs.foursquare.com/fsq-developers-places/reference/response-fields) — `hours`, `hours_popular`, `rating`, `popularity` descriptions.
- [Places OS Data Schemas](https://docs.foursquare.com/data-products/docs/places-os-data-schema) — complete FSQ OS Places field list; no hours.
- [Foursquare OS Places Notice](https://opensource.foursquare.com/places-notice-txt/) — Apache 2.0 terms and NOTICE.txt obligation.

**OpenTripMap**

- [dev.opentripmap.org/product](https://dev.opentripmap.org/product) — data sources, ODbL, explicit permission to pre-fetch/index/store/cache. Page © 2019.
- [dev.opentripmap.org/price](https://dev.opentripmap.org/price) — free tier: 5,000 req/day, 10 req/s, non-commercial.
- [dev.opentripmap.org/openapi.en.json](https://dev.opentripmap.org/openapi.en.json) — OpenAPI 0.0.1; `Places` schema; zero occurrences of hours/duration.
- WHOIS for `opentripmap.com`, `opentripmap.org` (created 2017-03-17, expire 2027-03-17) and `opentripmap.io` (created 2023-12-23, Dynadot, parked) — queried 2026-08-09.

**OpenStreetMap**

- [Overpass API](https://overpass-api.de/api/interpreter) — live queries for all 95 seed attractions; `timestamp_osm_base: 2026-08-09T10:42:44Z`.
- [Key:opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours) — formal specification reference, recommended parser. Last modified 2026-08-03.
- [Key:opening_hours/specification](https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification) — the formal syntax specification.
- [taginfo key stats: opening_hours](https://taginfo.openstreetmap.org/api/4/key/stats?key=opening_hours) — 4,728,289 objects. `data_until: 2026-08-08`.
- [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) — §1.0 definitions, §4.2, §4.3, §4.4, §4.5(b), §4.7.
- [OSMF Licence Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) — required wording and placement in apps and printed works. Last modified 2022-03-16.
- [npm `opening_hours` 3.14.0](https://www.npmjs.com/package/opening_hours) — LGPL-3.0-only, published 2026-07-15. Repo: [opening-hours/opening_hours.js](https://github.com/opening-hours/opening_hours.js).

**Repository files consulted (not modified)**

- `docs/superpowers/specs/2026-07-06-smartroute-traveler-thesis-spec.md` — §6.5, §7.2, §7.3, §8.2, §8.4, §8.5, §13 Phases 6–7
- `AGENTS.md`, `docs/adr/0001-maplibre-ios-via-swift-injection.md`, `docs/adr/0004-phase-8-scoped-to-flat-must-go-list-no-day-by-day.md`
- `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed/attractions.json`, `apps/backend/src/services/plan/index.ts`
