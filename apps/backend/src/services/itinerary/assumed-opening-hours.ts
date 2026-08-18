import type { AttractionCategory } from '@smartroute/shared';
import type { MinutesOfDay } from './zoned.js';

/** The part of a day an Attraction of some AttractionCategory is assumed open. */
export interface AssumedOpeningWindow {
  opens: MinutesOfDay;
  closes: MinutesOfDay;
}

const at = (hour: number): MinutesOfDay => hour * 60;

/**
 * The window an Attraction is assumed open for, per AttractionCategory, used
 * only where its OpeningHours are unknown.
 *
 * This is the OpeningHours twin of `DEFAULT_VISIT_MINUTES`: explicit data where
 * it exists, a documented default where it does not, disclosed either way. A
 * VisitSlot scheduled against one of these carries `hoursAssumed`, so the
 * traveler can tell an opening time we know from one we guessed and check
 * before they travel.
 *
 * Dropping such Attractions instead was rejected in the parent spec — silently
 * losing a must-go landmark for a data reason the traveler cannot see is worse
 * than an approximate opening time. Scheduling them around the clock was the
 * behaviour before this table existed, and sent a traveler to a museum at six
 * in the morning.
 *
 * Which is why these are a *preference* and not a constraint. The scheduler
 * places a visit inside its window wherever the stay allows and outside it
 * where nothing does, rather than dropping it — reintroducing the very
 * exclusion above by the back door. A published closure, which is a fact, is
 * itself only ever flagged (#30); a guess cannot outrank one.
 *
 * Like the VisitDuration defaults these are our own judgement rather than a
 * sourced figure — no provider publishes a per-category opening window either —
 * and the thesis has to declare them as such. They are drawn from what the
 * categories are rather than from any one city's habits, so they are
 * deliberately wide: an assumed window is a plausibility bound, and one narrower
 * than reality would push a visit off a day it could genuinely have happened on.
 *
 * - `MUSEUM` — the canonical ticketed museum day, and the tightest of the seven.
 * - `HISTORICAL` — palaces, castles and excavated sites; opens earlier than a
 *   museum, shuts around the same time.
 * - `RELIGIOUS` — working places of worship, open from around morning prayer
 *   until dusk.
 * - `MARKET` — trading hours: set up early, wound down before the evening.
 * - `PARK` — gated parks run dawn to dusk; a conservative daylight band.
 * - `VIEWPOINT` — towers and terraces, kept open for the evening view. Its close
 *   coincides with `DAY_END_MINUTES` on purpose: the honest assumption for this
 *   category is that nothing narrows the touring day further.
 * - `LANDMARK` — gates, bridges, squares and fountains, largely open-air with
 *   little to close; bounded because standing in a square at 06:00 is not the
 *   visit the Itinerary is promising.
 */
export const ASSUMED_OPENING_WINDOW: Record<AttractionCategory, AssumedOpeningWindow> = {
  MUSEUM: { opens: at(10), closes: at(18) },
  HISTORICAL: { opens: at(9), closes: at(18) },
  RELIGIOUS: { opens: at(8), closes: at(18) },
  MARKET: { opens: at(9), closes: at(19) },
  PARK: { opens: at(8), closes: at(20) },
  VIEWPOINT: { opens: at(9), closes: at(21) },
  LANDMARK: { opens: at(8), closes: at(20) },
};

/**
 * The window a visit may be placed in, or null where the Attraction's own
 * OpeningHours are known and this table has no business narrowing anything.
 *
 * Null rather than a permissive window so the caller cannot accidentally treat
 * "we know" and "we guessed" alike — which is the one distinction this whole
 * mechanism exists to keep. Known hours are honoured at the day level by
 * `closedOn`; placing a visit inside the hours of a day it is open is a
 * narrower question, and deliberately still open (see CONTEXT.md).
 */
export function assumedWindowFor(
  category: AttractionCategory,
  openingHours: string | null,
): AssumedOpeningWindow | null {
  return openingHours === null ? ASSUMED_OPENING_WINDOW[category] : null;
}
