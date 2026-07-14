import type { OptimizePreset, Score } from '@smartroute/shared';

export interface PresetWeights {
  cost: number;
  direct: number;
  time: number;
}

// Spec §7.1.2, order cost/direct/time. `direct` weights totalStops (minimized),
// standing in for the spec's sign-broken "direct flight count" — code wins.
export const PRESET_WEIGHTS: Record<OptimizePreset, PresetWeights> = {
  budget: { cost: 0.7, direct: 0.1, time: 0.2 },
  time: { cost: 0.3, direct: 0.4, time: 0.3 },
  comfort: { cost: 0.3, direct: 0.5, time: 0.2 },
  balanced: { cost: 0.5, direct: 0.3, time: 0.2 },
};

export function fitnessScores(batch: readonly Score[], w: PresetWeights): number[] {
  const normCost = minMax(batch.map((s) => s.totalCostCents));
  const normStops = minMax(batch.map((s) => s.totalStops));
  const normTime = minMax(batch.map((s) => s.totalDurationMin));
  return batch.map(
    (_, i) => w.cost * normCost[i]! + w.direct * normStops[i]! + w.time * normTime[i]!,
  );
}

function minMax(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0);
  return values.map((v) => (v - min) / range);
}
