import type { Score } from '@smartroute/shared';
import type { PriceResult } from '../flights/provider.js';

export function scoreOrdering(legs: PriceResult[]): Score {
  let totalCostCents = 0;
  let totalDurationMin = 0;
  let totalStops = 0;
  for (const l of legs) {
    totalCostCents += l.priceCents;
    totalDurationMin += l.durationMin;
    totalStops += l.stops;
  }
  return { totalCostCents, totalDurationMin, totalStops };
}
