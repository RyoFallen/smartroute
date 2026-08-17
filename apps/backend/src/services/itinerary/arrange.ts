/**
 * Choosing how a city's WalkingRoute is divided between the days of the stay.
 *
 * Each day takes a contiguous run from the front of the route, so an
 * arrangement is fully described by how many attractions each day takes. The
 * best one is found exactly, for every stay length, by dynamic programming over
 * (day, position in the route) — the same answer enumerating every division
 * would give, at a cost that stays polynomial instead of exploding.
 *
 * Enumeration was the obvious implementation and is the wrong one. The number of
 * divisions grows combinatorially in the number of days: fifteen attractions
 * over five days is 1,451 of them, over seven days 33,390, and a fortnight in
 * one city is millions. Any cap on that has to fall back to something, and the
 * something — filling each day to the brim in turn — is exactly the behaviour
 * this exists to replace. A week in Rome would have quietly reverted to three
 * busy days and four reading "nothing left to visit".
 */

/** How one day's share scores, once it is known to fit. */
export interface DayCost {
  /** Attractions actually scheduled. Never more than the share offered. */
  scheduled: number;
  /** Of those, how many fall on a day the attraction is shut. */
  conflicts: number;
  walkMinutes: number;
}

/**
 * What one day would cost if it took `take` attractions starting at `from`,
 * or null where they do not fit its SchedulableWindow.
 */
export type DayCostFn = (day: number, from: number, take: number) => DayCost | null;

/** The chosen share for each day, in order. */
export type Arrangement = number[];

interface Best {
  scheduled: number;
  conflicts: number;
  walkMinutes: number;
  lumpiness: number;
  takes: Arrangement;
}

/**
 * The best division of `total` attractions across `days`.
 *
 * Optimal substructure holds because every term is a sum over days: the best
 * arrangement of days d..end starting at route position p does not depend on how
 * the traveler got to p. That is what lets one table replace the whole
 * combinatorial space.
 */
export function bestArrangement(
  total: number,
  days: number,
  ceiling: number,
  costOf: DayCostFn,
): Arrangement {
  // best[day][from] — solved backwards, so each entry is already final when read.
  const best: Array<Array<Best | null>> = Array.from({ length: days + 1 }, () =>
    new Array<Best | null>(total + 1).fill(null),
  );
  for (let from = 0; from <= total; from++) {
    best[days]![from] = { scheduled: 0, conflicts: 0, walkMinutes: 0, lumpiness: 0, takes: [] };
  }

  for (let day = days - 1; day >= 0; day--) {
    for (let from = 0; from <= total; from++) {
      let winner: Best | null = null;
      // Descending, with strict improvement below, so an otherwise exact tie
      // keeps the larger share on the earlier day: a stay should start on its
      // first day rather than its second.
      for (let take = Math.min(ceiling, total - from); take >= 0; take--) {
        const cost = costOf(day, from, take);
        if (cost === null) continue;
        const rest = best[day + 1]![from + cost.scheduled];
        if (!rest) continue;
        const candidate: Best = {
          scheduled: cost.scheduled + rest.scheduled,
          conflicts: cost.conflicts + rest.conflicts,
          walkMinutes: cost.walkMinutes + rest.walkMinutes,
          lumpiness: cost.scheduled * cost.scheduled + rest.lumpiness,
          takes: [take, ...rest.takes],
        };
        if (winner === null || isBetter(candidate, winner)) winner = candidate;
      }
      best[day]![from] = winner;
    }
  }

  return best[0]![0]?.takes ?? new Array<number>(days).fill(ceiling);
}

/**
 * Coverage leads deliberately, and the ordering below it is not arbitrary.
 *
 * A day's share is a *cap*, not a quota — a day whose window cannot hold what it
 * was offered schedules less — so arrangements genuinely differ in how much of
 * the city the traveler is shown. Ranking closures above coverage would let the
 * generator quietly drop an attraction to avoid a locked door, which trades a
 * disclosed problem for a hidden one. A conflict it cannot design away is
 * flagged on the slot instead; that is what the flag is for.
 *
 * `walkMinutes` is the ticket's tie-break. The two below it exist because
 * walking alone is not merely arbitrary but biased: only the *second* visit of a
 * day onwards carries a walk — the first is reached from wherever the traveler
 * slept, which this model does not know — so every extra day used silently
 * removes a charge, and "least walking" therefore always favours spreading thin.
 * With a uniform matrix every equally-spread arrangement then ties and the
 * traversal order decides, which is how twelve attractions over three days came
 * out 1/5/6. `lumpiness` (sum of squared day sizes, smallest when the days are
 * most even) breaks that toward 4/4/4 — the same wart #27 recorded from the
 * other side, as 6/6/0.
 */
function isBetter(candidate: Best, incumbent: Best): boolean {
  if (candidate.scheduled !== incumbent.scheduled) {
    return candidate.scheduled > incumbent.scheduled;
  }
  if (candidate.conflicts !== incumbent.conflicts) {
    return candidate.conflicts < incumbent.conflicts;
  }
  if (candidate.walkMinutes !== incumbent.walkMinutes) {
    return candidate.walkMinutes < incumbent.walkMinutes;
  }
  return candidate.lumpiness < incumbent.lumpiness;
}
