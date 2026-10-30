import { keyOf } from '../flights/cache.js';
import type { PriceResult } from '../flights/provider.js';
import { legsFor } from '../optimizer/index.js';
import { collectPriceTriples } from '../optimizer/triples.js';
import { optimizerInput, type BenchmarkScenario } from './scenarios.js';
import type { CompetitorResult, SessionFile } from './session.js';
import { median } from './stats.js';

/**
 * One scenario against Kiwi.com Nomad in one session (#40).
 *
 * - `valid`: Nomad's all-flight itinerary flew the scenario's cities on its
 *   dates and stays, so its price is compared.
 * - `invalid`: it did not (`problems` says how); excluded, never compared.
 * - `no-all-flight`: Nomad listed no all-flight result; excluded.
 * - `missing`: the session has no CompetitorResult for the scenario; reported,
 *   not counted as a loss.
 */
export interface CompetitorComparison {
  status: 'valid' | 'invalid' | 'no-all-flight' | 'missing';
  problems: string[];
  /** The compared price and Nomad's order, as captured; null when not captured. */
  priceCents: number | null;
  order: string[] | null;
  /** Nomad's cheapest any-mode result: context only, never the compared price. */
  anyMode: CompetitorResult['anyMode'] | null;
  capturedAt: string | null;
  /** Valid results only: the GA median is at most Nomad's price. */
  gaWins: boolean | null;
  /** Valid results only: the share of Nomad's price the GA median saves. */
  saving: number | null;
  /** Valid results only: Nomad flew the GA's order. */
  orderMatchesGa: boolean | null;
}

/** One session's Nomad figures, over its valid results only. */
export interface NomadSummary {
  valid: number;
  /** Invalid plus no-all-flight: captured, but not comparable. */
  excluded: number;
  missing: number;
  wins: number;
  /** `wins / valid`; null with no valid result. */
  winRate: number | null;
  medianSaving: number | null;
  orderMatches: number;
}

/** Why a session's CompetitorResults cannot be read against `scenarios`, or nothing. */
export function competitorProblems(session: SessionFile, scenarios: BenchmarkScenario[]): string[] {
  const known = new Set(scenarios.map((s) => s.id));
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const r of session.competitorResults) {
    if (!known.has(r.scenarioId)) problems.push(`CompetitorResult for unknown ${r.scenarioId}`);
    else if (seen.has(r.scenarioId)) problems.push(`${r.scenarioId} has two CompetitorResults`);
    seen.add(r.scenarioId);
  }
  return problems;
}

export function compareWithNomad(
  s: BenchmarkScenario,
  result: CompetitorResult | undefined,
  ga: { medianCents: number | null; order: string[] | null },
): CompetitorComparison {
  const none = { gaWins: null, saving: null, orderMatchesGa: null };
  if (!result) {
    return {
      status: 'missing',
      problems: [],
      priceCents: null,
      order: null,
      anyMode: null,
      capturedAt: null,
      ...none,
    };
  }
  const captured = {
    anyMode: result.anyMode,
    capturedAt: result.capturedAt,
    priceCents: result.allFlight?.priceCents ?? null,
    order: result.allFlight?.order ?? null,
  };
  if (!result.allFlight) return { status: 'no-all-flight', problems: [], ...captured, ...none };

  const problems = validityProblems(s, result.allFlight);
  if (problems.length > 0) return { status: 'invalid', problems, ...captured, ...none };

  const nomad = result.allFlight.priceCents;
  return {
    status: 'valid',
    problems: [],
    ...captured,
    gaWins: ga.medianCents !== null && ga.medianCents <= nomad,
    saving: ga.medianCents === null ? null : (nomad - ga.medianCents) / nomad,
    orderMatchesGa: ga.order !== null && ga.order.join() === result.allFlight.order.join(),
  };
}

/**
 * How Nomad's itinerary strays from the scenario, or nothing. Valid means the
 * scenario's cities from its origin to its end city, each place's nights equal
 * to its CityStay, and every leg leaving on the day the scenario's stays give
 * for Nomad's own order — dated by the optimizer's own rule, `legsFor`.
 */
function validityProblems(
  s: BenchmarkScenario,
  nomad: NonNullable<CompetitorResult['allFlight']>,
): string[] {
  const { order } = nomad;
  const cities = [s.origin, ...s.visited.map((v) => v.city)];
  if (
    order[0] !== s.origin ||
    order.at(-1) !== s.endCity ||
    order.length !== cities.length ||
    [...order].sort().join() !== [...cities].sort().join()
  ) {
    return [
      `order ${order.join(' ')} is not ${s.origin} to ${s.endCity} through the scenario's cities`,
    ];
  }

  const problems: string[] = [];
  const middle = order.slice(1, -1);
  if (nomad.stays.map((st) => st.city).join() !== middle.join()) {
    problems.push(
      `stays name ${nomad.stays.map((st) => st.city).join(' ')}, not ${middle.join(' ')}`,
    );
  } else {
    for (const st of nomad.stays) {
      const cityStay = s.visited.find((v) => v.city === st.city)!.stayDays;
      if (st.nights !== cityStay) {
        problems.push(`${st.city}: Stay ${st.nights} nights, CityStay ${cityStay}`);
      }
    }
  }

  const expected = legDates(s, order);
  if (nomad.legDates.length !== expected.length) {
    problems.push(`${nomad.legDates.length} leg dates for ${expected.length} legs`);
  } else {
    expected.forEach((date, i) => {
      if (nomad.legDates[i] !== date) {
        problems.push(
          `leg ${order[i]} → ${order[i + 1]} leaves ${nomad.legDates[i]}, the stays give ${date}`,
        );
      }
    });
  }
  return problems;
}

/**
 * The day each leg of `order` leaves, from `legsFor` over a stand-in price for
 * every query the scenario can make, so the benchmark keeps one leg-dating rule.
 */
function legDates(s: BenchmarkScenario, order: string[]): string[] {
  const input = optimizerInput(s);
  const prices = new Map<string, PriceResult>();
  for (const q of collectPriceTriples(input)) {
    prices.set(keyOf(q), { ...q, priceCents: 1, durationMin: 0, stops: 0, carrier: null });
  }
  return legsFor(order, input, prices).map((leg) => leg.departDate);
}

export function nomadSummary(comparisons: CompetitorComparison[]): NomadSummary {
  const valid = comparisons.filter((c) => c.status === 'valid');
  const savings = valid.flatMap((c) => (c.saving === null ? [] : [c.saving]));
  const wins = valid.filter((c) => c.gaWins).length;
  return {
    valid: valid.length,
    excluded: comparisons.filter((c) => c.status === 'invalid' || c.status === 'no-all-flight')
      .length,
    missing: comparisons.filter((c) => c.status === 'missing').length,
    wins,
    winRate: valid.length > 0 ? wins / valid.length : null,
    medianSaving: savings.length > 0 ? median(savings) : null,
    orderMatches: valid.filter((c) => c.orderMatchesGa).length,
  };
}
