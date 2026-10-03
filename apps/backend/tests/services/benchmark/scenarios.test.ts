import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BENCHMARK_CITIES, drawScenarios } from '../../../src/services/benchmark/index.js';
import { SeedFile } from '../../../src/services/plan/seed-schema.js';

// Properties are checked over many seeds, not one, so a rule the draw only
// keeps by luck for a particular seed still fails.
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const all = SEEDS.flatMap((seed) => drawScenarios(seed));

describe('drawScenarios', () => {
  it('draws identical scenarios from the same seed', () => {
    expect(drawScenarios(7)).toEqual(drawScenarios(7));
    expect(drawScenarios(7)).not.toEqual(drawScenarios(8));
  });

  it('draws exactly 5 scenarios at each of 4, 5, 6 and 7 visited cities', () => {
    for (const seed of SEEDS) {
      const sizes = drawScenarios(seed).map((s) => s.visited.length);
      expect(sizes).toEqual([4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7]);
    }
  });

  it('uses only curated cities, never visits the origin, and ends among the visited', () => {
    const curated = new Set(['IST', 'BER', 'WAW', 'BUD', 'LHR', 'CDG', 'FCO', 'BCN']);
    for (const s of all) {
      const visited = s.visited.map((v) => v.city);
      expect(curated.has(s.origin)).toBe(true);
      for (const c of visited) expect(curated.has(c)).toBe(true);
      expect(new Set(visited).size).toBe(visited.length);
      expect(visited).not.toContain(s.origin);
      expect(visited).toContain(s.endCity);
    }
  });

  it('gives every visited city a CityStay of 2–4 days, and each length occurs', () => {
    const stays = all.flatMap((s) => s.visited.map((v) => v.stayDays));
    expect(new Set(stays)).toEqual(new Set([2, 3, 4]));
  });

  it('departs inside 14 Nov – 8 Dec 2026, reaching both ends of the window', () => {
    const dates = all.map((s) => s.departDate).sort();
    expect(dates[0]).toBe('2026-11-14');
    expect(dates.at(-1)).toBe('2026-12-08');
  });

  it('pins the same 8 cities the seed data curates', () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL('../../../prisma/seed/attractions.json', import.meta.url), 'utf8'),
    );
    const seeded = SeedFile.parse(raw).map((c) => c.iata);
    expect([...BENCHMARK_CITIES].sort()).toEqual([...seeded].sort());
  });
});
