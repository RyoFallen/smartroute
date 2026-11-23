import type { SessionFile } from './session.js';
import { median } from './stats.js';

/** One live search beside the grid's price for the same fare. */
export interface SpotCheckRow {
  item: string | null;
  origin: string;
  destination: string;
  date: string;
  /** The grid's price for this fare; null if the grid showed "no fare" or did not record it. */
  gridCents: number | null;
  /** The live search's cheapest price; null if it found no flight. */
  liveCents: number | null;
  /** (live − grid) / grid: negative when the live price is lower. Null without both. */
  drift: number | null;
}

/**
 * Calendar-vs-live drift (capture-protocol § 6): how far the date grid's
 * cached prices, which the benchmark is priced from, sit from a live search.
 */
export interface SpotCheckSummary {
  rows: SpotCheckRow[];
  checked: number;
  /** Rows with both prices, the drift's sample size. */
  compared: number;
  liveAtOrBelowGrid: number;
  medianDrift: number | null;
}

export function spotCheckRows(session: SessionFile): SpotCheckRow[] {
  const gridPrice = new Map<string, number | null>();
  for (const g of session.grids) {
    for (const f of g.fares) gridPrice.set(`${g.origin}-${g.destination} ${f.date}`, f.priceCents);
  }
  return session.spotChecks.map((s) => {
    const gridCents = gridPrice.get(`${s.origin}-${s.destination} ${s.date}`) ?? null;
    const liveCents = s.livePriceCents;
    return {
      item: s.item ?? null,
      origin: s.origin,
      destination: s.destination,
      date: s.date,
      gridCents,
      liveCents,
      drift: gridCents === null || liveCents === null ? null : (liveCents - gridCents) / gridCents,
    };
  });
}

export function summarizeSpotChecks(rows: SpotCheckRow[]): SpotCheckSummary {
  const compared = rows.filter((r) => r.drift !== null);
  return {
    rows,
    checked: rows.length,
    compared: compared.length,
    liveAtOrBelowGrid: compared.filter((r) => r.liveCents! <= r.gridCents!).length,
    medianDrift: compared.length > 0 ? median(compared.map((r) => r.drift!)) : null,
  };
}
