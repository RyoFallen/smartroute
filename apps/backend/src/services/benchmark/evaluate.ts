import type { OptimizeRequest } from '@smartroute/shared';
import { enumerateOrderings } from '../optimizer/enumerate.js';
import { mulberry32 } from '../optimizer/ga.js';
import { OptimizerService, legsFor, type PriceSource } from '../optimizer/index.js';
import { scoreOrdering } from '../optimizer/score.js';
import { collectPriceTriples } from '../optimizer/triples.js';
import { fareChecklist } from './checklist.js';
import { optimizerInput, type BenchmarkScenario } from './scenarios.js';
import { recordedFareSource, sessionProblems, type SessionFile } from './session.js';

export interface EvaluateOptions {
  /** One GA run per seed, each with `mulberry32(seed)` (#35: seeds 1–30). */
  seeds: number[];
}

/** One BenchmarkScenario priced from one CaptureSession's RecordedFares. */
export interface ScenarioResult {
  scenarioId: string;
  visitedCount: number;
  /** Every order of the cities between the origin and the end city. */
  totalOrders: number;
  /** Orders whose every leg has a RecordedFare. */
  feasibleOrders: number;
  /** The brute-force cheapest order; null when no order is feasible. */
  optimum: { priceCents: number; order: string[] } | null;
  /** The GA's recommended price per seed, in seed order; null where it found no route. */
  gaPricesCents: (number | null)[];
  /** Median over the runs that found a route. */
  gaMedianCents: number | null;
  /** Share of runs whose price equals the optimum's. */
  hitRate: number | null;
  ordersEvaluatedMedian: number;
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
 * per seed and by brute force over every order. Pure data, no clock, so the
 * same inputs and seeds give the same report; rendering is the script's job.
 */
export async function evaluateBenchmark(
  scenarios: BenchmarkScenario[],
  sessions: SessionFile[],
  { seeds }: EvaluateOptions,
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
    for (const s of scenarios) results.push(await evaluateScenario(s, source, seeds));
    report.sessions.push({ date: session.date, scenarios: results });
  }

  return report;
}

async function evaluateScenario(
  s: BenchmarkScenario,
  source: PriceSource,
  seeds: number[],
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
  let feasibleOrders = 0;
  let optimum: ScenarioResult['optimum'] = null;
  for (const order of orders) {
    const legs = legsFor(order, req, prices);
    if (legs.length !== order.length - 1) continue;
    feasibleOrders++;
    const priceCents = scoreOrdering(legs).totalCostCents;
    if (!optimum || priceCents < optimum.priceCents) optimum = { priceCents, order };
  }

  const gaPricesCents: (number | null)[] = [];
  const ordersEvaluated: number[] = [];
  for (const seed of seeds) {
    const optimizer = new OptimizerService(source, { rng: mulberry32(seed) });
    const run = await optimizer.search(req);
    const recommended = run.response.options.find((o) => o.label === 'recommended');
    gaPricesCents.push(recommended?.totalPriceCents ?? null);
    ordersEvaluated.push(run.ordersEvaluated);
  }

  const found = gaPricesCents.filter((p): p is number => p !== null);
  return {
    scenarioId: s.id,
    visitedCount: s.visited.length,
    totalOrders: orders.length,
    feasibleOrders,
    optimum,
    gaPricesCents,
    gaMedianCents: found.length > 0 ? median(found) : null,
    hitRate: optimum
      ? gaPricesCents.filter((p) => p === optimum.priceCents).length / seeds.length
      : null,
    ordersEvaluatedMedian: median(ordersEvaluated),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
