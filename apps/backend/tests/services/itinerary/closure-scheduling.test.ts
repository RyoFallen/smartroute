import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { generateItinerary } from '../../../src/services/itinerary/generate.js';
import type {
  ItineraryAttractionInput,
  ItineraryInput,
} from '../../../src/services/itinerary/generate.js';
import { MockWalkingDistanceProvider } from '../../../src/services/itinerary/walking.js';
import { SeedFile } from '../../../src/services/plan/seed-schema.js';

/**
 * Day assignment against weekly closures (#30).
 *
 * The dates below are chosen so the weekdays are readable: 2026-07-13 is a
 * Monday, so a three-day stay from the 13th runs Mon / Tue / Wed.
 */
const MONDAY = '2026-07-13';
const WEDNESDAY = '2026-07-15';

const CLOSED_MONDAYS = 'Tu-Su 09:00-18:00';
const CLOSED_TUESDAYS = 'We-Mo 09:00-18:00';

function uniformWalk(size: number, minutes = 10): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 0 : minutes)),
  );
}

function sight(
  n: number,
  openingHours: string | null = '24/7',
  visitMinutes = 60,
): ItineraryAttractionInput {
  return {
    id: `a${n}`,
    name: `Sight ${n}`,
    category: 'LANDMARK',
    lat: 41 + n / 100,
    lon: 28 + n / 100,
    description: 'A test attraction.',
    visitMinutes,
    openingHours,
  };
}

function input(
  attractions: ItineraryAttractionInput[],
  over: Partial<ItineraryInput> = {},
  walkMinutes?: number[][],
): ItineraryInput {
  return {
    tripId: 'trip_1',
    startDate: MONDAY,
    endDate: WEDNESDAY,
    wakeUpTime: '09:00',
    intensity: 'RELAXED', // ceiling of 4, so cuts have room to move
    cities: [
      {
        iata: 'IST',
        name: 'Istanbul',
        timezone: 'Europe/Istanbul',
        available: true,
        arriveAt: null,
        departAt: null,
        attractions,
        walkMinutes: walkMinutes ?? uniformWalk(attractions.length),
      },
    ],
    ...over,
  };
}

const daysOf = (result: ReturnType<typeof generateItinerary>) => result.cities[0]!.days;
const slotsOf = (result: ReturnType<typeof generateItinerary>) =>
  daysOf(result).flatMap((d) => d.slots);

