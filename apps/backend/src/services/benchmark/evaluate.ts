import type { OptimizeRequest } from '@smartroute/shared';
import { enumerateOrderings } from '../optimizer/enumerate.js';
import { mulberry32 } from '../optimizer/ga.js';
import { OptimizerService, legsFor, type PriceSource } from '../optimizer/index.js';
import { scoreOrdering } from '../optimizer/score.js';
import { collectPriceTriples } from '../optimizer/triples.js';
import type { Coordinate } from '../itinerary/walking.js';
import { fareChecklist } from './checklist.js';
import { BENCHMARK_COORDINATES, naiveOrder } from './naive.js';
import { optimizerInput, type BenchmarkScenario } from './scenarios.js';
import { recordedFareSource, sessionProblems, type SessionFile } from './session.js';

/** #35: the GA runs once per seed 1–30, each with `mulberry32(seed)`. */
export const BENCHMARK_SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

export interface EvaluateOptions {
  /** One GA run per seed, each with `mulberry32(seed)`. */
  seeds: number[];
  /**
   * The city coordinates the NaiveOrder is measured on; the curated ones unless
   * a test needs a hand-built map (to force a distance tie, say).
   */
  coordinates?: Record<string, Coordinate>;
}

/** One GA run: the shipped `optimize()` path with one seed. */
export interface GaRun {
  seed: number;
  /** The `recommended` option's price and order; null where it found no route. */
  priceCents: number | null;
  order: string[] | null;
  /** Distinct orders this run evaluated, feasible or not. */
  ordersEvaluated: number;
}

/** One BenchmarkScenario priced from one CaptureSession's RecordedFares. */
export interface ScenarioResult {
  scenarioId: string;
  visitedCount: number;
  /** Every order of the cities between the origin and the end city. */
  totalOrders: number;
  /** Orders whose every leg has a RecordedFare. */
  feasibleOrders: number;
  /**
   * Mean price over the feasible orders, for context beside the NaiveOrder;
   * the `totalOrders - feasibleOrders` infeasible ones are left out. Null when
   * no order is feasible.
   */
  meanCents: number | null;
  /**
   * The NaiveOrder and its price on the same RecordedFares and leg-dating rule;
   * a null price means one of its legs is "no fare", so it has no price.
   */
  naive: { order: string[]; priceCents: number | null };
  /**
   * The brute-force cheapest price and every order that reaches it, in
   * enumeration order; null when no order is feasible.
   */
  optimum: { priceCents: number; orders: string[][] } | null;
  /** In seed order. */
  gaRuns: GaRun[];
  /**
   * Median price over every run, a run that found no route ranking above any
   * price; null if the median lands on such a run.
   */
  gaMedianCents: number | null;
  /**
   * Share of runs that reached the optimum's price. Price, not order: a run
   * that picks another order tied at the optimum price has found the optimum.
   */
  hitRate: number | null;
  ordersEvaluatedMedian: number;
  /**
   * Ordering value (#39): the share of the NaiveOrder's (headline) or the
   * mean's price that the GA median saves, e.g. 0.25 for 25% cheaper; negative
   * when the GA costs more. Null when either price is missing.
   */
  savingVsNaive: number | null;
  savingVsMean: number | null;
}

export interface SessionResult {
  date: string;
  scenarios: ScenarioResult[];
}

export interface BenchmarkReport {
  /** Evaluated sessions, by date. */
  sessions: SessionResult[];
  /** Sessions not evaluated, with why — a missing fare must never quietly change a result. */
  refused: { date: string; problems: string[] }[];
}

/**
 * The competitor benchmark's numbers (#35, ADR-0006): every scenario priced
 * from every session's RecordedFares, by the shipped `optimize()` path once
 * per seed and by brute force over every order. Plain data, and the same
 * inputs and seeds give the same report: the GA's only clock is its 30 s
 * safety timeout, which a ≤720-order scenario never comes near. Rendering is
 * the script's job.
 */
