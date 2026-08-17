import { describe, it, expect } from 'vitest';
import { closedOn, weekdayOf } from '../../../src/services/itinerary/closures.js';

// 2026-07-13 is a Monday, so this week runs Mon..Sun across the 13th..19th.
const MONDAY = '2026-07-13';
const TUESDAY = '2026-07-14';
const WEDNESDAY = '2026-07-15';
const SUNDAY = '2026-07-19';

describe('weekdayOf', () => {
  it('reads the weekday off the calendar date itself', () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf(SUNDAY)).toBe(0);
  });

  it('does not depend on the process timezone', () => {
    // The whole itinerary is computed on each city's own wall clock, so a
    // machine in Auckland and one in Los Angeles must agree about which day of
    // the week a date is. Extremes either side of UTC.
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      const east = weekdayOf(TUESDAY);
      process.env.TZ = 'Pacific/Midway'; // UTC-11
      const west = weekdayOf(TUESDAY);
      expect(east).toBe(2);
      expect(west).toBe(2);
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('closedOn', () => {
  it('reports a weekly closure on the day it falls', () => {
    // The classic museum Monday.
    const hours = 'Tu-Su 09:00-18:00';
    expect(closedOn(hours, MONDAY)).toBe(true);
    expect(closedOn(hours, TUESDAY)).toBe(false);
  });

  it('never reports an always-open attraction as closed', () => {
    for (const date of [MONDAY, TUESDAY, SUNDAY]) {
      expect(closedOn('24/7', date)).toBe(false);
    }
  });

  it('never reports unknown hours as closed', () => {
    // Unknown is a gap in our data, not a fact about the attraction, and
    // guessing "closed" would drop it from days it is probably open on.
    // Disclosure of the assumption is #31's job, not a closure.
    expect(closedOn(null, MONDAY)).toBe(false);
  });

  it('handles a mid-week closure', () => {
    const hours = 'Mo-Tu,Th-Su 09:00-17:00';
    expect(closedOn(hours, WEDNESDAY)).toBe(true);
    expect(closedOn(hours, TUESDAY)).toBe(false);
  });

  it('treats a day with any opening at all as open', () => {
    // Split hours are still an open day; a traveler can visit in either half.
    expect(closedOn('Mo 09:00-12:00,14:00-18:00', MONDAY)).toBe(false);
  });

  it('reads an explicit date rule, not just the weekday', () => {
    // Curated data uses explicit dates instead of PH macros, which the seed
    // validator rejects — so those dates have to actually bite.
    const hours = 'Mo-Su 09:00-18:00; Jul 14 off';
    expect(closedOn(hours, TUESDAY)).toBe(true);
    expect(closedOn(hours, WEDNESDAY)).toBe(false);
  });

  it('treats an unparseable value as not closed rather than throwing', () => {
    // Seeding validates the grammar, so this should be unreachable. If it ever
    // is reached, refusing to schedule is a worse answer than scheduling
    // something the traveler can check for themselves.
    expect(closedOn('this is not opening_hours', MONDAY)).toBe(false);
  });

  it('gives the same answer whatever timezone the process runs in', () => {
    // The same guarantee `weekdayOf` carries, asserted on the function that is
    // actually used: a `Date.UTC`-built instant would evaluate the rule against
    // the wrong weekday at the extremes, and would pass a test that only ever
    // ran under one zone.
    const hours = 'Tu-Su 09:00-18:00';
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      expect(closedOn(hours, MONDAY)).toBe(true);
      expect(closedOn(hours, TUESDAY)).toBe(false);
      process.env.TZ = 'Pacific/Midway'; // UTC-11
      expect(closedOn(hours, MONDAY)).toBe(true);
      expect(closedOn(hours, TUESDAY)).toBe(false);
    } finally {
      process.env.TZ = original;
    }
  });
});
