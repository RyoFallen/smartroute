import { describe, it, expect } from 'vitest';
import { loadSeed } from '../../../prisma/seed.js';
import { ALWAYS_OPEN } from '../../../src/services/plan/seed-opening-hours.js';
import { prisma } from '../../setup-db.js';

const fixture = [
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

const osmFile = (entries: unknown[]) => ({
  license: 'ODbL-1.0',
  attribution: '© OpenStreetMap contributors',
  source: 'Overpass API',
  osmBaseTimestamp: '2026-08-09T10:42:44Z',
  entries,
});

const osmEntry = (attraction: string, openingHours: string) => ({
  cityIata: 'IST',
  attraction,
  openingHours,
  osmElement: 'way/109862851',
});

const manualFile = (entries: unknown[]) => ({
  note: 'Hand-filled where OSM had no opening_hours tag.',
  entries,
});

const manualEntry = (attraction: string, openingHours: string) => ({
  basis: 'sourced',
  cityIata: 'IST',
  attraction,
  openingHours,
  source: 'https://example.org/times',
  retrieved: '2026-08-09',
});

const alwaysOpenEntry = (attraction: string) => ({
  basis: 'always-open',
  cityIata: 'IST',
  attraction,
  rationale: 'Open-air public space with no gates.',
});

const unknownEntry = (attraction: string) => ({
  basis: 'unknown',
  cityIata: 'IST',
  attraction,
  rationale: 'Checked; the operator publishes no hours.',
});

describe('loadSeed', () => {
  it('inserts cities and attractions', async () => {
    await loadSeed(prisma, fixture);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(8);
  });

  it('is idempotent — re-running converges to the file state', async () => {
    // First seed: 9 attractions, with an alternate airport code
    const first = [
      {
        ...fixture[0]!,
        altCodes: ['LGW'],
        attractions: Array.from({ length: 9 }, (_, i) => ({
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
    await loadSeed(prisma, first);
    expect(await prisma.attraction.count()).toBe(9);
    expect((await prisma.city.findUnique({ where: { iata: 'IST' } }))?.altCodes).toEqual(['LGW']);

    // Second seed: 8 renamed attractions, altCodes cleared — must prune and update
    const second = [
      {
        ...fixture[0]!,
        altCodes: [],
        attractions: Array.from({ length: 8 }, (_, i) => ({
          name: `Renamed ${i + 1}`,
          category: 'LANDMARK' as const,
          rank: i + 1,
          lat: 41.0,
          lon: 28.98,
          description: 'A test attraction description.',
          tags: ['history'],
        })),
      },
    ];
    await loadSeed(prisma, second);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(8);
    expect(await prisma.attraction.findFirst({ where: { name: 'Sight 1' } })).toBeNull();
    expect((await prisma.city.findUnique({ where: { iata: 'IST' } }))?.altCodes).toEqual([]);
  });

  it('rejects invalid data before touching the DB', async () => {
    const bad = [{ ...fixture[0]!, attractions: [] }]; // violates min 8
    await expect(loadSeed(prisma, bad)).rejects.toThrow();
    expect(await prisma.city.count()).toBe(0);
  });

  it('leaves openingHours and visitMinutes null when nothing supplies them', async () => {
    await loadSeed(prisma, fixture);
    const a = await prisma.attraction.findFirst({ where: { name: 'Sight 1' } });
    expect(a?.openingHours).toBeNull();
    expect(a?.visitMinutes).toBeNull();
  });

  it('persists curated visitMinutes from the attraction file', async () => {
    const withVisitMinutes = [
      {
        ...fixture[0]!,
        attractions: fixture[0]!.attractions.map((a, i) =>
          i === 0 ? { ...a, visitMinutes: 180 } : a,
        ),
      },
    ];
    await loadSeed(prisma, withVisitMinutes);
    expect((await prisma.attraction.findFirst({ where: { name: 'Sight 1' } }))?.visitMinutes).toBe(
      180,
    );
    // Uncurated rows stay null so the fallback stays distinguishable from a real value.
    expect(
      (await prisma.attraction.findFirst({ where: { name: 'Sight 2' } }))?.visitMinutes,
    ).toBeNull();
  });

  it('persists openingHours joined from the supplementary files', async () => {
    await loadSeed(prisma, fixture, {
      osm: osmFile([osmEntry('Sight 1', 'Tu-Su 09:00-17:00')]),
      manual: manualFile([
        alwaysOpenEntry('Sight 2'),
        unknownEntry('Sight 4'),
        manualEntry('Sight 5', 'Mo-Fr 10:00-18:00'),
      ]),
    });

    const byName = new Map(
      (await prisma.attraction.findMany()).map((a) => [a.name, a.openingHours]),
    );
    expect(byName.get('Sight 1')).toBe('Tu-Su 09:00-17:00');
    expect(byName.get('Sight 2')).toBe(ALWAYS_OPEN);
    expect(byName.get('Sight 3')).toBeNull();
    // Each of the three hand-made bases lands differently in the column: a
    // sourced fill persists its value, always-open persists the marker, and a
    // deliberate unknown persists nothing at all.
    expect(byName.get('Sight 5')).toBe('Mo-Fr 10:00-18:00');
    // A deliberate unknown persists exactly as an unexamined one does. The
    // decision is recorded in the seed file, not in the column — the database
    // only ever holds "we have a value" or "we do not".
    expect(byName.get('Sight 4')).toBeNull();
  });

  it('rejects an orphaned OpeningHours entry before touching the DB', async () => {
    await expect(
      loadSeed(prisma, fixture, { osm: osmFile([osmEntry('Does Not Exist', ALWAYS_OPEN)]) }),
    ).rejects.toThrow(/Does Not Exist/);
    expect(await prisma.city.count()).toBe(0);
  });

  it('persists metroIata when set, and null when omitted', async () => {
    await loadSeed(prisma, [{ ...fixture[0]!, altCodes: ['LGW'], metroIata: 'LON' }]);
    expect((await prisma.city.findUnique({ where: { iata: 'IST' } }))?.metroIata).toBe('LON');

    await loadSeed(prisma, fixture);
    expect((await prisma.city.findUnique({ where: { iata: 'IST' } }))?.metroIata).toBeNull();
  });
});
