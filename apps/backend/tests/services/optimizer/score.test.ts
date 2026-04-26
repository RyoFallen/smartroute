import { describe, it, expect } from 'vitest';
import { scoreOrdering, compositeScore } from '../../../src/services/optimizer/score.js';
import type { PriceResult } from '../../../src/services/flights/provider.js';

const leg = (origin: string, destination: string, price: number, durationMin: number, stops = 0): PriceResult => ({
  origin, destination, departDate: '2026-06-01', cabinClass: 'ECONOMY', priceCents: price, durationMin, stops, carrier: 'X',
});

describe('scoreOrdering', () => {
  it('sums cost, duration, stops across legs', () => {
    const s = scoreOrdering([leg('A', 'B', 100, 60, 0), leg('B', 'C', 200, 90, 1)]);
    expect(s.totalCostCents).toBe(300);
    expect(s.totalDurationMin).toBe(150);
    expect(s.totalStops).toBe(1);
  });
});

describe('compositeScore', () => {
  it('produces lower (better) score for cheaper-faster-more-direct route', () => {
    const cheap = scoreOrdering([leg('A', 'B', 100, 60, 0)]);
    const expensive = scoreOrdering([leg('A', 'B', 1000, 600, 3)]);
    const cheapComp = compositeScore(cheap, { maxCostCents: 1000, maxDurationMin: 600, maxStops: 3 });
    const expComp = compositeScore(expensive, { maxCostCents: 1000, maxDurationMin: 600, maxStops: 3 });
    expect(cheapComp).toBeLessThan(expComp);
  });
});
