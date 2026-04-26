import { describe, it, expect } from 'vitest';
import { TripService } from '../../../src/services/trips/index.js';
import { ApiError } from '../../../src/lib/ApiError.js';
import { prisma } from '../../setup-db.js';

const sample = {
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  cabinClass: 'ECONOMY' as const,
  travelers: 1,
  cities: ['JFK', 'CDG', 'FCO'],
  flights: [
    {
      origin: 'JFK',
      destination: 'CDG',
      depart: '2026-06-01T08:00:00.000Z',
      arrive: '2026-06-01T14:00:00.000Z',
      carrier: 'AF',
      priceCents: 50_000,
      durationMin: 360,
      stops: 0,
    },
    {
      origin: 'CDG',
      destination: 'FCO',
      depart: '2026-06-04T08:00:00.000Z',
      arrive: '2026-06-04T10:00:00.000Z',
      carrier: 'AF',
      priceCents: 20_000,
      durationMin: 120,
      stops: 0,
    },
  ],
  totalPriceCents: 70_000,
};

describe('TripService', () => {
  it('creates and retrieves a trip', async () => {
    const svc = new TripService(prisma);
    const created = await svc.create('u1', sample);
    expect(created.id).toBeDefined();
    const fetched = await svc.findById('u1', created.id);
    expect(fetched.name).toBe('Eurotrip');
  });

  it('lists trips for one user only', async () => {
    const svc = new TripService(prisma);
    await svc.create('u1', sample);
    await svc.create('u2', sample);
    const list = await svc.list('u1');
    expect(list).toHaveLength(1);
  });

  it('throws NOT_FOUND for other user trip', async () => {
    const svc = new TripService(prisma);
    const c = await svc.create('u1', sample);
    await expect(svc.findById('u2', c.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes own trip', async () => {
    const svc = new TripService(prisma);
    const c = await svc.create('u1', sample);
    await svc.delete('u1', c.id);
    await expect(svc.findById('u1', c.id)).rejects.toBeInstanceOf(ApiError);
  });
});
