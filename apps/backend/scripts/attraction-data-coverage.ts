/**
 * Counts how the Attraction dataset's OpeningHours and VisitDuration values
 * were arrived at, and writes the methodology note the thesis cites.
 *
 * This is the mechanical half of issue #25. The judgement — which attractions
 * are genuinely unconstrained, which need a sourced fill, what a realistic visit
 * length is — is human work; this only reports where that work has got to, so
 * "68 of 95" never has to be counted by hand or quoted from memory.
 *
 * Run: pnpm --filter @smartroute/backend exec tsx scripts/attraction-data-coverage.ts
 *      ... --check   to fail if the committed note is out of date
 *
 * Deliberately not part of `pnpm test`: it reads the seed files directly, needs
 * no database, and regenerating a document is not a test. The `--check` mode
 * exists for the moment the note starts mattering for submission.
 *
 * What it writes is run through Prettier first, because `docs/**` must be
 * Prettier-formatted or backend CI fails, and a generator whose output needs a
 * second pass to be committable cannot check its own work: it would compare its
 * raw markdown against the formatted file and report a stale note on every run,
 * however current the note was. Formatting here is what makes `--check` mean
 * "the seed data moved" rather than "Prettier reflowed a table".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import type { AttractionCategory } from '@smartroute/shared';
import { SeedFile } from '../src/services/plan/seed-schema.js';
import {
  ManualOpeningHoursFile,
  OsmOpeningHoursFile,
  attractionKey,
} from '../src/services/plan/seed-opening-hours.js';
import { DEFAULT_VISIT_MINUTES } from '../src/services/plan/visit-duration.js';
import { ASSUMED_OPENING_WINDOW } from '../src/services/itinerary/assumed-opening-hours.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(here, '../prisma/seed');
const notePath = path.join(here, '../../../docs/research/attraction-data-coverage.md');

const read = (name: string): unknown => JSON.parse(readFileSync(path.join(seedDir, name), 'utf8'));

/**
 * How one Attraction's OpeningHours came to be what it is.
 *
 * `undecided` is the one that matters while #25 is open: it is the attraction
 * nobody has looked at yet, as opposed to `unknown`, which is a decision that
 * there is nothing to record. Collapsing the two would make the dataset look
 * finished before it is.
 */
type HoursBasis = 'osm' | 'sourced' | 'always-open' | 'unknown' | 'undecided';

const HOURS_BASIS_LABEL: Record<HoursBasis, string> = {
  osm: 'OSM-sourced',
  sourced: 'Manually filled, with a cited source',
  'always-open': 'Genuinely unconstrained (`24/7`)',
  unknown: 'Deliberately left unknown',
  undecided: 'Not yet examined',
};

interface Row {
  city: string;
  name: string;
  category: AttractionCategory;
  hours: HoursBasis;
  visitMinutesCurated: boolean;
  visitMinutes: number | null;
  /** `published` or `judgement` where curated; null on the category default. */
  visitBasis: 'published' | 'judgement' | null;
}

function collect(): Row[] {
  const cities = SeedFile.parse(read('attractions.json'));
  const osm = OsmOpeningHoursFile.parse(read('opening-hours.osm.json'));
  const manual = ManualOpeningHoursFile.parse(read('opening-hours.manual.json'));

  const basis = new Map<string, HoursBasis>();
  for (const e of osm.entries) basis.set(attractionKey(e.cityIata, e.attraction), 'osm');
  for (const e of manual.entries) basis.set(attractionKey(e.cityIata, e.attraction), e.basis);

  return cities.flatMap((c) =>
    c.attractions.map((a) => ({
      city: c.iata,
      name: a.name,
      category: a.category,
      hours: basis.get(attractionKey(c.iata, a.name)) ?? 'undecided',
      visitMinutesCurated: a.visitMinutes != null,
      visitMinutes: a.visitMinutes ?? null,
      visitBasis: a.visitMinutesProvenance?.basis ?? null,
    })),
  );
}

const count = (rows: Row[], basis: HoursBasis): number =>
  rows.filter((r) => r.hours === basis).length;

const pct = (n: number, total: number): string =>
  total === 0 ? '—' : `${((n / total) * 100).toFixed(0)}%`;

