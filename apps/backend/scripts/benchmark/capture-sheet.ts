/**
 * Writes the CaptureSession operator's working sheet, docs/benchmark/capture-sheet.md
 * (#37): the numbered list of every screenshot a session takes, in capture order —
 * the 56 Google Flights date grids, a ready-made Kiwi.com Nomad search link per
 * BenchmarkScenario, and each session's 10 live spot-checks. The protocol it
 * serves is docs/benchmark/capture-protocol.md.
 *
 * Run by hand (never CI):
 *   pnpm --filter @smartroute/backend exec tsx scripts/benchmark/capture-sheet.ts
 *   ... --check   to fail if the committed sheet is out of date
 *
 * Like fare-checklist.ts it refuses a scenarios.json its seed does not draw, and
 * formats through Prettier so `--check` compares like with like.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { mulberry32 } from '../../src/services/optimizer/ga.js';
import {
  BENCHMARK_CITIES,
  ScenarioFile,
  drawScenarios,
  fareChecklist,
  type BenchmarkScenario,
} from '../../src/services/benchmark/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '../../../../docs/benchmark');
const scenariosPath = path.join(docs, 'scenarios.json');
const notePath = path.join(docs, 'capture-sheet.md');

/**
 * Each curated city's benchmark airport list (capture-protocol.md § Airports),
 * with the slug Kiwi.com uses for the airport in a Nomad URL — read from
 * Kiwi's own locations API on 2026-10-03. IST's slug still says "ataturk";
 * it is Kiwi's slug for the new Istanbul Airport (IST), checked in the UI.
 */
const AIRPORTS: Record<(typeof BENCHMARK_CITIES)[number], [iata: string, kiwiSlug: string][]> = {
  BCN: [['BCN', 'barcelona-el-prat-barcelona-spain']],
  BER: [['BER', 'berlin-brandenburg-berlin-germany']],
  BUD: [['BUD', 'budapest-ferenc-liszt-international-budapest-hungary']],
  CDG: [
    ['CDG', 'charles-de-gaulle-paris-france'],
    ['ORY', 'paris-orly-paris-france'],
    ['BVA', 'beauvais-tille-paris-france'],
  ],
  FCO: [
    ['FCO', 'leonardo-da-vinci-fiumicino-rome-italy'],
    ['CIA', 'ciampino-g-b-pastine-international-rome-italy'],
  ],
  IST: [
    ['IST', 'istanbul-ataturk-istanbul-turkey'],
    ['SAW', 'sabiha-gokcen-international-istanbul-turkey'],
  ],
  LHR: [
    ['LHR', 'heathrow-london-united-kingdom'],
    ['LGW', 'gatwick-london-united-kingdom'],
    ['STN', 'london-stansted-london-united-kingdom'],
    ['LTN', 'luton-london-united-kingdom'],
    ['LCY', 'london-city-london-united-kingdom'],
    ['SEN', 'london-southend-london-united-kingdom'],
  ],
  WAW: [
    ['WAW', 'warsaw-chopin-warsaw-poland'],
    ['WMI', 'warsaw-modlin-warsaw-poland'],
  ],
};

/** The three CaptureSessions (#35). */
const SESSIONS = ['2026-10-13', '2026-10-22', '2026-10-31'] as const;
const SPOT_CHECKS_PER_SESSION = 10;
/**
 * Seeds the spot-check draw, so the 30 checked fares are fixed — and committed —
 * before any price is seen, and nobody can pick the ones that agree.
 */
const SPOT_CHECK_SEED = 20261013;

const file = ScenarioFile.parse(JSON.parse(readFileSync(scenariosPath, 'utf8')));
if (!isDeepStrictEqual(file.scenarios, drawScenarios(file.seed))) {
  console.error(
    `scenarios.json does not match what seed ${file.seed} draws — it was edited by hand.`,
  );
  process.exit(1);
}

const airports = (city: string) => AIRPORTS[city as keyof typeof AIRPORTS];
const codes = (city: string) => airports(city).map(([iata]) => iata);
const slugs = (city: string) => airports(city).map(([, slug]) => slug);

/**
 * The Nomad search for a scenario, as the URL Nomad's own form produces
 * (decoded on 2026-10-03): origin airports and the departure day, then the end
 * city's airports (its night range is the trip length, left open), then each
 * other visited city with its CityStay as exact nights; comma-separated slugs
 * are one place's airports. `nomad_sortBy=price` opens it sorted by Cheapest.
 */
function nomadUrl(s: BenchmarkScenario): string {
  const place = (city: string) => slugs(city).join(',');
  const middle = s.visited
    .filter((v) => v.city !== s.endCity)
    .map((v) => `${place(v.city)}~--~${v.stayDays}`);
  return (
    'https://www.kiwi.com/en/nomad/results/' +
    [`${place(s.origin)}~${s.departDate}~--`, `${place(s.endCity)}~--~1-60`, ...middle].join('/') +
    '/?nomad_sortBy=price'
  );
}

