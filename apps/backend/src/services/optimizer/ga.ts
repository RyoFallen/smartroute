import type { Score } from '@smartroute/shared';
import { fitnessScores, type PresetWeights } from './fitness.js';

export interface GaParams {
  populationSize: number;
  maxGenerations: number;
  stagnationLimit: number;
  tournamentK: number;
  crossoverRate: number;
  mutationRate: number;
  elitism: number;
  timeoutMs: number;
}

export const DEFAULT_GA_PARAMS: GaParams = {
  populationSize: 64,
  maxGenerations: 200,
  stagnationLimit: 30,
  tournamentK: 3,
  crossoverRate: 0.9,
  mutationRate: 0.2,
  elitism: 2,
  timeoutMs: 30_000,
};

export interface GaInput {
  cities: string[];
  startCity?: string | undefined;
  endCity?: string | undefined;
  weights: PresetWeights;
  /** Returns the ordering's objective totals, or null when infeasible (e.g. missing price leg). */
  evaluate: (ordering: string[]) => Score | null;
}

export interface GaOptions {
  params?: Partial<GaParams>;
  rng?: () => number;
  now?: () => number;
}

export interface GaCandidate {
  ordering: string[];
  score: Score;
}

/** Canonical identity of a city ordering, used for dedupe and comparison. */
export function orderingKey(ordering: string[]): string {
  return ordering.join('>');
}

export interface GaResult {
  /** Archive-wide fitness winner under one consistent normalization batch; null if nothing feasible. */
  best: GaCandidate | null;
  /** Every distinct feasible ordering the GA evaluated. */
  evaluated: GaCandidate[];
  generations: number;
  timedOut: boolean;
}

/**
 * Order-based GA over the middle cities (fixed start/end excluded from the genome).
 * Tournament selection, order crossover (OX), swap mutation, elitism; wall-clock
 * timeout inside the generation loop returns best-so-far.
 */
export function runGa(input: GaInput, opts: GaOptions = {}): GaResult {
  const params = { ...DEFAULT_GA_PARAMS, ...opts.params };
  const rng = opts.rng ?? Math.random;
  const now = opts.now ?? Date.now;

  const head = input.startCity ? [input.startCity] : [];
  const tail = input.endCity ? [input.endCity] : [];
  const middle = input.cities.filter((c) => c !== input.startCity && c !== input.endCity);

  // Memoized evaluation archive: ordering key -> candidate (or null when infeasible).
  const archive = new Map<string, GaCandidate | null>();
  const evaluateGenome = (genome: string[]): GaCandidate | null => {
    const ordering = [...head, ...genome, ...tail];
    const key = orderingKey(ordering);
    let hit = archive.get(key);
    if (hit === undefined) {
      const score = input.evaluate(ordering);
      hit = score === null ? null : { ordering, score };
      archive.set(key, hit);
    }
    return hit;
  };

  if (middle.length <= 1) {
    evaluateGenome(middle);
    return {
      best: archiveBest(archive, input.weights),
      evaluated: feasible(archive),
      generations: 0,
      timedOut: false,
    };
  }

  const startedAt = now();
  let population: string[][] = [];
  for (let i = 0; i < params.populationSize; i++) population.push(shuffle(middle, rng));

  let bestKey: string | null = null;
  let stagnation = 0;
  let generations = 0;
  let timedOut = false;

  for (let gen = 0; gen < params.maxGenerations; gen++) {
    if (now() - startedAt >= params.timeoutMs) {
      timedOut = true;
      break;
    }

    // Per-generation fitness for selection; infeasible chromosomes never win a tournament.
    const candidates = population.map(evaluateGenome);
    const feasibleIdx = candidates.flatMap((c, i) => (c === null ? [] : [i]));
    const feasibleFits = fitnessScores(
      feasibleIdx.map((i) => candidates[i]!.score),
      input.weights,
    );
    const fits = new Array<number>(population.length).fill(Number.POSITIVE_INFINITY);
    feasibleIdx.forEach((idx, j) => {
      fits[idx] = feasibleFits[j]!;
    });

    generations = gen + 1;

    // Best-so-far judged over the whole archive in one normalization batch.
    const best = archiveBest(archive, input.weights);
    const key = best ? orderingKey(best.ordering) : null;
    if (key !== bestKey) {
      bestKey = key;
      stagnation = 0;
    } else {
      stagnation++;
    }
    if (stagnation >= params.stagnationLimit) break;

    const ranked = population
      .map((genome, i) => ({ genome, fit: fits[i]! }))
      .sort((a, b) => a.fit - b.fit);
    const next: string[][] = ranked.slice(0, params.elitism).map((r) => r.genome);
    while (next.length < params.populationSize) {
      const p1 = tournament(population, fits, params.tournamentK, rng);
      const p2 = tournament(population, fits, params.tournamentK, rng);
      let child = rng() < params.crossoverRate ? orderCrossover(p1, p2, rng) : [...p1];
      if (rng() < params.mutationRate) child = swapMutate(child, rng);
      next.push(child);
    }
    population = next;
  }

  return {
    best: archiveBest(archive, input.weights),
    evaluated: feasible(archive),
    generations,
    timedOut,
  };
}

/** Deterministic PRNG for reproducible tests and benchmarks. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function feasible(archive: Map<string, GaCandidate | null>): GaCandidate[] {
  return [...archive.values()].filter((c): c is GaCandidate => c !== null);
}

function archiveBest(
  archive: Map<string, GaCandidate | null>,
  weights: PresetWeights,
): GaCandidate | null {
  const all = feasible(archive);
  if (all.length === 0) return null;
  const fits = fitnessScores(
    all.map((c) => c.score),
    weights,
  );
  let bestIdx = 0;
  for (let i = 1; i < all.length; i++) if (fits[i]! < fits[bestIdx]!) bestIdx = i;
  return all[bestIdx]!;
}

function shuffle(arr: string[], rng: () => number): string[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function tournament(
  population: string[][],
  fits: number[],
  k: number,
  rng: () => number,
): string[] {
  let bestIdx = Math.floor(rng() * population.length);
  for (let i = 1; i < k; i++) {
    const idx = Math.floor(rng() * population.length);
    if (fits[idx]! < fits[bestIdx]!) bestIdx = idx;
  }
  return population[bestIdx]!;
}

/** OX: copy a slice from p1, fill the rest with p2's genes in p2 order. */
function orderCrossover(p1: string[], p2: string[], rng: () => number): string[] {
  const n = p1.length;
  const a = Math.floor(rng() * n);
  const b = Math.floor(rng() * n);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const slice = new Set(p1.slice(lo, hi + 1));
  const child = new Array<string>(n);
  for (let i = lo; i <= hi; i++) child[i] = p1[i]!;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const pos = (hi + 1 + i) % n;
    if (child[pos] !== undefined) continue;
    while (slice.has(p2[j]!)) j++;
    child[pos] = p2[j]!;
    j++;
  }
  return child;
}

function swapMutate(genome: string[], rng: () => number): string[] {
  const out = [...genome];
  if (out.length < 2) return out;
  const i = Math.floor(rng() * out.length);
  let j = Math.floor(rng() * out.length);
  if (j === i) j = (j + 1) % out.length;
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
