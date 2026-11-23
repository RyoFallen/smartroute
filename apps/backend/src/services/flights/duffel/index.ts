import type { Duffel } from '@duffel/api';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { ApiError } from '../../../lib/ApiError.js';
import type { FlightProvider, PriceQuery, PriceResult } from '../provider.js';
import { bestOfferToPriceResult, queryToOfferRequest } from './mappers.js';
import { classifyDuffelError, isRetryable } from './errors.js';
import { mapWithConcurrency } from './concurrency.js';

export interface DuffelFlightProviderOptions {
  /** Number of retries (in addition to the first attempt) for retryable errors. */
  maxRetries?: number;
  /** Base backoff in ms between retries; multiplied by attempt index. */
  retryBackoffMs?: number;
}

/** Duffel's test-mode ceiling is 10 TPS; stay comfortably under it. */
const MAX_CONCURRENT_REQUESTS = 8;

export class DuffelFlightProvider implements FlightProvider {
  /** The mapper prefers USD offers (see `mappers.ts`); its any-currency fallback is a known gap. */
  readonly currency = 'USD';

  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly duffel: Duffel,
    private readonly logger: FastifyBaseLogger,
    private readonly prisma: PrismaClient,
    opts: DuffelFlightProviderOptions = {},
  ) {
    this.maxRetries = opts.maxRetries ?? 1;
    this.retryBackoffMs = opts.retryBackoffMs ?? 250;
  }

  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    const metroCodes = await this.resolveMetroCodes(queries);
    const settled = await mapWithConcurrency(queries, MAX_CONCURRENT_REQUESTS, (q) =>
      this.fetchOne(q, metroCodes),
    );

    // Any auth failure on any query is fatal — surface so FlightService
    // can fall back to the stale cache. Cheaper than silently dropping
    // every result when the key is bad.
    for (const r of settled) {
      if (
        r.status === 'rejected' &&
        r.reason instanceof ApiError &&
        r.reason.code === 'FLIGHT_API_UNAVAILABLE'
      ) {
        throw r.reason;
      }
    }

    const out: PriceResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i]!;
      if (s.status === 'fulfilled' && s.value) out.push(s.value);
      else if (s.status === 'rejected') {
        this.logger.warn({ err: s.reason, query: queries[i] }, 'duffel query failed; skipping');
      }
    }
    return out;
  }

  /**
   * Resolve each airport code in this batch to its Duffel metro code
   * (e.g. LHR/LGW -> LON) in one batched lookup, so multi-airport cities
   * get priced across every airport Duffel knows about for that metro.
   * Codes with no matching City row (or no metroIata) map to themselves.
   */
  private async resolveMetroCodes(queries: PriceQuery[]): Promise<Map<string, string>> {
    const codes = [...new Set(queries.flatMap((q) => [q.origin, q.destination]))];
    if (codes.length === 0) return new Map();

    const cities = await this.prisma.city.findMany({
      where: { OR: [{ iata: { in: codes } }, { altCodes: { hasSome: codes } }] },
    });

    const resolved = new Map<string, string>();
    for (const city of cities) {
      const metro = city.metroIata ?? city.iata;
      resolved.set(city.iata, metro);
      for (const alt of city.altCodes) resolved.set(alt, metro);
    }
    return resolved;
  }

  private async fetchOne(
    q: PriceQuery,
    metroCodes: Map<string, string>,
  ): Promise<PriceResult | null> {
    const outbound: PriceQuery = {
      ...q,
      origin: metroCodes.get(q.origin) ?? q.origin,
      destination: metroCodes.get(q.destination) ?? q.destination,
    };
    let attempt = 0;
    for (;;) {
      try {
        const req = queryToOfferRequest(outbound);
        const res = await this.duffel.offerRequests.create({ ...req, return_offers: true });
        const offers = res.data.offers ?? [];
        return bestOfferToPriceResult(q, offers);
      } catch (err) {
        const cls = classifyDuffelError(err);
        if (cls === 'auth') {
          throw new ApiError(
            'FLIGHT_API_UNAVAILABLE',
            'Flight provider authentication failed',
            502,
          );
        }
        if (cls === 'validation') {
          this.logger.debug({ err, query: q }, 'duffel validation error; treating as no offers');
          return null;
        }
        if (!isRetryable(cls) || attempt >= this.maxRetries) {
          throw err;
        }
        attempt += 1;
        await sleep(this.retryBackoffMs * attempt);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
