import { describe, it, expect } from 'vitest';
import type { AttractionCategory, InterestEntry } from '@smartroute/shared';
import { ATTRACTION_TO_INTEREST_CATEGORY, InterestCategory } from '@smartroute/shared';
import { interestRatingFor, selectAttractions } from '../../../src/services/itinerary/select.js';

/** Attractions in editorial rank order — index 0 is rank 1, as the seed serves them. */
function ranked(...categories: AttractionCategory[]): { category: AttractionCategory }[] {
  return categories.map((category) => ({ category }));
}

const likes = (...categories: InterestCategory[]): InterestEntry[] =>
  categories.map((category) => ({ category, rating: 1 }));

const dislikes = (...categories: InterestCategory[]): InterestEntry[] =>
  categories.map((category) => ({ category, rating: -1 }));

describe('interestRatingFor', () => {
  it('scores an attraction by the traveler rating of its mapped InterestCategory', () => {
    expect(interestRatingFor('MUSEUM', likes('museums-galleries'))).toBe(1);
    expect(interestRatingFor('MUSEUM', dislikes('museums-galleries'))).toBe(-1);
  });

  it('scores a category the traveler never rated as neutral', () => {
    expect(interestRatingFor('MUSEUM', likes('nightlife-bars'))).toBe(0);
    expect(interestRatingFor('MUSEUM', [])).toBe(0);
  });

  it('reads every AttractionCategory through the one shared mapping', () => {
    // The criterion that matters here is that no second, parallel mapping is
    // introduced: liking the InterestCategory the shared map points at must be
    // what promotes the attraction, for every category in the map.
    for (const [attraction, interest] of Object.entries(ATTRACTION_TO_INTEREST_CATEGORY)) {
      expect(interestRatingFor(attraction as AttractionCategory, likes(interest))).toBe(1);
    }
  });
});

describe('selectAttractions', () => {
  it('takes everything, in editorial rank, when the limit does not bind', () => {
    const list = ranked('MUSEUM', 'PARK', 'LANDMARK');
    expect(selectAttractions(list, [], 10)).toEqual([0, 1, 2]);
  });

  it('never takes more than the limit allows', () => {
    const list = ranked('MUSEUM', 'PARK', 'LANDMARK', 'MARKET');
    expect(selectAttractions(list, [], 2)).toEqual([0, 1]);
  });

  it('ranks liked above neutral and neutral above disliked', () => {
    const list = ranked('LANDMARK', 'MUSEUM', 'PARK');
    const interests = [...likes('museums-galleries'), ...dislikes('art-architecture')];

    // MUSEUM (+1), PARK (0), LANDMARK (-1) — rank 1 falls to the back.
    expect(selectAttractions(list, interests, 3)).toEqual([1, 2, 0]);
  });

  it('breaks ties on editorial rank', () => {
    const list = ranked('MUSEUM', 'MUSEUM', 'MUSEUM');
    expect(selectAttractions(list, likes('museums-galleries'), 3)).toEqual([0, 1, 2]);
  });

  it('drops disliked attractions before neutral ones', () => {
    const list = ranked('MUSEUM', 'LANDMARK', 'PARK', 'MUSEUM', 'LANDMARK', 'PARK');
    const interests = [...likes('museums-galleries'), ...dislikes('nature-parks')];

    // Both museums, then both landmarks; the parks are what the ceiling cuts.
    expect(selectAttractions(list, interests, 4)).toEqual([0, 3, 1, 4]);
  });

  it('falls back to editorial rank for a traveler with no interests recorded', () => {
    const list = ranked('MUSEUM', 'LANDMARK', 'PARK', 'MARKET');
    expect(selectAttractions(list, [], 3)).toEqual([0, 1, 2]);
  });

  it('still fills the selection for a traveler who dislikes every InterestCategory', () => {
    const list = ranked('MUSEUM', 'LANDMARK', 'PARK', 'MARKET');
    const everything = dislikes(...InterestCategory.options);

    expect(selectAttractions(list, everything, 3)).toEqual([0, 1, 2]);
  });

  it('yields a shorter selection rather than padding a city that holds few attractions', () => {
    const list = ranked('MUSEUM', 'PARK');
    const chosen = selectAttractions(list, likes('museums-galleries'), 6);

    expect(chosen).toEqual([0, 1]);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it('schedules nothing where there is no room for it', () => {
    const list = ranked('MUSEUM', 'PARK');
    expect(selectAttractions(list, [], 0)).toEqual([]);
    expect(selectAttractions(list, [], -1)).toEqual([]);
  });

  it('is deterministic for a given traveler and city', () => {
    const list = ranked('MUSEUM', 'LANDMARK', 'PARK', 'MARKET', 'RELIGIOUS');
    const interests = [...likes('shopping'), ...dislikes('nature-parks')];

    expect(selectAttractions(list, interests, 3)).toEqual(selectAttractions(list, interests, 3));
  });
});
