import type { CreateOfferRequest, Offer } from '@duffel/api/types';
import type { CabinClass } from '@smartroute/shared';
import type { PriceQuery, PriceResult } from '../provider.js';

type OfferForPricing = Omit<Offer, 'available_services'>;

type DuffelCabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

const cabinClassMap: Record<CabinClass, DuffelCabinClass> = {
  ECONOMY: 'economy',
  PREMIUM_ECONOMY: 'premium_economy',
  BUSINESS: 'business',
  FIRST: 'first',
};

export function queryToOfferRequest(q: PriceQuery): CreateOfferRequest {
  return {
    slices: [
      {
        origin: q.origin,
        destination: q.destination,
        departure_date: q.departDate,
        arrival_time: null,
        departure_time: null,
      },
    ],
    passengers: [{ type: 'adult' }],
    cabin_class: cabinClassMap[q.cabinClass],
  };
}

const ISO_DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

export function parseIsoDurationMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = ISO_DURATION.exec(iso);
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const total = hours * 60 + mins;
  return total > 0 ? total : null;
}

/**
 * Pick the cheapest offer from a single-slice offer_request response and
 * project it onto the shape FlightService expects.
 *
 * Prefers USD offers if present; otherwise falls back to the cheapest offer
 * in any currency. Returns null only when no offers are usable (no segments,
 * no duration). Proper FX conversion is deferred — test-mode prices are
 * synthetic, and live mode will need a real FX layer (TODO Plan 5+).
 */
export function bestOfferToPriceResult(
  query: PriceQuery,
  offers: OfferForPricing[],
): PriceResult | null {
  if (offers.length === 0) return null;

  const usd = offers.filter((o) => o.total_currency === 'USD');
  const pool = usd.length > 0 ? usd : offers;

  let best: OfferForPricing | null = null;
  let bestAmount = Number.POSITIVE_INFINITY;
  for (const o of pool) {
    const amt = parseFloat(o.total_amount);
    if (Number.isFinite(amt) && amt < bestAmount) {
      bestAmount = amt;
      best = o;
    }
  }
  if (!best) return null;

  const slice = best.slices[0];
  if (!slice || slice.segments.length === 0) return null;

  const durationMin = parseIsoDurationMinutes(slice.duration);
  if (durationMin === null) return null;

  const firstSegment = slice.segments[0]!;
  const carrier = firstSegment.marketing_carrier?.iata_code ?? null;

  return {
    origin: query.origin,
    destination: query.destination,
    departDate: query.departDate,
    cabinClass: query.cabinClass,
    priceCents: Math.round(bestAmount * 100),
    durationMin,
    stops: slice.segments.length - 1,
    carrier,
  };
}
