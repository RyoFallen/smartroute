import type {
  AttractionCategory,
  EmptyDayReason,
  InterestEntry,
  ItineraryCity,
  ItineraryDay,
  ItineraryResponse,
  TripIntensity,
  VisitSlot,
} from '@smartroute/shared';
import { visitMinutesFor } from '../plan/visit-duration.js';
import { closedOn } from './closures.js';
import { bestArrangement } from './arrange.js';
import { selectAttractions } from './select.js';
import { optimalWalkingRoute } from './tour.js';
import type { LocalDate, MinutesOfDay } from './zoned.js';
import { datesInclusive, localIso, minutesOfDayFromHhMm, toLocal } from './zoned.js';

/**
 * Airport to city centre, plus dropping bags. The traveler's first VisitSlot has
 * to be one they can actually reach, so an arrival day cannot open at the
 * moment the wheels touch down.
 */
export const ARRIVAL_TRANSFER_MINUTES = 90;

/**
 * Checkout, the trip back out to the airport and international check-in. A plan
 * that ends any later is a plan that misses the flight.
 */
export const DEPARTURE_AIRPORT_MINUTES = 180;

/**
 * The end of the touring day. Attractions close and travelers stop; scheduling
 * a visit at 23:00 would be arithmetic, not a plan. Opening hours will narrow
 * this further once they are consulted.
 */
export const DAY_END_MINUTES = 21 * 60;

/**
 * How many VisitSlots a day may hold at most, per TripIntensity.
 *
 * A ceiling, not a quota (see CONTEXT.md on TripIntensity): a city with fewer
 * attractions than this yields a lighter day, never a padded one. Without it a
 * twelve-hour day swallows most of a city and leaves the rest of the stay empty,
 * which is arithmetically fine and no way to spend a holiday.
 *
 * MODERATE's six is the value the seed implies: every city holds ten to fifteen
 * attractions, so the ceiling starts to bind past about two days in one city —
 * the point at which the traveler has genuinely seen the place. RELAXED and
 * PACKED sit one long visit either side of it: four is a morning and an
 * afternoon with time to sit down, eight is a day that only works if you keep
 * moving.
 */
export const MAX_SLOTS_PER_DAY_BY_INTENSITY: Record<TripIntensity, number> = {
  RELAXED: 4,
  MODERATE: 6,
  PACKED: 8,
};

/** What a traveler who has not finished onboarding gets — the UserProfile column default. */
export const DEFAULT_TRIP_INTENSITY: TripIntensity = 'MODERATE';

export interface ItineraryAttractionInput {
  id: string;
  name: string;
  category: AttractionCategory;
  lat: number;
  lon: number;
  description: string;
  /** Curated VisitDuration; null falls back to the AttractionCategory default. */
  visitMinutes: number | null;
  /** OSM `opening_hours`; null is a real data gap, which the response discloses. */
  openingHours: string | null;
}

export interface AvailableCityInput {
  iata: string;
  available: true;
  name: string;
  timezone: string;
  /** In editorial rank order, which only breaks ties — the walking route decides what comes first. */
  attractions: ItineraryAttractionInput[];
  /** Walking minutes `[from][to]`, indexed into `attractions`. Must be square over them. */
  walkMinutes: number[][];
  /** When the traveler lands. Null for the origin city — an open tour has no arrival there. */
  arriveAt: string | null;
  /** When the onward flight leaves. Null for the final city. */
  departAt: string | null;
}

export type ItineraryCityInput = AvailableCityInput | { iata: string; available: false };

export interface ItineraryInput {
  tripId: string;
  /** Trip bounds as calendar dates — they open the origin stay and close the final one. */
  startDate: LocalDate;
  endDate: LocalDate;
  /** The traveler's stored wake-up time, "HH:mm". */
  wakeUpTime: string;
  /** The traveler's stored TripIntensity; defaults to `DEFAULT_TRIP_INTENSITY`. */
  intensity?: TripIntensity;
  /** The traveler's Interest ratings; absent or empty leaves editorial rank in charge. */
  interests?: InterestEntry[];
  /** In visiting order. */
  cities: ItineraryCityInput[];
}

