import { describe, it, expect } from 'vitest';
import { bestArrangement } from '../../../src/services/itinerary/arrange.js';
import type { DayCost, DayCostFn } from '../../../src/services/itinerary/arrange.js';

/** Every share fits, costs nothing, and conflicts with nothing. */
const free: DayCostFn = (_day, _from, take) => ({
  scheduled: take,
  conflicts: 0,
  outsideAssumed: 0,
  walkMinutes: 0,
});

/** Every share fits; `closed` names the days an attraction index is shut on. */
function withClosures(closed: Map<number, Set<number>>): DayCostFn {
  return (day, from, take) => {
    let conflicts = 0;
    for (let i = from; i < from + take; i++) {
      if (closed.get(i)?.has(day)) conflicts++;
    }
    return { scheduled: take, conflicts, outsideAssumed: 0, walkMinutes: 0 };
  };
}

describe('bestArrangement', () => {
  it('spreads evenly when nothing distinguishes the days', () => {
    expect(bestArrangement(12, 3, 6, free)).toEqual([4, 4, 4]);
  });

  it('keeps every attraction', () => {
    for (const days of [1, 2, 3, 5, 7]) {
      const takes = bestArrangement(12, days, 6, free);
      const total = takes.reduce((a, b) => a + b, 0);
      // 12 does not fit one day at a ceiling of 6, so only that case falls short.
      expect(total, `${days} days`).toBe(Math.min(12, days * 6));
    }
  });

  it('never gives a day more than the ceiling', () => {
    for (const take of bestArrangement(15, 4, 4, free)) {
      expect(take).toBeLessThanOrEqual(4);
    }
  });

  it('moves an attraction off the day it is shut', () => {
    // Attraction 0 is closed on day 0. Filling from the front would put it there.
    const takes = bestArrangement(4, 2, 4, withClosures(new Map([[0, new Set([0])]])));
    // Day 0 takes nothing, so attraction 0 lands on day 1 where it is open.
    expect(takes[0]).toBe(0);
    expect(takes.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('shows every attraction rather than hiding one to dodge a closure', () => {
    // Attraction 3 is shut on both days, so no arrangement clears it. Leaving it
    // out would score zero conflicts, and that is not the answer we want.
    const closed = new Map([[3, new Set([0, 1])]]);
    const takes = bestArrangement(4, 2, 2, withClosures(closed));
    expect(takes.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('prefers less walking once closures are equal', () => {
    // A day costs 100 for its second attraction onwards, so pairs are expensive
    // and singles are free — the arrangement should spread rather than pair up.
    const costly: DayCostFn = (_day, _from, take) => ({
      scheduled: take,
      conflicts: 0,
      outsideAssumed: 0,
      walkMinutes: Math.max(0, take - 1) * 100,
    });
    expect(bestArrangement(3, 3, 3, costly)).toEqual([1, 1, 1]);
  });

  it('fills earlier days first when everything else ties', () => {
    // Two attractions, three days, nothing to separate the arrangements: the
    // holiday should start on its first day.
    expect(bestArrangement(2, 3, 2, free)).toEqual([1, 1, 0]);
  });

  it('flows the whole route around a day that can hold nothing', () => {
    // Day 1 is wiped out — a dawn departure — so it schedules nothing whatever
    // it is offered. What matters is that its share is not *lost*: the visits
    // move on to the day after rather than falling off the end.
    const blocked: DayCostFn = (day, _from, take) =>
      day === 1
        ? { scheduled: 0, conflicts: 0, outsideAssumed: 0, walkMinutes: 0 }
        : { scheduled: take, conflicts: 0, outsideAssumed: 0, walkMinutes: 0 };

    const takes = bestArrangement(4, 3, 2, blocked);

    let from = 0;
    const landed = takes.map((take, day) => {
      const placed = blocked(day, from, take)!.scheduled;
      from += placed;
      return placed;
    });
    expect(landed[1]).toBe(0);
    expect(landed.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('is exact at a stay length no enumeration could reach', () => {
    // Fifteen attractions over fourteen days is millions of divisions. The DP
    // answers it in the same pass as any other, which is the whole point.
    const takes = bestArrangement(15, 14, 8, free);
    expect(takes.reduce((a, b) => a + b, 0)).toBe(15);
    expect(takes).toHaveLength(14);
  });

  it('returns the same arrangement every time', () => {
    const closed = new Map([
      [0, new Set([0])],
      [5, new Set([1])],
    ]);
    const once = bestArrangement(9, 3, 4, withClosures(closed));
    const twice = bestArrangement(9, 3, 4, withClosures(closed));
    expect(once).toEqual(twice);

    // Pinned, so a change of traversal order shows up here rather than silently
    // reshuffling every traveler's itinerary. Why this one: nine attractions at
    // a ceiling of four need every day, so day 0 always starts at index 0 and
    // attraction 0's day-0 closure is unavoidable — one conflict whatever
    // happens. Attraction 5's day-1 closure *is* avoidable, but only where days
    // 0 and 1 together take exactly five, leaving four for day 2. Of the four
    // arrangements that do, [2,3,4] and [3,2,4] are the most even, and the tie
    // between them goes to the fuller earlier day.
    expect(once).toEqual([3, 2, 4]);
  });

  it('asks about a share only in terms of where it starts and how big it is', () => {
    // The state the whole DP rests on: two arrangements reaching the same route
    // position on the same day are interchangeable from there.
    const seen: string[] = [];
    const spy: DayCostFn = (day, from, take) => {
      seen.push(`${day}/${from}/${take}`);
      return free(day, from, take) as DayCost;
    };
    bestArrangement(4, 2, 2, spy);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
