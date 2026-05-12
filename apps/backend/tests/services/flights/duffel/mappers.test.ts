import { describe, it, expect } from 'vitest';
import type { Offer } from '@duffel/api/types';
import type { PriceQuery } from '../../../../src/services/flights/provider.js';
import {
  queryToOfferRequest,
  parseIsoDurationMinutes,
  bestOfferToPriceResult,
} from '../../../../src/services/flights/duffel/mappers.js';

const query: PriceQuery = {
  origin: 'LHR',
  destination: 'JFK',
  departDate: '2026-06-01',
  cabinClass: 'ECONOMY',
};

function makeOffer(opts: {
  totalAmount: string;
  currency?: string;
  duration?: string | null;
  segments?: number;
  carrierIata?: string | null;
}): Offer {
  const iata = 'carrierIata' in opts ? opts.carrierIata : 'BA';
  const carrier = iata === null ? undefined : { iata_code: iata };
  const segments = Array.from({ length: opts.segments ?? 1 }, (_, i) => ({
    id: `seg_${i}`,
    duration: 'PT2H',
    marketing_carrier: carrier,
    operating_carrier: carrier,
    aircraft: null,
    arriving_at: '2026-06-01T15:00:00Z',
    departing_at: '2026-06-01T10:00:00Z',
    destination: { iata_code: 'JFK' },
    origin: { iata_code: 'LHR' },
    destination_terminal: null,
    origin_terminal: null,
    distance: null,
    marketing_carrier_flight_number: '101',
    operating_carrier_flight_number: '101',
    passengers: [],
    stops: [],
  })) as unknown as Offer['slices'][number]['segments'];

  return {
    id: `off_${opts.totalAmount}`,
    total_amount: opts.totalAmount,
    total_currency: opts.currency ?? 'USD',
    slices: [
      {
        id: 'sl_0',
        duration: opts.duration === undefined ? 'PT8H30M' : opts.duration,
        segments,
        origin: { iata_code: 'LHR' },
        destination: { iata_code: 'JFK' },
        origin_type: 'airport',
        destination_type: 'airport',
        fare_brand_name: null,
        conditions: {},
        ngs_shelf: null,
        comparison_key: 'x',
      },
    ],
  } as unknown as Offer;
}

describe('queryToOfferRequest', () => {
  it('builds a one-slice request with adult passenger and lowercased cabin', () => {
    const req = queryToOfferRequest(query);
    expect(req.slices).toHaveLength(1);
    expect(req.slices[0]).toMatchObject({
      origin: 'LHR',
      destination: 'JFK',
      departure_date: '2026-06-01',
    });
    expect(req.passengers).toEqual([{ type: 'adult' }]);
    expect(req.cabin_class).toBe('economy');
  });

  it('maps each shared CabinClass enum to its Duffel string', () => {
    expect(queryToOfferRequest({ ...query, cabinClass: 'ECONOMY' }).cabin_class).toBe('economy');
    expect(queryToOfferRequest({ ...query, cabinClass: 'PREMIUM_ECONOMY' }).cabin_class).toBe(
      'premium_economy',
    );
    expect(queryToOfferRequest({ ...query, cabinClass: 'BUSINESS' }).cabin_class).toBe('business');
    expect(queryToOfferRequest({ ...query, cabinClass: 'FIRST' }).cabin_class).toBe('first');
  });
});

describe('parseIsoDurationMinutes', () => {
  it('parses hours and minutes', () => {
    expect(parseIsoDurationMinutes('PT8H30M')).toBe(510);
    expect(parseIsoDurationMinutes('PT45M')).toBe(45);
    expect(parseIsoDurationMinutes('PT2H')).toBe(120);
  });

  it('returns null for invalid or empty input', () => {
    expect(parseIsoDurationMinutes(null)).toBeNull();
    expect(parseIsoDurationMinutes(undefined)).toBeNull();
    expect(parseIsoDurationMinutes('')).toBeNull();
    expect(parseIsoDurationMinutes('garbage')).toBeNull();
    expect(parseIsoDurationMinutes('PT')).toBeNull();
  });
});

describe('bestOfferToPriceResult', () => {
  it('returns null when no offers', () => {
    expect(bestOfferToPriceResult(query, [])).toBeNull();
  });

  it('drops non-USD offers and returns null when none remain', () => {
    const offers = [makeOffer({ totalAmount: '120.00', currency: 'EUR' })];
    expect(bestOfferToPriceResult(query, offers)).toBeNull();
  });

  it('picks the cheapest USD offer', () => {
    const offers = [
      makeOffer({ totalAmount: '500.00' }),
      makeOffer({ totalAmount: '250.50' }),
      makeOffer({ totalAmount: '750.00' }),
    ];
    const r = bestOfferToPriceResult(query, offers);
    expect(r).not.toBeNull();
    expect(r!.priceCents).toBe(25050);
  });

  it('counts stops as segments - 1', () => {
    const offers = [makeOffer({ totalAmount: '300.00', segments: 1 })];
    expect(bestOfferToPriceResult(query, offers)!.stops).toBe(0);

    const twoLeg = [makeOffer({ totalAmount: '300.00', segments: 3 })];
    expect(bestOfferToPriceResult(query, twoLeg)!.stops).toBe(2);
  });

  it('returns the slice duration in minutes', () => {
    const offers = [makeOffer({ totalAmount: '300.00', duration: 'PT8H30M' })];
    expect(bestOfferToPriceResult(query, offers)!.durationMin).toBe(510);
  });

  it('returns null when duration is missing or malformed', () => {
    expect(
      bestOfferToPriceResult(query, [makeOffer({ totalAmount: '300.00', duration: null })]),
    ).toBeNull();
    expect(
      bestOfferToPriceResult(query, [makeOffer({ totalAmount: '300.00', duration: 'forever' })]),
    ).toBeNull();
  });

  it('uses the first segment marketing carrier IATA', () => {
    const offers = [makeOffer({ totalAmount: '300.00', carrierIata: 'AF' })];
    expect(bestOfferToPriceResult(query, offers)!.carrier).toBe('AF');
  });

  it('falls back to null carrier when missing', () => {
    const offers = [makeOffer({ totalAmount: '300.00', carrierIata: null })];
    expect(bestOfferToPriceResult(query, offers)!.carrier).toBeNull();
  });

  it('echoes the query origin, destination, date, and cabin', () => {
    const offers = [makeOffer({ totalAmount: '300.00' })];
    const r = bestOfferToPriceResult(query, offers)!;
    expect(r).toMatchObject({
      origin: 'LHR',
      destination: 'JFK',
      departDate: '2026-06-01',
      cabinClass: 'ECONOMY',
    });
  });
});
