import type { BENCHMARK_CITIES } from './scenarios.js';

export interface BenchmarkAirport {
  iata: string;
  /** How Kiwi.com names the airport in a Nomad URL. */
  kiwiSlug: string;
}

/**
 * Each curated city's benchmark airport list: every scheduled airport within
 * 70 km of the city's curated coordinates, searched identically on Google
 * Flights and Kiwi.com Nomad (ADR-0006). The rule, the distances and what it
 * leaves out are in docs/benchmark/capture-protocol.md § 2, whose table a test
 * holds to this one.
 *
 * Slugs were read from Kiwi's own locations API on 2026-10-03. IST's still says
 * "ataturk", but it is Kiwi's slug for the new Istanbul Airport (IST): picking
 * "IST Istanbul Airport" in Nomad's form produces it.
 */
export const BENCHMARK_AIRPORTS: Record<(typeof BENCHMARK_CITIES)[number], BenchmarkAirport[]> = {
  BCN: [{ iata: 'BCN', kiwiSlug: 'barcelona-el-prat-barcelona-spain' }],
  BER: [{ iata: 'BER', kiwiSlug: 'berlin-brandenburg-berlin-germany' }],
  BUD: [{ iata: 'BUD', kiwiSlug: 'budapest-ferenc-liszt-international-budapest-hungary' }],
  CDG: [
    { iata: 'CDG', kiwiSlug: 'charles-de-gaulle-paris-france' },
    { iata: 'ORY', kiwiSlug: 'paris-orly-paris-france' },
    { iata: 'BVA', kiwiSlug: 'beauvais-tille-paris-france' },
  ],
  FCO: [
    { iata: 'FCO', kiwiSlug: 'leonardo-da-vinci-fiumicino-rome-italy' },
    { iata: 'CIA', kiwiSlug: 'ciampino-g-b-pastine-international-rome-italy' },
  ],
  IST: [
    { iata: 'IST', kiwiSlug: 'istanbul-ataturk-istanbul-turkey' },
    { iata: 'SAW', kiwiSlug: 'sabiha-gokcen-international-istanbul-turkey' },
  ],
  LHR: [
    { iata: 'LHR', kiwiSlug: 'heathrow-london-united-kingdom' },
    { iata: 'LGW', kiwiSlug: 'gatwick-london-united-kingdom' },
    { iata: 'STN', kiwiSlug: 'london-stansted-london-united-kingdom' },
    { iata: 'LTN', kiwiSlug: 'luton-london-united-kingdom' },
    { iata: 'LCY', kiwiSlug: 'london-city-london-united-kingdom' },
    { iata: 'SEN', kiwiSlug: 'london-southend-london-united-kingdom' },
  ],
  WAW: [
    { iata: 'WAW', kiwiSlug: 'warsaw-chopin-warsaw-poland' },
    { iata: 'WMI', kiwiSlug: 'warsaw-modlin-warsaw-poland' },
  ],
};
