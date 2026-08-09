import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  attractionKey,
  ManualOpeningHoursFile,
  OsmOpeningHoursFile,
  resolveOpeningHours,
} from '../../../src/services/plan/seed-opening-hours.js';
import { SeedFile } from '../../../src/services/plan/seed-schema.js';

// ESM project — no __dirname; resolve relative to this file via import.meta.url
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../prisma/seed/${name}`, import.meta.url), 'utf8'));

const file = new URL('../../../prisma/seed/attractions.json', import.meta.url);
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
const rawOsm: unknown = read('opening-hours.osm.json');
const rawManual: unknown = read('opening-hours.manual.json');

describe('attractions seed data', () => {
  // Parse once in beforeAll: if the schema rejects the file, the whole suite
  // fails here before any it() runs — that's the intended failure mode.
  let cities: SeedFile;
  beforeAll(() => {
    cities = SeedFile.parse(raw);
  });

  it('parses against the seed schema', () => {
    expect(cities).toBeDefined();
  });

  it('has no duplicate city IATAs', () => {
    const codes = cities.map((c) => c.iata);
    expect(new Set(codes).size, 'duplicate IATA in seed file').toBe(codes.length);
  });

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
        // lat 0.6° ≈ 67 km; lon 0.8° ≈ 60-75 km at 41-53°N — conservative for current cities
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

  it('metroIata is only set when altCodes is non-empty', () => {
    for (const c of cities) {
      if (c.metroIata) {
        expect(c.altCodes.length, `${c.iata} has metroIata but no altCodes`).toBeGreaterThan(0);
      }
    }
  });

  it('carries only hand-curated fields — OSM-derived provenance belongs in the ODbL files', () => {
    // ADR-0005: OSM-derived content must never enter this file, or share-alike
    // attaches to our own work. An allow-list rather than a "contains hours"
    // check, so pasting in an osmElement, a wikidata id or any other borrowed
    // field fails too. Checked against the raw JSON because the schema would
    // silently strip an unknown key.
    const allowed = new Set([
      'name',
      'category',
      'rank',
      'lat',
      'lon',
      'description',
      'tags',
      'visitMinutes',
    ]);
    for (const city of raw as { iata: string; attractions: Record<string, unknown>[] }[]) {
      for (const a of city.attractions) {
        for (const key of Object.keys(a)) {
          expect(allowed.has(key), `${city.iata}/${String(a.name)} has field "${key}"`).toBe(true);
        }
      }
    }
  });
});

describe('supplementary opening-hours seed files', () => {
  it('the OSM file parses, with its licence and Overpass timestamp intact', () => {
    const parsed = OsmOpeningHoursFile.parse(rawOsm);
    expect(parsed.license).toBe('ODbL-1.0');
    expect(parsed.attribution).toContain('OpenStreetMap');
    expect(parsed.osmBaseTimestamp).toBeTruthy();
  });

  it('the manual file parses and every fill is attributed', () => {
    const parsed = ManualOpeningHoursFile.parse(rawManual);
    for (const row of parsed.entries) {
      expect(row.source, `${row.cityIata}/${row.attraction}`).toMatch(/^https?:\/\//);
      expect(row.retrieved, `${row.cityIata}/${row.attraction}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('joins cleanly onto the curated attractions', () => {
    // The real integration check: every supplementary row matches a curated
    // attraction by exact name, no attraction is claimed twice, and every value
    // parses under the OSM grammar. Any of those failing throws here.
    const resolved = resolveOpeningHours(SeedFile.parse(raw), rawOsm, rawManual);
    expect(resolved.size).toBeGreaterThan(0);
  });

  it('resolves the OpeningHours verified for the Istanbul attractions', () => {
    const resolved = resolveOpeningHours(SeedFile.parse(raw), rawOsm, rawManual);
    expect(resolved.get(attractionKey('IST', 'Hagia Sophia'))).toBe('Mo-Su 09:00-19:30');
    // The qualifier matters: OSM calls this one "Kariye Camii" and the curated
    // name carries "(Kariye)". An exact-name join is what catches that.
    expect(resolved.get(attractionKey('IST', 'Chora Church (Kariye)'))).toBe('09:00-18:00');
  });
});