/**
 * Turns a saved Trip into a day-by-day Itinerary.
 *
 * A pure function by design (spec §Testing Decisions): no database, no network
 * and — importantly — no clock, so the same Trip yields the same Itinerary
 * every time the traveler opens it. Everything variable is an argument,
 * including the walking-distance matrix, which the caller obtains from the
 * WalkingDistanceProvider.
 *
 * OpeningHours are consulted when placing a day (see `arrangeDays`): a visit is
 * kept off a day the attraction is shut wherever any arrangement of the stay
 * allows it, and flagged on the slot where none does.
 */
export function generateItinerary(input: ItineraryInput): ItineraryResponse {
  const wakeUpMinutes = minutesOfDayFromHhMm(input.wakeUpTime);
  const maxSlotsPerDay = MAX_SLOTS_PER_DAY_BY_INTENSITY[input.intensity ?? DEFAULT_TRIP_INTENSITY];
  const interests = input.interests ?? [];
  return {
    tripId: input.tripId,
    cities: input.cities.map((city) =>
      city.available
        ? scheduleCity({
            city,
            tripStart: input.startDate,
            tripEnd: input.endDate,
            wakeUpMinutes,
            maxSlotsPerDay,
            interests,
          })
        : { iata: city.iata, name: null, available: false, days: [] },
    ),
  };
}

/** Everything one city's stay is scheduled against. */
interface CitySchedule {
  city: AvailableCityInput;
  tripStart: LocalDate;
  tripEnd: LocalDate;
  wakeUpMinutes: MinutesOfDay;
  maxSlotsPerDay: number;
  interests: InterestEntry[];
}

function scheduleCity(stay: CitySchedule): ItineraryCity {
  const { city, tripStart, tripEnd, wakeUpMinutes, maxSlotsPerDay, interests } = stay;

  // Open tours: the origin city's stay starts on the trip's first day because
  // there is no arrival to wait for, and the final city's runs to the trip's
  // end date because there is no departure to close it.
  const arrival = city.arriveAt ? toLocal(city.timezone, city.arriveAt) : null;
  const departure = city.departAt ? toLocal(city.timezone, city.departAt) : null;
  const dates = datesInclusive(arrival?.date ?? tripStart, departure?.date ?? tripEnd);

  // Windows first, because what the stay can hold is what decides how many
  // attractions it is worth choosing.
  const stayDays: StayDay[] = dates.map((date, index) => {
    const isArrivalDay = arrival !== null && index === 0;
    const isDepartureDay = departure !== null && index === dates.length - 1;
    return {
      date,
      dayOfStay: index + 1,
      isArrivalDay,
      isDepartureDay,
      window: {
        opens: isArrivalDay
          ? Math.max(wakeUpMinutes, arrival.minutesOfDay + ARRIVAL_TRANSFER_MINUTES)
          : wakeUpMinutes,
        closes: isDepartureDay
          ? Math.min(DAY_END_MINUTES, departure.minutesOfDay - DEPARTURE_AIRPORT_MINUTES)
          : DAY_END_MINUTES,
      },
    };
  });

  // What the stay has room for, chosen before anything is routed: the ceiling is
  // per day, so the whole stay holds at most one day's worth times the days that
  // can hold anything. Days the flights wiped out — a dawn departure, a midnight
  // landing — are excluded, and that exclusion is what makes Interests matter:
  // counted, they would raise the limit past what the traveler will ever see, and
  // the surplus would then be trimmed by the walking route rather than by what
  // the traveler likes. Interests decide who makes the cut (see
  // `selectAttractions`), which is also why a walking route is only ever solved
  // over the attractions the traveler will actually be shown.
  //
  // A day left with a genuine but tiny sliver still counts: it has real time in
  // it, and whether a particular visit fits is not knowable before the route is.
  const walkMinutes = checkedWalkMatrix(city);
  const usableDays = stayDays.filter((d) => d.window.closes > d.window.opens).length;
  const chosen = selectAttractions(city.attractions, interests, usableDays * maxSlotsPerDay);

  // One walking route for the whole city, divided into contiguous per-day
  // stretches. Contiguous stretches of a shortest route are geographically tight
  // by construction, so a day never crosses the city and back; and one queue for
  // the whole stay means an attraction is scheduled at most once.
  //
  // *Which* division is used is chosen rather than assumed: every valid one is
  // enumerated and scored, so an attraction shut on a Monday is placed on a day
  // it is open whenever any arrangement allows it.
  const route = optimalWalkingRoute(submatrix(walkMinutes, chosen)).map((i) => chosen[i]!);
  const days = arrangeDays({ ...stay, stayDays, route });

  return { iata: city.iata, name: city.name, available: true, days };
}

