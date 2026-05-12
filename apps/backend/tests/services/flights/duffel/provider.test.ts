import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Duffel } from '@duffel/api';
import type { FastifyBaseLogger } from 'fastify';
import { DuffelFlightProvider } from '../../../../src/services/flights/duffel/index.js';
import type { PriceQuery } from '../../../../src/services/flights/provider.js';
import { ApiError } from '../../../../src/lib/ApiError.js';

const noopLogger = {
  warn: () => {},
  debug: () => {},
  info: () => {},
  error: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => noopLogger,
  level: 'info',
  silent: () => {},
} as unknown as FastifyBaseLogger;

class DuffelErrorStub extends Error {
  constructor(public meta: { status: number }) {
    super(`Duffel ${meta.status}`);
    this.name = 'DuffelError';
  }
}

function offer(opts: { total: string; currency?: string; duration?: string; segments?: number }) {
  const segs = Array.from({ length: opts.segments ?? 1 }, (_, i) => ({
    id: `seg_${i}`,
    duration: 'PT2H',
    marketing_carrier: { iata_code: 'BA' },
  }));
  return {
    id: `off_${opts.total}`,
    total_amount: opts.total,
    total_currency: opts.currency ?? 'USD',
    slices: [{ id: 'sl', duration: opts.duration ?? 'PT8H30M', segments: segs }],
  };
}

function mkDuffel(impl: (input: unknown) => Promise<unknown>): Duffel {
  return {
    offerRequests: {
      create: vi.fn(impl),
    },
  } as unknown as Duffel;
}

function mkProvider(d: Duffel) {
  return new DuffelFlightProvider(d, noopLogger, { maxRetries: 1, retryBackoffMs: 1 });
}

const q1: PriceQuery = {
  origin: 'LHR',
  destination: 'JFK',
  departDate: '2026-06-01',
  cabinClass: 'ECONOMY',
};
const q2: PriceQuery = { ...q1, destination: 'CDG' };

describe('DuffelFlightProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps successful offer_request responses to PriceResults', async () => {
    const duffel = mkDuffel(async () => ({
      data: { offers: [offer({ total: '250.00' })] },
    }));
    const prov = mkProvider(duffel);
    const out = await prov.getPrices([q1, q2]);
    expect(out).toHaveLength(2);
    expect(out[0]!.priceCents).toBe(25000);
    expect(out[0]!.origin).toBe('LHR');
    expect(out[1]!.destination).toBe('CDG');
  });

  it('skips a query that fails with 422 (no offers) without throwing', async () => {
    let call = 0;
    const duffel = mkDuffel(async () => {
      call += 1;
      if (call === 1) throw new DuffelErrorStub({ status: 422 });
      return { data: { offers: [offer({ total: '300.00' })] } };
    });
    const prov = mkProvider(duffel);
    const out = await prov.getPrices([q1, q2]);
    expect(out).toHaveLength(1);
    expect(out[0]!.destination).toBe('CDG');
  });

  it('throws FLIGHT_API_UNAVAILABLE on 401 so cache can fall back', async () => {
    const duffel = mkDuffel(async () => {
      throw new DuffelErrorStub({ status: 401 });
    });
    const prov = mkProvider(duffel);
    await expect(prov.getPrices([q1])).rejects.toMatchObject({
      code: 'FLIGHT_API_UNAVAILABLE',
      statusCode: 502,
    });
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    let attempt = 0;
    const create = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new DuffelErrorStub({ status: 429 });
      return { data: { offers: [offer({ total: '500.00' })] } };
    });
    const duffel = { offerRequests: { create } } as unknown as Duffel;
    const prov = mkProvider(duffel);
    const out = await prov.getPrices([q1]);
    expect(out).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('drops a query after exhausting retries on 429', async () => {
    const create = vi.fn(async () => {
      throw new DuffelErrorStub({ status: 429 });
    });
    const duffel = { offerRequests: { create } } as unknown as Duffel;
    const prov = mkProvider(duffel);
    const out = await prov.getPrices([q1]);
    expect(out).toHaveLength(0);
    expect(create).toHaveBeenCalledTimes(2); // 1 attempt + 1 retry
  });

  it('returns no PriceResult when the offer list is all non-USD', async () => {
    const duffel = mkDuffel(async () => ({
      data: { offers: [offer({ total: '120.00', currency: 'EUR' })] },
    }));
    const prov = mkProvider(duffel);
    const out = await prov.getPrices([q1]);
    expect(out).toHaveLength(0);
  });

  it('propagates ApiError instance for assertions in callers', async () => {
    const duffel = mkDuffel(async () => {
      throw new DuffelErrorStub({ status: 403 });
    });
    const prov = mkProvider(duffel);
    await expect(prov.getPrices([q1])).rejects.toBeInstanceOf(ApiError);
  });
});
