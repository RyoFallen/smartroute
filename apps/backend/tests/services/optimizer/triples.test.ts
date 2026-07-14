import { describe, it, expect } from 'vitest';
import type { CabinClass } from '@smartroute/shared';
import { collectPriceTriples } from '../../../src/services/optimizer/triples.js';
import { enumerateOrderings } from '../../../src/services/optimizer/enumerate.js';

const cabinClass: CabinClass = 'ECONOMY';

/** Oracle: walk every enumerated ordering and record each leg's (o, d, date). */
function triplesViaEnumeration(
  cities: string[],
  perCityDays: number[],
  departDate: string,
  startCity?: string,
  endCity?: string,
): Set<string> {
  const out = new Set<string>();
  for (const ordering of enumerateOrderings(cities, { startCity, endCity })) {
    let date = new Date(departDate);
    for (let i = 0; i < ordering.length - 1; i++) {
      const origin = ordering[i]!;
      out.add(`${origin}|${ordering[i + 1]}|${date.toISOString().slice(0, 10)}`);
      const stay = perCityDays[cities.indexOf(origin)] ?? 1;
      date = new Date(date.getTime() + stay * 86_400_000);
    }
  }
  return out;
}

describe('collectPriceTriples', () => {
  const CODES = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'];
  const cases: Array<{ n: number; days: number[]; start?: string; end?: string }> = [
    { n: 3, days: [1, 2, 3] },
    { n: 4, days: [2, 2, 2, 2], start: 'AAA' },
    { n: 5, days: [1, 3, 2, 5, 1], start: 'AAA', end: 'EEE' },
    { n: 5, days: [4, 1, 1, 2, 3], end: 'BBB' },
    { n: 6, days: [1, 2, 1, 2, 1, 2], start: 'CCC' },
    { n: 2, days: [7, 7], start: 'AAA', end: 'BBB' },
  ];

  it.each(cases)('matches the enumeration oracle (n=$n start=$start end=$end)', (c) => {
    const cities = CODES.slice(0, c.n);
    const got = collectPriceTriples({
      cities,
      perCityDays: c.days,
      departDate: '2026-06-01',
      cabinClass,
      startCity: c.start,
      endCity: c.end,
    });
    const gotKeys = new Set(got.map((q) => `${q.origin}|${q.destination}|${q.departDate}`));
    const want = triplesViaEnumeration(cities, c.days, '2026-06-01', c.start, c.end);
    expect(gotKeys).toEqual(want);
    expect(got).toHaveLength(gotKeys.size);
  });
});
