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
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttractionCategory } from '@smartroute/shared';
import { SeedFile } from '../src/services/plan/seed-schema.js';
import {
  ManualOpeningHoursFile,
  OsmOpeningHoursFile,
  attractionKey,
} from '../src/services/plan/seed-opening-hours.js';
import { DEFAULT_VISIT_MINUTES } from '../src/services/plan/visit-duration.js';

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
    })),
  );
}

const count = (rows: Row[], basis: HoursBasis): number =>
  rows.filter((r) => r.hours === basis).length;

const pct = (n: number, total: number): string =>
  total === 0 ? '—' : `${((n / total) * 100).toFixed(0)}%`;

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

  out.push('## VisitDuration');
  out.push('');
  out.push(
    `Curated per attraction: **${curated} of ${total}** (${pct(curated, total)}). The remaining`,
    `**${total - curated}** fall back to the per-\`AttractionCategory\` default at read time.`,
  );
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
const note = render(rows);

if (process.argv.includes('--check')) {
  const existing = readFileSync(notePath, 'utf8');
  if (existing.trim() !== note.trim()) {
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
