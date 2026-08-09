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
    }),
  ),
});
export type OsmOpeningHoursFile = z.infer<typeof OsmOpeningHoursFile>;

/**
 * OpeningHours filled in by hand where OSM had none.
 *
 * `source` and `retrieved` are mandatory: a hand-entered opening time whose
 * provenance is neither OSM nor a vendor is only defensible in a thesis if the
 * sourcing method and date are recorded per row.
 */
export const ManualOpeningHoursFile = z.object({
  note: z.string().min(1),
  entries: z.array(
    OpeningHoursEntry.extend({
      source: z.string().url(),
      retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date, e.g. 2026-08-09'),
    }),
  ),
});
export type ManualOpeningHoursFile = z.infer<typeof ManualOpeningHoursFile>;

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

  const ingest = (entries: OpeningHoursEntry[], origin: string) => {
    for (const entry of entries) {
      const key = attractionKey(entry.cityIata, entry.attraction);
      const label = `${entry.cityIata}/${entry.attraction}`;

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
      assertValidOpeningHours(entry.openingHours, label);
      resolved.set(key, entry.openingHours);
      provenance.set(key, origin);
    }
  };

  if (osm !== undefined) {
    ingest(OsmOpeningHoursFile.parse(osm).entries, 'opening-hours.osm.json');
  }
  if (manual !== undefined) {
    ingest(ManualOpeningHoursFile.parse(manual).entries, 'opening-hours.manual.json');
  }

  return resolved;
}
