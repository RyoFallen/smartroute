import { z } from 'zod';
import { Iata } from './flights.js';

export const AttractionCategory = z.enum([
  'LANDMARK',
  'MUSEUM',
  'RELIGIOUS',
  'PARK',
  'VIEWPOINT',
  'HISTORICAL',
  'MARKET',
]);
export type AttractionCategory = z.infer<typeof AttractionCategory>;

export const Attraction = z.object({
  id: z.string(),
  name: z.string(),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number(),
  lon: z.number(),
  description: z.string(),
});
export type Attraction = z.infer<typeof Attraction>;

export const TripPlanCity = z.object({
  iata: Iata,
  name: z.string().nullable(), // null when the city is not in our database
  available: z.boolean(), // false => "no guide for this city yet"
  mustGo: z.array(Attraction), // empty when !available
});
export type TripPlanCity = z.infer<typeof TripPlanCity>;

export const TripPlanResponse = z.object({
  tripId: z.string(),
  cities: z.array(TripPlanCity), // in visiting order
});
export type TripPlanResponse = z.infer<typeof TripPlanResponse>;
