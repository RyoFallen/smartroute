/**
 * Draws the 20 BenchmarkScenarios from a seed and freezes them, with the seed,
 * in docs/benchmark/scenarios.json (#36).
 *
 * Run once, by hand, before CaptureSession 1 (never CI):
 *   pnpm --filter @smartroute/backend exec tsx scripts/benchmark/draw-scenarios.ts <seed>
 *
 * It refuses to overwrite a frozen file: the point of freezing is that the
 * scenario set provably did not change after any price was seen, and a redraw
 * would quietly undo that. `--force` exists for a mistake caught before
 * session 1, and its use belongs in the commit message.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { drawScenarios, type ScenarioFile } from '../../src/services/benchmark/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, '../../../../docs/benchmark/scenarios.json');

const seedArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const seed = Number(seedArg);
if (!seedArg || !Number.isInteger(seed)) {
  console.error('Usage: draw-scenarios.ts <integer seed> [--force]');
  process.exit(1);
}
if (existsSync(outPath) && !process.argv.includes('--force')) {
  console.error(
    `${path.relative(process.cwd(), outPath)} is already frozen — the scenarios must not change ` +
      'once drawn. Pass --force only to redraw before any price has been captured.',
  );
  process.exit(1);
}

const file: ScenarioFile = { seed, scenarios: drawScenarios(seed) };
const json = await prettier.format(JSON.stringify(file), {
  ...(await prettier.resolveConfig(outPath)),
  parser: 'json',
});
writeFileSync(outPath, json);
console.log(
  `Wrote ${file.scenarios.length} scenarios (seed ${seed}) to ${path.relative(process.cwd(), outPath)}`,
);
