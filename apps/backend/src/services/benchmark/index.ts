/**
 * The competitor benchmark (#35, ADR-0006). Pure and never on the API path:
 * only the by-hand scripts under `scripts/benchmark/` drive it, never CI.
 */
export { BENCHMARK_AIRPORTS, type BenchmarkAirport } from './airports.js';
export { fareChecklist, type FareChecklist, type PairFares } from './checklist.js';
export {
  BENCHMARK_SEEDS,
  evaluateBenchmark,
  type BenchmarkReport,
  type EvaluateOptions,
  type GaRun,
  type ScenarioResult,
  type SessionResult,
} from './evaluate.js';
export { BENCHMARK_COORDINATES } from './naive.js';
export { BENCHMARK_CITIES, BenchmarkScenario, ScenarioFile, drawScenarios } from './scenarios.js';
export { SessionFile } from './session.js';
