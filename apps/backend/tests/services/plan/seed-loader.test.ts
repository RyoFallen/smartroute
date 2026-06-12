import { describe, it, expect } from 'vitest';
import { loadSeed } from '../../../prisma/seed.js';
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

describe('loadSeed', () => {
  it('inserts cities and attractions', async () => {
    await loadSeed(prisma, fixture);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(8);
  });

  it('is idempotent — re-running converges to the file state', async () => {
    await loadSeed(prisma, fixture);
    const renamedFixture = [
      {
        ...fixture[0]!,
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
    await loadSeed(prisma, renamedFixture);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(8);
    expect(await prisma.attraction.findFirst({ where: { name: 'Sight 1' } })).toBeNull();
  });

  it('rejects invalid data before touching the DB', async () => {
    const bad = [{ ...fixture[0]!, attractions: [] }]; // violates min 8
    await expect(loadSeed(prisma, bad)).rejects.toThrow();
    expect(await prisma.city.count()).toBe(0);
  });
});
