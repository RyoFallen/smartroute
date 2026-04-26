import { PriceCache, keyOf, type CacheKey } from './cache.js';
import type { FlightProvider, PriceQuery, PriceResult } from './provider.js';

export interface FlightServiceOptions {
  freshMs?: number;
}

export interface FlightServiceResult {
  prices: Map<CacheKey, PriceResult>;
  partial: boolean;
  staleCache: boolean;
}

export class FlightService {
  constructor(
    private readonly cache: PriceCache,
    private readonly provider: FlightProvider,
    private readonly opts: FlightServiceOptions = {},
  ) {}

  async getPrices(queries: PriceQuery[]): Promise<FlightServiceResult> {
    const freshMs = this.opts.freshMs ?? 1000 * 60 * 60 * 6; // 6h default
    const fresh = await this.cache.lookup(queries, { maxAgeMs: freshMs });
    const missing = queries.filter((q) => !fresh.has(keyOf(q)));

    if (missing.length === 0) {
      return { prices: fresh, partial: false, staleCache: false };
    }

    try {
      const fetched = await this.provider.getPrices(missing);
      await this.cache.upsert(fetched);
      const merged = new Map(fresh);
      for (const r of fetched) merged.set(keyOf(r), r);
      const partial = fetched.length < missing.length;
      return { prices: merged, partial, staleCache: false };
    } catch {
      const stale = await this.cache.lookup(queries);
      return { prices: stale, partial: stale.size < queries.length, staleCache: true };
    }
  }
}
