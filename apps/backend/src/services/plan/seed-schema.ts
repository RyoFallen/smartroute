import { z } from 'zod';
import { AttractionCategory, Iata } from '@smartroute/shared';

export const SeedAttraction = z.object({
  name: z.string().min(1),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  description: z.string().min(10).max(300),
  tags: z.array(z.string().min(1)).min(1),
});
export type SeedAttraction = z.infer<typeof SeedAttraction>;

export const SeedCity = z.object({
  iata: Iata,
  altCodes: z.array(Iata).default([]),
  name: z.string().min(1),
  country: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  attractions: z.array(SeedAttraction).min(8),
});
export type SeedCity = z.infer<typeof SeedCity>;

export const SeedFile = z.array(SeedCity).min(1);
export type SeedFile = z.infer<typeof SeedFile>;
