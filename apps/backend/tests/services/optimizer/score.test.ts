import { describe, it, expect } from 'vitest';
import { scoreOrdering } from '../../../src/services/optimizer/score.js';
import type { PriceResult } from '../../../src/services/flights/provider.js';

const leg = (
  origin: string,
  destination: string,
  price: number,
  durationMin: number,
  stops = 0,
): PriceResult => ({
  origin,
  destination,
  departDate: '2026-06-01',
  cabinClass: 'ECONOMY',
  priceCents: price,
  durationMin,
  stops,
  carrier: 'X',
});

describe('scoreOrdering', () => {
  it('sums cost, duration, stops across legs', () => {
    const s = scoreOrdering([leg('A', 'B', 100, 60, 0), leg('B', 'C', 200, 90, 1)]);
    expect(s.totalCostCents).toBe(300);
    expect(s.totalDurationMin).toBe(150);
    expect(s.totalStops).toBe(1);
  });
});
