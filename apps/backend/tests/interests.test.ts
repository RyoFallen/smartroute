import { describe, it, expect } from 'vitest';
import {
  AttractionCategory,
  InterestCategory,
  InterestRating,
  ATTRACTION_TO_INTEREST_CATEGORY,
} from '@smartroute/shared';

// The 15 categories from thesis spec §3.3.1. Slugs are stored data — this
// literal list is the stability contract; changing it is a data migration.
const EXPECTED_SLUGS = [
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
];

describe('InterestCategory', () => {
  it('has exactly the 15 stable slugs from spec §3.3.1', () => {
    expect(InterestCategory.options).toEqual(EXPECTED_SLUGS);
  });

  it('accepts ratings -1, 0, +1 and rejects everything else', () => {
    expect(InterestRating.parse(-1)).toBe(-1);
    expect(InterestRating.parse(0)).toBe(0);
    expect(InterestRating.parse(1)).toBe(1);
    expect(() => InterestRating.parse(2)).toThrow();
    expect(() => InterestRating.parse(0.5)).toThrow();
  });
});

describe('ATTRACTION_TO_INTEREST_CATEGORY', () => {
  it('maps every AttractionCategory to a valid InterestCategory', () => {
    for (const attraction of AttractionCategory.options) {
      const interest = ATTRACTION_TO_INTEREST_CATEGORY[attraction];
      expect(InterestCategory.options).toContain(interest);
    }
  });

  it('maps categories to their obvious interest counterparts', () => {
    expect(ATTRACTION_TO_INTEREST_CATEGORY.MUSEUM).toBe('museums-galleries');
    expect(ATTRACTION_TO_INTEREST_CATEGORY.VIEWPOINT).toBe('photography-spots');
  });
});
