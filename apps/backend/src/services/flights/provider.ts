import type { CabinClass, FlightLeg } from '@smartroute/shared';

export interface PriceQuery {
  origin: string;
  destination: string;
  departDate: string;
  cabinClass: CabinClass;
}

export interface PriceResult extends Omit<FlightLeg, 'depart' | 'arrive'> {
  departDate: string;
  cabinClass: CabinClass;
}

export interface FlightProvider {
  /** ISO 4217 code of every `priceCents` this provider returns. */
  readonly currency: string;
  /**
   * False keeps this provider's prices out of the shared price cache, both ways:
   * nothing it returns is stored and nothing stored is served in its place. For
   * a fixed data set whose prices must never mix with another provider's.
   */
  readonly cacheable?: boolean;
  getPrices(queries: PriceQuery[]): Promise<PriceResult[]>;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export class MockFlightProvider implements FlightProvider {
  readonly currency = 'USD';

  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    return queries.map((q) => {
      const seed = hash(`${q.origin}-${q.destination}-${q.departDate}-${q.cabinClass}`);
      const priceCents = 15_000 + (seed % 80_000);
      const durationMin = 90 + (seed % 600);
      const stops = seed % 4 === 0 ? 0 : seed % 3 === 0 ? 1 : 0;
      return {
        origin: q.origin,
        destination: q.destination,
        departDate: q.departDate,
        cabinClass: q.cabinClass,
        priceCents,
        durationMin,
        stops,
        carrier: ['AA', 'BA', 'AF', 'LH'][seed % 4] ?? null,
      };
    });
  }
}
