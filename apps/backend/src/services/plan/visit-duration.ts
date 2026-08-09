import type { AttractionCategory } from '@smartroute/shared';

/**
 * Fallback VisitDuration in minutes, per AttractionCategory.
 *
 * No Places provider publishes a typical-visit-duration field — verified across
 * Google Places, Foursquare, OpenTripMap and OSM in
 * `docs/research/2026-08-09-places-api-selection.md` — so this table and the
 * curated per-attraction values are our own data. That makes it a
 * methodological choice to declare in the thesis, not a sourced figure.
 *
 * The values separate enclosed, ticketed visits from pass-through stops: you
 * spend an afternoon in a museum and five minutes photographing a fountain.
 * They are deliberately conservative — a curated per-attraction value overrides
 * them wherever the default would be visibly wrong (see `visitMinutesFor`).
 */
export const DEFAULT_VISIT_MINUTES: Record<AttractionCategory, number> = {
  MUSEUM: 120,
  HISTORICAL: 90,
  RELIGIOUS: 45,
  PARK: 60,
  VIEWPOINT: 45,
  MARKET: 60,
  LANDMARK: 30,
};

/**
 * Resolves how long to allow for one Attraction.
 *
 * Applied at read time rather than baked in at seed time on purpose: the null in
 * the column is what distinguishes a curated value from an assumed one, and the
 * thesis needs to report how many of each there are.
 */
export function visitMinutesFor(category: AttractionCategory, explicit?: number | null): number {
  // A zero-length visit is never meaningful, so treat 0 as absent rather than
  // letting bad data produce a slot with no duration.
  return explicit && explicit > 0 ? explicit : DEFAULT_VISIT_MINUTES[category];
}
