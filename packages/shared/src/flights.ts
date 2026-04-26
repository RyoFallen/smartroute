import { z } from 'zod';

export const CabinClass = z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']);
export type CabinClass = z.infer<typeof CabinClass>;

export const Iata = z.string().length(3).regex(/^[A-Z]{3}$/);

export const FlightLeg = z.object({
  origin: Iata,
  destination: Iata,
  depart: z.string().datetime(),
  arrive: z.string().datetime(),
  carrier: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  durationMin: z.number().int().positive(),
  stops: z.number().int().nonnegative(),
});
export type FlightLeg = z.infer<typeof FlightLeg>;
