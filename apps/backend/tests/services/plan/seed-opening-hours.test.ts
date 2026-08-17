import { describe, it, expect } from 'vitest';
import {
  ALWAYS_OPEN,
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
  basis: 'sourced',
  cityIata: 'IST',
  attraction,
  openingHours,
  source: 'https://example.org/opening-times',
  retrieved: '2026-08-09',
});

const alwaysOpenEntry = (attraction: string) => ({
  basis: 'always-open',
  cityIata: 'IST',
  attraction,
  rationale: 'A public square with no gates and no published hours.',
});

const unknownEntry = (attraction: string) => ({
  basis: 'unknown',
  cityIata: 'IST',
  attraction,
  rationale: 'Operator publishes no hours; the site is seasonal and unstaffed.',
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

  describe('the three bases a hand-made judgement can rest on', () => {
    it('resolves an always-open entry to the marker without asking for a source', () => {
      // A public square has no published hours to cite. Demanding a source URL
      // for one would force a fabricated citation, which is the opposite of what
      // the provenance requirement is for.
      const map = resolveOpeningHours(
        cities(),
        undefined,
        manualFile([alwaysOpenEntry('Sight 2')]),
      );
      expect(map.get(attractionKey('IST', 'Sight 2'))).toBe(ALWAYS_OPEN);
    });

    it('records a deliberate unknown without giving it opening hours', () => {
      // The distinction the whole file exists to preserve: "we looked and there
      // is nothing to record" is a decision, and it must be visible as one.
      // Absence alone cannot say that — it is indistinguishable from nobody
      // having looked yet.
      const map = resolveOpeningHours(cities(), undefined, manualFile([unknownEntry('Sight 2')]));
      expect(map.has(attractionKey('IST', 'Sight 2'))).toBe(false);
    });

    it('still stops a deliberate unknown from colliding with a sourced value', () => {
      // An attraction cannot be both deliberately unknown and known.
      expect(() =>
        resolveOpeningHours(
          cities(),
          osmFile([osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]),
          manualFile([unknownEntry('Sight 1')]),
        ),
      ).toThrow(/claimed by both/);
    });

    it('rejects an always-open entry that tries to smuggle in real hours', () => {
      // `24/7` is implied by the basis, never written out — otherwise the file
      // could claim a row is unconstrained while carrying a weekly schedule.
      expect(() =>
        resolveOpeningHours(
          cities(),
          undefined,
          manualFile([{ ...alwaysOpenEntry('Sight 2'), openingHours: 'Mo-Fr 09:00-17:00' }]),
        ),
      ).toThrow();
    });

    it('requires a rationale for always-open and for unknown', () => {
      expect(() =>
        resolveOpeningHours(
          cities(),
          undefined,
          manualFile([without(alwaysOpenEntry('Sight 2'), 'rationale')]),
        ),
      ).toThrow();
      expect(() =>
        resolveOpeningHours(
          cities(),
          undefined,
          manualFile([without(unknownEntry('Sight 2'), 'rationale')]),
        ),
      ).toThrow();
    });

    it('rejects an entry with no basis at all', () => {
      // Every row states what it rests on; there is no default basis.
      expect(() =>
        resolveOpeningHours(
          cities(),
          undefined,
          manualFile([without(manualEntry('Sight 2', '24/7'), 'basis')]),
        ),
      ).toThrow();
    });

    it('keeps a deliberate unknown out of the way of orphan detection', () => {
      expect(() =>
        resolveOpeningHours(cities(), undefined, manualFile([unknownEntry('Nowhere')])),
      ).toThrow(/no curated attraction/);
    });
  });

  it('carries an audit trail when a value was rewritten from its published form', () => {
    // PH/SH holiday macros cannot be evaluated for `tr` or `gb`, so they are
    // rewritten to explicit dates. The original has to survive the rewrite or
    // the transformation is unauditable.
    const map = resolveOpeningHours(
      cities(),
      osmFile([
        {
          ...osmEntry('Sight 1', 'Mo-Fr 09:00-17:00; Jan 01,Dec 25 off'),
          rewrittenFrom: 'Mo-Fr 09:00-17:00; PH off',
        },
      ]),
    );
    expect(map.get(attractionKey('IST', 'Sight 1'))).toBe('Mo-Fr 09:00-17:00; Jan 01,Dec 25 off');
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
