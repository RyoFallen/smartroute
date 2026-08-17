import type { AttractionCategory, InterestEntry, InterestRating } from '@smartroute/shared';
import { ATTRACTION_TO_INTEREST_CATEGORY } from '@smartroute/shared';

/** All the selector needs to know about an Attraction: what it *is*. */
export interface RankableAttraction {
  category: AttractionCategory;
}

/**
 * How much the traveler wants to see one Attraction: +1 liked, 0 neutral, −1 disliked.
 *
 * The bridge from what an attraction *is* (AttractionCategory) to what a
 * traveler *likes* (InterestCategory) is `ATTRACTION_TO_INTEREST_CATEGORY` in
 * the shared package — deliberately the only such mapping in the codebase, so
 * the vocabulary the mobile onboarding deck collects and the vocabulary the
 * Itinerary ranks by cannot drift apart. A category the traveler never rated,
 * and one no InterestCategory covers, both come back neutral: absence of an
 * opinion is not a dislike.
 *
 * A linear scan rather than a prepared index: a traveler holds at most fifteen
 * Interests and a city at most fifteen Attractions, so the whole ranking is a
 * couple of hundred comparisons.
 */
export function interestRatingFor(
  category: AttractionCategory,
  interests: readonly InterestEntry[],
): InterestRating {
  const wanted = ATTRACTION_TO_INTEREST_CATEGORY[category];
  return interests.find((i) => i.category === wanted)?.rating ?? 0;
}

/**
 * Which Attractions of a city the traveler will actually be shown, in priority order.
 *
 * The TripIntensity ceiling makes a city's stay hold fewer Attractions than the
 * city offers, and this is what decides who is cut: liked InterestCategories
 * rank up, disliked rank down and so are dropped first, and editorial rank
 * breaks every tie. Two travelers with different Interests therefore open the
 * same saved Trip and get different Itineraries — which is the whole
 * personalisation claim, and until this function existed the Interests
 * collected during onboarding were stored and never read.
 *
 * The ceiling is a ceiling, not a quota: a city holding fewer Attractions than
 * `limit` yields a shorter selection, never a padded or repeated one.
 *
 * Priority order — not editorial rank — is the order the caller then hands to
 * the walking solver, so where two walks cost the same the attraction the
 * traveler wants more goes first. Order *within* a day is still the shortest
 * walking route's business; this decides who is on the list at all.
 *
 * @param attractions in editorial rank order, as the seed serves them
 * @param interests the traveler's ratings; empty means editorial rank alone decides
 * @param limit how many the stay has room for
 * @returns indices into `attractions`, most wanted first
 */
export function selectAttractions(
  attractions: readonly RankableAttraction[],
  interests: readonly InterestEntry[],
  limit: number,
): number[] {
  return (
    [...attractions.keys()]
      .map((index) => ({
        index,
        rating: interestRatingFor(attractions[index]!.category, interests),
      }))
      // Sorted explicitly on the index rather than leaning on sort stability, so
      // the tie-break is a stated rule the tests can hold us to.
      .sort((a, b) => b.rating - a.rating || a.index - b.index)
      .slice(0, Math.max(0, limit))
      .map((entry) => entry.index)
  );
}
