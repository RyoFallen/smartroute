import { describe, it, expect } from 'vitest';
import { OptimizePreset } from '@smartroute/shared';
import { PRESET_WEIGHTS, fitnessScores } from '../../../src/services/optimizer/fitness.js';

describe('OptimizePreset', () => {
  it('accepts the four presets and rejects unknown values', () => {
    for (const p of ['budget', 'time', 'comfort', 'balanced']) {
      expect(OptimizePreset.parse(p)).toBe(p);
    }
    expect(() => OptimizePreset.parse('luxury')).toThrow();
  });
});

describe('PRESET_WEIGHTS', () => {
  it('matches spec §7.1.2 literally (cost/direct/time)', () => {
    expect(PRESET_WEIGHTS.budget).toEqual({ cost: 0.7, direct: 0.1, time: 0.2 });
    expect(PRESET_WEIGHTS.time).toEqual({ cost: 0.3, direct: 0.4, time: 0.3 });
    expect(PRESET_WEIGHTS.comfort).toEqual({ cost: 0.3, direct: 0.5, time: 0.2 });
    expect(PRESET_WEIGHTS.balanced).toEqual({ cost: 0.5, direct: 0.3, time: 0.2 });
  });

  it('each row sums to 1', () => {
    for (const w of Object.values(PRESET_WEIGHTS)) {
      expect(w.cost + w.direct + w.time).toBeCloseTo(1, 10);
    }
  });
});

describe('fitnessScores', () => {
  const batch = [
    { totalCostCents: 10_000, totalStops: 0, totalDurationMin: 300 },
    { totalCostCents: 20_000, totalStops: 2, totalDurationMin: 100 },
    { totalCostCents: 15_000, totalStops: 1, totalDurationMin: 500 },
  ];

  it('returns the min-max normalized weighted sum per candidate (worked example)', () => {
    // Hand-worked with balanced weights 0.5/0.3/0.2:
    // costs normalize to [0, 1, 0.5]; stops to [0, 1, 0.5]; durations to [0.5, 0, 1]
    const fits = fitnessScores(batch, PRESET_WEIGHTS.balanced);
    expect(fits).toHaveLength(3);
    expect(fits[0]).toBeCloseTo(0.1, 10);
    expect(fits[1]).toBeCloseTo(0.8, 10);
    expect(fits[2]).toBeCloseTo(0.6, 10);
  });

  it('is minimized: strictly-dominating candidate gets the lowest fitness for every preset', () => {
    const dominated = [
      { totalCostCents: 5_000, totalStops: 0, totalDurationMin: 90 },
      { totalCostCents: 50_000, totalStops: 3, totalDurationMin: 900 },
    ];
    for (const w of Object.values(PRESET_WEIGHTS)) {
      const fits = fitnessScores(dominated, w);
      expect(fits[0]!).toBeLessThan(fits[1]!);
    }
  });

  it('treats a constant objective as contributing zero instead of dividing by zero', () => {
    const flatCost = [
      { totalCostCents: 10_000, totalStops: 0, totalDurationMin: 100 },
      { totalCostCents: 10_000, totalStops: 4, totalDurationMin: 200 },
    ];
    const fits = fitnessScores(flatCost, PRESET_WEIGHTS.balanced);
    expect(fits[0]).toBeCloseTo(0, 10);
    expect(fits[1]).toBeCloseTo(0.3 + 0.2, 10);
    expect(Number.isFinite(fits[0]!)).toBe(true);
    expect(Number.isFinite(fits[1]!)).toBe(true);
  });
});
