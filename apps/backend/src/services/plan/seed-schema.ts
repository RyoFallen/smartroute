import { z } from 'zod';
import { AttractionCategory, Iata } from '@smartroute/shared';

/**
 * Where a curated VisitDuration came from.
 *
 * Two bases, because operators almost never publish a visit length — three of 52
 * did, measured in `docs/research/2026-08-18-opening-hours-citations.md` §6 — so
 * most curated values are our own estimate, and the thesis has to be able to
 * count which is which. A `published` value quotes the operator; a `judgement`
 * value states its reasoning and cites nothing, because there is nothing to
 * cite and a borrowed URL would dress an estimate up as a source.
 */
export const VisitMinutesProvenance = z.discriminatedUnion('basis', [
  z
    .object({
      basis: z.literal('published'),
      source: z.string().url(),
      retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date, e.g. 2026-08-18'),
      quote: z.string().min(1),
    })
    .strict(),
  z
    .object({
      basis: z.literal('judgement'),
      rationale: z.string().min(20),
    })
    .strict(),
]);
export type VisitMinutesProvenance = z.infer<typeof VisitMinutesProvenance>;

export const SeedAttraction = z
  .object({
    name: z.string().min(1),
    category: AttractionCategory,
    rank: z.number().int().positive(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    description: z.string().min(10).max(300),
    tags: z
      .array(z.string().regex(/^[a-z][a-z0-9-]*$/, 'tags must be lowercase with optional hyphens'))
      .min(1),
    // VisitDuration in minutes. Our own curated datum, so it belongs in this
    // hand-curated file rather than the ODbL-marked supplementary ones. Optional:
    // omitted means "fall back to the AttractionCategory default at read time",
    // which keeps curated and assumed values distinguishable.
    visitMinutes: z.number().int().positive().optional(),
    visitMinutesProvenance: VisitMinutesProvenance.optional(),
  })
  // Both or neither: a curated value with no stated basis is exactly the
  // unaccountable number this field exists to prevent, and a basis with no value
  // is a leftover from a value someone removed.
  .refine((a) => (a.visitMinutes === undefined) === (a.visitMinutesProvenance === undefined), {
    message: 'visitMinutes and visitMinutesProvenance must be given together',
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
