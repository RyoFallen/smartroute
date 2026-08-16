import type {
  AttractionCategory,
  EmptyDayReason,
  ItineraryCity,
  ItineraryDay,
  ItineraryResponse,
  VisitSlot,
} from '@smartroute/shared';
import { visitMinutesFor } from '../plan/visit-duration.js';
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
  /** In editorial rank order. Exact intra-city ordering arrives with the TSP. */
  attractions: ItineraryAttractionInput[];
  /** Walking minutes `[from][to]`, indexed into `attractions`. */
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
 * Two things here are deliberately naive and belong to later tickets: slots
 * follow editorial rank rather than an optimal visiting order, and OpeningHours
 * are carried through for disclosure but not yet consulted when placing a day.
 */
export function generateItinerary(input: ItineraryInput): ItineraryResponse {
  const wakeUpMinutes = minutesOfDayFromHhMm(input.wakeUpTime);
  return {
    tripId: input.tripId,
    cities: input.cities.map((city) =>
      city.available
        ? scheduleCity(city, input.startDate, input.endDate, wakeUpMinutes)
        : { iata: city.iata, name: null, available: false, days: [] },
    ),
  };
}

function scheduleCity(
  city: AvailableCityInput,
  tripStart: LocalDate,
  tripEnd: LocalDate,
  wakeUpMinutes: MinutesOfDay,
): ItineraryCity {
  // Open tours: the origin city's stay starts on the trip's first day because
  // there is no arrival to wait for, and the final city's runs to the trip's
  // end date because there is no departure to close it.
  const arrival = city.arriveAt ? toLocal(city.timezone, city.arriveAt) : null;
  const departure = city.departAt ? toLocal(city.timezone, city.departAt) : null;
  const dates = datesInclusive(arrival?.date ?? tripStart, departure?.date ?? tripEnd);

  // One queue for the whole stay, so an attraction is scheduled at most once
  // and anything a short day cannot hold simply waits for the next one.
  const queue = [...city.attractions.keys()];
  const days = dates.map((date, index) => {
    const isArrivalDay = arrival !== null && index === 0;
    const isDepartureDay = departure !== null && index === dates.length - 1;

    return scheduleDay({
      city,
      date,
      dayOfStay: index + 1,
      window: {
        opens: isArrivalDay
          ? Math.max(wakeUpMinutes, arrival.minutesOfDay + ARRIVAL_TRANSFER_MINUTES)
          : wakeUpMinutes,
        closes: isDepartureDay
          ? Math.min(DAY_END_MINUTES, departure.minutesOfDay - DEPARTURE_AIRPORT_MINUTES)
          : DAY_END_MINUTES,
      },
      wakeUpMinutes,
      isArrivalDay,
      isDepartureDay,
      queue,
    });
  });

  return { iata: city.iata, name: city.name, available: true, days };
}

/** The part of a calendar day in which VisitSlots may be placed (see CONTEXT.md). */
interface SchedulableWindow {
  opens: MinutesOfDay;
  closes: MinutesOfDay;
}

interface DaySchedule {
  city: AvailableCityInput;
  date: LocalDate;
  dayOfStay: number;
  window: SchedulableWindow;
  wakeUpMinutes: MinutesOfDay;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  /** Indices of the attractions still unscheduled; consumed in place. */
  queue: number[];
}

function scheduleDay(day: DaySchedule): ItineraryDay {
  const { city, date, dayOfStay, window, queue } = day;
  const slots: VisitSlot[] = [];
  let cursor = window.opens;
  let previous: number | null = null;

  while (queue.length > 0 && window.closes > cursor) {
    const index = queue[0]!;
    const attraction = city.attractions[index]!;
    const walk = previous === null ? null : walkMinutesBetween(city, previous, index);
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
      // Weekly closures are not consulted yet — the flag ships with the contract
      // so the client can render it the day the checker lands.
      closedOnThisDay: false,
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
 * A misaligned matrix would otherwise schedule a free walk across the city, and
 * quietly inventing travel time is exactly the failure this design exists to
 * prevent. The provider's contract is one row and column per attraction.
 */
function walkMinutesBetween(city: AvailableCityInput, from: number, to: number): number {
  const minutes = city.walkMinutes[from]?.[to];
  if (minutes === undefined) {
    throw new Error(
      `No walking distance for ${city.iata} ${from}->${to}: the matrix does not cover ` +
        `${city.attractions.length} attractions`,
    );
  }
  return minutes;
}

function emptyReasonFor(day: DaySchedule): EmptyDayReason {
  const { window, wakeUpMinutes, isArrivalDay, isDepartureDay, queue } = day;

  // Nothing left to schedule is the honest answer whenever the day itself was
  // usable — the flights had nothing to do with it.
  if (queue.length === 0 && window.closes > window.opens) return 'NO_ATTRACTIONS_LEFT';

  // Otherwise attribute the loss to whichever flight narrowed the day, so the
  // traveler reads "you land too late" rather than a generic shrug. This covers
  // the near miss as well as the impossible day: a 19:00 arrival leaves a real
  // half-hour that nothing fits into, and the arrival is still the cause.
  if (isArrivalDay && window.opens > wakeUpMinutes) return 'ARRIVAL_TOO_LATE';
  if (isDepartureDay && window.closes < DAY_END_MINUTES) return 'DEPARTURE_TOO_EARLY';

  return queue.length === 0 ? 'NO_ATTRACTIONS_LEFT' : 'WINDOW_TOO_SHORT';
}
