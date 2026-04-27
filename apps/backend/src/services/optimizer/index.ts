import type {
  CabinClass,
  OptimizeRequest,
  OptimizeResponse,
  RouteLabel,
  RouteOption,
  FlightLeg,
} from '@smartroute/shared';
import type { FlightService } from '../flights/index.js';
import type { PriceQuery, PriceResult } from '../flights/provider.js';
import { keyOf } from '../flights/cache.js';
import { enumerateOrderings } from './enumerate.js';
import { scoreOrdering } from './score.js';

export class OptimizerService {
  constructor(private readonly flights: FlightService) {}

  async optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
    const orderings = enumerateOrderings(req.cities, {
      startCity: req.startCity,
      endCity: req.endCity,
    });
    const triples = collectTriples(
      orderings,
      req.perCityDays,
      req.cities,
      req.departDate,
      req.cabinClass,
    );

    const { prices, partial, staleCache } = await this.flights.getPrices(triples);

    const candidates: Array<{ ordering: string[]; legs: PriceResult[] }> = [];
    for (const ordering of orderings) {
      const legs = legsFor(
        ordering,
        req.perCityDays,
        req.cities,
        req.departDate,
        req.cabinClass,
        prices,
      );
      if (legs.length !== ordering.length - 1) continue;
      if (req.directOnly && legs.some((l) => l.stops > 0)) continue;
      candidates.push({ ordering, legs });
    }

    if (candidates.length === 0) {
      return {
        options: [],
        reason: req.directOnly
          ? 'No direct-only routes available; try disabling directOnly.'
          : 'No viable routes found.',
        ...(partial && { partial }),
        ...(staleCache && { staleCache }),
      };
    }

    const cheapest = pickBy(candidates, (c) => sumProp(c.legs, 'priceCents'));
    const fastest = pickBy(candidates, (c) => sumProp(c.legs, 'durationMin'));
    const direct = pickBy(
      candidates,
      (c) => sumProp(c.legs, 'stops') * 1e9 + sumProp(c.legs, 'priceCents'),
    );

    const labeled: Array<{ label: RouteLabel; pick: (typeof candidates)[number] }> = [
      { label: 'cheapest', pick: cheapest },
      { label: 'fastest', pick: fastest },
      { label: 'most_direct', pick: direct },
    ];

    const seen = new Set<string>();
    const options: RouteOption[] = [];
    for (const { label, pick } of labeled) {
      const key = pick.ordering.join('>');
      if (seen.has(key)) continue;
      seen.add(key);
      const totals = scoreOrdering(pick.legs);
      options.push({
        label,
        order: pick.ordering,
        flights: pick.legs.map(toFlightLeg),
        totalPriceCents: totals.totalCostCents,
        totalDurationMin: totals.totalDurationMin,
      });
    }

    return {
      options,
      ...(partial && { partial }),
      ...(staleCache && { staleCache }),
    };
  }
}

function collectTriples(
  orderings: string[][],
  perCityDays: number[],
  cities: string[],
  departDate: string,
  cabinClass: CabinClass,
): PriceQuery[] {
  const seen = new Set<string>();
  const out: PriceQuery[] = [];
  for (const ordering of orderings) {
    let date = new Date(departDate);
    for (let i = 0; i < ordering.length - 1; i++) {
      const origin = ordering[i]!;
      const destination = ordering[i + 1]!;
      const departDateStr = date.toISOString().slice(0, 10);
      const k = `${origin}|${destination}|${departDateStr}|${cabinClass}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ origin, destination, departDate: departDateStr, cabinClass });
      }
      const idx = cities.indexOf(origin);
      const stay = perCityDays[idx] ?? 1;
      date = new Date(date.getTime() + stay * 86400_000);
    }
  }
  return out;
}

function legsFor(
  ordering: string[],
  perCityDays: number[],
  cities: string[],
  departDate: string,
  cabinClass: CabinClass,
  prices: Map<string, PriceResult>,
): PriceResult[] {
  const out: PriceResult[] = [];
  let date = new Date(departDate);
  for (let i = 0; i < ordering.length - 1; i++) {
    const origin = ordering[i]!;
    const destination = ordering[i + 1]!;
    const departDateStr = date.toISOString().slice(0, 10);
    const r = prices.get(keyOf({ origin, destination, departDate: departDateStr, cabinClass }));
    if (!r) return out;
    out.push(r);
    const idx = cities.indexOf(origin);
    const stay = perCityDays[idx] ?? 1;
    date = new Date(date.getTime() + stay * 86400_000);
  }
  return out;
}

function sumProp(legs: PriceResult[], prop: 'priceCents' | 'durationMin' | 'stops'): number {
  return legs.reduce((s, l) => s + l[prop], 0);
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
