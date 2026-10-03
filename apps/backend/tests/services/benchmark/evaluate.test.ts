import { describe, it, expect } from 'vitest';
import {
  SessionFile,
  evaluateBenchmark,
  type BenchmarkScenario,
} from '../../../src/services/benchmark/index.js';

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
 *
 * Every leg costs €100 except the four of IST FCO BER CDG WAW, at €10 each. So
 * that order costs €40; the two orders sharing one cheap leg with it (IST-FCO
 * 20 or CDG-WAW 29) cost €310, and the other three €400.
 */
const SCENARIO: BenchmarkScenario = {
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

const ORDER_LEGS = [
  ['IST-BER 20', 'BER-CDG 22', 'CDG-FCO 25', 'FCO-WAW 29'],
  ['IST-BER 20', 'BER-FCO 22', 'FCO-CDG 26', 'CDG-WAW 29'],
  ['IST-CDG 20', 'CDG-BER 23', 'BER-FCO 25', 'FCO-WAW 29'],
  ['IST-CDG 20', 'CDG-FCO 23', 'FCO-BER 27', 'BER-WAW 29'],
  ['IST-FCO 20', 'FCO-BER 24', 'BER-CDG 26', 'CDG-WAW 29'],
  ['IST-FCO 20', 'FCO-CDG 24', 'CDG-BER 27', 'BER-WAW 29'],
];
const CHEAP = new Set(ORDER_LEGS[4]);

type Fares = Record<string, number | null>;

/** Every leg of every order, €100 or €10 — the whole checklist, by hand. */
function handFares(): Fares {
  const fares: Fares = {};
  for (const leg of ORDER_LEGS.flat()) fares[leg] = CHEAP.has(leg) ? 1_000 : 10_000;
  return fares;
}

/** A session file holding `fares`, one grid per directed pair. */
function session(fares: Fares, date = '2026-10-13'): SessionFile {
  // Raw JSON, as transcribed; SessionFile.parse checks it.
  const grids = new Map<
    string,
    { origin: string; destination: string; screenshotAt: string; fares: object[] }
  >();
  for (const [leg, priceCents] of Object.entries(fares)) {
    const [pair, day] = leg.split(' ') as [string, string];
    const [origin, destination] = pair.split('-') as [string, string];
    let grid = grids.get(pair);
    if (!grid) {
      grid = { origin, destination, screenshotAt: `${date}T09:00:00+02:00`, fares: [] };
      grids.set(pair, grid);
    }
    grid.fares.push({ date: `2026-11-${day}`, priceCents });
  }
  return SessionFile.parse({
    date,
    startedAt: `${date}T09:00:00+02:00`,
    endedAt: `${date}T12:30:00+02:00`,
    grids: [...grids.values()],
  });
}

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

describe('SessionFile', () => {
  const grid = { origin: 'IST', destination: 'BER', screenshotAt: '2026-10-13T09:00:00+02:00' };
  const file = (gridFields: object, extra: object = {}) => ({
    date: '2026-10-13',
    startedAt: '2026-10-13T09:00:00+02:00',
    endedAt: '2026-10-13T12:30:00+02:00',
    grids: [{ ...grid, ...gridFields }],
    ...extra,
  });
  const fare = (f: object) => ({ fares: [f] });

  it('requires "no fare" to be written down, not left out', () => {
    expect(
      SessionFile.safeParse(file(fare({ date: '2026-11-20', priceCents: null }))).success,
    ).toBe(true);
    expect(SessionFile.safeParse(file(fare({ date: '2026-11-20' }))).success).toBe(false);
  });

  it('rejects a mistyped field rather than dropping it', () => {
    expect(
      SessionFile.safeParse(file(fare({ date: '2026-11-20', priceCents: 1_000, price: 10 })))
        .success,
    ).toBe(false);
  });

  it('rejects a grid between cities that are not curated', () => {
    const typo = { origin: 'ISt', ...fare({ date: '2026-11-20', priceCents: 1_000 }) };
    expect(SessionFile.safeParse(file(typo)).success).toBe(false);
  });

  it('holds the spot-checks and notes the protocol transcribes', () => {
    const parsed = SessionFile.parse(
      file(
        { item: 'G01', ...fare({ date: '2026-11-20', priceCents: 1_000 }) },
        {
          spotChecks: [
            {
              item: 'L01',
              origin: 'IST',
              destination: 'BER',
              date: '2026-11-20',
              livePriceCents: 1_200,
              screenshotAt: '2026-10-13T12:10:00+02:00',
            },
          ],
          notes: ['N04: Modify journey used, Rome showed 3–5 nights'],
        },
      ),
    );
    expect(parsed.spotChecks[0]!.livePriceCents).toBe(1_200);
    expect(parsed.grids[0]!.item).toBe('G01');
  });
});

describe('evaluateBenchmark', () => {
  it('finds the uniquely cheapest order in every GA run and agrees with brute force', async () => {
    const report = await evaluateBenchmark([SCENARIO], [session(handFares())], { seeds: SEEDS });

    expect(report.refused).toEqual([]);
    const result = report.sessions[0]!.scenarios[0]!;
    expect(result.optimum).toEqual({
      priceCents: 4_000,
      orders: [['IST', 'FCO', 'BER', 'CDG', 'WAW']],
    });
    expect(result.gaRuns.map((r) => r.seed)).toEqual(SEEDS);
    for (const run of result.gaRuns) {
      expect(run.priceCents).toBe(4_000);
      expect(run.order).toEqual(['IST', 'FCO', 'BER', 'CDG', 'WAW']);
    }
    expect(result.gaMedianCents).toBe(4_000);
    expect(result.hitRate).toBe(1);
    expect(result.totalOrders).toBe(6);
    expect(result.feasibleOrders).toBe(6);
    // 64 random starting orders cover all six.
    expect(result.ordersEvaluatedMedian).toBe(6);
  });

  it('treats a "no fare" leg as making every order through it infeasible', async () => {
    // IST-FCO on the 20th is the first leg of the two orders that start in FCO.
    const report = await evaluateBenchmark(
      [SCENARIO],
      [session({ ...handFares(), 'IST-FCO 20': null })],
      { seeds: SEEDS },
    );

    const result = report.sessions[0]!.scenarios[0]!;
    expect(result.feasibleOrders).toBe(4);
    // Of the four left, only IST BER FCO CDG WAW keeps a cheap leg (CDG-WAW 29).
    expect(result.optimum).toEqual({
      priceCents: 31_000,
      orders: [['IST', 'BER', 'FCO', 'CDG', 'WAW']],
    });
    expect(result.gaMedianCents).toBe(31_000);
    expect(result.hitRate).toBe(1);
  });

  it('keeps every order tied at the optimum, and counts a run at that price as a hit', async () => {
    // With IST-FCO 20 gone, a cheap FCO-WAW 29 brings IST BER CDG FCO WAW and
    // IST CDG BER FCO WAW down to €310 too: three orders tie.
    const report = await evaluateBenchmark(
      [SCENARIO],
      [session({ ...handFares(), 'IST-FCO 20': null, 'FCO-WAW 29': 1_000 })],
      { seeds: SEEDS },
    );

    const result = report.sessions[0]!.scenarios[0]!;
    expect(result.optimum!.priceCents).toBe(31_000);
    expect([...result.optimum!.orders].map((o) => o.join(' ')).sort()).toEqual([
      'IST BER CDG FCO WAW',
      'IST BER FCO CDG WAW',
      'IST CDG BER FCO WAW',
    ]);
    expect(result.hitRate).toBe(1);
  });

  it('refuses a session missing a checklist fare and names what is missing', async () => {
    const fares = handFares();
    delete fares['FCO-BER 27'];
    delete fares['IST-CDG 20'];

    const report = await evaluateBenchmark([SCENARIO], [session(fares)], { seeds: SEEDS });

    expect(report.sessions).toEqual([]);
    expect(report.refused).toEqual([
      {
        date: '2026-10-13',
        problems: ['missing FCO → BER 2026-11-27', 'missing IST → CDG 2026-11-20'],
      },
    ]);
  });

  it('refuses a session that records one fare twice', async () => {
    const file = session(handFares());
    file.grids[0]!.fares.push({ ...file.grids[0]!.fares[0]! });

    const report = await evaluateBenchmark([SCENARIO], [file], { seeds: SEEDS });

    expect(report.sessions).toEqual([]);
    expect(report.refused[0]!.problems).toEqual(['IST → BER 2026-11-20 is recorded twice']);
  });

  it('gives an identical report for the same inputs and seeds', async () => {
    const sessions = [
      session(handFares()),
      session({ ...handFares(), 'IST-FCO 20': null }, '2026-10-22'),
    ];
    const a = await evaluateBenchmark([SCENARIO], sessions, { seeds: SEEDS });
    const b = await evaluateBenchmark([SCENARIO], sessions, { seeds: SEEDS });
    expect(a).toEqual(b);
    expect(a.sessions.map((s) => s.date)).toEqual(['2026-10-13', '2026-10-22']);
  });
});
