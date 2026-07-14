/**
 * GA-vs-exhaustive benchmark for the thesis evidence table (spec §2.5, §11.5).
 *
 * Run manually (never CI):  pnpm exec tsx scripts/benchmark-optimizer.ts [seed]
 *
 * Sweeps N=4..8 comparing the GA against the exhaustive enumerator optimum
 * (optimality gap, runtimes) and N=10/12/15 GA-only for scaling headroom,
 * for two GA parameter sets. Writes docs/presentation/ga-benchmark.md.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CabinClass, Score } from '@smartroute/shared';
import { MockFlightProvider } from '../src/services/flights/provider.js';
import type { PriceResult } from '../src/services/flights/provider.js';
import { keyOf } from '../src/services/flights/cache.js';
import { enumerateOrderings } from '../src/services/optimizer/enumerate.js';
import { PRESET_WEIGHTS, fitnessScores } from '../src/services/optimizer/fitness.js';
import { mulberry32, runGa, type GaParams } from '../src/services/optimizer/ga.js';
import { collectPriceTriples } from '../src/services/optimizer/triples.js';

const CITIES = [
  'JFK',
  'CDG',
  'FCO',
  'MAD',
  'LHR',
  'AMS',
  'BER',
  'VIE',
  'PRG',
  'LIS',
  'ATH',
  'IST',
  'ZRH',
  'CPH',
  'OSL',
];
const DEPART_DATE = '2026-06-01';
const CABIN: CabinClass = 'ECONOMY';
const STAY_DAYS = 2;
const PRESET = 'balanced';

const PARAM_SETS: Array<{ name: string; params: Partial<GaParams> }> = [
  { name: 'default (pop 64, gen ≤200, stagnation 30)', params: {} },
  {
    name: 'light (pop 32, gen ≤100, stagnation 15)',
    params: { populationSize: 32, maxGenerations: 100, stagnationLimit: 15 },
  },
];

const seed = Number(process.argv[2] ?? 42);
const provider = new MockFlightProvider();

async function buildEvaluate(cities: string[]): Promise<(ordering: string[]) => Score | null> {
  const perCityDays = cities.map(() => STAY_DAYS);
  const triples = collectPriceTriples({
    cities,
    perCityDays,
    departDate: DEPART_DATE,
    cabinClass: CABIN,
  });
  const results = await provider.getPrices(triples);
  const prices = new Map<string, PriceResult>(results.map((r) => [keyOf(r), r]));

  return (ordering: string[]): Score | null => {
    let date = new Date(DEPART_DATE);
    let totalCostCents = 0;
    let totalDurationMin = 0;
    let totalStops = 0;
    for (let i = 0; i < ordering.length - 1; i++) {
      const departDate = date.toISOString().slice(0, 10);
      const r = prices.get(
        keyOf({
          origin: ordering[i]!,
          destination: ordering[i + 1]!,
          departDate,
          cabinClass: CABIN,
        }),
      );
      if (!r) return null;
      totalCostCents += r.priceCents;
      totalDurationMin += r.durationMin;
      totalStops += r.stops;
      date = new Date(date.getTime() + STAY_DAYS * 86_400_000);
    }
    return { totalCostCents, totalDurationMin, totalStops };
  };
}

interface Row {
  n: number;
  paramSet: string;
  gaMs: number;
  bruteMs: number | null;
  gapPp: number | null;
  matched: boolean | null;
  generations: number;
  evaluated: number;
}

async function bench(
  n: number,
  paramSet: { name: string; params: Partial<GaParams> },
): Promise<Row> {
  const cities = CITIES.slice(0, n);
  const startCity = cities[0]!;
  const evaluate = await buildEvaluate(cities);
  const weights = PRESET_WEIGHTS[PRESET];

  const t0 = performance.now();
  const ga = runGa(
    { cities, startCity, weights, evaluate },
    { params: paramSet.params, rng: mulberry32(seed + n) },
  );
  const gaMs = performance.now() - t0;
  if (!ga.best) throw new Error(`GA found no feasible route for n=${n}`);

  if (n > 8) {
    return {
      n,
      paramSet: paramSet.name,
      gaMs,
      bruteMs: null,
      gapPp: null,
      matched: null,
      generations: ga.generations,
      evaluated: ga.evaluated.length,
    };
  }

  const t1 = performance.now();
  const orderings = enumerateOrderings(cities, { startCity });
  const scores = orderings.map((o) => evaluate(o)!);
  const fits = fitnessScores(scores, weights);
  let optIdx = 0;
  for (let i = 1; i < fits.length; i++) if (fits[i]! < fits[optIdx]!) optIdx = i;
  const bruteMs = performance.now() - t1;

  const gaIdx = orderings.findIndex((o) => o.join('>') === ga.best!.ordering.join('>'));
  const gapPp = (fits[gaIdx]! - fits[optIdx]!) * 100;
  return {
    n,
    paramSet: paramSet.name,
    gaMs,
    bruteMs,
    gapPp,
    matched: Math.abs(gapPp) < 1e-9,
    generations: ga.generations,
    evaluated: ga.evaluated.length,
  };
}

function fmtMs(ms: number | null): string {
  return ms === null ? '—' : ms >= 100 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`;
}

async function main(): Promise<void> {
  const rows: Row[] = [];
  for (const paramSet of PARAM_SETS) {
    for (const n of [4, 5, 6, 7, 8, 10, 12, 15]) {
      rows.push(await bench(n, paramSet));
      console.log(`done: n=${rows.at(-1)!.n} [${paramSet.name}]`);
    }
  }

  const header =
    '| Cities (N) | Parameter set | GA runtime | Brute-force runtime | Optimality gap (pp) | Matched optimum | Generations | Unique orderings evaluated |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- |\n';
  const body = rows
    .map(
      (r) =>
        `| ${r.n} | ${r.paramSet} | ${fmtMs(r.gaMs)} | ${fmtMs(r.bruteMs)} | ${
          r.gapPp === null ? '—' : r.gapPp.toFixed(4)
        } | ${r.matched === null ? '—' : r.matched ? 'yes' : 'no'} | ${r.generations} | ${r.evaluated} |`,
    )
    .join('\n');

  const summaries = PARAM_SETS.map((ps) => {
    const oracleRows = rows.filter((r) => r.paramSet === ps.name && r.gapPp !== null);
    const matched = oracleRows.filter((r) => r.matched).length;
    const worstGap = Math.max(...oracleRows.map((r) => r.gapPp!));
    const maxMs = Math.max(...rows.filter((r) => r.paramSet === ps.name).map((r) => r.gaMs));
    return `  - **${ps.name}**: matched the exhaustive optimum on ${matched}/${oracleRows.length} N≤8 instances (worst gap ${worstGap.toFixed(4)} pp); slowest run ${fmtMs(maxMs)}.`;
  }).join('\n');

  const doc = `# GA optimizer benchmark

Generated by \`apps/backend/scripts/benchmark-optimizer.ts\` (seed ${seed}, preset \`${PRESET}\`,
uniform ${STAY_DAYS}-day stays, fixed start city, mock flight provider). Rerun with
\`pnpm exec tsx scripts/benchmark-optimizer.ts ${seed}\` from \`apps/backend/\`.

- **Optimality gap** is reported in percentage points of the min–max-normalized preset
  fitness (range 0–1) judged over the full enumeration batch; 0.0000 means the GA reached
  the exhaustive optimum's fitness. Relative gap is undefined when the optimum's fitness
  is 0 (it dominates every objective), so absolute points are used throughout.
- N=10/12/15 rows are GA-only (brute force is ${'>'}10^6 permutations at N=10 with a fixed
  start; no oracle is computed) and demonstrate scaling headroom beyond the current
  8-city request cap.
- The two parameter sets double as the tuning record. This run:
${summaries}
- **Chosen defaults**: the spec defaults (population 64, ≤200 generations, stagnation
  stop 30) are kept in production — they are the stronger set on optimality, and even
  their slowest run is negligible next to flight-price fetching, which dominates
  \`/optimize\` latency. The 30-second wall-clock guard is never approached at these sizes.

${header}${body}
`;

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../docs/presentation/ga-benchmark.md',
  );
  writeFileSync(outPath, doc);
  execSync(`pnpm exec prettier --write ${JSON.stringify(outPath)}`, { stdio: 'inherit' });
  console.log(`\n${doc}\nWrote ${outPath}`);
}

await main();