describe('scheduling around weekly closures', () => {
  it('moves an attraction off the day it is closed', () => {
    // The headline case: a museum shut on Mondays, on a stay that has a Monday
    // in it. Some cut avoids it, so the returned Itinerary must be one.
    const result = generateItinerary(input([sight(1, CLOSED_MONDAYS), sight(2), sight(3)]));

    const monday = daysOf(result).find((d) => d.date === MONDAY)!;
    expect(monday.slots.map((s) => s.attractionId)).not.toContain('a1');
    expect(slotsOf(result).every((s) => !s.closedOnThisDay)).toBe(true);
  });

  it('schedules every attraction even while dodging a closure', () => {
    // Dropping the awkward attraction would trivially remove the conflict and
    // is not a solution — the traveler came to see it.
    const result = generateItinerary(input([sight(1, CLOSED_MONDAYS), sight(2), sight(3)]));

    expect(
      slotsOf(result)
        .map((s) => s.attractionId)
        .sort(),
    ).toEqual(['a1', 'a2', 'a3']);
  });

  it('resolves closures on different days at once', () => {
    const result = generateItinerary(
      input([sight(1, CLOSED_MONDAYS), sight(2, CLOSED_TUESDAYS), sight(3)]),
    );

    expect(slotsOf(result).every((s) => !s.closedOnThisDay)).toBe(true);
    expect(slotsOf(result)).toHaveLength(3);
  });

  it('never treats an always-open attraction as closed', () => {
    const result = generateItinerary(input([sight(1, '24/7'), sight(2, '24/7')]));
    expect(slotsOf(result).every((s) => !s.closedOnThisDay)).toBe(true);
  });

  it('never treats unknown hours as closed', () => {
    // Unknown is a gap in our data. Reading it as a closure would shuffle the
    // itinerary around a restriction nobody has evidence for.
    const result = generateItinerary(input([sight(1, null), sight(2, null)]));
    expect(slotsOf(result).every((s) => !s.closedOnThisDay)).toBe(true);
    expect(slotsOf(result)).toHaveLength(2);
  });

  it('flags a conflict it cannot design away rather than hiding it', () => {
    // A one-day stay on the Monday, and the attraction is shut on Mondays.
    // There is no cut that helps; the traveler has to be told.
    const result = generateItinerary(
      input([sight(1, CLOSED_MONDAYS)], { startDate: MONDAY, endDate: MONDAY }),
    );

    const slots = slotsOf(result);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.closedOnThisDay).toBe(true);
  });

  it('uses the calendar date of the day, not the position in the stay', () => {
    // Same attraction, same stay length, shifted by one day: the closure has to
    // follow the calendar rather than "day 1 of the stay".
    const mondayStart = generateItinerary(
      input([sight(1, CLOSED_MONDAYS)], { startDate: MONDAY, endDate: MONDAY }),
    );
    const tuesdayStart = generateItinerary(
      input([sight(1, CLOSED_MONDAYS)], { startDate: '2026-07-14', endDate: '2026-07-14' }),
    );

    expect(slotsOf(mondayStart)[0]!.closedOnThisDay).toBe(true);
    expect(slotsOf(tuesdayStart)[0]!.closedOnThisDay).toBe(false);
  });

  it('prefers less walking between arrangements that are equally clear of closures', () => {
    // A road-shaped city: 1-2 and 3-4 are neighbours, the pairs far apart. With
    // no closures in play the tie-break should keep each pair on one day rather
    // than splitting them across the stay.
    const far = 90;
    const near = 5;
    const walk = [
      [0, near, far, far],
      [near, 0, far, far],
      [far, far, 0, near],
      [far, far, near, 0],
    ];
    const result = generateItinerary(
      input([sight(1), sight(2), sight(3), sight(4)], { endDate: '2026-07-14' }, walk),
    );

    const days = daysOf(result).filter((d) => d.slots.length > 0);
    for (const day of days) {
      const walked = day.slots.reduce((sum, s) => sum + (s.walkMinutesFromPrevious ?? 0), 0);
      expect(walked, `day ${day.date} should not cross the city`).toBeLessThan(far);
    }
  });

  it('is deterministic', () => {
    const build = () =>
      generateItinerary(input([sight(1, CLOSED_MONDAYS), sight(2, CLOSED_TUESDAYS), sight(3)]));
    expect(build()).toEqual(build());
  });

  it('keeps Topkapı off a Tuesday, on the real seed data', async () => {
    // The only closures the curated dataset currently carries are Topkapı
    // (shut Tuesdays) and the Grand Bazaar (shut Sundays) — everything else is
    // open daily, always-open, or still unexamined (#25). Worth pinning
    // precisely because it is the one place this works on real data rather than
    // on a fixture built to make it work.
    const seed = SeedFile.parse(
      JSON.parse(
        readFileSync(new URL('../../../prisma/seed/attractions.json', import.meta.url), 'utf8'),
      ),
    );
    const istanbul = seed.find((c) => c.iata === 'IST')!;
    const hours = JSON.parse(
      readFileSync(new URL('../../../prisma/seed/opening-hours.osm.json', import.meta.url), 'utf8'),
    ) as { entries: Array<{ attraction: string; openingHours: string }> };
    const byName = new Map(hours.entries.map((e) => [e.attraction, e.openingHours]));

    const attractions: ItineraryAttractionInput[] = istanbul.attractions.map((a) => ({
      id: a.name,
      name: a.name,
      category: a.category,
      lat: a.lat,
      lon: a.lon,
      description: a.description,
      visitMinutes: a.visitMinutes ?? null,
      openingHours: byName.get(a.name) ?? null,
    }));
    const walkMinutes = await new MockWalkingDistanceProvider().matrix(attractions);

    // Mon 13th to Wed 15th, so the stay straddles the Tuesday it is shut.
    const result = generateItinerary(
      input(attractions, { startDate: MONDAY, endDate: WEDNESDAY }, walkMinutes),
    );

    const topkapi = 'Topkapı Palace';
    expect(byName.get(topkapi)).toBe('Mo, We-Su 09:00-18:00'); // pins the premise
    const scheduled = daysOf(result).flatMap((d) =>
      d.slots.map((s) => ({ date: d.date, id: s.attractionId })),
    );
    const placed = scheduled.find((s) => s.id === topkapi);
    expect(placed, 'Topkapı should be scheduled at all').toBeDefined();
    expect(placed!.date).not.toBe('2026-07-14'); // the Tuesday
    expect(slotsOf(result).filter((s) => s.closedOnThisDay)).toEqual([]);
  });

  it('says why a day the schedule deliberately left empty is empty', () => {
    // A cut may put nothing on a day in order to clear a closure elsewhere.
    // Reporting that as "the window was too short" would be a lie about a day
    // that was perfectly usable.
    const result = generateItinerary(
      input([sight(1, CLOSED_MONDAYS)], { startDate: MONDAY, endDate: '2026-07-14' }),
    );

    const monday = daysOf(result).find((d) => d.date === MONDAY)!;
    expect(monday.empty).toBe(true);
    expect(monday.emptyReason).toBe('SCHEDULED_AROUND_CLOSURES');
  });
});
