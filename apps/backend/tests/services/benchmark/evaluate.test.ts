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

  it('prices the NaiveOrder and the mean over all orders beside the GA', async () => {
    // Great-circle km on the curated coordinates: from IST, FCO 1375 < BER 1738
    // < CDG 2256 (WAW, 1386, is the end city and waits); from FCO, CDG 1105 <
    // BER 1183. So the NaiveOrder is IST FCO CDG BER WAW, sharing only its first
    // leg (IST-FCO 20) with the cheap order: 10 + 100 + 100 + 100 = €310.
    // IST-BER 20 at €40 brings the two orders that start in BER to €340 and
    // €250, so the six orders cost 340 + 250 + 400 + 400 + 40 + 310 = €1,740:
    // a mean of €290.
    const report = await evaluateBenchmark(
      [SCENARIO],
      [session({ ...handFares(), 'IST-BER 20': 4_000 })],
      { seeds: SEEDS },
    );

    const result = report.sessions[0]!.scenarios[0]!;
    expect(result.naive).toEqual({
      order: ['IST', 'FCO', 'CDG', 'BER', 'WAW'],
      priceCents: 31_000,
    });
    expect(result.meanCents).toBe(29_000);
    expect(result.gaMedianCents).toBe(4_000);
    expect(result.savingVsNaive).toBeCloseTo(27_000 / 31_000, 10);
    expect(result.savingVsMean).toBeCloseTo(25_000 / 29_000, 10);
  });

  it('reports a NaiveOrder through a "no fare" leg as unpriced, and leaves it out of the mean', async () => {
    // IST-FCO 20 is the NaiveOrder's first leg. The four orders left cost
    // 400 + 310 + 400 + 400 = €1,510: a mean of €377.50 over 4, with 2 infeasible.
    const report = await evaluateBenchmark(
      [SCENARIO],
      [session({ ...handFares(), 'IST-FCO 20': null })],
      { seeds: SEEDS },
    );

    const result = report.sessions[0]!.scenarios[0]!;
    expect(result.naive).toEqual({
      order: ['IST', 'FCO', 'CDG', 'BER', 'WAW'],
      priceCents: null,
    });
    expect(result.savingVsNaive).toBeNull();
    expect(result.totalOrders - result.feasibleOrders).toBe(2);
    expect(result.meanCents).toBe(37_750);
    expect(result.savingVsMean).toBeCloseTo((37_750 - 31_000) / 37_750, 10);
  });

  it('keeps the end city last however near it is, and breaks a distance tie by IATA code', async () => {
    // A hand-built map in degrees: WAW, the end city, is nearest the origin;
    // BER and CDG are both 1° from IST. BER wins the tie, then FCO (1° from
    // BER) beats CDG (√2°). Had CDG won, the order would be IST CDG BER FCO WAW.
    const coordinates = {
      IST: { lat: 0, lon: 0 },
      WAW: { lat: 0, lon: 0.5 },
      BER: { lat: 0, lon: 1 },
      CDG: { lat: 1, lon: 0 },
      FCO: { lat: 0, lon: 2 },
    };
    const report = await evaluateBenchmark([SCENARIO], [session(handFares())], {
      seeds: SEEDS,
      coordinates,
    });

    // IST BER FCO CDG WAW shares CDG-WAW 29 with the cheap order: €310.
    expect(report.sessions[0]!.scenarios[0]!.naive).toEqual({
      order: ['IST', 'BER', 'FCO', 'CDG', 'WAW'],
      priceCents: 31_000,
    });
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

describe('evaluateBenchmark against Kiwi.com Nomad', () => {
  // Five copies of SCENARIO, so one session holds a result of every kind. The
  // GA median is €40 in each, on IST FCO BER CDG WAW: legs on the 20th, 24th,
  // 26th and 29th, staying FCO 4, BER 2, CDG 3 nights.
  const scenarios = ['H1', 'H2', 'H3', 'H4', 'H5'].map((id) => ({ ...SCENARIO, id }));
  const GA_ORDER = ['IST', 'FCO', 'BER', 'CDG', 'WAW'];
  const gaItinerary = {
    order: GA_ORDER,
    legDates: ['2026-11-20', '2026-11-24', '2026-11-26', '2026-11-29'],
    stays: [
      { city: 'FCO', nights: 4 },
      { city: 'BER', nights: 2 },
      { city: 'CDG', nights: 3 },
    ],
  };
  const flights = { priceCents: 9_000, modes: ['flight', 'flight', 'flight', 'flight'] };
  const at = '2026-10-31T11:00:00+01:00';

  function withNomad(results: object[]): SessionFile {
    return SessionFile.parse({ ...session(handFares()), competitorResults: results });
  }

  const results = [
    // €50 on the GA's own order; the any-mode result, by bus, is cheaper still
    // and must not be the one compared.
    {
      scenarioId: 'H1',
      capturedAt: at,
      allFlight: { priceCents: 5_000, ...gaItinerary },
      anyMode: { priceCents: 2_500, modes: ['flight', 'bus', 'flight', 'flight'] },
    },
    // €32 on IST BER CDG FCO WAW: legs on the 20th, 22nd, 25th and 29th.
    {
      scenarioId: 'H2',
      capturedAt: at,
      allFlight: {
        priceCents: 3_200,
        order: ['IST', 'BER', 'CDG', 'FCO', 'WAW'],
        legDates: ['2026-11-20', '2026-11-22', '2026-11-25', '2026-11-29'],
        stays: [
          { city: 'BER', nights: 2 },
          { city: 'CDG', nights: 3 },
          { city: 'FCO', nights: 4 },
        ],
      },
      anyMode: flights,
    },
    // The GA's order, but the last leg left a day late: a past-midnight landing.
    {
      scenarioId: 'H3',
      capturedAt: at,
      allFlight: {
        priceCents: 1_000,
        ...gaItinerary,
        legDates: ['2026-11-20', '2026-11-24', '2026-11-26', '2026-11-30'],
      },
      anyMode: flights,
    },
    // H4 has no capture at all.
    { scenarioId: 'H5', capturedAt: at, allFlight: null, anyMode: flights },
  ];

  it('compares valid results only: win rate, median savings and order agreement', async () => {
    const report = await evaluateBenchmark(scenarios, [withNomad(results)], { seeds: SEEDS });
    const [h1, h2, h3, h4, h5] = report.sessions[0]!.scenarios.map((r) => r.competitor);

    expect(h1).toMatchObject({ status: 'valid', priceCents: 5_000, gaWins: true, saving: 0.2 });
    expect(h1!.orderMatchesGa).toBe(true);
    expect(h1!.anyMode).toEqual({
      priceCents: 2_500,
      modes: ['flight', 'bus', 'flight', 'flight'],
    });
    // (32 − 40) / 32: Nomad is cheaper, so the GA loses by a quarter.
    expect(h2).toMatchObject({ status: 'valid', gaWins: false, saving: -0.25 });
    expect(h2!.orderMatchesGa).toBe(false);
    expect(h3).toMatchObject({ status: 'invalid', gaWins: null, saving: null });
    expect(h3!.problems).toEqual(['leg CDG → WAW leaves 2026-11-30, the stays give 2026-11-29']);
    expect(h4).toMatchObject({ status: 'missing', gaWins: null });
    expect(h5).toMatchObject({ status: 'no-all-flight', gaWins: null });

    // Two valid: one win, savings 0.2 and −0.25, so a median of −0.025.
    const nomad = report.sessions[0]!.nomad;
    expect(nomad).toMatchObject({ valid: 2, excluded: 2, missing: 1, wins: 1, orderMatches: 1 });
    expect(nomad.winRate).toBe(0.5);
    expect(nomad.medianSaving).toBeCloseTo(-0.025, 10);
  });

  it('marks a result invalid when its stays differ, and says which', async () => {
    const stays = [
      { city: 'FCO', nights: 4 },
      { city: 'BER', nights: 3 },
      { city: 'CDG', nights: 3 },
    ];
    const report = await evaluateBenchmark(
      [SCENARIO],
      [
        withNomad([
          {
            scenarioId: 'H1',
            capturedAt: at,
            allFlight: { priceCents: 5_000, ...gaItinerary, stays },
            anyMode: flights,
          },
        ]),
      ],
      { seeds: SEEDS },
    );

    const c = report.sessions[0]!.scenarios[0]!.competitor;
    expect(c.status).toBe('invalid');
    expect(c.problems).toEqual(['BER: Stay 3 nights, CityStay 2']);
    expect(report.sessions[0]!.nomad).toMatchObject({ valid: 0, excluded: 1, winRate: null });
  });

  it("marks a result invalid when its order is not the scenario's cities", async () => {
    const report = await evaluateBenchmark(
      [SCENARIO],
      [
        withNomad([
          {
            scenarioId: 'H1',
            capturedAt: at,
            allFlight: {
              priceCents: 5_000,
              ...gaItinerary,
              order: ['IST', 'FCO', 'BER', 'WAW', 'CDG'],
            },
            anyMode: flights,
          },
        ]),
      ],
      { seeds: SEEDS },
    );
    expect(report.sessions[0]!.scenarios[0]!.competitor.status).toBe('invalid');
  });

  it('refuses a session with two results for one scenario, or one for no scenario', async () => {
    const report = await evaluateBenchmark(
      scenarios,
      [withNomad([results[0]!, results[0]!, { ...results[1]!, scenarioId: 'S99' }])],
      { seeds: SEEDS },
    );
    expect(report.sessions).toEqual([]);
    expect(report.refused[0]!.problems).toEqual([
      'H1 has two CompetitorResults',
      'CompetitorResult for unknown S99',
    ]);
  });
});
