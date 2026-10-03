import { describe, it, expect } from 'vitest';
import { fareChecklist, type BenchmarkScenario } from '../../../src/services/benchmark/index.js';

/**
 * Origin IST, then BER (2 days), CDG (3), FCO (4) in some order, ending in WAW.
 * Departs 20 Nov. The six orders, walked by hand — first leg on the 20th, each
 * later leg after the stay of the city it leaves:
 *
 *   IST BER CDG FCO WAW   IST-BER 20  BER-CDG 22  CDG-FCO 25  FCO-WAW 29
 *   IST BER FCO CDG WAW   IST-BER 20  BER-FCO 22  FCO-CDG 26  CDG-WAW 29
 *   IST CDG BER FCO WAW   IST-CDG 20  CDG-BER 23  BER-FCO 25  FCO-WAW 29
 *   IST CDG FCO BER WAW   IST-CDG 20  CDG-FCO 23  FCO-BER 27  BER-WAW 29
 *   IST FCO BER CDG WAW   IST-FCO 20  FCO-BER 24  BER-CDG 26  CDG-WAW 29
 *   IST FCO CDG BER WAW   IST-FCO 20  FCO-CDG 24  CDG-BER 27  BER-WAW 29
 */
const HAND: BenchmarkScenario = {
  id: 'H1',
  origin: 'IST',
  visited: [
    { city: 'BER', stayDays: 2 },
    { city: 'CDG', stayDays: 3 },
    { city: 'FCO', stayDays: 4 },
    { city: 'WAW', stayDays: 2 },
  ],
  endCity: 'WAW',
  departDate: '2026-11-20',
};

const HAND_PAIRS = [
  { origin: 'BER', destination: 'CDG', dates: ['2026-11-22', '2026-11-26'] },
  { origin: 'BER', destination: 'FCO', dates: ['2026-11-22', '2026-11-25'] },
  { origin: 'BER', destination: 'WAW', dates: ['2026-11-29'] },
  { origin: 'CDG', destination: 'BER', dates: ['2026-11-23', '2026-11-27'] },
  { origin: 'CDG', destination: 'FCO', dates: ['2026-11-23', '2026-11-25'] },
  { origin: 'CDG', destination: 'WAW', dates: ['2026-11-29'] },
  { origin: 'FCO', destination: 'BER', dates: ['2026-11-24', '2026-11-27'] },
  { origin: 'FCO', destination: 'CDG', dates: ['2026-11-24', '2026-11-26'] },
  { origin: 'FCO', destination: 'WAW', dates: ['2026-11-29'] },
  { origin: 'IST', destination: 'BER', dates: ['2026-11-20'] },
  { origin: 'IST', destination: 'CDG', dates: ['2026-11-20'] },
  { origin: 'IST', destination: 'FCO', dates: ['2026-11-20'] },
];

describe('fareChecklist', () => {
  it('needs exactly the legs of every order, grouped by directed pair', () => {
    const checklist = fareChecklist([HAND]);

    expect(
      checklist.pairs.map(({ origin, destination, dates }) => ({ origin, destination, dates })),
    ).toEqual(HAND_PAIRS);
    expect(checklist.totalFares).toBe(18);
  });

  it("reports each pair's earliest and latest date", () => {
    const pair = fareChecklist([HAND]).pairs.find(
      (p) => p.origin === 'FCO' && p.destination === 'BER',
    );
    expect(pair).toMatchObject({ earliest: '2026-11-24', latest: '2026-11-27' });
  });

  it('collapses the same fare needed by two scenarios into one', () => {
    // The same scenario a day later shares nothing; the same scenario again shares everything.
    const later = { ...HAND, id: 'H2', departDate: '2026-11-21' };
    const again = { ...HAND, id: 'H3' };

    expect(fareChecklist([HAND, again]).totalFares).toBe(18);
    expect(fareChecklist([HAND, later]).totalFares).toBe(36);
    const istBer = fareChecklist([HAND, later]).pairs.find(
      (p) => p.origin === 'IST' && p.destination === 'BER',
    );
    expect(istBer).toMatchObject({
      dates: ['2026-11-20', '2026-11-21'],
      earliest: '2026-11-20',
      latest: '2026-11-21',
    });
  });

  it('never asks for a fare into the origin or out of the end city', () => {
    for (const p of fareChecklist([HAND]).pairs) {
      expect(p.destination).not.toBe('IST');
      expect(p.origin).not.toBe('WAW');
    }
  });
});
