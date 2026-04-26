import type { PrismaClient } from '@prisma/client';
import type { CabinClass } from '@smartroute/shared';
import type { PriceQuery, PriceResult } from './provider.js';

export type CacheKey = string;

export function keyOf(q: {
  origin: string;
  destination: string;
  departDate: string;
  cabinClass: CabinClass;
}): CacheKey {
  return `${q.origin}|${q.destination}|${q.departDate}|${q.cabinClass}`;
}

export interface LookupOptions {
  maxAgeMs?: number;
}

export class PriceCache {
  constructor(private readonly db: PrismaClient) {}

  async lookup(
    queries: PriceQuery[],
    opts: LookupOptions = {},
  ): Promise<Map<CacheKey, PriceResult>> {
    if (queries.length === 0) return new Map();
    const ors = queries.map((q) => ({
      origin: q.origin,
      destination: q.destination,
      departDate: new Date(q.departDate),
      cabinClass: q.cabinClass,
    }));
    const rows = await this.db.flightPriceCache.findMany({ where: { OR: ors } });
    const map = new Map<CacheKey, PriceResult>();
    const now = Date.now();
    for (const r of rows) {
      if (opts.maxAgeMs && now - r.fetchedAt.getTime() > opts.maxAgeMs) continue;
      const key = keyOf({
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate.toISOString().slice(0, 10),
        cabinClass: r.cabinClass as CabinClass,
      });
      map.set(key, {
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate.toISOString().slice(0, 10),
        cabinClass: r.cabinClass as CabinClass,
        priceCents: r.priceCents,
        durationMin: r.durationMin,
        stops: r.stops,
        carrier: r.carrier,
      });
    }
    return map;
  }

  async upsert(results: PriceResult[]): Promise<void> {
    await Promise.all(
      results.map((r) =>
        this.db.flightPriceCache.upsert({
          where: {
            origin_destination_departDate_cabinClass: {
              origin: r.origin,
              destination: r.destination,
              departDate: new Date(r.departDate),
              cabinClass: r.cabinClass,
            },
          },
          create: {
            origin: r.origin,
            destination: r.destination,
            departDate: new Date(r.departDate),
            cabinClass: r.cabinClass,
            priceCents: r.priceCents,
            durationMin: r.durationMin,
            stops: r.stops,
            carrier: r.carrier,
          },
          update: {
            priceCents: r.priceCents,
            durationMin: r.durationMin,
            stops: r.stops,
            carrier: r.carrier,
            fetchedAt: new Date(),
          },
        }),
      ),
    );
  }
}
