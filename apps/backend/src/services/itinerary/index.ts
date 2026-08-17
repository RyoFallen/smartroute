import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { FlightLeg, ItineraryResponse, Trip } from '@smartroute/shared';
import { AttractionCategory } from '@smartroute/shared';
import { TripService } from '../trips/index.js';
import { UserService } from '../users/index.js';
import { mustGoCitiesByCode } from '../cities/index.js';
import { visitOrder } from '../plan/index.js';
import { generateItinerary } from './generate.js';
import type { ItineraryCityInput } from './generate.js';
import type { WalkingDistanceProvider } from './walking.js';

/**
 * Used when the traveler has not completed onboarding yet, so an Itinerary is
 * still generatable. Matches the UserProfile column default.
 */
export const DEFAULT_WAKE_UP_TIME = '09:00';

export class ItineraryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly walking: WalkingDistanceProvider,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async itineraryForTrip(userId: string, tripId: string): Promise<ItineraryResponse> {
    const trip = await new TripService(this.db).findById(userId, tripId);
    const order = visitOrder(trip);

    const byCode = await mustGoCitiesByCode(this.db, order);
    const { profile } = await new UserService(this.db).getMe(userId);
    this.warnOnUnusableFlightChain(trip, order);

    const cityInputs = await Promise.all(
      order.map(async (iata, index): Promise<ItineraryCityInput> => {
        const city = byCode.get(iata);
        if (!city) return { iata, available: false };

        return {
          iata,
          available: true,
          name: city.name,
          timezone: city.timezone,
          attractions: city.attractions.map((a) => ({
            id: a.id,
            name: a.name,
            category: AttractionCategory.parse(a.category),
            lat: a.lat,
            lon: a.lon,
            description: a.description,
            visitMinutes: a.visitMinutes,
            openingHours: a.openingHours,
          })),
          walkMinutes: await this.walking.matrix(
            city.attractions.map((a) => ({ lat: a.lat, lon: a.lon })),
          ),
          arriveAt: legBetween(trip.flights, order[index - 1], iata)?.arrive ?? null,
          departAt: legBetween(trip.flights, iata, order[index + 1])?.depart ?? null,
        };
      }),
    );

    return generateItinerary({
      tripId: trip.id,
      startDate: calendarDate(trip.startDate),
      endDate: calendarDate(trip.endDate),
      wakeUpTime: profile?.wakeUpTime ?? DEFAULT_WAKE_UP_TIME,
      // No profile means onboarding is unfinished; both of these are optional
      // precisely so that case needs no fallback here — `generateItinerary`
      // owns what an unrated traveler gets.
      intensity: profile?.intensity,
      interests: profile?.interests,
      cities: cityInputs,
    });
  }

  /**
   * A saved trip should have one leg for every consecutive pair in the visiting
   * order. Where it doesn't, the stays widen to the whole trip (see
   * `legBetween`), which is worth seeing in the logs rather than puzzling over
   * in the app.
   */
  private warnOnUnusableFlightChain(trip: Trip, order: string[]): void {
    const hops = order.slice(1).filter((to, i) => legBetween(trip.flights, order[i], to) !== null);
    if (hops.length === order.length - 1) return;
    this.logger.warn(
      { tripId: trip.id, order, matchedLegs: hops.length, legs: trip.flights.length },
      'trip flight chain does not cover its visiting order; city stays fall back to the trip span',
    );
  }
}

/**
 * Matched by city code rather than by position: `visitOrder` falls back to the
 * stored city order when a trip's flight chain is inconsistent, and indexing
 * into `flights` positionally would then silently attach the wrong leg to a
 * city.
 *
 * A missing leg yields a null bound, which is correct for the two open-tour
 * ends but not for a middle city — on that fallback path no leg matches
 * anything, so every city's stay widens to the whole trip. That is degraded
 * rather than wrong (the days and attractions are real), it only arises from
 * trip rows whose flights are not a permutation of their cities, and it is
 * logged where it happens. Deriving stays without a usable flight chain is out
 * of scope for the tracer bullet.
 */
function legBetween(
  flights: FlightLeg[],
  from: string | undefined,
  to: string | undefined,
): FlightLeg | null {
  if (!from || !to) return null;
  return flights.find((f) => f.origin === from && f.destination === to) ?? null;
}

/**
 * `Trip.startDate`/`endDate` are date-only values stored at UTC midnight, so
 * the calendar date is the UTC one. Reading them through a city timezone would
 * shift the trip a day west of Greenwich.
 */
function calendarDate(iso: Trip['startDate']): string {
  return iso.slice(0, 10);
}
