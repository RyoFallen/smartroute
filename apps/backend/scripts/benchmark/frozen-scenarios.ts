/**
 * What every benchmark script starts from: the frozen BenchmarkScenarios in
 * docs/benchmark/scenarios.json, refused if their seed does not draw them, so a
 * hand edit to the file cannot pass as the seeded draw (#36).
 */
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScenarioFile, drawScenarios } from '../../src/services/benchmark/index.js';

/** docs/benchmark, where the benchmark's committed data and generated notes live. */
export const BENCHMARK_DOCS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/benchmark',
);

export function loadFrozenScenarios(): ScenarioFile {
  const file = ScenarioFile.parse(
    JSON.parse(readFileSync(path.join(BENCHMARK_DOCS, 'scenarios.json'), 'utf8')),
  );
  if (!isDeepStrictEqual(file.scenarios, drawScenarios(file.seed))) {
    console.error(
      `scenarios.json does not match what seed ${file.seed} draws — it was edited by hand.`,
    );
    process.exit(1);
  }
  return file;
}
