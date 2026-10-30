# CaptureSession protocol

How to run one **CaptureSession** of the competitor benchmark (#35, ADR-0006). All three sessions
(**Sat 31 Oct, Sat 7 Nov, Sat 14 Nov 2026**) follow this page with no changes. A session takes
about 3½ hours. The working list of every screenshot, in order, is
[`capture-sheet.md`](capture-sheet.md). Keep it open next to the browser.

Terms are as in `CONTEXT.md` § Benchmark: a session records **RecordedFares** for the 56 directed
city pairs, then one **CompetitorResult** per **BenchmarkScenario**.

## 1. Before you start (10 min)

1. Use a Chrome profile kept for captures only, signed out of Google and Kiwi.com, with no
   extensions that change pages. Use the same profile every session.
2. Show seconds in the macOS menu-bar clock (System Settings → Control Center → Clock Options →
   "Display the time with seconds"). Take every screenshot of the **whole screen** (⇧⌘3), so the
   date and time show in the image itself.
3. Point screenshots at an empty folder for this session: ⇧⌘5 → Options → Save to → a new folder
   `capture-session-N-YYYY-MM-DD` (N = 1, 2, 3).
4. **Google Flights**: open `https://www.google.com/travel/flights?hl=en&curr=EUR`. In the footer,
   check Language = English (United States), Location = **Poland**, Currency = **EUR**. Set
   **One way**, **1** passenger, **Economy**. Leave stops and every other filter at their
   defaults. The date grid's prices are fares without checked bags. If the results page's Bags
   filter has been touched, set it back to 0.
5. **Kiwi.com**: open `https://www.kiwi.com/en/nomad`. In the header, check region = Polska
   (English) and currency = **EUR**. Change it there if needed (Currency tab → Euro). Passengers
   **1**, cabin and checked bags **0**, cabin **Economy**.
6. Write the session start time, to the minute, at the top of `notes.txt` in the screenshot
   folder. Every exception goes in that file, one line each, with its item ID.

If Location or region ever shows something other than Poland, note it and set it back. The point
of sale must be the same in all three sessions.

## 2. Airports

Each curated city means **exactly these airports**, on both sites, in every session. Never select
a city entry ("London, United Kingdom", "Paris, France"). City entries pull in other places, such
as Google's London listing St Pancras International and Kiwi's Paris search taking in XCR.

**Inclusion rule:** every airport with scheduled passenger flights within **70 km** in a straight
line of the city's curated coordinates (`lat`/`lon` in `prisma/seed/attractions.json`). The
distances below are great-circle distances from those coordinates.

| City              | Airports (km from centre)                      | Nearest left out             |
| ----------------- | ---------------------------------------------- | ---------------------------- |
| Barcelona (`BCN`) | BCN 13                                         | GRO Girona 75, REU Reus 88   |
| Berlin (`BER`)    | BER 18                                         | none within 100 km           |
| Budapest (`BUD`)  | BUD 18                                         | none within 100 km           |
| Istanbul (`IST`)  | IST 35, SAW 30                                 | TEQ Tekirdağ Çorlu 90        |
| London (`LHR`)    | LHR 23, LGW 40, STN 49, LTN 44, LCY 13, SEN 57 | OXF Oxford 90 (no scheduled) |
| Paris (`CDG`)     | CDG 22, ORY 15, BVA 69                         | XCR Vatry 136                |
| Rome (`FCO`)      | FCO 24, CIA 14                                 | none within 100 km           |
| Warsaw (`WAW`)    | WAW 8, WMI 35                                  | RDO Radom 94, LCJ Łódź 124   |

GRO is the closest call: it is 75 km out, and Kiwi.com files it under Girona, not Barcelona, so it
stays out. The same lists, with Kiwi.com's names for each airport, are `BENCHMARK_AIRPORTS` in
`apps/backend/src/services/benchmark/airports.ts`. A test fails if this table and that list
disagree. The code in brackets is the one the benchmark uses for the city. It stands for the
whole airport list, never just that one airport.

## 3. Capture order

Do the steps in this order, with no breaks longer than 15 minutes (note any break in the notes
file):

1. **G01–G56**: Google Flights date grids, all 56 pairs (about 2 h).
2. **N01–N20**: Kiwi.com Nomad, one search per scenario (about 1 h).
3. **L01–L10**: live spot-checks on Google Flights (about 20 min).
4. Write the session end time in the notes file.

Grids come first so that every scenario's Nomad capture falls after all of its fares, within
the same sitting. The timestamps in the screenshots record the actual gap.

## 4. Google Flights date grids (G01–G56)

For each odd item on the sheet:

1. In **From**, delete whatever is there, press the **+** at the end of the field, and tick each
   airport of the From city. Then press the ✓. Do the same in **To** for the To city.
2. Open **Departure**. Use the arrows until **November and December** are side by side. The grid
   then covers the checklist's whole range, 28 Nov – 22 Dec 2026, for every pair.
3. Wait until the prices stop filling in. Every day from 28 Nov to 22 Dec should show a price or be
   blank. Then screenshot. The screenshot must show the From and To chips and both months.

For the even item after it, close the grid, press **⇄** (swap), reopen Departure on Nov–Dec, and
screenshot again.

- A day with **no price** after the grid has settled is a **"no fare"** RecordedFare. Before
  moving on, close and reopen the grid once. If the day is still blank, it stays "no fare".
- Prices are whole euros as shown. Do not open individual days in this step.
- If a chip shows more or fewer airports than the sheet's row, fix it before taking the
  screenshot.

## 5. Kiwi.com Nomad (N01–N20)

For each item, open its **open** link from the sheet. The link already holds the scenario's
airports, departure day, end city and exact nights per city, sorted by Cheapest.

1. Check the summary bar against the row: start city and **Start trip** date (Istanbul's chips
   read **IST** and **SAW**), each place with
   **Stay N nights** (one number, not a range), the end city last. Check that the sort says
   **Cheapest** and the prices are in **€**. If anything is wrong, fix it in Modify journey and
   note it.
2. Wait for the results to finish loading, then screenshot the top of the list.
3. Find the **first all-flight itinerary**, looking through every result Nomad lists (it stops
   at "There are no more trips for these dates", usually after a handful). Nomad has no flights-only filter, so check each leg's
   carrier logo. If any logo is a bus or train company, or you cannot tell, press **Show
   details** on that result and screenshot it. The first result whose legs are all flights is
   the compared one. If it is not on screen yet, scroll to it and take another screenshot.
4. If no listed result is all-flight, note "no all-flight result" for this item. It has no
   compared price and is counted with the excluded results.

A CompetitorResult records the following. All of it is read from the screenshots afterwards, so
the screenshots must show it:

- **Compared price**: the price of the first all-flight itinerary under Cheapest, in EUR.
- **Nomad's city order** for that itinerary, origin to end city.
- **The dates and stays Nomad returned**: each leg's departure date and each place's "Stay N
  nights".
- **Cheapest any-mode price and its modes**: the first result overall and the transport of each
  of its legs. This is context only, never the compared price. It is often the same itinerary as
  the compared one.
- **Capture time**: from the screenshot.

Nomad counts a stay's nights from the day a leg **lands**, so a flight that lands after midnight
pushes every later leg back a day. The benchmark compares **departure dates**. A CompetitorResult
is valid only if each place's "Stay N nights" equals its CityStay **and** each leg leaves on the
day the scenario's CityStays give for Nomad's own order: the first leg on the departure day, each
later leg the previous city's CityStay days after the leg before it. The stays come from the
link, so in practice it is the departure dates that catch a shifted result. Record what Nomad shows. Validity is computed afterwards, never judged
during the session.

## 6. Live spot-checks (L01–L10)

Use only your own session's list on the sheet, which was drawn by seed before any price was seen.
For each row, on Google Flights with that row's airport lists:

1. Set the date to the row's date and run the search (one way, same settings as the grids).
2. Screenshot the results list with the cheapest flight visible. Make sure the price is the
   cheapest for that day, or set the sort to price first.

The thesis reports the difference between that live price and the same day's grid price. The
spot-checks run last, so each one is taken 2–3 hours after its grid. The measured drift includes
that gap, and the thesis says so.

## 7. Screenshots and naming

- After each screenshot, rename the file by **putting the item ID and a space in front of**
  macOS's own name. For example, `G07 Screenshot 2026-10-31 at 09.41.05.png`. Do not change the
  rest: the name carries the capture time to the second.
- A retake gets the same ID with a letter: `G07b …`. The latest letter is the one used. Keep the
  others.
- Extra screenshots for one item (Show details, a scrolled list) also take the item ID with a
  letter.

## 8. After the session (15 min)

1. Check that every ID G01–G56, N01–N20 and L01–L10 has at least one file.
2. Zip the folder: `capture-session-N-YYYY-MM-DD.zip`, holding the screenshots and the notes file.
3. Archive the zip **outside git** in two places: the owner's cloud drive and an external disk.
4. Write the SHA-256 manifest into the repo, next to where the session's data will go:

   ```sh
   cd capture-session-N-YYYY-MM-DD
   shasum -a 256 *.png notes.txt > <repo>/docs/benchmark/sessions/YYYY-MM-DD.sha256
   shasum -a 256 ../capture-session-N-YYYY-MM-DD.zip >> <repo>/docs/benchmark/sessions/YYYY-MM-DD.sha256
   ```

5. Hand the zip to the agent. It transcribes the session into JSON twice and reconciles the two
   copies. The owner then audits a random 5% of the transcribed prices against the screenshots.

## 9. Session-prep checks (done 2026-10-03)

All checks were done in Chrome (signed out, region Poland) on 2026-10-03. None fails, so nothing is
blocking 31 Oct.

| Check                                                                        | Result | What was seen                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nomad accepts exact nights per destination, not a range                      | Pass   | The stay slider (1–60) defaults to 3–5, but `~3` in the URL gives "Stay 3 nights" and the results honour it: Warsaw → Rome 3 → Barcelona 2 → Paris returned Mon 16, Thu 19 and Sat 21 Nov. One lower-ranked result left Barcelona a day late after a 23:15 departure landed past midnight, which is why validity checks departure dates (§5). |
| Nomad has a flights-only filter                                              | Fail   | Filters offer only Bags and Stops. Sort offers Best, Cheapest and Fastest. **Workaround:** sort by Cheapest and take the first result whose legs are all flights, using carrier logos and Show details (§5). Every result checked on the day showed only airline logos.                                                                       |
| Nomad accepts the same multi-airport selection                               | Pass   | Each place, the start and the end are chip fields that take several airports (e.g. "Already included: SAW, IST"). The URL lists them comma-separated. The largest scenario (S16: IST, SAW → 6 places with up to 6 airports each → BCN) loaded from its sheet link and returned all-flight results whose dates matched its stays.              |
| Nomad can pin the end city                                                   | Pass   | "Return to a different location" with an airport list as the end. In the URL the end is the second segment.                                                                                                                                                                                                                                   |
| Google Flights' one-way date grid takes multi-airport origin and destination | Pass   | **+** in a field switches to tick boxes. WAW + WMI → LHR, LGW, STN, LTN, LCY, SEN gave a priced date grid in EUR.                                                                                                                                                                                                                             |
| Google Flights' grid shows the needed months                                 | Pass   | The grid shows two months side by side. Paging once gives November and December together, with a price on every day of both months for the pair tried, so one screenshot covers the whole window (then 14 Nov – 8 Dec; since the 2026-10-30 reschedule, 28 Nov – 22 Dec).                                                                     |
| Both sites can show EUR                                                      | Pass   | Google: `curr=EUR` in the URL, confirmed in the footer. Kiwi: header → Currency → Euro, which persists in the profile.                                                                                                                                                                                                                        |

Google Flights offers no stable shareable link for a multi-airport search (its `q=` links did not
fill the form), so grids are set up by hand. The swap button halves the work.

## 10. Consistency with ADR-0006 and `CONTEXT.md`

- RecordedFares come only from Google Flights' date grids, one-way economy, price only, in EUR
  (ADR-0006).
- Scenarios use only the 8 curated cities. Each city is one explicit airport list, the same on
  both sites (ADR-0006 § Consequences).
- Every scenario pins its end city on Nomad as it does in SmartRoute (ADR-0006).
- A session is one continuous sitting. Its fares are never mixed with another session's
  (`CONTEXT.md` § CaptureSession).
- The CompetitorResult is Nomad's cheapest **all-flight** itinerary. The any-mode result is kept
  beside it as context only (`CONTEXT.md` § CompetitorResult).
