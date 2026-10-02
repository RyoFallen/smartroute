import type {
  OptimizeRequest,
  OptimizeResponse,
  RouteLabel,
  RouteOption,
  FlightLeg,
  Score,
} from '@smartroute/shared';
import type { FlightService } from '../flights/index.js';
import type { PriceResult } from '../flights/provider.js';
import { keyOf } from '../flights/cache.js';
import { PRESET_WEIGHTS } from './fitness.js';
import { orderingKey, runGa, type GaCandidate, type GaOptions } from './ga.js';
import { scoreOrdering } from './score.js';
import { collectPriceTriples } from './triples.js';

export class OptimizerService {
  constructor(
    private readonly flights: FlightService,
    private readonly ga: GaOptions = {},
  ) {}

  async optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
    const triples = collectPriceTriples(req);
    const { prices, partial, staleCache } = await this.flights.getPrices(triples);

    const evaluate = (ordering: string[]): Score | null => {
      const legs = legsFor(ordering, req, prices);
      if (legs.length !== ordering.length - 1) return null;
      if (req.directOnly && legs.some((l) => l.stops > 0)) return null;
      return scoreOrdering(legs);
    };

    const result = runGa(
      {
        cities: req.cities,
        startCity: req.startCity,
        endCity: req.endCity,
        weights: PRESET_WEIGHTS[req.preset],
        evaluate,
      },
      this.ga,
    );

    if (!result.best) {
      return {
        options: [],
        reason: req.directOnly
          ? 'No direct-only routes available; try disabling directOnly.'
          : 'No viable routes found.',
        ...(partial && { partial }),
        ...(staleCache && { staleCache }),
      };
    }

    const labeled: Array<{ label: RouteLabel; pick: GaCandidate }> = [
      { label: 'recommended', pick: result.best },
      { label: 'cheapest', pick: pickBy(result.evaluated, (c) => c.score.totalCostCents) },
      { label: 'fastest', pick: pickBy(result.evaluated, (c) => c.score.totalDurationMin) },
      {
        label: 'most_direct',
        pick: pickBy(result.evaluated, (c) => c.score.totalStops * 1e9 + c.score.totalCostCents),
      },
    ];

    const seen = new Set<string>();
    const options: RouteOption[] = [];
    for (const { label, pick } of labeled) {
      const key = orderingKey(pick.ordering);
      if (seen.has(key)) continue;
      seen.add(key);
      const legs = legsFor(pick.ordering, req, prices);
      options.push({
        label,
        order: pick.ordering,
        flights: legs.map(toFlightLeg),
        totalPriceCents: pick.score.totalCostCents,
        totalDurationMin: pick.score.totalDurationMin,
      });
    }

    return {
      options,
      ...(partial && { partial }),
      ...(staleCache && { staleCache }),
    };
  }
}

/**
 * The priced legs of one visiting order.
 *
 * The first city is where the traveler flies out from and has no stay (#34):
 * the first leg leaves on `departDate`, and every later leg leaves after the
 * stay of the city it departs from. Advancing by the stay *before* each leg
 * but the first is what makes a city's own CityStay the time spent in it.
 */
function legsFor(
  ordering: string[],
  req: Pick<OptimizeRequest, 'perCityDays' | 'cities' | 'departDate' | 'cabinClass'>,
  prices: Map<string, PriceResult>,
): PriceResult[] {
  const out: PriceResult[] = [];
  let date = new Date(req.departDate);
  for (let i = 0; i < ordering.length - 1; i++) {
    const origin = ordering[i]!;
    const destination = ordering[i + 1]!;
    if (i > 0) date = new Date(date.getTime() + stayOf(req, origin) * 86400_000);
    const departDateStr = date.toISOString().slice(0, 10);
    const r = prices.get(
      keyOf({ origin, destination, departDate: departDateStr, cabinClass: req.cabinClass }),
    );
    if (!r) return out;
    out.push(r);
  }
  return out;
}

function stayOf(req: Pick<OptimizeRequest, 'perCityDays' | 'cities'>, city: string): number {
  return req.perCityDays[req.cities.indexOf(city)] ?? 1;
}

function pickBy<T>(arr: T[], score: (t: T) => number): T {
  let best = arr[0]!;
  let bestScore = score(best);
  for (let i = 1; i < arr.length; i++) {
    const s = score(arr[i]!);
    if (s < bestScore) {
      best = arr[i]!;
      bestScore = s;
    }
  }
  return best;
}

function toFlightLeg(r: PriceResult): FlightLeg {
  const depart = new Date(`${r.departDate}T08:00:00.000Z`);
  const arrive = new Date(depart.getTime() + r.durationMin * 60_000);
  return {
    origin: r.origin,
    destination: r.destination,
    depart: depart.toISOString(),
    arrive: arrive.toISOString(),
    carrier: r.carrier,
    priceCents: r.priceCents,
    durationMin: r.durationMin,
    stops: r.stops,
  };
}
