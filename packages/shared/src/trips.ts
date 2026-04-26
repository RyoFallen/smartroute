import { z } from 'zod';
import { CabinClass, FlightLeg, Iata } from './flights.js';

export const Trip = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  cabinClass: CabinClass,
  travelers: z.number().int().min(1).max(9),
  cities: z.array(Iata).min(2).max(8),
  flights: z.array(FlightLeg),
  totalPriceCents: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof Trip>;

export const CreateTripRequest = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  cabinClass: CabinClass,
  travelers: z.number().int().min(1).max(9),
  cities: z.array(Iata).min(2).max(8),
  flights: z.array(FlightLeg),
  totalPriceCents: z.number().int().nonnegative(),
});
export type CreateTripRequest = z.infer<typeof CreateTripRequest>;
