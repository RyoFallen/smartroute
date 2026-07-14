import { z } from 'zod';
import { FlightLeg, Iata } from './flights.js';

export const RouteLabel = z.enum(['cheapest', 'fastest', 'most_direct']);
export type RouteLabel = z.infer<typeof RouteLabel>;

export const Score = z.object({
  totalCostCents: z.number().int().nonnegative(),
  totalDurationMin: z.number().int().nonnegative(),
  totalStops: z.number().int().nonnegative(),
});
export type Score = z.infer<typeof Score>;

export const RouteOption = z.object({
  label: RouteLabel,
  order: z.array(Iata).min(2).max(8),
  flights: z.array(FlightLeg),
  totalPriceCents: z.number().int().nonnegative(),
  totalDurationMin: z.number().int().nonnegative(),
});
export type RouteOption = z.infer<typeof RouteOption>;