/** Everything `arrangeDays` needs; deliberately narrower than `CitySchedule`. */
interface ArrangementPlan {
  city: AvailableCityInput;
  wakeUpMinutes: MinutesOfDay;
  maxSlotsPerDay: number;
  stayDays: StayDay[];
  /** Attraction indices in walking-route order. */
  route: number[];
}

/**
 * The route divided across the stay's days, best arrangement first.
 *
 * The cost of one day's share is computed by actually scheduling it, so the
 * arrangement is scored on what the traveler would really get — which visits
 * fit the window, which fall on a closed day, how far they walk — rather than on
 * a proxy for it.
 */
function arrangeDays(plan: ArrangementPlan): ItineraryDay[] {
  const { stayDays, route, maxSlotsPerDay } = plan;

  const takes = bestArrangement(
    route.length,
    stayDays.length,
    maxSlotsPerDay,
    (day, from, take) => {
      const scheduled = scheduleDay(dayPlan(plan, day, from, take));
      // A share that does not fit is not rejected: the day simply schedules what
      // it can, and the arrangement is scored on that. Rejecting it would leave
      // a short arrival day unable to hold anything at all.
      return {
        scheduled: scheduled.slots.length,
        conflicts: scheduled.slots.filter((s) => s.closedOnThisDay).length,
        walkMinutes: scheduled.slots.reduce((sum, s) => sum + (s.walkMinutesFromPrevious ?? 0), 0),
      };
    },
  );

  // Re-scheduled once with the winning shares, because the costing above threw
  // its days away and only kept the numbers.
  let from = 0;
  return stayDays.map((_, index) => {
    const day = scheduleDay(dayPlan(plan, index, from, takes[index]!));
    from += day.slots.length;
    return day;
  });
}

function dayPlan(plan: ArrangementPlan, index: number, from: number, take: number): DaySchedule {
  return {
    city: plan.city,
    ...plan.stayDays[index]!,
    wakeUpMinutes: plan.wakeUpMinutes,
    // The share for this day, which `scheduleDay` treats as its ceiling.
    maxSlotsPerDay: take,
    queue: plan.route.slice(from, from + take),
    remaining: plan.route.length - from,
  };
}

/** The part of a calendar day in which VisitSlots may be placed (see CONTEXT.md). */
interface SchedulableWindow {
  opens: MinutesOfDay;
  closes: MinutesOfDay;
}

/** One calendar day of the stay, before anything has been placed on it. */
interface StayDay {
  date: LocalDate;
  dayOfStay: number;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  window: SchedulableWindow;
}

interface DaySchedule {
  city: AvailableCityInput;
  date: LocalDate;
  dayOfStay: number;
  window: SchedulableWindow;
  wakeUpMinutes: MinutesOfDay;
  maxSlotsPerDay: number;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  /** This day's share of the walking route, in order; consumed in place. */
  queue: number[];
  /**
   * Attractions of the whole city still unscheduled when this day begins, its
   * own share included.
   *
   * Separate from `queue` because the arrangement hands each day only its own
   * slice: an empty `queue` says this day was given nothing, which is a very
   * different thing from the city being finished, and only this tells them
   * apart.
   */
  remaining: number;
}