/** Minutes since midnight as a wall clock reads it, for the assumed-window table. */
const wallClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function render(rows: Row[]): string {
  const total = rows.length;
  const curated = rows.filter((r) => r.visitMinutesCurated).length;
  const bases: HoursBasis[] = ['osm', 'sourced', 'always-open', 'unknown', 'undecided'];
  const decided = total - count(rows, 'undecided');

  const out: string[] = [];
  out.push('# Attraction data coverage');
  out.push('');
  out.push(
    'Where the `OpeningHours` and `VisitDuration` values in the Attraction dataset came from. This',
    'is the raw material for the thesis methodology section: it is the honest account of how much of',
    'the dataset is sourced, how much is our own judgement, and how much rests on a documented',
    'assumption.',
  );
  out.push('');
  out.push(
    '**Generated** — do not edit by hand. Regenerate with',
    '`pnpm --filter @smartroute/backend exec tsx scripts/attraction-data-coverage.ts` after changing',
    'any seed file.',
  );
  out.push('');
  out.push(
    `Across **${total} attractions** in **${new Set(rows.map((r) => r.city)).size} cities**.`,
  );
  out.push('');

  out.push('## OpeningHours');
  out.push('');
  out.push('| Basis | Count | Share |');
  out.push('| ----- | ----: | ----: |');
  for (const b of bases) {
    out.push(`| ${HOURS_BASIS_LABEL[b]} | ${count(rows, b)} | ${pct(count(rows, b), total)} |`);
  }
  out.push(`| **Decided** | **${decided}** | **${pct(decided, total)}** |`);
  out.push('');
  out.push(
    'The three hand-made bases are distinct on purpose. "Genuinely unconstrained" is a fact about the',
    'attraction — a square has no gates. "Deliberately left unknown" is a fact about our data — we',
    'looked and there was nothing to record. "Not yet examined" is neither, and is the number that',
    'has to reach zero before the dataset is finished.',
  );
  out.push('');

  const undecided = rows.filter((r) => r.hours === 'undecided');
  if (undecided.length > 0) {
    out.push(`## Still to decide (${undecided.length})`);
    out.push('');
    out.push('| City | Attraction | Category |');
    out.push('| ---- | ---------- | -------- |');
    for (const r of undecided) out.push(`| ${r.city} | ${r.name} | ${r.category} |`);
    out.push('');
  }

  // Both bases resolve to a null OpeningHours on the Attraction, which is what
  // the scheduler reads — one deliberately, one because nobody has looked yet.
  const assumedRows = rows.filter((r) => r.hours === 'undecided' || r.hours === 'unknown');

  out.push('## Assumed opening windows');
  out.push('');
  out.push(
    `Scheduled against an assumed window: **${assumedRows.length} of ${total}** ` +
      `(${pct(assumedRows.length, total)}) — every Attraction whose \`OpeningHours\` we do not`,
    'hold, whether it was deliberately left unknown or has not been examined yet. Each affected',
    'VisitSlot is returned with `hoursAssumed` set and is badged in the app, so a traveler can tell',
    'an opening time we know from one we guessed.',
  );
  out.push('');
  out.push(
    'This mirrors the `VisitDuration` fallback below and is our own judgement for the same reason —',
    'no provider publishes a per-category opening window either. The alternative of dropping such',
    'Attractions from the Itinerary was rejected: silently losing a must-go landmark for a data',
    'reason the traveler cannot see is worse than an approximate opening time. The windows are',
    'deliberately wide, because an assumed window is a plausibility bound, and one narrower than',
    'reality would push a visit off a day it could genuinely have happened on.',
    '',
    'They are a **preference, not a constraint**. A visit is placed inside its window wherever the',
    'stay allows one, and outside it — still disclosed — where nothing does; enforcing it strictly',
    'would reintroduce the same silent exclusion by the back door. A published closure, which is a',
    'fact rather than a guess, is itself only ever flagged, and a guess must not outrank one.',
  );
  out.push('');
  out.push('| AttractionCategory | Assumed open | Assumed close | Attractions using it |');
  out.push('| ------------------ | ------------ | ------------- | -------------------: |');
  for (const [category, window] of Object.entries(ASSUMED_OPENING_WINDOW)) {
    const using = assumedRows.filter((r) => r.category === category).length;
    out.push(
      `| ${category} | ${wallClock(window.opens)} | ${wallClock(window.closes)} | ${using} |`,
    );
  }
  out.push('');
  out.push(
    'Attractions whose hours we *do* hold — including the ones recorded as genuinely unconstrained',
    '(`24/7`) — are never touched by this table and never marked as assumed. Note also what this',
    'does not do: a published weekly schedule is honoured at the level of _which day_ a visit falls',
    'on, not which hour of it (see `closures.ts`).',
  );
  out.push('');

  out.push('## VisitDuration');
  out.push('');
  out.push(
    `Curated per attraction: **${curated} of ${total}** (${pct(curated, total)}). The remaining`,
    `**${total - curated}** fall back to the per-\`AttractionCategory\` default at read time.`,
  );
  out.push('');
  const published = rows.filter((r) => r.visitBasis === 'published').length;
  const judgement = rows.filter((r) => r.visitBasis === 'judgement').length;
  out.push(
    `Of the curated values, **${published}** quote a visit length the operator publishes and`,
    `**${judgement}** are our own judgement, each with its rationale beside it in`,
    '`attractions.json` (`visitMinutesProvenance`). Operators almost never publish one: three of 52',
    'official sites did (`2026-08-18-opening-hours-citations.md` §6). A judgement value overrides the',
    'default only where the default is visibly wrong for that attraction — usually because the',
    'category describes the outside of a building whose ticketed inside is what the hours encode.',
  );
  out.push('');
  out.push('| City | Attraction | Category | Default | Curated | Basis |');
  out.push('| ---- | ---------- | -------- | ------: | ------: | ----- |');
  for (const r of rows.filter((x) => x.visitBasis !== null)) {
    out.push(
      `| ${r.city} | ${r.name} | ${r.category} | ${DEFAULT_VISIT_MINUTES[r.category]} | ${r.visitMinutes} | ${r.visitBasis} |`,
    );
  }
  out.push('');
  out.push(
    'No Places provider publishes a typical-visit-duration field — verified across Google Places,',
    'Foursquare, OpenTripMap and OSM in `2026-08-09-places-api-selection.md` — so both the curated',
    'values and this table are our own data, and a methodological choice the thesis has to justify',
    'rather than a sourced figure.',
  );
  out.push('');
  out.push('| AttractionCategory | Default minutes | Attractions using it |');
  out.push('| ------------------ | --------------: | -------------------: |');
  for (const [category, minutes] of Object.entries(DEFAULT_VISIT_MINUTES)) {
    const using = rows.filter((r) => r.category === category && !r.visitMinutesCurated).length;
    out.push(`| ${category} | ${minutes} | ${using} |`);
  }
  out.push('');
  out.push(
    'The values separate enclosed, ticketed visits from pass-through stops: an afternoon in a museum,',
    'five minutes photographing a fountain. They are deliberately conservative, and a curated',
    'per-attraction value overrides them wherever the default would be visibly wrong — which is',
    'exactly where a major museum and a small chapel share an `AttractionCategory` but not a',
    'realistic visit length.',
  );
  out.push('');

  return out.join('\n');
}

