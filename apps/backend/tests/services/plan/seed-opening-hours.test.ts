import { describe, it, expect } from 'vitest';
import {
  attractionKey,
  resolveOpeningHours,
} from '../../../src/services/plan/seed-opening-hours.js';
import type { SeedFile } from '../../../src/services/plan/seed-schema.js';

function cities(): SeedFile {
  return [
    {
      iata: 'IST',
      altCodes: [],
      name: 'Istanbul',
      country: 'Türkiye',
      lat: 41.0082,
      lon: 28.9784,
      timezone: 'Europe/Istanbul',
      attractions: Array.from({ length: 8 }, (_, i) => ({
        name: `Sight ${i + 1}`,
        category: 'LANDMARK' as const,
        rank: i + 1,
        lat: 41.0,
        lon: 28.98,
        description: 'A test attraction description.',
        tags: ['history'],
      })),
    },
  ];
}

const osmFile = (rows: unknown[]) => ({
  license: 'ODbL-1.0',
  attribution: '© OpenStreetMap contributors',
  source: 'Overpass API',
  osmBaseTimestamp: '2026-08-09T10:42:44Z',
  entries: rows,
});

const osmEntry = (attraction: string, openingHours: string) => ({
  cityIata: 'IST',
  attraction,
  openingHours,
  osmElement: 'way/109862851',
});

const manualFile = (rows: unknown[]) => ({
  note: 'Hand-filled where OSM had no opening_hours tag.',
  entries: rows,
});

const manualEntry = (attraction: string, openingHours: string) => ({
  cityIata: 'IST',
  attraction,
  openingHours,
  source: 'https://example.org/opening-times',
  retrieved: '2026-08-09',
});

/** Drops one key, so a test can assert that a required field really is required. */
function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

describe('resolveOpeningHours', () => {
  it('joins OSM-sourced hours onto curated attractions', () => {
    const map = resolveOpeningHours(cities(), osmFile([osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]));
    expect(map.get(attractionKey('IST', 'Sight 1'))).toBe('Tu-Su 09:00-17:00');
  });

  it('joins manual fills, including the always-open marker', () => {
    const map = resolveOpeningHours(
      cities(),
      undefined,
      manualFile([manualEntry('Sight 2', '24/7')]),
    );
    expect(map.get(attractionKey('IST', 'Sight 2'))).toBe('24/7');
  });

  it('merges both files', () => {
    const map = resolveOpeningHours(
      cities(),
      osmFile([osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]),
      manualFile([manualEntry('Sight 2', '24/7')]),
    );
    expect(map.size).toBe(2);
  });

  it('leaves an attraction with no entry out of the map — unknown is legitimate', () => {
    const map = resolveOpeningHours(cities(), osmFile([osmEntry('Sight 1', '24/7')]));
    expect(map.has(attractionKey('IST', 'Sight 3'))).toBe(false);
  });

  it('accepts absent supplementary files', () => {
    expect(resolveOpeningHours(cities()).size).toBe(0);
  });

  it('accepts present-but-empty supplementary files', () => {
    expect(resolveOpeningHours(cities(), osmFile([]), manualFile([])).size).toBe(0);
  });

  describe('orphan detection — an entry matching no curated attraction fails loudly', () => {
    it('rejects an OSM entry whose attraction name does not exist', () => {
      expect(() =>
        resolveOpeningHours(cities(), osmFile([osmEntry('Chora Church', '09:00-18:00')])),
      ).toThrow(/Chora Church/);
    });

    it('rejects an OSM entry whose city is not in the seed', () => {
      const row = { ...osmEntry('Sight 1', '24/7'), cityIata: 'BCN' };
      expect(() => resolveOpeningHours(cities(), osmFile([row]))).toThrow(/BCN/);
    });

    it('rejects an orphaned manual entry', () => {
      expect(() =>
        resolveOpeningHours(cities(), undefined, manualFile([manualEntry('Nowhere', '24/7')])),
      ).toThrow(/Nowhere/);
    });
  });

  describe('provenance integrity', () => {
    it('rejects the same attraction appearing twice in one file', () => {
      expect(() =>
        resolveOpeningHours(
          cities(),
          osmFile([osmEntry('Sight 1', '24/7'), osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]),
        ),
      ).toThrow(/Sight 1/);
    });

    it('rejects an attraction claimed by both files — provenance would be ambiguous', () => {
      expect(() =>
        resolveOpeningHours(
          cities(),
          osmFile([osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]),
          manualFile([manualEntry('Sight 1', '24/7')]),
        ),
      ).toThrow(/Sight 1/);
    });

    it('rejects an OSM file without the ODbL licence marker', () => {
      const bad = { ...osmFile([osmEntry('Sight 1', '24/7')]), license: 'MIT' };
      expect(() => resolveOpeningHours(cities(), bad)).toThrow();
    });

    it('rejects an OSM file without attribution', () => {
      const bad = { ...osmFile([osmEntry('Sight 1', '24/7')]), attribution: '' };
      expect(() => resolveOpeningHours(cities(), bad)).toThrow();
    });

    it('rejects an OSM file without the Overpass base timestamp', () => {
      const bad = without(osmFile([osmEntry('Sight 1', '24/7')]), 'osmBaseTimestamp');
      expect(() => resolveOpeningHours(cities(), bad)).toThrow();
    });

    it('rejects an OSM entry without an auditable element reference', () => {
      const row = without(osmEntry('Sight 1', '24/7'), 'osmElement');
      expect(() => resolveOpeningHours(cities(), osmFile([row]))).toThrow();
    });

    it('rejects a manual fill with no source', () => {
      const row = without(manualEntry('Sight 1', '24/7'), 'source');
      expect(() => resolveOpeningHours(cities(), undefined, manualFile([row]))).toThrow();
    });

    it('rejects a manual fill with no retrieval date', () => {
      const row = without(manualEntry('Sight 1', '24/7'), 'retrieved');
      expect(() => resolveOpeningHours(cities(), undefined, manualFile([row]))).toThrow();
    });
  });

  it('rejects an unparseable OpeningHours value, naming the attraction', () => {
    expect(() =>
      resolveOpeningHours(cities(), osmFile([osmEntry('Sight 4', 'nonsense ~~~')])),
    ).toThrow(/Sight 4/);
  });
});