function scheduleDay(day: DaySchedule): ItineraryDay {
  const { city, date, dayOfStay, window, maxSlotsPerDay, queue } = day;
  const slots: VisitSlot[] = [];
  let cursor = window.opens;
  let previous: number | null = null;

  while (queue.length > 0 && window.closes > cursor && slots.length < maxSlotsPerDay) {
    const index = queue[0]!;
    const attraction = city.attractions[index]!;
    // The first slot of a day is reached from the traveler's bed, not from
    // yesterday's last stop, so it carries no walk.
    const walk = previous === null ? null : city.walkMinutes[previous]![index]!;
    const startsAtMinutes = cursor + (walk ?? 0);
    const minutes = visitMinutesFor(attraction.category, attraction.visitMinutes);
    if (startsAtMinutes + minutes > window.closes) break;

    slots.push({
      attractionId: attraction.id,
      name: attraction.name,
      category: attraction.category,
      lat: attraction.lat,
      lon: attraction.lon,
      description: attraction.description,
      startsAt: localIso(city.timezone, date, startsAtMinutes),
      endsAt: localIso(city.timezone, date, startsAtMinutes + minutes),
      visitMinutes: minutes,
      walkMinutesFromPrevious: walk,
      // A null OpeningHours means we are scheduling against an assumed window
      // rather than a published one; the traveler is told so they can verify.
      hoursAssumed: attraction.openingHours === null,
      // Set even while candidate arrangements are still being scored: this is
      // what they are scored on, and on the winner it is what the traveler is
      // shown. A conflict surviving here is one no valid cut could avoid.
      closedOnThisDay: closedOn(attraction.openingHours, date),
    });

    cursor = startsAtMinutes + minutes;
    previous = index;
    queue.shift();
  }

  return {
    date,
    dayOfStay,
    empty: slots.length === 0,
    emptyReason: slots.length === 0 ? emptyReasonFor(day) : null,
    slots,
  };
}

/**
 * Checked once, before anything is scheduled: a misaligned matrix would
 * otherwise route the city around a hole and schedule a free walk across it, and
 * quietly inventing travel time is exactly the failure this design exists to
 * prevent. The provider's contract is one row and column per attraction.
 */
function checkedWalkMatrix(city: AvailableCityInput): number[][] {
  const size = city.attractions.length;
  const square =
    city.walkMinutes.length === size && city.walkMinutes.every((row) => row.length === size);
  if (!square) {
    throw new Error(
      `No walking distance matrix for ${city.iata}: expected ${size}x${size} over its attractions`,
    );
  }
  return city.walkMinutes;
}

/**
 * The walking matrix narrowed to the selected attractions, in selection order.
 *
 * The route solver only ever sees the attractions the traveler will be shown, so
 * it works over an m×m matrix rather than the city's full n×n one. Where the
 * ceiling cuts a large city back that also brings it inside
 * `MAX_EXACT_TOUR_NODES` — but only where it cuts: a stay whose usable days times
 * its ceiling still exceeds that bound is as solvable, or not, as it ever was.
 * The submatrix's indices are positions in `indices`; the caller maps them back.
 */
function submatrix(matrix: number[][], indices: number[]): number[][] {
  return indices.map((from) => indices.map((to) => matrix[from]![to]!));
}

function emptyReasonFor(day: DaySchedule): EmptyDayReason {
  const { window, wakeUpMinutes, isArrivalDay, isDepartureDay, remaining } = day;

  // Nothing left to schedule is the honest answer whenever the day itself was
  // usable — the flights had nothing to do with it.
  if (remaining === 0 && window.closes > window.opens) return 'NO_ATTRACTIONS_LEFT';

  // Attribute the loss to whichever flight narrowed the day, so the traveler
  // reads "you land too late" rather than a generic shrug. This covers the near
  // miss as well as the impossible day: a 19:00 arrival leaves a real half-hour
  // that nothing fits into, and the arrival is still the cause.
  //
  // Ahead of the arrangement below on purpose: a flight that wrecked the day is
  // a fact about the day, and the reason the arrangement then had nothing to put
  // on it. Blaming the schedule for it would point the traveler at the wrong
  // thing entirely.
  if (isArrivalDay && window.opens > wakeUpMinutes) return 'ARRIVAL_TOO_LATE';
  if (isDepartureDay && window.closes < DAY_END_MINUTES) return 'DEPARTURE_TOO_EARLY';

  // A day the flights left alone, that the arrangement gave nothing to, with
  // visits still waiting: left clear so those visits could land on days they are
  // open.
  if (day.queue.length === 0 && window.closes > window.opens) {
    return 'SCHEDULED_AROUND_CLOSURES';
  }

  return remaining === 0 ? 'NO_ATTRACTIONS_LEFT' : 'WINDOW_TOO_SHORT';
}
