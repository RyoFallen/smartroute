import { describe, it, expect } from 'vitest';
import { MockFlightProvider } from '../../../src/services/flights/provider.js';

describe('MockFlightProvider', () => {
  it('returns deterministic price for same triple', async () => {
    const p = new MockFlightProvider();
    const a = await p.getPrices([
      { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' },
    ]);
    const b = await p.getPrices([
      { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' },
    ]);
    expect(a[0]!.priceCents).toBe(b[0]!.priceCents);
    expect(a[0]!.priceCents).toBeGreaterThan(0);
  });

  it('returns one result per requested triple', async () => {
    const p = new MockFlightProvider();
    const out = await p.getPrices([
      { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' },
      { origin: 'CDG', destination: 'FCO', departDate: '2026-06-04', cabinClass: 'ECONOMY' },
    ]);
    expect(out).toHaveLength(2);
  });
});
