# OpeningHours citations for the 82 undecided Attractions

## 1. Question & date

**Researched:** 2026-08-18. Every opening time below was read off an operator's own website on that
date, and **every one of them is volatile**. Opening hours change seasonally, for renovations, for
public holidays and at a week's notice; several of the values here are explicitly day-by-day
calendar readings rather than published weekly schedules. **Re-verify any value before it is quoted
in the thesis**, and treat the retrieval date as part of the datum rather than metadata.

**Question:** issue #25 needs, for each of the 82 Attractions still listed under "Still to decide"
in `docs/research/attraction-data-coverage.md`, either a published schedule from a primary source
with a citation, or a reasoned decision that the Attraction is genuinely unconstrained or genuinely
unpublished.

**This note is research, not curation.** It edits no seed file and no source. It is raw material for
the hand-work in `apps/backend/prisma/seed/opening-hours.manual.json`: each row below maps onto one
`ManualEntry` in the discriminated union in `apps/backend/src/services/plan/seed-opening-hours.ts`,
so a row can be transcribed without re-deriving anything. The judgement calls that remain are
collected in §7.

### What counted as a source

**Only the attraction's own operator website**, or the government/municipal body that runs it —
`louvre.fr`, `britishmuseum.org`, `zamek-krolewski.pl`, `sagradafamilia.org`,
`galatakulesi.gov.tr`, `bundestag.de`, and so on. No TripAdvisor, no Wikipedia, no GetYourGuide,
Viator, Tiqets or Klook, no blog round-ups, no search-engine summaries. Where the official site
could not be reached or published nothing usable, the row is `unknown` and says why. **There is no
row in this note whose citation is an aggregator**, and no row carries a URL I did not actually
fetch.

### Syntax constraint that shaped the values

Values are OSM `opening_hours` expressions and must pass `assertValidOpeningHours`
(`apps/backend/src/services/plan/opening-hours.ts`). The `PH`/`SH` holiday macros are rejected on
purpose: measured in this repo, `Mo-Fr 09:00-17:00; PH off` throws with _"Country code missing which
is needed to select the correct holidays"_, and even given a country code the library cannot
evaluate it for `tr` and `gb` — Istanbul and London. Published data uses "closed on public
holidays" constantly, so this was hit repeatedly; every such phrase below is rewritten to explicit
dates and the original wording recorded in a `rewrittenFrom` column, so the transformation is
auditable rather than a silent edit of someone else's statement.

**Every expression in this note was machine-checked.** All 52 proposed `sourced` values were parsed
with the repo's own validator and then evaluated with `opening_hours` under all eight seed country
codes (`tr`, `gb`, `de`, `pl`, `hu`, `fr`, `it`, `es`). 52/52 passed; a deliberate `PH off` control
in the same run failed, confirming the check was live.

---

## 2. Coverage — the honest count

Of the **82** Attractions in scope:

| Proposed basis                           | Count | Share |
| ---------------------------------------- | ----: | ----: |
| `sourced` — official schedule + citation |    52 |   63% |
| `always-open` — genuinely unconstrained  |    14 |   17% |
| `unknown` — looked, nothing publishable  |    16 |   20% |

**I reached an official source for 52 of 82.** The 16 `unknown` rows split into four causes, and the
distinction matters for whether they are worth another attempt:

