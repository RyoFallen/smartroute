import type { Duffel } from '@duffel/api';
import type { FastifyBaseLogger } from 'fastify';
import { ApiError } from '../../../lib/ApiError.js';
import type { FlightProvider, PriceQuery, PriceResult } from '../provider.js';
import { bestOfferToPriceResult, queryToOfferRequest } from './mappers.js';
import { classifyDuffelError, isRetryable } from './errors.js';

export interface DuffelFlightProviderOptions {
  /** Number of retries (in addition to the first attempt) for retryable errors. */
  maxRetries?: number;
  /** Base backoff in ms between retries; multiplied by attempt index. */
  retryBackoffMs?: number;
}

export class DuffelFlightProvider implements FlightProvider {
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly duffel: Duffel,
    private readonly logger: FastifyBaseLogger,
    opts: DuffelFlightProviderOptions = {},
  ) {
    this.maxRetries = opts.maxRetries ?? 1;
    this.retryBackoffMs = opts.retryBackoffMs ?? 250;
  }

  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    const settled = await Promise.allSettled(queries.map((q) => this.fetchOne(q)));

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

  private async fetchOne(q: PriceQuery): Promise<PriceResult | null> {
    let attempt = 0;
    for (;;) {
      try {
        const req = queryToOfferRequest(q);
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