export async function evaluateBenchmark(
  scenarios: BenchmarkScenario[],
  sessions: SessionFile[],
  { seeds, coordinates = BENCHMARK_COORDINATES }: EvaluateOptions,
): Promise<BenchmarkReport> {
  const checklist = fareChecklist(scenarios);
  const report: BenchmarkReport = { sessions: [], refused: [] };

  for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const problems = sessionProblems(session, checklist);
    if (problems.length > 0) {
      report.refused.push({ date: session.date, problems });
      continue;
    }
    const source = recordedFareSource(session);
    const results: ScenarioResult[] = [];
    for (const s of scenarios) {
      results.push(await evaluateScenario(s, source, seeds, coordinates));
    }
    report.sessions.push({ date: session.date, scenarios: results });
  }

  return report;
}

async function evaluateScenario(
  s: BenchmarkScenario,
  source: PriceSource,
  seeds: number[],
  coordinates: Record<string, Coordinate>,
): Promise<ScenarioResult> {
  const input = optimizerInput(s);
  const req: OptimizeRequest = {
    ...input,
    travelers: 1,
    directOnly: false,
    // Any preset ranks by cost alone on RecordedFares (see session.ts).
    preset: 'budget',
  };

  // Brute force, priced with the optimizer's own leg-dating rule.
  const { prices } = await source.getPrices(collectPriceTriples(input));
  const orders = enumerateOrderings(input.cities, { startCity: s.origin, endCity: s.endCity });
  const priceOf = (order: string[]): number | null => {
    const legs = legsFor(order, req, prices);
    return legs.length === order.length - 1 ? scoreOrdering(legs).totalCostCents : null;
  };
  let feasibleOrders = 0;
  let totalCents = 0;
  let optimum: ScenarioResult['optimum'] = null;
  for (const order of orders) {
    const priceCents = priceOf(order);
    if (priceCents === null) continue;
    feasibleOrders++;
    totalCents += priceCents;
    if (!optimum || priceCents < optimum.priceCents) optimum = { priceCents, orders: [order] };
    else if (priceCents === optimum.priceCents) optimum.orders.push(order);
  }

  const gaRuns: GaRun[] = [];
  for (const seed of seeds) {
    const optimizer = new OptimizerService(source, { rng: mulberry32(seed) });
    const gaRun = await optimizer.optimizeWithStats(req);
    const recommended = gaRun.response.options.find((o) => o.label === 'recommended');
    gaRuns.push({
      seed,
      priceCents: recommended?.totalPriceCents ?? null,
      order: recommended?.order ?? null,
      ordersEvaluated: gaRun.ordersEvaluated,
    });
  }

  const noRoute = Number.POSITIVE_INFINITY;
  const gaMedian = median(gaRuns.map((r) => r.priceCents ?? noRoute));
  const gaMedianCents = gaMedian === noRoute ? null : gaMedian;
  const meanCents = feasibleOrders > 0 ? totalCents / feasibleOrders : null;
  const naive = naiveOrder(s, coordinates);
  const naivePriceCents = priceOf(naive);
  return {
    scenarioId: s.id,
    visitedCount: s.visited.length,
    totalOrders: orders.length,
    feasibleOrders,
    meanCents,
    naive: { order: naive, priceCents: naivePriceCents },
    optimum,
    gaRuns,
    gaMedianCents,
    hitRate: optimum
      ? gaRuns.filter((r) => r.priceCents === optimum.priceCents).length / gaRuns.length
      : null,
    ordersEvaluatedMedian: median(gaRuns.map((r) => r.ordersEvaluated)),
    savingVsNaive: saving(gaMedianCents, naivePriceCents),
    savingVsMean: saving(gaMedianCents, meanCents),
  };
}

/** The share of `baseline` that `cents` saves; null if either is missing. */
function saving(cents: number | null, baseline: number | null): number | null {
  return cents === null || baseline === null ? null : (baseline - cents) / baseline;
}

/** The middle value, or the mean of the middle two (Infinity if either is). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