/** The 56 directed pairs as 28 grids and their swap, in the order they are captured. */
function gridPairs(): [string, string][] {
  const out: [string, string][] = [];
  for (const [i, a] of BENCHMARK_CITIES.entries()) {
    for (const b of BENCHMARK_CITIES.slice(i + 1)) out.push([a, b], [b, a]);
  }
  return out;
}

/** Each session's spot-checks: distinct checklist fares, from one seeded stream. */
function spotChecks(): { origin: string; destination: string; date: string }[][] {
  const fares = fareChecklist(file.scenarios).pairs.flatMap((p) =>
    p.dates.map((date) => ({ origin: p.origin, destination: p.destination, date })),
  );
  const rng = mulberry32(SPOT_CHECK_SEED);
  return SESSIONS.map(() => {
    const pool = [...fares];
    for (let i = 0; i < SPOT_CHECKS_PER_SESSION; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool
      .slice(0, SPOT_CHECKS_PER_SESSION)
      .sort((x, y) =>
        `${x.origin}${x.destination}${x.date}`.localeCompare(
          `${y.origin}${y.destination}${y.date}`,
        ),
      );
  });
}

function render(): string {
  const pairs = gridPairs();
  const out: string[] = [];

  out.push('# CaptureSession sheet');
  out.push('');
  out.push(
    '_Generated by `scripts/benchmark/capture-sheet.ts` from the frozen',
    '[`scenarios.json`](scenarios.json) — do not edit by hand. How to use it:',
    '[`capture-protocol.md`](capture-protocol.md)._',
  );
  out.push('');
  out.push(
    'Every screenshot a session takes, in the order it takes them. Prefix each screenshot file with',
    "its item ID (`G01 `, `N05 `, `L03 `) and keep macOS's own name after it, which carries the time.",
  );
  out.push('');

  out.push('## 1. Google Flights date grids (G01–G56)');
  out.push('');
  out.push(
    'One-way, November and December side by side. Each odd item is set up once; the even item after',
    'it is the same search with ⇄ (swap) pressed.',
  );
  out.push('');
  out.push('| ID | From | Airports | To | Airports |');
  out.push('| -- | ---- | -------- | -- | -------- |');
  pairs.forEach(([a, b], i) => {
    const id = `G${String(i + 1).padStart(2, '0')}`;
    out.push(`| ${id} | ${a} | ${codes(a).join(', ')} | ${b} | ${codes(b).join(', ')} |`);
  });
  out.push('');

  out.push('## 2. Kiwi.com Nomad (N01–N20)');
  out.push('');
  out.push(
    'Open the link, check the form against the row (origin, departure day, end city, exact nights per',
    'city), confirm EUR and the Cheapest sort, then screenshot.',
  );
  out.push('');
  out.push('| ID | Scenario | From | Departs | Places (nights) | Ends in | Search |');
  out.push('| -- | -------- | ---- | ------- | --------------- | ------- | ------ |');
  file.scenarios.forEach((s, i) => {
    const id = `N${String(i + 1).padStart(2, '0')}`;
    const places = s.visited
      .filter((v) => v.city !== s.endCity)
      .map((v) => `${v.city} ${v.stayDays}`)
      .join(', ');
    out.push(
      `| ${id} | ${s.id} | ${s.origin} | ${s.departDate} | ${places} | ${s.endCity} | [open](${nomadUrl(s)}) |`,
    );
  });
  out.push('');

  out.push('## 3. Live spot-checks (L01–L10)');
  out.push('');
  out.push(
    `Drawn from the fare checklist with seed **${SPOT_CHECK_SEED}**, ${SPOT_CHECKS_PER_SESSION} per session,`,
    'before any price was seen. Use only your own session’s list.',
  );
  out.push('');
  spotChecks().forEach((checks, k) => {
    out.push(`### CaptureSession ${k + 1} (${SESSIONS[k]})`);
    out.push('');
    out.push('| ID | From | To | Date |');
    out.push('| -- | ---- | -- | ---- |');
    checks.forEach((c, i) => {
      out.push(
        `| L${String(i + 1).padStart(2, '0')} | ${c.origin} | ${c.destination} | ${c.date} |`,
      );
    });
    out.push('');
  });

  return out.join('\n');
}

const note = await prettier.format(render(), {
  ...(await prettier.resolveConfig(notePath)),
  parser: 'markdown',
});

if (process.argv.includes('--check')) {
  let existing = '';
  try {
    existing = readFileSync(notePath, 'utf8');
  } catch {
    // A missing sheet is just an out-of-date one.
  }
  if (existing !== note) {
    console.error(`${path.relative(process.cwd(), notePath)} is out of date — regenerate it.`);
    process.exit(1);
  }
  console.log('Capture sheet is up to date.');
} else {
  writeFileSync(notePath, note);
  console.log(`Wrote ${path.relative(process.cwd(), notePath)}.`);
}
