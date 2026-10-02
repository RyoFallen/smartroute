import { z } from 'zod';
import { Iata } from '@smartroute/shared';
import { assertValidOpeningHours } from './opening-hours.js';
import type { SeedFile } from './seed-schema.js';

/**
 * The OpeningHours value marking an attraction as genuinely unconstrained —
 * squares, parks, streets. Distinct from a null, which means we simply do not
 * know (see CONTEXT.md "OpeningHours"); collapsing the two loses the difference
 * between a fact about the attraction and a gap in our data.
 *
 * Exported so read sites compare against this constant rather than sprinkling a
 * bare `'24/7'` literal around. Note that equality against it is a test for "we
 * recorded it as always open", not for "is open right now" — an equivalent value
 * such as `Mo-Su 00:00-24:00` parses to the same behaviour without matching.
 */
export const ALWAYS_OPEN = '24/7';

/** The fields every supplementary entry carries, whatever its provenance. */
const OpeningHoursEntry = z.object({
  cityIata: Iata,
  attraction: z.string().min(1),
  openingHours: z.string().min(1),
});
type OpeningHoursEntry = z.infer<typeof OpeningHoursEntry>;

/**
 * OpeningHours sourced from OpenStreetMap.
 *
 * The licence and attribution markers are required rather than decorative: this
 * file is the ODbL boundary described in ADR-0005. Keeping OSM-derived values
 * here — never merged into the hand-curated attractions file — is what stops the
 * share-alike obligation from attaching to our own work when the repo, dataset
 * or app is eventually published.
 *
 * `osmElement` is required so every value is auditable and the fetch is
 * re-runnable. Name matching against OSM is unreliable (Hagia Sophia's element
 * is named `Ayasofya` and sits ~400 m from our seed coordinate), so the element
 * that actually supplied the value has to be recorded rather than re-derived.
 */
export const OsmOpeningHoursFile = z.object({
  license: z.literal('ODbL-1.0'),
  attribution: z.string().min(1),
  source: z.string().min(1),
  osmBaseTimestamp: z.string().datetime(),
  entries: z.array(
    OpeningHoursEntry.extend({
      osmElement: z.string().regex(/^(node|way|relation)\/\d+$/, 'expected e.g. "way/109862851"'),
      wikidata: z
        .string()
        .regex(/^Q\d+$/)
        .optional(),
      /**
       * The value as OSM published it, where `openingHours` had to be rewritten
       * to store it.
       *
       * The case this exists for is the `PH`/`SH` holiday macros: measured
       * 2026-08-09, `PH off` evaluates for `de`/`pl`/`hu`/`fr`/`it`/`es` but
       * throws for `tr` and `gb`, so an Istanbul or London value carrying one
       * could never be evaluated by the closure scoring in #30. Those are
       * rewritten to explicit dates (`Jan 01,Dec 25 off`). Recording the
       * original is what keeps the rewrite auditable rather than a silent edit
       * of someone else's data.
       */
      rewrittenFrom: z.string().min(1).optional(),
    }),
  ),
});
export type OsmOpeningHoursFile = z.infer<typeof OsmOpeningHoursFile>;

/**
 * A hand-made judgement about one Attraction's OpeningHours.
 *
 * Three bases, because the hand-work genuinely has three outcomes and flattening
 * them loses the distinction CONTEXT.md's "OpeningHours" entry is built on —
 * "always open" is a fact about the attraction, "unknown" is a fact about our
 * data, and neither is a sourced opening time.
 *
 * The basis is explicit rather than inferred from which fields are present, so a
 * row states what it rests on and a reader never has to reverse-engineer it.
 */
const ManualEntry = z.discriminatedUnion('basis', [
  /**
   * A real opening time read off a published source.
   *
   * `source` and `retrieved` are mandatory: a hand-entered opening time whose
   * provenance is neither OSM nor a vendor is only defensible in a thesis if the
   * sourcing method and date are recorded per row.
   */
  OpeningHoursEntry.extend({
    basis: z.literal('sourced'),
    source: z.string().url(),
    retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date, e.g. 2026-08-09'),
    /** See `OsmOpeningHoursFile.rewrittenFrom` — same purpose, same PH/SH case. */
    rewrittenFrom: z.string().min(1).optional(),
    /**
     * What a reader must know before trusting the value: that it is one day's
     * reading rather than a published weekly rule, that a season was not yet
     * published, that a published rule could not be expressed. The value itself
     * stays exactly what the source supports; the caveat lives beside it.
     */
    note: z.string().min(1).optional(),
  })
    // Strict so a mistyped key in a hand-edited file fails on the typo rather
    // than on the required field it was meant to be.
    .strict(),

  /**
   * Genuinely unconstrained — a square, a park, a street, an open viewpoint.
   *
   * Carries no `openingHours` field: the value is always `ALWAYS_OPEN`, supplied
   * by the resolver. Writing it out per row would let a file claim a row is
   * unconstrained while carrying a weekly schedule.
   *
   * Deliberately takes a `rationale` and no `source`. There is no page to cite
   * for "Trevi Fountain has no gates", and demanding a URL for it would force a
   * fabricated citation — the opposite of what the provenance rule is for.
   */
  z
    .object({
      basis: z.literal('always-open'),
      cityIata: Iata,
      attraction: z.string().min(1),
      rationale: z.string().min(1),
    })
    // Strict so an `openingHours` field here is an error rather than silently
    // stripped: a row must not be able to claim it is unconstrained while
    // carrying a weekly schedule.
    .strict(),

  /**
   * Looked at, and deliberately left unknown.
   *
   * Records a decision that absence cannot express: an Attraction missing from
   * these files is indistinguishable from one nobody has examined yet. Resolves
   * to no value at all — it is a note about the gap, not a way of filling it.
   */
  z
    .object({
      basis: z.literal('unknown'),
      cityIata: Iata,
      attraction: z.string().min(1),
      rationale: z.string().min(1),
    })
    // Strict for the same reason: a value written on a row that declares itself
    // unknown is a contradiction, not something to quietly ignore.
    .strict(),
]);
export type ManualEntry = z.infer<typeof ManualEntry>;