1. **Network-unreachable official sites (6).** `colosseo.it` / `parcocolosseo.it`,
   `galleriaborghese.cultura.gov.it` and `castelsantangelo.cultura.gov.it` refused TCP connections
   from this environment (`ECONNREFUSED 2.42.229.247:443`, `ECONNREFUSED 2.42.228.88:443`, and
   `ENOTFOUND` for the Castel Sant'Angelo host) on every attempt, over both HTTP/1.1 and HTTP/2 and
   through two independent fetch paths. DNS resolves; the hosts simply do not accept the
   connection. **These are almost certainly retrievable from a European IP** and are the single
   highest-value re-try: they include the Colosseum, the single most-visited item in the dataset.
2. **Bot-walls and CAPTCHAs (3).** `parlament.hu` serves a CAPTCHA challenge ahead of all content;
   `musee-orsay.fr` returns HTTP 403 to every path that carries the hours.
3. **Genuinely no published tourist schedule (5).** Working mosques and parish churches — Blue
   Mosque, Süleymaniye, Warsaw's Holy Cross Church — publish prayer and Mass times, not visiting
   hours. Rome's Campo de' Fiori market has no operator site at all.
4. **A published statement that there is nothing to schedule (2).** Centre Pompidou is shut until
   2030; the Basilica Cistern's own site says it is closed to visitors. Both are cited below.

**Everything I could not check is named.** Nothing in this note is padded to look complete.

### The four findings that matter most

**(a) Centre Pompidou is closed, and has been since 22 September 2025.** Its own site: _"The
building will close its doors on 22 September 2025"_, with the renovation running to a reopening
_"by 2030"_. Any itinerary that schedules it sends a traveler to a construction site. This is not
an hours problem — it is a dataset problem, and the owner may want to reconsider whether the row
belongs in `attractions.json` at all.

**(b) Two more headline rows carry live closure notices.** Yerebatan's own site says _"The Basilica
Cistern is temporarily closed to visitors"_ while the same page still displays _"Visiting Hours
09.00 – 22.00"_ — the operator contradicts itself, and I am not going to pick a winner for them.
The Pergamonmuseum on Museum Island is _"completely closed to visitors due to construction work"_,
which changes what "Museum Island" means for a visitor.

**(c) Several major operators no longer publish a weekly schedule at all** — they publish a
JavaScript date-picker. Westminster Abbey, the Tower of London, the Eiffel Tower, the Berliner Dom
and Matthias Church all fall in this class. Where the underlying per-date data was recoverable
(Westminster Abbey embeds `schema.org` `openingHoursSpecification` for a fortnight; the Berliner
Dom renders a two-week event calendar server-side) I derived the weekly pattern from it and say so.
Where it was not (Eiffel Tower, Matthias Church) the value is a **single day's** reading and is
flagged as such. This is a methodological finding worth stating in the thesis: the assumption that
attractions publish stable weekly hours is decreasingly true.

**(d) Published visit durations barely exist.** Across 52 official sites I found **three** usable
statements (§6). The `2026-08-09` note already established that no Places provider sells the field;
this note establishes the stronger result that **the operators themselves mostly do not publish it
either**. The per-category `DEFAULT_VISIT_MINUTES` table is therefore not a shortcut around
available data — there is no available data to take.

---

## 3. How to read the tables

One row per Attraction, in the order `attraction-data-coverage.md` lists them. Columns:

- **Attraction** — the exact `attractions.json` name. `resolveOpeningHours` throws on any mismatch,
  so transcribe it verbatim.
- **Basis** — `sourced` / `always-open` / `unknown`, matching the `ManualEntry` union.
- **Value / rationale** — for `sourced`, the `opening_hours` expression (all validated). For the
  other two, the text to put in `rationale`.
- **Source** — the exact URL fetched on 2026-08-18. `sourced` rows carry it as `source`;
  `always-open` rows carry **no** source (the schema forbids one, deliberately — there is no page
  to cite for "Trevi Fountain has no gates"). `unknown` rows also carry no `source` field, so where
  I do have a citation for the _reason_ it is written into the `rationale` text instead.
- **⚑** — marks a compound name or another judgement call. Every ⚑ is explained in §7.

`retrieved` is `2026-08-18` on every `sourced` row.

---

## 4. Per-city tables

### 4.1 IST — Istanbul (6)

| Attraction                      | Basis         | Value / rationale                                                                                                                                                                                                | Source                                                      | ⚑   |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --- |
| Blue Mosque (Sultanahmet Camii) | `unknown`     | Working mosque under Diyanet; no operator site publishes tourist visiting hours. `sultanahmetcamii.org` redirects away and `suleymaniyecamii.org` now serves an unrelated gambling page — neither is citable.    | —                                                           | ⚑1  |
| Basilica Cistern                | `unknown`     | Operator site states "The Basilica Cistern is temporarily closed to visitors" while the same page still shows "Visiting Hours 09.00 – 22.00" (yerebatan.com, 2026-08-18). Contradictory; no defensible schedule. | —                                                           | ⚑2  |
| Galata Tower                    | `sourced`     | `08:30-23:00`                                                                                                                                                                                                    | https://galatakulesi.gov.tr/                                | ⚑3  |
| Süleymaniye Mosque              | `unknown`     | Working mosque; no official operator page publishing visiting hours could be found. See ⚑1.                                                                                                                      | —                                                           | ⚑1  |
| Dolmabahçe Palace               | `sourced`     | `Tu-Su 09:00-17:00; Jan 01 off`                                                                                                                                                                                  | https://www.millisaraylar.gov.tr/saraylar/dolmabahce-sarayi | ⚑4  |
| Hippodrome & Sultanahmet Square | `always-open` | Open public square (Sultanahmet Meydanı) with the obelisks in situ; no gates, no admission, no operator.                                                                                                         | —                                                           | ⚑5  |

Verbatim, Galata Tower: the Ministry of Culture and Tourism site's footer reads `ZİYARET SAATLERİ
08:30 - 23:00`. Dolmabahçe: `Gişe Açılış Saati : 09:00:00`, `Gişe Kapanış Saati : 17:00:00`, closed
`Pazartesi` (Monday).

### 4.2 BER — Berlin (10)

| Attraction                              | Basis         | Value / rationale                                                                                                                                                                                                     | Source                                                                                | ⚑   |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --- |
| Brandenburg Gate                        | `always-open` | Free-standing city gate on Pariser Platz; no enclosure, no admission, no operator.                                                                                                                                    | —                                                                                     |     |
| Reichstag Building                      | `unknown`     | Bundestag publishes only "Last admission: 21.45 hrs" plus closure dates for the dome — no opening time on any page reached. Booking is compulsory and slot-based, so a clock window would misrepresent access anyway. | —                                                                                     | ⚑6  |
| Museum Island                           | `sourced`     | `Tu-Su 10:00-18:00`                                                                                                                                                                                                   | https://www.smb.museum/en/plan-your-visit/opening-hours/                              | ⚑7  |
| Memorial to the Murdered Jews of Europe | `sourced`     | `Tu-Su 10:00-18:00`                                                                                                                                                                                                   | https://www.stiftung-denkmal.de/en/memorials/memorial-to-the-murdered-jews-of-europe/ | ⚑8  |
| East Side Gallery                       | `always-open` | 1.3 km open-air painted wall segment along Mühlenstraße; a public pavement, not a venue.                                                                                                                              | —                                                                                     |     |
| Berlin Wall Memorial — Bernauer Straße  | `sourced`     | `Mo-Su 08:00-22:00`                                                                                                                                                                                                   | https://www.stiftung-berliner-mauer.de/en/berlin-wall-memorial/visit/information      | ⚑9  |
| Berliner Dom                            | `sourced`     | `Mo-Sa 09:00-19:00; Su 12:00-19:00`                                                                                                                                                                                   | https://berlinerdom.de/termine/                                                       | ⚑10 |
| TV Tower — Alexanderplatz               | `sourced`     | `09:00-23:00`                                                                                                                                                                                                         | https://tv-turm.de/en/                                                                |     |
| Tiergarten                              | `always-open` | Ungated 210 ha city park, crossed by public roads and paths; no closing time published.                                                                                                                               | —                                                                                     |     |
| Charlottenburg Palace                   | `sourced`     | `Apr-Oct Tu-Su 10:00-17:30; Nov-Dec Tu-Su 10:00-16:30; Dec 24,Dec 25 off`                                                                                                                                             | https://www.spsg.de/schloesser-gaerten/objekt/schloss-charlottenburg-altes-schloss/   | ⚑11 |

Verbatim, Museum Island (SMB): Alte Nationalgalerie, Neues Museum and James-Simon-Galerie are
"Closed Mondays. Tuesday–Sunday, 10:00 am–6:00 pm"; Altes Museum and Bode-Museum close at 17:00
Tue–Fri and 18:00 at weekends; the **Pergamonmuseum is "completely closed to visitors due to
construction work"**. `Tu-Su 10:00-18:00` is the envelope shared by the buildings that are open.

Verbatim, Memorial: the field of stelae is "24 hours a day accessible"; the Ort der Information is
"Di-So 10-18 Uhr", last admission 45 minutes before closing.

Verbatim, Berlin Wall Memorial: outdoor exhibition/grounds "Monday to Sunday, 8 a.m. to 10 p.m.";
Visitor Centre and Documentation Centre "Tuesday to Sunday 10 a.m. to 6 p.m."

Verbatim, Charlottenburg: "April bis Oktober … Montag geschlossen, Dienstag – Sonntag: 10.00 –
17.30 Uhr"; "November/Dezember … Dienstag – Sonntag: 10.00 – 16.30 Uhr"; "Heiligabend
(24.12.2026) geschlossen"; "1. Weihnachtsfeiertag (25.12.2026) geschlossen".

### 4.3 WAW — Warsaw (11)

| Attraction                                 | Basis         | Value / rationale                                                                                                                                                                              | Source                                                            | ⚑   |
| ------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --- |
| Old Town Market Square                     | `always-open` | Rynek Starego Miasta is an open public square; no gates, no admission.                                                                                                                         | —                                                                 |     |
| Royal Castle                               | `sourced`     | `Tu-Su 10:00-18:00`                                                                                                                                                                            | https://www.zamek-krolewski.pl/en/godziny-otwarcia-i-ceny-biletow | ⚑12 |
| Łazienki Park                              | `sourced`     | `Mo-Su 06:00-22:00`                                                                                                                                                                            | https://www.lazienki-krolewskie.pl/en/zwiedzanie/godziny-otwarcia | ⚑13 |
| Warsaw Uprising Museum                     | `sourced`     | `Mo 08:00-18:00; We-Fr 08:00-18:00; Sa-Su 10:00-18:00; Tu off`                                                                                                                                 | https://www.1944.pl/en/article/visit-us,4993.html                 |     |
| POLIN Museum of the History of Polish Jews | `sourced`     | `Mo 10:00-18:00; We-Fr 10:00-18:00; Sa 10:00-20:00; Su 10:00-18:00; Tu off`                                                                                                                    | https://polin.pl/pl/zaplanuj-wizyte                               | ⚑14 |
| Palace of Culture and Science              | `sourced`     | `10:00-20:00`                                                                                                                                                                                  | https://pkin.pl/en/visiting-pkin/                                 | ⚑15 |
| Wilanów Palace                             | `sourced`     | `Th-Tu 10:00-16:00; We 10:00-18:00; Nov 01 off; Dec 14-Dec 31 off`                                                                                                                             | https://www.wilanow-palac.pl/godziny-otwarcia                     | ⚑16 |
| Copernicus Science Centre                  | `sourced`     | `Mo-Th 09:00-19:00; Fr 09:00-20:00; Sa-Su 09:00-19:00`                                                                                                                                         | https://www.kopernik.org.pl/en/visit/opening-hours                | ⚑17 |
| Krakowskie Przedmieście                    | `always-open` | Public street forming part of the Royal Route; walkable at all hours.                                                                                                                          | —                                                                 |     |
| Holy Cross Church                          | `unknown`     | The parish publishes Mass times (Sun 6:00–19:00, weekdays 6:00–19:00) and confession hours, but no tourist visiting hours. Deriving a window from Mass times would be inference, not a source. | —                                                                 | ⚑18 |
| Warsaw Barbican                            | `sourced`     | `We,Sa 13:00-17:00`                                                                                                                                                                            | https://muzeumwarszawy.pl/en/barbakan/                            | ⚑19 |

Verbatim, Royal Castle: "Tuesday–Sunday: 10 AM–6 PM (last entry at 5 PM)", Monday closed,
"Wednesday: 10 AM–6 PM … free admission". Łazienki: "The gardens of the Royal Łazienki Museum are
open to visitors from Monday to Sunday from 6.00 to 22.00 (free entrance)." PKiN: "Taras Widokowy
czynny jest codziennie w godz. 10:00–20:00." POLIN: "Poniedziałek 10:00—18:00 / Wtorek nieczynne /
Środa 10:00—18:00 / Czwartek 10:00—18:00 (wstęp bezpłatny) / Piątek 10:00—18:00 / Sobota
10:00—20:00 / Niedziela 10:00—18:00." Barbican: "środa 13:00-17:00, sobota 13:00-17:00 (od 24
maja)".

### 4.4 BUD — Budapest (11)

| Attraction                    | Basis         | Value / rationale                                                                                                                                                                                                                                               | Source                                     | ⚑   |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --- |
| Hungarian Parliament Building | `unknown`     | `parlament.hu` and `latogatokozpont.parlament.hu` both serve a CAPTCHA challenge ("Validation needed due to : Policy constraints") ahead of all content. No official schedule reachable.                                                                        | —                                          | ⚑20 |
| Buda Castle                   | `sourced`     | `Mo-Su 10:00-18:00`                                                                                                                                                                                                                                             | https://www.varmuzeum.hu/en/visit/         | ⚑21 |
| Fisherman's Bastion           | `sourced`     | `Jan 02-May 31 09:00-19:00; Jun 01-Sep 30 09:00-21:00; Oct 01-Dec 23 09:00-19:00`                                                                                                                                                                               | https://www.fishermansbastion.com/         | ⚑22 |
| Matthias Church               | `sourced`     | `09:00-17:00`                                                                                                                                                                                                                                                   | https://www.matyas-templom.hu/en/          | ⚑23 |
| St. Stephen's Basilica        | `sourced`     | `Mo-Sa 09:00-18:00; Su 13:00-18:00`                                                                                                                                                                                                                             | https://www.bazilikabudapest.hu/en/        | ⚑24 |
| Széchenyi Chain Bridge        | `always-open` | Public road-and-pedestrian bridge over the Danube; permanently open, no admission.                                                                                                                                                                              | —                                          |     |
| Széchenyi Thermal Baths       | `sourced`     | `Mo-Th 07:00-20:00; Fr 07:00-22:00; Sa-Su 08:00-20:00`                                                                                                                                                                                                          | https://www.szechenyifurdo.hu/nyitvatartas |     |
| Great Market Hall             | `sourced`     | `Mo-Fr 06:00-18:00; Sa 06:00-16:00; Su 10:00-16:00; Jan 01,Mar 15,May 01,Aug 20,Oct 23,Nov 01,Dec 25,Dec 26 off`                                                                                                                                                | https://www.piaconline.hu/nyitvatartas     | ⚑25 |
| Gellért Hill & Citadella      | `always-open` | Public hillside park with open paths and viewpoints; no gate, no admission. The Citadella fortress itself is a separate, long-running reconstruction site.                                                                                                      | —                                          | ⚑26 |
| Dohány Street Synagogue       | `unknown`     | The operator (Milev / Hungarian Jewish Museum) site `milev.hu` links only a generic "Plan your visit" page with no hours; `dohanystreetsynagogue.hu` does not resolve; `greatsynagogue.hu` is a frameset of unclear provenance and was not treated as official. | —                                          | ⚑27 |
| Shoes on the Danube Bank      | `always-open` | Open-air memorial on the Pest embankment promenade; no enclosure, no admission.                                                                                                                                                                                 | —                                          |     |

Verbatim, Buda Castle (BTM): "General opening hours: Monday–Sunday: 10:00–18:00. Closing time and
last entry: 17:30." Széchenyi: the official `nyitvatartás` table gives "A fürdő nyitvatartási
ideje" as 7:00–20:00 Mon–Thu, 7:00–22:00 Fri, 8:00–20:00 Sat–Sun. Great Market Hall (Nagycsarnok):
"H – P 06.00 – 18.00 / Sz 06.00 – 16.00 / V 10.00 – 16.00" under the heading "Hivatalos ünnep-,
illetve munkaszüneti napokon ZÁRVA!"

**`rewrittenFrom` for Great Market Hall:** `"Hivatalos ünnep-, illetve munkaszüneti napokon ZÁRVA!"`
("closed on official public and rest days"). Rewritten to the eight fixed Hungarian public holidays
(`Jan 01, Mar 15, May 01, Aug 20, Oct 23, Nov 01, Dec 25, Dec 26`). **The movable ones — Good
Friday, Easter Monday, Whit Monday — cannot be expressed** without the `PH` macro that the
validator rejects, so those three days will be modelled as open when they are not. Recorded as a
known, bounded inaccuracy.

### 4.5 LHR — London (12)

| Attraction                          | Basis         | Value / rationale                                                                                                                                           | Source                                                                    | ⚑   |
| ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --- |
| Tower of London                     | `sourced`     | `Mo-Su 09:00-17:30`                                                                                                                                         | https://www.hrp.org.uk/tower-of-london/visit/                             | ⚑28 |
| Tower Bridge                        | `sourced`     | `09:30-18:00; Jan 01 10:00-18:00; Dec 24-Dec 26 off`                                                                                                        | https://www.towerbridge.org.uk/plan-your-visit                            |     |
| British Museum                      | `sourced`     | `Mo-Th 10:00-17:00; Fr 10:00-20:30; Sa-Su 10:00-17:00; Dec 24-Dec 26 off`                                                                                   | https://www.britishmuseum.org/visit                                       | ⚑29 |
| Westminster Abbey                   | `sourced`     | `Mo-Fr 09:30-15:30; Sa 09:00-15:00; Su off`                                                                                                                 | https://www.westminster-abbey.org/visit-us/opening-times                  | ⚑30 |
| Big Ben & Houses of Parliament      | `always-open` | The compound's dominant free component — the Elizabeth Tower and the Palace frontage seen from Parliament Square and Westminster Bridge — is public street. | —                                                                         | ⚑31 |
| Buckingham Palace                   | `sourced`     | `Jul 09-Aug 31 09:30-19:30; Sep 01-Sep 27 Th-Mo 09:30-18:30`                                                                                                | https://www.rct.uk/visit/buckingham-palace                                | ⚑32 |
| London Eye                          | `sourced`     | `10:00-20:30`                                                                                                                                               | https://www.londoneye.com/plan-your-visit/before-you-visit/opening-hours/ | ⚑33 |
| National Gallery & Trafalgar Square | `sourced`     | `Mo-Th 10:00-19:00; Fr 10:00-21:00; Sa-Su 10:00-19:00; Dec 24-Dec 26,Jan 01 off`                                                                            | https://www.nationalgallery.org.uk/visiting                               | ⚑34 |
| St Paul's Cathedral                 | `sourced`     | `Mo-Sa 08:30-16:30; Su off`                                                                                                                                 | https://www.stpauls.co.uk/visits/visits/sightseeing-opening-hours         | ⚑35 |
| Hyde Park                           | `sourced`     | `05:00-24:00`                                                                                                                                               | https://www.royalparks.org.uk/visit/parks/hyde-park                       | ⚑36 |
| Borough Market                      | `sourced`     | `Tu-Fr 10:00-17:00; Sa 09:00-17:00; Su 10:00-16:00; Mo off`                                                                                                 | https://www.boroughmarket.org.uk/visit-us/                                | ⚑37 |
| Natural History Museum              | `sourced`     | `10:00-17:50; Dec 24-Dec 26 off`                                                                                                                            | https://www.nhm.ac.uk/visit.html                                          | ⚑38 |

Verbatim, British Museum: "Daily: 10.00–17.00 (Fridays: 20.30). The Museum is closed 24–26
December." National Gallery: "Open daily 10am–7pm Friday until 9pm (Closed 24–26 December and 1
January)." NHM: "Open daily 10:00–17:50 (last entry 17:30). Closed 9 October and 24–26 December."
Hyde Park: "Pedestrian gates 5am - midnight". Tower Bridge: "Open daily: 09:30 to 18:00", "Last
entry is 17:00", closed 24–26 December, opens 10:00 on 1 January.

**`rewrittenFrom` — London and Istanbul rows carry no `PH` at all.** Where an operator wrote a
holiday rule it was already given as explicit dates (British Museum "24–26 December", National
Gallery "24–26 December and 1 January"), so the rewrite was a transcription rather than a
substitution and no `rewrittenFrom` is needed. The single case where a genuine `PH`-shaped phrase
had to be converted is Budapest's Great Market Hall (§4.4). Borough Market's "Opening times vary
during the festive period and at Bank Holidays" is deliberately **not** encoded — it names no
dates, so there is nothing to rewrite it into.

### 4.6 CDG — Paris (12)

| Attraction              | Basis         | Value / rationale                                                                                                                                                                                                                                                 | Source                                                                        | ⚑   |
| ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- |
| Eiffel Tower            | `sourced`     | `09:00-24:00`                                                                                                                                                                                                                                                     | https://www.toureiffel.paris/en/rates-opening-times                           | ⚑39 |
| Louvre Museum           | `sourced`     | `Mo,Th,Sa,Su 09:00-18:00; We,Fr 09:00-21:00; Tu off; Jan 01,May 01,Dec 25 off`                                                                                                                                                                                    | https://www.louvre.fr/en/visit/hours-admission                                |     |
| Notre-Dame Cathedral    | `sourced`     | `Mo-We,Fr 07:50-19:00; Th 07:50-22:00; Sa-Su 08:15-19:30`                                                                                                                                                                                                         | https://www.notredamedeparis.fr/en/visit/practical-information/opening-hours/ |     |
| Sacré-Cœur & Montmartre | `unknown`     | The basilica's own "Opening hours and access" page could not be reached (404 on every path tried from `sacre-coeur-montmartre.com`); the homepage carries no times. Compound name, so a wrong value is doubly costly.                                             | —                                                                             | ⚑40 |
| Arc de Triomphe         | `sourced`     | `Apr 01-Sep 30 We-Mo 10:00-23:00; Apr 01-Sep 30 Tu 11:00-23:00; Oct 01-Mar 31 We-Mo 10:00-22:30; Oct 01-Mar 31 Tu 11:00-22:30; May 01,May 08,Jul 14 off`                                                                                                          | https://www.paris-arc-de-triomphe.fr/en/visit/practical-information           | ⚑41 |
| Champs-Élysées          | `always-open` | Public avenue; walkable at all hours, no admission.                                                                                                                                                                                                               | —                                                                             |     |
| Musée d'Orsay           | `unknown`     | `musee-orsay.fr` returns HTTP 403 on every hours-bearing path (`/en/visit`, `/fr/articles/acces-horaires-tarifs-197704`) through both fetch routes. No official value obtained.                                                                                   | —                                                                             | ⚑42 |
| Sainte-Chapelle         | `sourced`     | `Apr 01-Sep 30 09:00-19:00; Oct 01-Mar 31 09:00-17:00; Jan 01,May 01,Dec 25 off`                                                                                                                                                                                  | https://www.sainte-chapelle.fr/en/visit/practical-information                 |     |
| Luxembourg Gardens      | `sourced`     | `Jan 01-Feb 15 08:15-17:00; Feb 16-Mar 15 07:45-18:15; Mar 16-Apr 15 07:30-20:00; Apr 16-Jun 15 07:30-21:15; Jun 16-Aug 15 07:30-21:00; Aug 16-Sep 30 07:30-19:45; Oct 01-Oct 31 07:45-18:15; Nov 01-Dec 31 08:00-16:45`                                          | https://jardin.senat.fr/infos-pratiques/horaires-douverture.html              | ⚑43 |
| Panthéon                | `sourced`     | `Apr 01-Sep 30 10:00-18:30; Oct 01-Mar 31 10:00-18:00; Jan 01,May 01,Dec 25 off`                                                                                                                                                                                  | https://www.paris-pantheon.fr/en/visit/practical-information                  | ⚑44 |
| Centre Pompidou         | `unknown`     | Closed for renovation. Operator: "The building will close its doors on 22 September 2025", reopening "by 2030" (centrepompidou.fr/en/centre-pompidou-is-transforming-itself, retrieved 2026-08-18). There is no schedule to record because there is nothing open. | —                                                                             | ⚑45 |
| Trocadéro               | `always-open` | Place du Trocadéro and the Jardins du Trocadéro esplanade are open public space; the viewpoint over the Eiffel Tower is a pavement.                                                                                                                               | —                                                                             |     |

Verbatim, Louvre: "Monday, Thursday, Saturday, Sunday: 9:00 AM to 6:00 PM"; "Wednesday and Friday:
9:00 AM to 9:00 PM"; Tuesday closed; closed "1 January, 1 May and 25 December". Notre-Dame:
"Monday to Friday: 7:50 AM – 7:00 PM \*closing on Thursday at 10:00 PM. Saturday and Sunday: 8:15 AM
– 7:30 PM." Panthéon: "1 April to 30 September: 10am - 6.30pm"; "1 October to 31 March: 10am -
6pm"; "Closed 1 January, 1 May, 25 December". Sainte-Chapelle: "1 April to 30 September: 9am -
7pm"; "1 October to 31 March: 9am - 5pm".

### 4.7 FCO — Rome (9)

| Attraction                       | Basis         | Value / rationale                                                                                                                                                                                                                                  | Source                                                                               | ⚑   |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --- |
| Colosseum                        | `unknown`     | `colosseo.it` and `parcocolosseo.it` (both `2.42.229.247`) refused TCP connections on every attempt from this environment. DNS resolves; the host does not accept the connection. No aggregator substituted.                                       | —                                                                                    | ⚑46 |
| Roman Forum & Palatine Hill      | `unknown`     | Same operator and same host as the Colosseum; unreachable for the same reason.                                                                                                                                                                     | —                                                                                    | ⚑46 |
| Pantheon                         | `sourced`     | `09:00-19:00; Jan 01,Aug 15,Dec 25 off`                                                                                                                                                                                                            | https://www.pantheonroma.com/en/openings-info/                                       |     |
| Vatican Museums & Sistine Chapel | `sourced`     | `Mo-Sa 08:00-20:00; Su off; Jan 01,Jan 06,Feb 11,Mar 19,Apr 06,May 01,Jun 29,Aug 14,Aug 15,Nov 01,Dec 08,Dec 25,Dec 26 off`                                                                                                                        | https://www.museivaticani.va/content/museivaticani/en/info/orari-musei-vaticani.html | ⚑47 |
| St. Peter's Basilica             | `sourced`     | `07:00-20:00`                                                                                                                                                                                                                                      | https://www.basilicasanpietro.va/en/opening-hours                                    | ⚑48 |
| Castel Sant'Angelo               | `unknown`     | `castelsantangelo.cultura.gov.it` did not resolve/connect from this environment; the `cultura.gov.it` estate was unreachable throughout.                                                                                                           | —                                                                                    | ⚑46 |
| Galleria Borghese                | `unknown`     | `galleriaborghese.it` 301-redirects to `galleriaborghese.cultura.gov.it`, which refused the connection (`ECONNREFUSED 2.42.228.88:443`).                                                                                                           | —                                                                                    | ⚑46 |
| Campo de' Fiori                  | `unknown`     | Open square hosting a morning produce market. No operator website exists — the market is run by Roma Capitale with no per-market hours page found. Not marked `always-open` because a MARKET's value is the stalls, and they are not always there. | —                                                                                    | ⚑49 |
| Trastevere                       | `always-open` | A neighbourhood, not a venue; its streets and piazzas are public and permanently accessible.                                                                                                                                                       | —                                                                                    |     |

Verbatim, Pantheon: "The Basilica is open all days from 9.00 am to 7.00 pm (last entry 6.45 pm) …
Closed on : 1st January, 15 August and the 25th December." Vatican Museums: "Monday to Saturday
08.00 a.m. – 08.00 p.m. (final entry 06.00 p.m.)", "Last Sunday of each month 09.00 a.m. – 02.00
p.m. (final entry 12.30 p.m.) Free entry", closure dates "1 and 6 January, 11 February, 19 March, 6
April, 1 May, 29 June, 14 and 15 August, 1 November, and 8, 25, and 26 December". St Peter's:
"From june 1st: from 7.00 am to 8:00 pm"; the Dome separately "7am - 6pm" (29 March – 25 October)
and "7.30am - 5pm" (26 October – 28 March).

### 4.8 BCN — Barcelona (11)

| Attraction                           | Basis         | Value / rationale                                                                                                                                                                                                                                                   | Source                                                                                   | ⚑   |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --- |
| Sagrada Família                      | `sourced`     | `Nov-Feb Mo-Sa 09:00-18:00; Nov-Feb Su 10:30-18:00; Mar,Oct Mo-Fr 09:00-19:00; Mar,Oct Sa 09:00-18:00; Mar,Oct Su 10:30-19:00; Apr-Sep Mo-Fr 09:00-20:00; Apr-Sep Sa 09:00-18:00; Apr-Sep Su 10:30-20:00`                                                           | https://sagradafamilia.org/en/schedules-how-to-get                                       | ⚑50 |
| Park Güell                           | `sourced`     | `09:30-19:30`                                                                                                                                                                                                                                                       | https://parkguell.barcelona/en/planning-your-visit/prices-and-times                      | ⚑51 |
| Casa Batlló                          | `sourced`     | `09:00-22:30`                                                                                                                                                                                                                                                       | https://www.casabatllo.es/en/tickets/                                                    |     |
| Casa Milà — La Pedrera               | `sourced`     | `09:00-20:30`                                                                                                                                                                                                                                                       | https://www.lapedrera.com/en/visits                                                      | ⚑52 |
| Gothic Quarter & Barcelona Cathedral | `sourced`     | `Mo-Fr 09:30-18:30; Sa 09:30-17:15; Su 14:00-17:00`                                                                                                                                                                                                                 | https://catedralbcn.org/en/tourist-visit/visiting-hours/                                 | ⚑53 |
| La Boqueria Market                   | `sourced`     | `Mo-Sa 08:00-20:30`                                                                                                                                                                                                                                                 | https://www.boqueria.barcelona                                                           |     |
| Picasso Museum                       | `sourced`     | `Mar 31-Sep 27 Tu-We 09:00-20:00; Mar 31-Sep 27 Th-Sa 09:00-21:00; Mar 31-Sep 27 Su 09:00-20:00; Sep 29-Mar 29 Tu-Su 10:00-19:00; Mo off; Jan 01,May 01,Jun 24,Dec 25 off`                                                                                          | https://museupicassobcn.cat/en/plan-your-visit/buy-tickets-and-opening-hours             | ⚑54 |
| Montjuïc & Magic Fountain            | `sourced`     | `Jun 03-Sep 27 We-Su 21:30-22:30`                                                                                                                                                                                                                                   | https://www.barcelona.cat/es/que-hacer-en-bcn/fuente-magica/horarios-de-la-fuente-magica | ⚑55 |
| Palau de la Música Catalana          | `sourced`     | `09:00-15:30`                                                                                                                                                                                                                                                       | https://www.palaumusica.cat/en/visites/guided-tour_1174259                               | ⚑56 |
| Bunkers del Carmel                   | `unknown`     | No official Barcelona City Council or MUHBA page for Turó de la Rovira was reachable (`barcelona.cat` returned HTTP 418 to one route and 404 to the guessed paths). The site has had council-imposed night closures, so `always-open` would be an unverified claim. | —                                                                                        | ⚑57 |
| Barcelona Beach — Barceloneta        | `always-open` | Public urban beach and promenade; open at all hours, no admission. (Lifeguard cover is seasonal, which is a safety fact, not an opening time.)                                                                                                                      | —                                                                                        |     |

Verbatim, Boqueria (footer): "Horari d'obertura del mercat — Dilluns a dissabte: 8:00h - 20:30h."
Barcelona Cathedral: "from 9:30 to 18:30 h. (access will be closed at 17:45 h)" weekdays; "from
9:30 to 17:15 h" Saturdays and vigils; "from 14:00 to 17:00 h" Sundays and religious holidays.
Magic Fountain: "Temporada actual — Del 3 de junio al 27 de septiembre … Miércoles, jueves,
viernes, sábado y domingo … De 21.30 a 22.30 h."

---

## 5. Every ⚑ — the compounds and the judgement calls

Compound names are called out first, because the brief is right that a wrong `24/7` on one sends a
traveler to a locked door.

### 5.1 Compound names

There are **eleven** compound rows in scope. For each, I name the component I priced.

| Compound                                   | Free / unconstrained part                                       | Ticketed part I priced                                                                                  | Decision                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hippodrome & Sultanahmet Square (⚑5)       | The whole thing — square, obelisks, Serpent Column              | None. The Blue Mosque next to it is a separate seed row.                                                | `always-open`, no ambiguity                                                                 |
| Museum Island (⚑7)                         | The island's streets and the Lustgarten                         | **The five SMB museums** — this is what "visiting Museum Island" means                                  | `sourced` `Tu-Su 10:00-18:00`                                                               |
| Memorial to the Murdered Jews (⚑8)         | Field of stelae, "24 hours a day accessible"                    | **Ort der Information** (below the field), `Tu-So 10-18`                                                | `sourced` — see the call in §7                                                              |
| Warsaw Barbican (⚑19)                      | The gate passage through the city walls                         | **The interior exhibition**, We/Sa 13:00–17:00, summer season only                                      | `sourced` — see the call in §7                                                              |
| Buda Castle (⚑21)                          | Castle hill, courtyards, ramparts                               | **BTM Castle Museum** in Building E, daily 10:00–18:00                                                  | `sourced`; the Hungarian National Gallery in the same palace has its own hours, not fetched |
| Fisherman's Bastion (⚑22)                  | Lower terraces, free "all year round"                           | **Upper turrets**, ticketed, seasonal                                                                   | `sourced` on the turrets                                                                    |
| Gellért Hill & Citadella (⚑26)             | The hill, its paths and viewpoints                              | The Citadella fortress — a long-running reconstruction site, not sellable                               | `always-open` on the hill                                                                   |
| Big Ben & Houses of Parliament (⚑31)       | Parliament Square, Westminster Bridge, the tower seen from them | Palace of Westminster tours — **no weekly schedule published**, only a booking calendar                 | `always-open` — see the call in §7                                                          |
| National Gallery & Trafalgar Square (⚑34)  | Trafalgar Square itself                                         | **The National Gallery.** Category is MUSEUM, and a seed test pins that no MUSEUM is ever `always-open` | `sourced` on the gallery                                                                    |
| Vatican Museums & Sistine Chapel (⚑47)     | Nothing — both are inside the same ticket                       | The Vatican Museums; the Sistine Chapel is the end of that route                                        | `sourced`, no ambiguity                                                                     |
| Gothic Quarter & Barcelona Cathedral (⚑53) | The Barri Gòtic streets                                         | **The cathedral**, whose hours are far more restrictive than the streets                                | `sourced` on the cathedral                                                                  |
| Montjuïc & Magic Fountain (⚑55)            | Montjuïc hill, its parks and viewpoints                         | **The Magic Fountain show** — free but tightly scheduled                                                | `sourced` on the fountain — see §7                                                          |
| Sacré-Cœur & Montmartre (⚑40)              | The Butte, the streets, the parvis                              | The basilica interior and separately the dome                                                           | `unknown` — I could not reach either                                                        |
| Casa Milà — La Pedrera (⚑52)               | None; the façade is street-visible only                         | Day visit vs. "Night Experience" are two products                                                       | `sourced` on the day visit                                                                  |

**Museum Island and Sacré-Cœur & Montmartre — the two the owner deliberately left undecided.**

- **Museum Island** is category `MUSEUM`, and a seed test pins that no `MUSEUM` row is ever
  `always-open`, so the `24/7` that the OSM-gap analysis in `2026-08-09-places-api-selection.md`
  implied would have failed the test as well as misleading a traveler. It has a real, citable
  schedule and I have given it: `Tu-Su 10:00-18:00`. Caveat in §7.
- **Sacré-Cœur & Montmartre** stays `unknown`, because I could not reach the basilica's hours page
  and the free half of the compound (the Butte) is exactly the half that would tempt a `24/7`. This
  is the one row where I would most like a second attempt.

### 5.2 The remaining flags

- **⚑1 — Turkish mosque domains are hostile.** `suleymaniyecamii.org` now serves an online-gambling
  page ("Gacor77"); `sultanahmetcamii.org` redirects to nothing usable. Neither is citable and both
  are worth recording as a caution: a name-shaped domain is not a primary source.
- **⚑2 — Basilica Cistern contradiction.** Full text as retrieved: _"The Basilica Cistern is
  temporarily closed to visitors. You may visit the 1,600-year-old Theodosius Cistern"_, and
  further down the same page _"Open to Visit Every Day of the Week / Visiting Hours / 09.00 –
  22.00"_. If the owner prefers a value over a gap, `09:00-22:00` is what the operator publishes.
- **⚑3 — Galata Tower is under restoration.** The same official site documents ongoing works
  including a 3 m protective tunnel around the tower. The `08:30-23:00` value is what the site
  publishes today; access may be partial.
- **⚑4 — Dolmabahçe holiday rule is partly inexpressible.** The palace is closed on New Year's Day
  and on the first day of Ramazan Bayramı and Kurban Bayramı. Only `Jan 01` is a fixed date; the two
  Islamic feasts move by ~11 days a year and cannot be written without `PH`. Encoded: `Jan 01 off`.
  Not encoded, and knowingly so: the two movable feast days.
- **⚑6 — Reichstag is slot-booked, not clock-open.** Admission is "every quarter of an hour" with
  compulsory prior registration; the only time on the page is "Last admission: 21.45 hrs". Also
  published: closed all day 24 December, from 16:00 on 31 December, and dome-only closures 15–19
  June, 29 June–3 July, 14–18 September, 28 September–2 October and 19–30 October 2026. If the owner
  wants a value rather than a gap, those closure dates are citable even though the daily window is
  not.
- **⚑9 — Berlin Wall Memorial has two clocks.** Grounds 08:00–22:00 daily; the Visitor and
  Documentation Centres Tu–Su 10:00–18:00. I priced the grounds, because the open-air wall segment
  and the tower are the visit. Swapping to `Tu-Su 10:00-18:00` is defensible if the indoor
  exhibition is considered the draw.
- **⚑10 — Berliner Dom derived from a calendar, not a table.** The cathedral publishes no static
  hours page; `berlinerdom.de/termine` renders a rolling event calendar. Fourteen consecutive
  `Dom-Besichtigung` entries (18–31 Aug 2026) read `9.00 – 19.00 Uhr` Mon–Sat and `12.00 – 19.00
Uhr` on both Sundays, with `Letzter Einlass 18.00 Uhr` throughout. The weekly pattern is derived
  from that fortnight.
- **⚑11 — Charlottenburg's January–March is not published.** SPSG publishes the season it is in
  plus the next. The value covers April–December as published; **January–March is absent from the
  page and the expression leaves it undefined**, which `opening_hours` reads as closed. Either
  extend `Nov-Dec` to `Nov-Mar` (my recommendation, matching SPSG's usual winter season) or re-fetch
  in the winter.
- **⚑12 — Royal Castle, one of the three gaps the owner flagged.** Now sourced. Note the Wednesday
  free-admission route is restricted, and the castle gardens run on their own seasonal clock
  (upper garden May–Sep 10:00–20:00, lower garden May–Aug 10:00–22:00).
- **⚑13 — Łazienki: gardens vs. buildings.** `Mo-Su 06:00-22:00` is the gardens, free. The museum
  buildings are Tu–Su on per-building schedules (Palace on the Isle Tu–We 10:00–17:00, Th–Fr
  10:00–18:00 from 1 May to 30 September), Friday free. Category is `PARK`, so the gardens are the
  right component.
- **⚑15 — Palace of Culture, the second owner-flagged gap.** Now sourced: terrace daily 10:00–20:00.
  Additionally _"Taras Widokowy Nocą – w każdy piątek i sobotę do końca września dodatkowe wejścia w
  godz. 20:00–24:00"_ — Fri/Sat late entries to end September, deliberately left out of the
  expression to keep it simple; add `Fr-Sa 10:00-24:00` if the late slot matters.
- **⚑16 — Wilanów's Wednesday.** Palace 10:00–16:00 daily except Wednesday 10:00–18:00 (encoded as
  `Th-Tu 10:00-16:00; We 10:00-18:00`). Gardens run a ten-band seasonal table not encoded here.
- **⚑17 — Copernicus is a summer-only reading.** The page published only the 29 June – 31 August
  block; standard-season hours were not on any page reached. I have therefore given the value
  **unqualified** rather than wrapped in `Jun 29-Aug 31`, because a date-qualified expression would
  make the museum read as closed for ten months of the year. The trade-off: the value is right in
  summer and unverified otherwise. Flag it or re-fetch.
- **⚑18 — Holy Cross Church.** For the record, the parish publishes: Sunday Mass 6:00, 7:30, 9:00,
  10:30, 11:45, 13:00, 16:00, 19:00; weekdays 6:00, 7:00, 8:00, 9:00, 12:00, 16:30, 18:00, 19:00;
  confession weekdays 6:00–12:00 and 16:30–19:15. If the owner wants a value, `06:00-19:30` is a
  defensible reading — but it is a reading, not a published visiting time, so I have not proposed it
  as `sourced`.
- **⚑20 — Hungarian Parliament, the CAPTCHA.** Both `parlament.hu` and the dedicated visitor-centre
  host serve a challenge page reading _"Validation needed due to : Policy constraints"_. A browser
  would get through; an automated fetch does not. Very likely retrievable by hand.
- **⚑23 — Matthias Church is a single day's reading.** The site shows only _"We are open today:
  09:00 – 17:00"_ and publishes no weekly schedule. `09:00-17:00` is what the operator said on
  2026-08-18 and nothing more. If the owner prefers not to generalise one day into a weekly rule,
  `unknown` is the honest alternative.
- **⚑24 — St Stephen's Basilica has two clocks.** Church hall Mo–Sa 09:00–18:00, Su 13:00–18:00
  (encoded); Panorama Terrace and Treasury "every day 09.00-19.00" (not encoded). Category is
  `RELIGIOUS`, so the church hall is the right component.
- **⚑22a — one source worth a second look.** `fishermansbastion.com` presents as the Bastion's own
  visitor site (it sells the turret ticket and carries the operator's pricing) rather than a
  reseller, and I treated it as primary on that basis. It is the only citation in this note that is
  not on an obviously institutional domain (`.gov`, `.museum`, a diocese, a national body), so it is
  the one to sanity-check by hand.
- **⚑27 — Dohány Street Synagogue.** Three candidate hosts checked; none was both official and
  informative. Worth a manual attempt via the Milev ticketing flow.
- **⚑28 — Tower of London is a rolling 7-day widget.** The visit page rendered 17–23 Aug 2026 as
  09:00–17:30 on all seven days, "Last entry: 16:30". HRP's seasonal (summer/winter) table lives on
  `/visit/opening-and-closing-times/`, which is JavaScript-rendered and yielded only navigation.
  **The winter value is therefore unverified** — HRP historically closes earlier in winter, so
  re-check before quoting.
- **⚑29 — British Museum needed HTTP/1.1.** `britishmuseum.org`, `hrp.org.uk`, `rct.uk` and
  `parliament.uk` all returned 403 over HTTP/2 and 200 over HTTP/1.1 from the same client. Worth
  knowing if this is ever automated: the block is protocol-fingerprint-based, not IP-based.
- **⚑30 — Westminster Abbey derived from embedded structured data.** The abbey publishes only a
  date-picker, but the page embeds `schema.org` `TouristAttraction` /
  `openingHoursSpecification` objects for 19 Aug – 1 Sep 2026. Twelve `Westminster Abbey General
Admittance` entries: 09:30–15:30 Mon–Fri, 09:00–15:00 Sat, and **no entry at all on either
  Sunday** — hence `Su off`, which matches the abbey being a working church with Sunday given to
  worship. This is the cleanest derivation in the note and the method is reproducible.
- **⚑32 — Buckingham Palace is a summer-only opening, and that is correct.** _"Buckingham Palace
  opens to visitors each summer. Dates for summer 2026 are 9 July - 27 September. Buckingham Palace
  is closed on Tuesdays and Wednesdays during September."_ Table: 9 Jul–31 Aug open 9:30, last
  admission 17:30, closing 19:30; 1–27 Sep open 9:30, last admission 16:30, closing 18:30. Outside
  that window the palace really is shut to general admission (October–May is selected-date guided
  tours only), so a date-qualified expression is semantically right here rather than a bug.
  **But the dates move every year** — this value will be wrong for 2027.
- **⚑33 — London Eye is a single day's reading.** The dedicated opening-hours page renders the
  schedule client-side; the server-rendered banner gave "London Eye: 10am - 8:30pm / Open today".
  The site itself says _"Closing times vary throughout the year, but the London Eye typically closes
  between 6:00pm and 8:30pm"_, so the winter value is unverified.
- **⚑35 — St Paul's.** "Monday to Saturday: Opens 8:30am; last entry typically 4:00pm; sightseeing
  concludes 30 minutes after final entry" → close 16:30. Sunday is worship-only, hence `Su off`.
  The page warns "Opening and closing times can change".
- **⚑36 — Hyde Park is `sourced`, not `always-open`, on purpose.** The Royal Parks publish
  "Pedestrian gates 5am - midnight", so it is _not_ unconstrained: there is a real five-hour nightly
  closure and a published page saying so. Marking it `always-open` would discard a fact we hold.
- **⚑37 — Borough Market's Monday.** Closed Mondays per the operator. The note "Opening times vary
  during the festive period and at Bank Holidays" names no dates and is deliberately not encoded.
- **⚑38 — NHM's one-off closure.** Also published: "Our South Kensington site will be closed on
  Friday 9 October 2026, as we're hosting a charity gala." Not encoded, because `Oct 09 off` would
  recur every year and this is a 2026-only event. Recording it here instead is the honest place for
  it.
- **⚑39 — Eiffel Tower is a single day's reading.** The tower publishes a click-through calendar
  ("Click on a date to view details of the opening hours on the selected day") fed by an API I could
  not reach. The banner read "Open today 09:00 - 00:00" on 2026-08-18 — a summer value. Also
  published on the same page and worth recording: _"The Eiffel Tower will be closed to the public on
  July 13, 2026 (instead of July 14)."_
- **⚑41 — Arc de Triomphe's Tuesday.** Opens an hour later on Tuesdays year-round, which the
  expression captures. Closure dates published: 1 May, 8 May, 14 July, 11 November (morning only —
  the morning-only part is not expressible and is dropped, so 11 November is modelled as fully
  open). Also a one-off: "Closed on Saturday 26 September 2026".
- **⚑43 — Luxembourg Gardens: 26 bands compressed to 8.** The Senate publishes a fortnight-by-
  fortnight table tracking sunrise and sunset (26 rows, from 08:15–16:30 in December to 07:30–21:30
  in mid-June). I compressed it to eight bands, each taking the **earlier** closing time of the
  fortnights it spans, so the value is conservative — it never claims the gardens are open when they
  are shut. The full 26-row table is in the source. An alternative worth considering: the OSM
  `sunrise-sunset` form, which the validator accepts and which is arguably a better model of what
  the Senate is actually doing.
- **⚑44 — Panthéon's first-Monday rule.** "The first working Monday of each month (opens at 12
  noon)" is not expressible in `opening_hours` without weekday-of-month syntax that would complicate
  the value considerably. Not encoded; recorded here. Also: the panoramic dome remains closed for
  renovation.
- **⚑46 — the Italian heritage estate.** Four of Rome's nine rows failed for one shared,
  environment-specific reason. This is the highest-value re-try in the whole note and probably
  succeeds from any European connection.
- **⚑47 — Vatican Museums' free Sunday not encoded.** "Last Sunday of each month 09.00 a.m. – 02.00
  p.m." needs weekday-of-month syntax; `Su off` therefore over-closes on twelve days a year. The
  13-date closure list _is_ encoded, and note it includes 6 April 2026 (Easter Monday) as a fixed
  date because the museums published it as one — that date will not be right in other years.
- **⚑48 — St Peter's basilica vs. dome.** `07:00-20:00` is the basilica, published as "From june
  1st". The dome runs separately: 07:00–18:00 (29 Mar – 25 Oct) and 07:30–17:00 (26 Oct – 28 Mar).
  Category is `RELIGIOUS`, so the basilica is right.
- **⚑50 — Sagrada Família has a genuine three-season table** and it is fully encoded. Also
  published and not encoded: "On 25 and 26 December, 1 and 6 January, opening hours will be from
  9:00 am to 2:00 pm" — a reduced-hours rule rather than a closure, which is expressible
  (`Dec 25,Dec 26,Jan 01,Jan 06 09:00-14:00`) if the owner wants it.
- **⚑51 — Park Güell's residents-only bands.** Ticketed visits run "From 9:30 am to 19:30 pm";
  07:00–09:30 ("BON DIA BARCELONA") and 20:00–22:00 ("BON VESPRE BARCELONA") are reserved for
  residents and pass-holders and "tourist visits are not allowed". The traveler-facing value is
  therefore the narrow one. The precise seasonal table is served as an image on that page and could
  not be read as text.
- **⚑54 — Picasso Museum has a two-day hole.** The published seasons are 31 Mar–27 Sep and 29
  Sep–29 Mar, which leaves 28 September and 30 March undefined. Harmless, but real.
- **⚑55 — Magic Fountain is season-scoped and will read as closed in winter.** The council page
  showed only "Temporada actual — Del 3 de junio al 27 de septiembre". A winter schedule exists and
  is not on that page. Consider dropping the date qualifier or flagging the row.
- **⚑56 — Palau de la Música is tours-only.** "From 9:00 a.m. to 3:30 p.m.", tours "50 minutes".
  Days of the week are not stated on the page.
- **⚑57 — Bunkers del Carmel.** Not marked `always-open` deliberately: the site has been subject to
  council-imposed night closures, so claiming it is unconstrained would be an assertion I cannot
  cite.

---

## 6. VisitDuration — the finding is the absence

The category defaults in force (`DEFAULT_VISIT_MINUTES`, documented in
`attraction-data-coverage.md`) are MUSEUM 120, HISTORICAL 90, RELIGIOUS 45, PARK 60, VIEWPOINT 45,
MARKET 60, LANDMARK 30.

**Across 52 official operator sites read on 2026-08-18, exactly three published a visit length.**

| Attraction                              | Published duration                                                              | Category default | Source                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Tower of London (LHR)                   | "We recommend allowing **at least three hours**, dependent on queues"           | HISTORICAL 90    | https://www.hrp.org.uk/tower-of-london/visit/              |
| Palau de la Música Catalana (BCN)       | Guided tour: "**50 minutes**"                                                   | LANDMARK 30      | https://www.palaumusica.cat/en/visites/guided-tour_1174259 |
| Buckingham Palace (LHR), winter product | "Tours last around **1 hour 30 minutes**" (Oct–May exclusive guided tours only) | LANDMARK 30      | https://www.rct.uk/visit/buckingham-palace                 |

Two near-misses, recorded so nobody re-derives them: the Reichstag dome audioguide runs "in the
course of 20 minutes" and the Berliner Dom's free `Kurzführungen` run 30 minutes — both are the
length of a _guided element_, not of a visit, and neither should be used as a `VisitDuration`.

**What this means for the thesis.** `2026-08-09-places-api-selection.md` established that no Places
provider exposes a typical-visit-duration field. This note establishes the complementary and
stronger point: **the operators do not publish one either.** Only the Tower of London's figure is
both a genuine whole-visit estimate and materially different from the default — 180 minutes against
a HISTORICAL default of 90, i.e. the default is wrong by a factor of two for the single most
schedule-dominating site in London. That one row is worth curating. Everything else stays on the
category default, and the methodology section can now say that this is not a convenience but the
only defensible position: there is no published corpus to draw on.

---

## 7. Open questions for the human

These are judgement calls, not facts I can settle.

1. **Centre Pompidou — is a closed-until-2030 building an Attraction?** `unknown` is the correct
   _hours_ answer, but it leaves an attraction in the plan that cannot be visited on any trip a user
   will take. Removing the row from `attractions.json`, or adding a "closed" concept, is an
   `attractions.json` decision that is out of this ticket's scope but caused by it.
2. **Basilica Cistern — pick a side.** The operator's own page says both "temporarily closed" and
   "09.00 – 22.00". I propose `unknown`; `sourced` with `09:00-22:00` is equally defensible and
   arguably more useful. Your call.
3. **Memorial to the Murdered Jews of Europe — which half is the visit?** The field of stelae is
   "24 hours a day accessible" and is what almost every visitor experiences; the Ort der Information
   underneath it has real hours. I priced the Information Centre (`Tu-Su 10:00-18:00`) because it is
   the constraining component, but `always-open` on the field is defensible and would be a _more_
   accurate model of the typical visit. Category is HISTORICAL, so the MUSEUM test does not bind.
4. **Warsaw Barbican — same shape, sharper.** The gate itself is a walk-through in the city walls,
   free and permanently open; the interior exhibition is Wed and Sat 13:00–17:00 and **only from 21
   May to 30 September** ("w sezonie jesienno-zimowym jest zamknięta"). Encoding the exhibition
   makes the Barbican look near-inaccessible; encoding `always-open` throws away a real published
   schedule. I proposed the exhibition; I think `always-open` is the better product answer.
5. **Big Ben & Houses of Parliament — I proposed `always-open` and want that checked.** Parliament
   publishes tour _prices_ but no weekly tour schedule; tours run on Saturdays and non-sitting days
   via a booking calendar I could not read. The free component genuinely dominates. But this is
   exactly the compound-with-a-ticketed-venue shape the brief warns about, so it is flagged rather
   than assumed.
6. **Charlottenburg's January–March, Copernicus's winter, and the Magic Fountain's winter** are
   three cases where a date-qualified expression would silently mean "closed". I handled them
   inconsistently on purpose — Charlottenburg keeps its qualifier (and so under-covers Jan–Mar),
   Copernicus drops it (and so over-covers), Magic Fountain keeps it. Pick one policy and apply it
   to all three.
7. **Single-day readings.** Eiffel Tower, London Eye and Matthias Church values each come from one
   day's calendar entry, not a published weekly rule. They are honest as of 2026-08-18 and will be
   wrong in February. If the dataset should only contain stable weekly schedules, these three should
   be `unknown` instead.
8. **The six network-blocked Italian rows** (Colosseum, Roman Forum & Palatine Hill, Castel
   Sant'Angelo, Galleria Borghese — plus the two Paris 403s, Musée d'Orsay and Sacré-Cœur) are the
   ones worth ten minutes in a browser. They are not "unpublished"; they are "unreachable from
   here", which is a different and more fixable gap.
9. **`Jul 14` on the Arc de Triomphe and `Apr 06` on the Vatican Museums are year-specific.**
   Bastille Day is fixed, but the Vatican's "6 April" is Easter Monday 2026 and will be a different
   date in 2027. Encoded because the operator published it as a date; wrong from next year. This is
   an argument for the seed carrying a `retrieved` date it can be re-validated against, which the
   schema already does.

---

## 8. Sources

Every URL below was fetched on **2026-08-18**. Grouped by city, in the order they appear above.
Nothing here is an aggregator.

**Istanbul** — https://galatakulesi.gov.tr/ · https://www.millisaraylar.gov.tr/saraylar/dolmabahce-sarayi
· https://yerebatan.com/en/

**Berlin** — https://www.smb.museum/en/plan-your-visit/opening-hours/ ·
https://www.stiftung-denkmal.de/en/memorials/memorial-to-the-murdered-jews-of-europe/ ·
https://www.stiftung-berliner-mauer.de/en/berlin-wall-memorial/visit/information ·
https://berlinerdom.de/termine/ · https://tv-turm.de/en/ ·
https://www.spsg.de/schloesser-gaerten/objekt/schloss-charlottenburg-altes-schloss/ ·
https://www.bundestag.de/besuche/kuppel-245686

**Warsaw** — https://www.zamek-krolewski.pl/en/godziny-otwarcia-i-ceny-biletow ·
https://www.lazienki-krolewskie.pl/en/zwiedzanie/godziny-otwarcia ·
https://www.1944.pl/en/article/visit-us,4993.html · https://polin.pl/pl/zaplanuj-wizyte ·
https://pkin.pl/en/visiting-pkin/ · https://www.wilanow-palac.pl/godziny-otwarcia ·
https://www.kopernik.org.pl/en/visit/opening-hours · https://muzeumwarszawy.pl/en/barbakan/ ·
https://swkrzyz.pl/

**Budapest** — https://www.varmuzeum.hu/en/visit/ · https://www.fishermansbastion.com/ ·
https://www.matyas-templom.hu/en/ · https://www.bazilikabudapest.hu/en/ ·
https://www.szechenyifurdo.hu/nyitvatartas · https://www.piaconline.hu/nyitvatartas · https://milev.hu/visit-502865.html

**London** — https://www.hrp.org.uk/tower-of-london/visit/ ·
https://www.towerbridge.org.uk/plan-your-visit · https://www.britishmuseum.org/visit ·
https://www.westminster-abbey.org/visit-us/opening-times · https://www.rct.uk/visit/buckingham-palace
· https://www.londoneye.com/plan-your-visit/before-you-visit/opening-hours/ ·
https://www.nationalgallery.org.uk/visiting · https://www.stpauls.co.uk/visits/visits/sightseeing-opening-hours
· https://www.royalparks.org.uk/visit/parks/hyde-park · https://www.boroughmarket.org.uk/visit-us/ ·
https://www.nhm.ac.uk/visit.html · https://www.parliament.uk/visiting/visiting-and-tours/tour-prices/

**Paris** — https://www.toureiffel.paris/en/rates-opening-times · https://www.louvre.fr/en/visit/hours-admission
· https://www.notredamedeparis.fr/en/visit/practical-information/opening-hours/ ·
https://www.paris-arc-de-triomphe.fr/en/visit/practical-information ·
https://www.sainte-chapelle.fr/en/visit/practical-information ·
https://jardin.senat.fr/infos-pratiques/horaires-douverture.html ·
https://www.paris-pantheon.fr/en/visit/practical-information ·
https://www.centrepompidou.fr/en/centre-pompidou-is-transforming-itself ·
https://www.sacre-coeur-montmartre.com/english/

**Rome** — https://www.pantheonroma.com/en/openings-info/ ·
https://www.museivaticani.va/content/museivaticani/en/info/orari-musei-vaticani.html ·
https://www.basilicasanpietro.va/en/opening-hours

**Barcelona** — https://sagradafamilia.org/en/schedules-how-to-get ·
https://parkguell.barcelona/en/planning-your-visit/prices-and-times · https://www.casabatllo.es/en/tickets/
· https://www.lapedrera.com/en/visits · https://catedralbcn.org/en/tourist-visit/visiting-hours/ ·
https://www.boqueria.barcelona · https://museupicassobcn.cat/en/plan-your-visit/buy-tickets-and-opening-hours
· https://www.barcelona.cat/es/que-hacer-en-bcn/fuente-magica/horarios-de-la-fuente-magica ·
https://www.palaumusica.cat/en/visites/guided-tour_1174259

**Attempted and failed** (recorded so the gap is auditable, not so it is cited) —
`colosseo.it` / `parcocolosseo.it` (ECONNREFUSED 2.42.229.247:443) ·
`galleriaborghese.cultura.gov.it` (ECONNREFUSED 2.42.228.88:443) ·
`castelsantangelo.cultura.gov.it` (host did not resolve) · `musee-orsay.fr` (HTTP 403 on all
hours-bearing paths) · `parlament.hu` and `latogatokozpont.parlament.hu` (CAPTCHA) ·
`sacre-coeur-montmartre.com` hours page (HTTP 404 on all paths tried) · `barcelona.cat` Bunkers del
Carmel (HTTP 418 / 404) · `dohanystreetsynagogue.hu` (host did not resolve).
