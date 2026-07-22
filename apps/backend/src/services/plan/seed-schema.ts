import { z } from 'zod';
import { AttractionCategory, Iata } from '@smartroute/shared';

export const SeedAttraction = z.object({
  name: z.string().min(1),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  description: z.string().min(10).max(300),
  tags: z
    .array(z.string().regex(/^[a-z][a-z0-9-]*$/, 'tags must be lowercase with optional hyphens'))
    .min(1),
});
export type SeedAttraction = z.infer<typeof SeedAttraction>;

export const SeedCity = z.object({
  iata: Iata,
  altCodes: z.array(Iata).default([]),
  metroIata: Iata.nullable().optional(),
  name: z.string().min(1),
  country: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  attractions: z.array(SeedAttraction).min(8), // absolute loader floor; QA test enforces ≥10 for curated data
});
export type SeedCity = z.infer<typeof SeedCity>;

export const SeedFile = z.array(SeedCity).min(1);
export type SeedFile = z.infer<typeof SeedFile>;
