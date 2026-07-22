import { z } from 'zod';
import { Iata } from './flights.js';

export const CitySummary = z.object({
  iata: Iata,
  name: z.string(),
  country: z.string(),
});
export type CitySummary = z.infer<typeof CitySummary>;
