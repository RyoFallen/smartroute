import { z } from 'zod';
import { AttractionCategory } from './attractions.js';
import { Iata } from './flights.js';

/**
 * Why an ItineraryDay holds no VisitSlot. A day may legitimately be empty — an
 * evening arrival leaves no usable time — and saying so is the point: the
 * alternative is a fabricated schedule the traveler cannot keep.
 */
export const EmptyDayReason = z.enum([
  'ARRIVAL_TOO_LATE', // landed too late for anything after the transfer buffer
  'DEPARTURE_TOO_EARLY', // must leave for the airport before the day opens
  'WINDOW_TOO_SHORT', // the SchedulableWindow cannot hold the next visit
  'NO_ATTRACTIONS_LEFT', // every attraction we hold for this city is already scheduled
]);
export type EmptyDayReason = z.infer<typeof EmptyDayReason>;

/**
 * One scheduled visit. `startsAt`/`endsAt` are ISO-8601 with the city's own UTC
 * offset (e.g. `2026-07-14T09:00:00+03:00`), so the wall-clock time a traveler
 * reads off the screen is the local one without the client knowing the zone.
 *
 * `hoursAssumed` and `closedOnThisDay` are the honesty flags — behaviour, not
 * decoration. A regression that silently stops reporting an assumed opening
 * time turns a disclosed approximation into an undisclosed one, which is the
 * failure mode this design exists to prevent.
 */
export const VisitSlot = z.object({
  attractionId: z.string(),
  name: z.string(),
  category: AttractionCategory,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  visitMinutes: z.number().int().positive(),
  // null on the first slot of a day — there is no previous slot to walk from.
  walkMinutesFromPrevious: z.number().int().nonnegative().nullable(),
  hoursAssumed: z.boolean(),
  closedOnThisDay: z.boolean(),
});
export type VisitSlot = z.infer<typeof VisitSlot>;

export const ItineraryDay = z.object({
  date: z.string(), // "YYYY-MM-DD" in the city's own timezone
  dayOfStay: z.number().int().positive(), // 1-based within this city's stay
  empty: z.boolean(),
  emptyReason: EmptyDayReason.nullable(), // non-null exactly when `empty`
  slots: z.array(VisitSlot),
});
export type ItineraryDay = z.infer<typeof ItineraryDay>;

export const ItineraryCity = z.object({
  iata: Iata,
  name: z.string().nullable(), // null when the city is not in our database
  available: z.boolean(), // false => "no guide for this city yet"
  days: z.array(ItineraryDay), // empty when !available
});
export type ItineraryCity = z.infer<typeof ItineraryCity>;

export const ItineraryResponse = z.object({
  tripId: z.string(),
  cities: z.array(ItineraryCity), // in visiting order
});
export type ItineraryResponse = z.infer<typeof ItineraryResponse>;
