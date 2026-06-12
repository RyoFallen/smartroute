import type { PrismaClient } from '@prisma/client';
import type { Trip, TripPlanCity, TripPlanResponse } from '@smartroute/shared';
import { AttractionCategory } from '@smartroute/shared';
import { TripService } from '../trips/index.js';

export function visitOrder(trip: Trip): string[] {
  if (trip.flights.length > 0) {
    const derived = [trip.flights[0]!.origin, ...trip.flights.map((f) => f.destination)];
    // Trust the chain only if it's a permutation of the saved cities;
    // otherwise (broken/inconsistent client data) fall back to stored order.
    const a = [...derived].sort();
    const b = [...trip.cities].sort();
    if (a.length === b.length && a.every((v, i) => v === b[i])) {
      return derived;
    }
  }
  return trip.cities;
}

export class PlanService {
  constructor(private readonly db: PrismaClient) {}

  async planForTrip(userId: string, tripId: string): Promise<TripPlanResponse> {
    const trip = await new TripService(this.db).findById(userId, tripId);
    const order = visitOrder(trip);

    const cities = await this.db.city.findMany({
      where: { OR: [{ iata: { in: order } }, { altCodes: { hasSome: order } }] },
      include: { attractions: { where: { mustGo: true }, orderBy: { rank: 'asc' } } },
    });

    const byCode = new Map<string, (typeof cities)[number]>();
    for (const c of cities) {
      byCode.set(c.iata, c);
      for (const alt of c.altCodes) byCode.set(alt, c);
    }

    return {
      tripId: trip.id,
      cities: order.map((iata): TripPlanCity => {
        const c = byCode.get(iata);
        if (!c) return { iata, name: null, available: false, mustGo: [] };
        return {
          iata,
          name: c.name,
          available: true,
          mustGo: c.attractions.map((a) => ({
            id: a.id,
            name: a.name,
            category: AttractionCategory.parse(a.category),
            rank: a.rank,
            lat: a.lat,
            lon: a.lon,
            description: a.description,
          })),
        };
      }),
    };
  }
}
