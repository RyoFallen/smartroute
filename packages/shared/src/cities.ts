import { z } from 'zod';
import { Iata } from './flights.js';

export const CitySummary = z.object({
  iata: Iata,
  name: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
});
export type CitySummary = z.infer<typeof CitySummary>;
