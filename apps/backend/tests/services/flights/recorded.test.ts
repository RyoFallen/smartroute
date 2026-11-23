import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { SessionFile } from '../../../src/services/benchmark/session.js';
import { loadRecordedSession } from '../../../src/services/benchmark/session.js';
import {
  DEFAULT_RECORDED_SESSION,
  RecordedFareProvider,
} from '../../../src/services/flights/recorded.js';

const session: SessionFile = {
  date: '2026-11-01',
  startedAt: '2026-11-01T08:29:00+01:00',
  endedAt: '2026-11-01T09:17:00+01:00',
  grids: [
    {
      origin: 'BER',
      destination: 'FCO',
      screenshotAt: '2026-11-01T08:30:00+01:00',
      fares: [
        { date: '2026-12-01', priceCents: 4_200 },
        { date: '2026-12-02', priceCents: null },
      ],
    },
  ],
  competitorResults: [],
  spotChecks: [],
  notes: [],
};

describe('RecordedFareProvider', () => {
  const provider = new RecordedFareProvider(session);

  it('serves a recorded fare in EUR and keeps it out of the price cache', async () => {
    expect(provider.currency).toBe('EUR');
    expect(provider.cacheable).toBe(false);
    const out = await provider.getPrices([
      { origin: 'BER', destination: 'FCO', departDate: '2026-12-01', cabinClass: 'ECONOMY' },
    ]);
    expect(out).toEqual([
      {
        origin: 'BER',
        destination: 'FCO',
        departDate: '2026-12-01',
        cabinClass: 'ECONOMY',
        priceCents: 4_200,
        durationMin: 60,
        stops: 0,
        carrier: null,
      },
    ]);
  });

  it('leaves out a no-fare day, an unrecorded pair and any cabin but economy', async () => {
    const out = await provider.getPrices([
      { origin: 'BER', destination: 'FCO', departDate: '2026-12-02', cabinClass: 'ECONOMY' },
      { origin: 'FCO', destination: 'BER', departDate: '2026-12-01', cabinClass: 'ECONOMY' },
      { origin: 'BER', destination: 'FCO', departDate: '2026-12-01', cabinClass: 'BUSINESS' },
    ]);
    expect(out).toEqual([]);
  });
});

describe('loadRecordedSession', () => {
  it('loads the committed Session 1 by default: 56 pairs, 28 Nov to 22 Dec', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
    const loaded = loadRecordedSession(path.join(repoRoot, DEFAULT_RECORDED_SESSION));
    expect(loaded.date).toBe('2026-11-01');
    expect(loaded.grids).toHaveLength(56);
    const dates = loaded.grids.flatMap((g) => g.fares.map((f) => f.date)).sort();
    expect(dates[0]).toBe('2026-11-28');
    expect(dates.at(-1)).toBe('2026-12-22');
  });

  it('refuses a file that is not a session', () => {
    expect(() => loadRecordedSession(fileURLToPath(import.meta.url))).toThrow();
  });
});
