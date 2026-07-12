import { z } from 'zod';
import type { AttractionCategory } from './attractions.js';

// The 15 travel-interest categories a traveler rates (thesis spec §3.3.1).
// Slugs are stable identifiers stored per user — never rename, only append.
// Mirrored by the Kotlin InterestCategory enum in mobile commonMain; display
// names and icons live client-side, not here.
export const InterestCategory = z.enum([
  'museums-galleries',
  'historical-sites',
  'nature-parks',
  'beaches-water',
  'food-dining',
  'nightlife-bars',
  'shopping',
  'art-architecture',
  'adventure-sports',
  'religious-sites',
  'local-culture',
  'photography-spots',
  'family-activities',
  'wellness-spa',
  'live-entertainment',
]);
export type InterestCategory = z.infer<typeof InterestCategory>;

// A traveler's rating of one InterestCategory: like (+1), neutral (0), dislike (-1).
export const InterestRating = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
export type InterestRating = z.infer<typeof InterestRating>;

// What an attraction *is* → what a user *likes*. Phase 6 ranking filters
// attractions through this. Several interests (food-dining, nightlife-bars, …)
// have no attraction counterpart yet; coverage grows with the data.
export const ATTRACTION_TO_INTEREST_CATEGORY: Record<AttractionCategory, InterestCategory> = {
  LANDMARK: 'art-architecture',
  MUSEUM: 'museums-galleries',
  RELIGIOUS: 'religious-sites',
  PARK: 'nature-parks',
  VIEWPOINT: 'photography-spots',
  HISTORICAL: 'historical-sites',
  MARKET: 'shopping',
};
