import { describe, it, expect } from 'vitest';
import type { Score } from '@smartroute/shared';
import { runGa, mulberry32, DEFAULT_GA_PARAMS } from '../../../src/services/optimizer/ga.js';
import { enumerateOrderings } from '../../../src/services/optimizer/enumerate.js';
import { PRESET_WEIGHTS, fitnessScores } from '../../../src/services/optimizer/fitness.js';

const CODES = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'JJJ', 'KKK', 'LLL'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic synthetic price landscape; every pair feasible. */
function evaluatePairs(ordering: string[]): Score {
  let totalCostCents = 0;
  let totalDurationMin = 0;
  let totalStops = 0;
  for (let i = 0; i < ordering.length - 1; i++) {
    const seed = hash(`${ordering[i]}-${ordering[i + 1]}`);
    totalCostCents += 10_000 + (seed % 90_000);
    totalDurationMin += 60 + (seed % 540);
    totalStops += seed % 3 === 0 ? 1 : 0;
  }
  return { totalCostCents, totalDurationMin, totalStops };
}

describe('runGa oracle', () => {
  it('finds the enumerator optimum on N=4..8 for every preset (seeded RNG)', () => {
    for (let n = 4; n <= 8; n++) {
      const cities = CODES.slice(0, n);
      const startCity = cities[0];
      const orderings = enumerateOrderings(cities, { startCity });
      const scores = orderings.map(evaluatePairs);
      for (const [preset, weights] of Object.entries(PRESET_WEIGHTS)) {
        const fits = fitnessScores(scores, weights);
        let optIdx = 0;
        for (let i = 1; i < fits.length; i++) if (fits[i]! < fits[optIdx]!) optIdx = i;

        const res = runGa(
          { cities, startCity, weights, evaluate: evaluatePairs },
          { rng: mulberry32(n * 100 + 1) },
        );
        expect(res.best, `n=${n} preset=${preset}`).not.toBeNull();
        // Ties are legitimate: assert the GA reaches the optimal fitness value
        // judged in the full enumeration batch, not one specific ordering.
        const gaIdx = orderings.findIndex((o) => o.join('>') === res.best!.ordering.join('>'));
        expect(
          gaIdx,
          `n=${n} preset=${preset}: GA ordering not in enumeration`,
        ).toBeGreaterThanOrEqual(0);
        expect(fits[gaIdx], `n=${n} preset=${preset}`).toBeCloseTo(fits[optIdx]!, 12);
      }
    }
  });
});

describe('runGa constraints', () => {
  it('keeps start first, end last, and visits every city exactly once (randomized instances)', () => {
    const rng = mulberry32(42);
    for (let trial = 0; trial < 20; trial++) {
      const n = 4 + Math.floor(rng() * 5); // 4..8
      const cities = CODES.slice(0, n);
      const startCity = rng() < 0.5 ? cities[Math.floor(rng() * n)] : undefined;
      let endCity = rng() < 0.5 ? cities[Math.floor(rng() * n)] : undefined;
      if (endCity && endCity === startCity) endCity = undefined;

      const res = runGa(
        { cities, startCity, endCity, weights: PRESET_WEIGHTS.balanced, evaluate: evaluatePairs },
        { rng: mulberry32(1000 + trial) },
      );

      expect(res.best).not.toBeNull();
      const order = res.best!.ordering;
      expect([...order].sort()).toEqual([...cities].sort());
      if (startCity) expect(order[0]).toBe(startCity);
      if (endCity) expect(order[order.length - 1]).toBe(endCity);
      for (const c of res.evaluated) {
        expect([...c.ordering].sort()).toEqual([...cities].sort());
        if (startCity) expect(c.ordering[0]).toBe(startCity);
        if (endCity) expect(c.ordering[c.ordering.length - 1]).toBe(endCity);
      }
    }
  });

  it('returns best-so-far instead of throwing when the wall clock runs out', () => {
    let tick = 0;
    const clock = () => {
      tick += 10_000; // each check advances 10s; 30s budget => a few generations at most
      return tick;
    };
    const cities = CODES.slice(0, 8);
    const res = runGa(
      { cities, weights: PRESET_WEIGHTS.balanced, evaluate: evaluatePairs },
      { rng: mulberry32(3), now: clock },
    );
    expect(res.timedOut).toBe(true);
    expect(res.generations).toBeLessThan(DEFAULT_GA_PARAMS.maxGenerations);
    expect(res.best).not.toBeNull();
    expect([...res.best!.ordering].sort()).toEqual([...cities].sort());
  });

  it('never returns an ordering with a missing price leg (infeasible excluded)', () => {
    const cities = CODES.slice(0, 6);
    // Only orderings ending in FFF are feasible; everything else has a missing leg.
    const evaluate = (ordering: string[]) => {
      if (ordering[ordering.length - 1] !== 'FFF') return null;
      return evaluatePairs(ordering);
    };
    const res = runGa(
      { cities, weights: PRESET_WEIGHTS.balanced, evaluate },
      { rng: mulberry32(11) },
    );
    expect(res.best).not.toBeNull();
    expect(res.best!.ordering[res.best!.ordering.length - 1]).toBe('FFF');
    for (const c of res.evaluated) {
      expect(c.ordering[c.ordering.length - 1]).toBe('FFF');
    }
  });

  it('returns null best when every ordering is infeasible', () => {
    const res = runGa(
      { cities: CODES.slice(0, 5), weights: PRESET_WEIGHTS.balanced, evaluate: () => null },
      { rng: mulberry32(5) },
    );
    expect(res.best).toBeNull();
    expect(res.evaluated).toEqual([]);
  });

  it('handles the degenerate two-city instance', () => {
    const res = runGa(
      {
        cities: ['AAA', 'BBB'],
        startCity: 'AAA',
        endCity: 'BBB',
        weights: PRESET_WEIGHTS.balanced,
        evaluate: evaluatePairs,
      },
      { rng: mulberry32(7) },
    );
    expect(res.best?.ordering).toEqual(['AAA', 'BBB']);
  });
});
