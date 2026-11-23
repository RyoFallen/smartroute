import type { PrismaClient } from '@prisma/client';
import type { CitySummary } from '@smartroute/shared';

export class CityService {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<CitySummary[]> {
    const rows = await this.db.city.findMany({
      orderBy: { name: 'asc' },
      select: { iata: true, name: true, country: true, lat: true, lon: true },
    });
    return rows;
  }
}

/**
 * The must-go attractions for a set of trip city codes, indexed by every code
 * that resolves to a city — its own IATA and each of its alt codes, since a trip
 * may name any airport of a multi-airport city (ADR-0003).
 *
 * Shared by the flat plan and the Itinerary: both answer "what is worth seeing
 * in these cities", and only differ in how they arrange the answer.
 */
export async function mustGoCitiesByCode(db: PrismaClient, codes: string[]) {
  const cities = await db.city.findMany({
    where: { OR: [{ iata: { in: codes } }, { altCodes: { hasSome: codes } }] },
    include: { attractions: { where: { mustGo: true }, orderBy: { rank: 'asc' } } },
  });

  const byCode = new Map<string, (typeof cities)[number]>();
  for (const city of cities) {
    byCode.set(city.iata, city);
    for (const alt of city.altCodes) byCode.set(alt, city);
  }
  return byCode;
}
