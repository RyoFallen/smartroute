import { z } from 'zod';
import { CabinClass, Currency, Iata } from './flights.js';
import { RouteOption } from './routes.js';

export const OptimizePreset = z.enum(['budget', 'time', 'comfort', 'balanced']);
export type OptimizePreset = z.infer<typeof OptimizePreset>;

export const OptimizeRequest = z
  .object({
    cities: z.array(Iata).min(2).max(8),
    startCity: Iata.optional(),
    endCity: Iata.optional(),
    departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Days spent in each city, aligned with `cities`. The first city in a
    // visiting order is where the traveler flies out from and has no stay
    // (#34), so the pinned startCity may carry 0; every visited city needs at
    // least a day (refined below).
    perCityDays: z.array(z.number().int().min(0).max(30)),
    travelers: z.number().int().min(1).max(9),
    cabinClass: CabinClass,
    directOnly: z.boolean().default(false),
    preset: OptimizePreset.default('balanced'),
  })
  .refine((v) => v.perCityDays.length === v.cities.length, {
    message: 'perCityDays length must match cities length',
    path: ['perCityDays'],
  })
  .refine((v) => v.cities.every((c, i) => c === v.startCity || (v.perCityDays[i] ?? 0) >= 1), {
    message: 'every city but the startCity needs a stay of at least one day',
    path: ['perCityDays'],
  })
  .refine((v) => !v.startCity || v.cities.includes(v.startCity), {
    message: 'startCity must be in cities',
    path: ['startCity'],
  })
  .refine((v) => !v.endCity || v.cities.includes(v.endCity), {
    message: 'endCity must be in cities',
    path: ['endCity'],
  });
export type OptimizeRequest = z.infer<typeof OptimizeRequest>;

export const OptimizeResponse = z.object({
  options: z.array(RouteOption),
  partial: z.boolean().optional(),
  staleCache: z.boolean().optional(),
  reason: z.string().optional(),
  /** What every price above is in. Set by the route from its FlightProvider; the optimizer never sees money units. */
  currency: Currency.optional(),
});
export type OptimizeResponse = z.infer<typeof OptimizeResponse>;
