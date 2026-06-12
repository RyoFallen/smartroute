import { describe, it, expect, beforeEach } from 'vitest';
import { PlanService, visitOrder } from '../../../src/services/plan/index.js';
import { TripService } from '../../../src/services/trips/index.js';
import { loadSeed } from '../../../prisma/seed.js';
import { prisma } from '../../setup-db.js';
import type { Trip } from '@smartroute/shared';

function leg(origin: string, destination: string) {
  return {
    origin,
    destination,
    depart: '2026-07-01T08:00:00.000Z',
    arrive: '2026-07-01T12:00:00.000Z',
    carrier: 'XX',
    priceCents: 10_000,
    durationMin: 240,
    stops: 0,
  };
}

function cityFixture(iata: string, name: string, altCodes: string[], prefix: string) {
  return {
    iata,
    altCodes,
    name,
    country: 'Testland',
    lat: 41.0,
    lon: 28.9,
    timezone: 'Europe/Istanbul',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `${prefix} Sight ${i + 1}`,
      category: 'LANDMARK' as const,
      rank: i + 1,
      lat: 41.0,
      lon: 28.9,
      description: 'A test attraction description.',
      tags: ['history'],
    })),
  };
}

const tripInput = {
  name: 'Test trip',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  cabinClass: 'ECONOMY' as const,
  travelers: 1,
  cities: ['IST', 'BER', 'JFK'],
  flights: [leg('IST', 'BER'), leg('BER', 'JFK')],
  totalPriceCents: 20_000,
};

describe('visitOrder', () => {
  it('derives order from the flight-leg chain', () => {
    const t = { flights: [leg('IST', 'BER'), leg('BER', 'JFK')], cities: ['JFK', 'IST', 'BER'] };
    expect(visitOrder(t as unknown as Trip)).toEqual(['IST', 'BER', 'JFK']);
  });

  it('falls back to cities when flights are empty', () => {
    const t = { flights: [], cities: ['IST', 'BER'] };
    expect(visitOrder(t as unknown as Trip)).toEqual(['IST', 'BER']);
  });
});

describe('PlanService', () => {
  beforeEach(async () => {
    await loadSeed(prisma, [
      cityFixture('IST', 'Istanbul', [], 'IST'),
      cityFixture('LHR', 'London', ['LGW'], 'LON'),
    ]);
  });

  it('returns must-go lists in visiting order, unseeded cities marked unavailable', async () => {
    const trip = await new TripService(prisma).create('u1', tripInput);
    const plan = await new PlanService(prisma).planForTrip('u1', trip.id);

    expect(plan.tripId).toBe(trip.id);
    expect(plan.cities.map((c) => c.iata)).toEqual(['IST', 'BER', 'JFK']);

    const ist = plan.cities[0]!;
    expect(ist.available).toBe(true);
    expect(ist.name).toBe('Istanbul');
    expect(ist.mustGo).toHaveLength(8);
    expect(ist.mustGo[0]!.rank).toBe(1);

    const jfk = plan.cities[2]!;
    expect(jfk).toEqual({ iata: 'JFK', name: null, available: false, mustGo: [] });
  });

  it('resolves alternate airport codes to the same city', async () => {
    const trip = await new TripService(prisma).create('u1', {
      ...tripInput,
      cities: ['IST', 'LGW'],
      flights: [leg('IST', 'LGW')],
    });
    const plan = await new PlanService(prisma).planForTrip('u1', trip.id);
    const lgw = plan.cities[1]!;
    expect(lgw.iata).toBe('LGW');
    expect(lgw.available).toBe(true);
    expect(lgw.name).toBe('London');
    expect(lgw.mustGo).toHaveLength(8);
  });

  it('throws NOT_FOUND for another user trip', async () => {
    const trip = await new TripService(prisma).create('u1', tripInput);
    await expect(new PlanService(prisma).planForTrip('u2', trip.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
