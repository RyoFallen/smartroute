import type { SessionResult, ScenarioResult } from './evaluate.js';
import type { BenchmarkScenario } from './scenarios.js';
import { median } from './stats.js';

/**
 * One metric's median across CaptureSessions, over only the sessions that have
 * it (a "no fare" NaiveOrder or an excluded Nomad result has no value), and how
 * many those were, so the report can say when it is fewer than all.
 */
export interface AcrossSessions {
  value: number | null;
  sessions: number;
}

/** One BenchmarkScenario, every metric as the median across sessions (#41). */
export interface ScenarioSummary {
  scenarioId: string;
  visitedCount: number;
  totalOrders: number;
  gaMedianCents: AcrossSessions;
  hitRate: AcrossSessions;
  ordersEvaluated: AcrossSessions;
  savingVsNaive: AcrossSessions;
  savingVsMean: AcrossSessions;
  optimalityGap: AcrossSessions;
  /** The share of Nomad's price the GA median saves, over valid results. */
  nomadSaving: AcrossSessions;
  gaMs: AcrossSessions;
  /** Across sessions, the median Nomad saving is ≥ 0; null with no valid result. */
  beatsNomad: boolean | null;
  /** Sessions whose valid Nomad result flew the GA's order. */
  nomadOrderMatches: number;
}

/**
 * A group of scenarios — one size, or all of them — as the median of its
 * scenarios' across-session medians, skipping scenarios without a value.
 */
export interface GroupSummary {
  /** Visited cities, or null for every scenario. */
  visitedCount: number | null;
  scenarios: number;
  savingVsNaive: number | null;
  savingVsMean: number | null;
  optimalityGap: number | null;
  hitRate: number | null;
  /** Orders evaluated as a share of all orders: the GA's search efficiency. */
  ordersEvaluatedShare: number | null;
  gaMs: number | null;
  /** The slowest scenario's median time, against the < 10 s target. */
  maxGaMs: number | null;
  nomad: {
    /** Scenarios with a valid Nomad result in at least one session. */
    compared: number;
    wins: number;
    winRate: number | null;
    medianSaving: number | null;
  };
}

export interface BenchmarkSummary {
  /** The evaluated sessions' dates, in order. */
  sessions: string[];
  scenarios: ScenarioSummary[];
  /** One group per scenario size, ascending. */
  bySize: GroupSummary[];
  overall: GroupSummary;
}

export function summarize(
  scenarios: BenchmarkScenario[],
  sessions: SessionResult[],
): BenchmarkSummary {
  const perScenario = scenarios.map((s) => {
    const results = sessions.map(
      (session) => session.scenarios.find((r) => r.scenarioId === s.id)!,
    );
    return summarizeScenario(results);
  });
  const sizes = [...new Set(perScenario.map((s) => s.visitedCount))].sort((a, b) => a - b);
  return {
    sessions: sessions.map((s) => s.date),
    scenarios: perScenario,
    bySize: sizes.map((size) =>
      summarizeGroup(
        size,
        perScenario.filter((s) => s.visitedCount === size),
      ),
    ),
    overall: summarizeGroup(null, perScenario),
  };
}

function summarizeScenario(results: ScenarioResult[]): ScenarioSummary {
  const first = results[0];
  const across = (pick: (r: ScenarioResult) => number | null): AcrossSessions => {
    const values = results.map(pick).filter((v): v is number => v !== null);
    return { value: values.length > 0 ? median(values) : null, sessions: values.length };
  };
  const nomadSaving = across((r) => (r.competitor.status === 'valid' ? r.competitor.saving : null));
  return {
    scenarioId: first?.scenarioId ?? '',
    visitedCount: first?.visitedCount ?? 0,
    totalOrders: first?.totalOrders ?? 0,
    gaMedianCents: across((r) => r.gaMedianCents),
    hitRate: across((r) => r.hitRate),
    ordersEvaluated: across((r) => r.ordersEvaluatedMedian),
    savingVsNaive: across((r) => r.savingVsNaive),
    savingVsMean: across((r) => r.savingVsMean),
    optimalityGap: across((r) => r.optimalityGap),
    nomadSaving,
    gaMs: across((r) => r.gaMsMedian),
    beatsNomad: nomadSaving.value === null ? null : nomadSaving.value >= 0,
    nomadOrderMatches: results.filter((r) => r.competitor.orderMatchesGa).length,
  };
}

function summarizeGroup(visitedCount: number | null, group: ScenarioSummary[]): GroupSummary {
  const med = (values: (number | null)[]): number | null => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0 ? median(present) : null;
  };
  const compared = group.filter((s) => s.beatsNomad !== null);
  const wins = compared.filter((s) => s.beatsNomad).length;
  const times = group.flatMap((s) => (s.gaMs.value === null ? [] : [s.gaMs.value]));
  return {
    visitedCount,
    scenarios: group.length,
    savingVsNaive: med(group.map((s) => s.savingVsNaive.value)),
    savingVsMean: med(group.map((s) => s.savingVsMean.value)),
    optimalityGap: med(group.map((s) => s.optimalityGap.value)),
    hitRate: med(group.map((s) => s.hitRate.value)),
    ordersEvaluatedShare: med(
      group.map((s) =>
        s.ordersEvaluated.value === null ? null : s.ordersEvaluated.value / s.totalOrders,
      ),
    ),
    gaMs: med(times),
    maxGaMs: times.length > 0 ? Math.max(...times) : null,
    nomad: {
      compared: compared.length,
      wins,
      winRate: compared.length > 0 ? wins / compared.length : null,
      medianSaving: med(group.map((s) => s.nomadSaving.value)),
    },
  };
}
