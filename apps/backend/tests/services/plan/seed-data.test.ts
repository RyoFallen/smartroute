import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SeedFile } from '../../../src/services/plan/seed-schema.js';

// ESM project — no __dirname; resolve relative to this file via import.meta.url
const file = new URL('../../../prisma/seed/attractions.json', import.meta.url);
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));

describe('attractions seed data', () => {
  it('parses against the seed schema', () => {
    expect(() => SeedFile.parse(raw)).not.toThrow();
  });

  const cities = SeedFile.parse(raw);

  it('covers exactly the 8 starter cities', () => {
    const codes = cities.map((c) => c.iata).sort();
    expect(codes).toEqual(['BCN', 'BER', 'BUD', 'CDG', 'FCO', 'IST', 'LHR', 'WAW']);
  });

  it('has 10-15 attractions per city with unique names', () => {
    for (const c of cities) {
      expect(c.attractions.length, c.iata).toBeGreaterThanOrEqual(10);
      expect(c.attractions.length, c.iata).toBeLessThanOrEqual(15);
      const names = new Set(c.attractions.map((a) => a.name));
      expect(names.size, c.iata).toBe(c.attractions.length);
    }
  });

  it('ranks are exactly 1..n within each city', () => {
    for (const c of cities) {
      const ranks = c.attractions.map((a) => a.rank).sort((a, b) => a - b);
      expect(ranks, c.iata).toEqual(Array.from({ length: ranks.length }, (_, i) => i + 1));
    }
  });

  it('every attraction is near its city center (~within 60km)', () => {
    for (const c of cities) {
      for (const a of c.attractions) {
        expect(Math.abs(a.lat - c.lat), `${c.iata}/${a.name}`).toBeLessThan(0.6);
        expect(Math.abs(a.lon - c.lon), `${c.iata}/${a.name}`).toBeLessThan(0.8);
      }
    }
  });

  it('multi-airport cities declare their alternates', () => {
    const byIata = new Map(cities.map((c) => [c.iata, c]));
    expect(byIata.get('LHR')?.altCodes).toContain('LGW');
    expect(byIata.get('CDG')?.altCodes).toContain('ORY');
  });
});