/** OpeningHours decided by hand, where OSM had none or its value was unusable. */
export const ManualOpeningHoursFile = z.object({
  note: z.string().min(1),
  entries: z.array(ManualEntry),
});
export type ManualOpeningHoursFile = z.infer<typeof ManualOpeningHoursFile>;

/**
 * The OpeningHours a hand-made row resolves to, or null where it deliberately
 * records that we do not know.
 *
 * `always-open` supplies the marker itself rather than reading it off the row —
 * that is what makes the basis, and not the file's author, the thing deciding
 * the value.
 */
export function manualValue(entry: ManualEntry): string | null {
  switch (entry.basis) {
    case 'sourced':
      return entry.openingHours;
    case 'always-open':
      return ALWAYS_OPEN;
    case 'unknown':
      return null;
  }
}

/** Cannot occur in a city code or an attraction name, so keys never collide. */
const KEY_SEPARATOR = '\u0000';

/**
 * Join key for the supplementary files: a city code plus an Attraction name.
 *
 * Separated by an explicit NUL, which cannot occur in either part, so no city
 * code and name combination can collide with another. Always build keys through
 * this function rather than interpolating by hand.
 */
export function attractionKey(cityIata: string, name: string): string {
  return cityIata + KEY_SEPARATOR + name;
}

/**
 * Validates the supplementary files against the curated Attraction data and
 * returns the resolved OpeningHours by attraction.
 *
 * Pure — no database access — so the join rules are testable on their own. Every
 * failure throws before the caller writes anything.
 *
 * An Attraction absent from the result has genuinely unknown OpeningHours. That
 * is a legitimate state, distinct from the ALWAYS_OPEN marker, so the reverse
 * orphan direction (a curated attraction with no entry) is deliberately NOT an
 * error — only an entry matching no curated attraction is.
 */
export function resolveOpeningHours(
  cities: SeedFile,
  osm?: unknown,
  manual?: unknown,
): Map<string, string> {
  const curated = new Set<string>();
  for (const c of cities) {
    for (const a of c.attractions) curated.add(attractionKey(c.iata, a.name));
  }

  const resolved = new Map<string, string>();
  const provenance = new Map<string, string>();

  /**
   * `value` is null for a row that claims an attraction without giving it
   * OpeningHours — a deliberate `unknown`. Such a row is still checked for
   * orphans and still takes ownership of the attraction, so that "deliberately
   * unknown here" and "sourced there" collide loudly instead of one quietly
   * winning.
   */
  const ingest = (
    rows: Array<{ cityIata: string; attraction: string; value: string | null }>,
    origin: string,
  ) => {
    for (const row of rows) {
      const key = attractionKey(row.cityIata, row.attraction);
      const label = `${row.cityIata}/${row.attraction}`;

      if (!curated.has(key)) {
        throw new Error(
          `${origin}: no curated attraction matches ${label}. ` +
            `Names must match attractions.json exactly — check for a qualifier ` +
            `such as "Chora Church (Kariye)".`,
        );
      }
      const claimed = provenance.get(key);
      if (claimed) {
        throw new Error(
          claimed === origin
            ? `${label}: listed twice in ${origin} — each attraction appears at most once per file.`
            : `${label}: OpeningHours claimed by both ${claimed} and ${origin} — provenance ` +
                `would be ambiguous. Each attraction takes its value from exactly one source.`,
        );
      }
      provenance.set(key, origin);
      if (row.value === null) continue;
      assertValidOpeningHours(row.value, label);
      resolved.set(key, row.value);
    }
  };

  if (osm !== undefined) {
    ingest(
      OsmOpeningHoursFile.parse(osm).entries.map((e) => ({ ...e, value: e.openingHours })),
      'opening-hours.osm.json',
    );
  }
  if (manual !== undefined) {
    ingest(
      ManualOpeningHoursFile.parse(manual).entries.map((e) => ({ ...e, value: manualValue(e) })),
      'opening-hours.manual.json',
    );
  }

  return resolved;
}