const rows = collect();
// Resolved from the note's own path so the script picks up whatever
// `.prettierrc.json` the repo is using rather than restating its settings here.
const note = await prettier.format(render(rows), {
  ...(await prettier.resolveConfig(notePath)),
  parser: 'markdown',
});

if (process.argv.includes('--check')) {
  const existing = readFileSync(notePath, 'utf8');
  if (existing !== note) {
    console.error(
      `${path.relative(process.cwd(), notePath)} is out of date — regenerate it with:\n` +
        '  pnpm --filter @smartroute/backend exec tsx scripts/attraction-data-coverage.ts',
    );
    process.exit(1);
  }
  console.log('Coverage note is up to date.');
} else {
  writeFileSync(notePath, note);
  const total = rows.length;
  console.log(`Wrote ${path.relative(process.cwd(), notePath)}`);
  console.log(
    `  OpeningHours: ${count(rows, 'osm')} OSM, ${count(rows, 'sourced')} sourced by hand, ` +
      `${count(rows, 'always-open')} always-open, ${count(rows, 'unknown')} deliberately unknown, ` +
      `${count(rows, 'undecided')} still to examine (of ${total})`,
  );
  console.log(
    `  VisitDuration: ${rows.filter((r) => r.visitMinutesCurated).length} curated, ` +
      `${rows.filter((r) => !r.visitMinutesCurated).length} on the category default (of ${total})`,
  );
}
