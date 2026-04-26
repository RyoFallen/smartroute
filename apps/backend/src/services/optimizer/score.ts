import type { Score } from '@smartroute/shared';
import type { PriceResult } from '../flights/provider.js';

export interface Bounds {
  maxCostCents: number;
  maxDurationMin: number;
  maxStops: number;
}

export const DEFAULT_WEIGHTS = { cost: 0.5, duration: 0.3, stops: 0.2 };

export function scoreOrdering(legs: PriceResult[]): Omit<Score, 'composite'> {
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

export function compositeScore(
  s: Omit<Score, 'composite'>,
  b: Bounds,
  w = DEFAULT_WEIGHTS,
): number {
  const c = b.maxCostCents > 0 ? s.totalCostCents / b.maxCostCents : 0;
  const d = b.maxDurationMin > 0 ? s.totalDurationMin / b.maxDurationMin : 0;
  const t = b.maxStops > 0 ? s.totalStops / b.maxStops : 0;
  return w.cost * c + w.duration * d + w.stops * t;
}
