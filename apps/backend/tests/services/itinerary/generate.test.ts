import { describe, it, expect } from 'vitest';
import {
  ARRIVAL_TRANSFER_MINUTES,
  DAY_END_MINUTES,
  DEPARTURE_AIRPORT_MINUTES,
  generateItinerary,
} from '../../../src/services/itinerary/generate.js';
import type {
  ItineraryAttractionInput,
  ItineraryCityInput,
  ItineraryInput,
} from '../../../src/services/itinerary/generate.js';

/** Every off-diagonal walk costs the same, so slot arithmetic stays readable. */
function uniformWalk(size: number, minutes = 10): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 0 : minutes)),
  );
}

function attractions(count: number, visitMinutes: number | null = 60): ItineraryAttractionInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i + 1}`,
    name: `Sight ${i + 1}`,
    category: 'LANDMARK' as const,
    lat: 41 + i / 100,
    lon: 28 + i / 100,
    description: 'A test attraction.',
    visitMinutes,
    openingHours: '24/7',
  }));
}

function availableCity(over: Partial<Extract<ItineraryCityInput, { available: true }>> = {}) {
  const list = over.attractions ?? attractions(3);
  return {
    iata: 'IST',
    name: 'Istanbul',
    timezone: 'Europe/Istanbul',
    available: true as const,
    arriveAt: null,
    departAt: null,
    walkMinutes: uniformWalk(list.length),
    ...over,
    attractions: list,
  };
}

function input(over: Partial<ItineraryInput> = {}): ItineraryInput {
  return {
    tripId: 'trip_1',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    wakeUpTime: '09:00',
    cities: [availableCity()],
    ...over,
  };
}

describe('generateItinerary', () => {
  it('breaks a stay into one ItineraryDay per calendar day, in visiting order', () => {
    const result = generateItinerary(
      input({
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        cities: [availableCity({ iata: 'IST' })],
      }),
    );

    expect(result.tripId).toBe('trip_1');
    expect(result.cities).toHaveLength(1);
    const days = result.cities[0]!.days;
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(days.map((d) => d.dayOfStay)).toEqual([1, 2, 3]);
  });

  it('gives each VisitSlot a start, an end and a VisitDuration', () => {
    const result = generateItinerary(input({ cities: [availableCity()] }));
    const slot = result.cities[0]!.days[0]!.slots[0]!;

    expect(slot).toMatchObject({
      attractionId: 'a1',
      name: 'Sight 1',
      category: 'LANDMARK',
      visitMinutes: 60,
      walkMinutesFromPrevious: null,
    });
    expect(slot.startsAt).toBe('2026-07-01T09:00:00+03:00');
    expect(slot.endsAt).toBe('2026-07-01T10:00:00+03:00');
  });

  it('charges the walk from the previous slot to the next start time', () => {
    const result = generateItinerary(input());
    const [first, second] = result.cities[0]!.days[0]!.slots;

    expect(first!.walkMinutesFromPrevious).toBeNull();
    expect(second!.walkMinutesFromPrevious).toBe(10);
    // 09:00 + 60 visit + 10 walk
    expect(second!.startsAt).toBe('2026-07-01T10:10:00+03:00');
  });

  it('computes times in each city own timezone', () => {
    const result = generateItinerary(
      input({
        cities: [
          availableCity({ iata: 'FCO', name: 'Rome', timezone: 'Europe/Rome' }),
          availableCity({ iata: 'IST' }),
        ],
      }),
    );

    expect(result.cities[0]!.days[0]!.slots[0]!.startsAt).toBe('2026-07-01T09:00:00+02:00');
    expect(result.cities[1]!.days[0]!.slots[0]!.startsAt).toBe('2026-07-01T09:00:00+03:00');
  });

  it('follows a city across a daylight-saving change mid-stay', () => {
    // Europe/Rome leaves CEST in the small hours of 2026-10-25.
    const result = generateItinerary(
      input({
        startDate: '2026-10-24',
        endDate: '2026-10-26',
        cities: [
          availableCity({
            iata: 'FCO',
            name: 'Rome',
            timezone: 'Europe/Rome',
            attractions: attractions(12),
            walkMinutes: uniformWalk(12),
          }),
        ],
      }),
    );

    const days = result.cities[0]!.days;
    expect(days[0]!.slots[0]!.startsAt).toBe('2026-10-24T09:00:00+02:00');
    expect(days[1]!.slots[0]!.startsAt).toBe('2026-10-25T09:00:00+01:00');
  });

  it('opens an arrival day after the flight lands plus the transfer buffer', () => {
    // 09:10Z = 12:10 in Istanbul; + 90 min transfer => 13:40.
    const result = generateItinerary(
      input({
        startDate: '2026-06-30',
        cities: [availableCity({ arriveAt: '2026-07-01T09:10:00.000Z' })],
      }),
    );

    expect(ARRIVAL_TRANSFER_MINUTES).toBe(90);
    const days = result.cities[0]!.days;
    expect(days[0]!.date).toBe('2026-07-01'); // the stay starts on landing, not on startDate
    expect(days[0]!.slots[0]!.startsAt).toBe('2026-07-01T13:40:00+03:00');
  });

  it('never opens a day before the traveler wake-up time', () => {
    // Lands 01:00Z = 04:00 local; + 90 = 05:30, which is before the 09:00 wake-up.
    const result = generateItinerary(
      input({ cities: [availableCity({ arriveAt: '2026-07-01T01:00:00.000Z' })] }),
    );

    expect(result.cities[0]!.days[0]!.slots[0]!.startsAt).toBe('2026-07-01T09:00:00+03:00');
  });

  it('closes a departure day before the flight leaves minus the airport buffer', () => {
    // 12:00Z = 15:00 local; - 180 min => must be done by 12:00 local.
    const result = generateItinerary(
      input({
        endDate: '2026-07-05',
        cities: [
          // Enough attractions that the full first day cannot exhaust them.
          availableCity({
            departAt: '2026-07-02T12:00:00.000Z',
            attractions: attractions(12),
            walkMinutes: uniformWalk(12),
          }),
          availableCity({ iata: 'FCO', name: 'Rome', timezone: 'Europe/Rome' }),
        ],
      }),
    );

    expect(DEPARTURE_AIRPORT_MINUTES).toBe(180);
    const days = result.cities[0]!.days;
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    // 09:00 + 60, then 10:00 + 10 walk + 60 = 11:10, and a third would end 12:20 > 12:00.
    expect(days[1]!.slots).toHaveLength(2);
    expect(days[1]!.slots.at(-1)!.endsAt).toBe('2026-07-02T11:10:00+03:00');
  });

  it('runs the final city stay to the trip end date', () => {
    const result = generateItinerary(
      input({
        endDate: '2026-07-04',
        cities: [
          availableCity({ departAt: '2026-07-02T06:00:00.000Z' }),
          availableCity({
            iata: 'FCO',
            name: 'Rome',
            timezone: 'Europe/Rome',
            arriveAt: '2026-07-02T08:00:00.000Z',
          }),
        ],
      }),
    );

    expect(result.cities[1]!.days.map((d) => d.date)).toEqual([
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('leaves a late arrival day empty rather than fabricating a schedule', () => {
    // Lands 19:40Z = 22:40 local; + 90 min transfer lands past the end of the day.
    const result = generateItinerary(
      input({
        endDate: '2026-07-02',
        cities: [availableCity({ arriveAt: '2026-07-01T19:40:00.000Z' })],
      }),
    );

    const arrivalDay = result.cities[0]!.days[0]!;
    expect(arrivalDay).toMatchObject({
      date: '2026-07-01',
      empty: true,
      emptyReason: 'ARRIVAL_TOO_LATE',
      slots: [],
    });
    // …and nothing is lost: the attractions move to the next day.
    expect(result.cities[0]!.days[1]!.slots.length).toBeGreaterThan(0);
  });

  it('blames a late arrival even when it leaves a real but unusable sliver of day', () => {
    // Lands 16:00Z = 19:00 local; + 90 min opens a genuine 20:30–21:00 window
    // that no visit fits into. The arrival is still what cost the traveler the day.
    const result = generateItinerary(
      input({
        endDate: '2026-07-02',
        cities: [availableCity({ arriveAt: '2026-07-01T16:00:00.000Z' })],
      }),
    );

    expect(result.cities[0]!.days[0]).toMatchObject({
      empty: true,
      emptyReason: 'ARRIVAL_TOO_LATE',
    });
  });

  it('rejects a walking matrix that does not cover the attractions', () => {
    expect(() =>
      generateItinerary(
        input({ cities: [availableCity({ attractions: attractions(3), walkMinutes: [] })] }),
      ),
    ).toThrow(/walking distance/i);
  });

  it('leaves an early departure day empty with its own reason', () => {
    // Leaves 04:00Z = 07:00 local; minus the airport buffer, the day is over
    // before the traveler wakes.
    const result = generateItinerary(
      input({
        endDate: '2026-07-05',
        cities: [
          availableCity({ departAt: '2026-07-02T04:00:00.000Z' }),
          availableCity({ iata: 'FCO', name: 'Rome', timezone: 'Europe/Rome' }),
        ],
      }),
    );

    expect(result.cities[0]!.days[1]).toMatchObject({
      empty: true,
      emptyReason: 'DEPARTURE_TOO_EARLY',
      slots: [],
    });
  });

  it('reports a window too short to hold the next visit', () => {
    // 09:00 to 21:00 is 720 minutes, so an 800-minute visit never fits.
    const result = generateItinerary(
      input({
        endDate: '2026-07-01',
        cities: [availableCity({ attractions: attractions(1, 800), walkMinutes: uniformWalk(1) })],
      }),
    );

    expect(DAY_END_MINUTES).toBe(21 * 60);
    expect(result.cities[0]!.days[0]).toMatchObject({
      empty: true,
      emptyReason: 'WINDOW_TOO_SHORT',
    });
  });

  it('admits exactly the visit that fits the window and no more', () => {
    // 09:00 wake-up to 21:00 day end is 720 minutes: one 720-minute visit fits.
    const result = generateItinerary(
      input({
        endDate: '2026-07-01',
        cities: [availableCity({ attractions: attractions(2, 720), walkMinutes: uniformWalk(2) })],
      }),
    );

    const day = result.cities[0]!.days[0]!;
    expect(day.slots).toHaveLength(1);
    expect(day.slots[0]!.endsAt).toBe('2026-07-01T21:00:00+03:00');
  });

  it('marks a day empty once every attraction is already scheduled', () => {
    const result = generateItinerary(
      input({
        endDate: '2026-07-03',
        cities: [availableCity({ attractions: attractions(1), walkMinutes: uniformWalk(1) })],
      }),
    );

    expect(result.cities[0]!.days[1]).toMatchObject({
      empty: true,
      emptyReason: 'NO_ATTRACTIONS_LEFT',
    });
  });

  it('schedules an attraction at most once across a city stay', () => {
    const result = generateItinerary(input({ endDate: '2026-07-05' }));
    const ids = result.cities[0]!.days.flatMap((d) => d.slots.map((s) => s.attractionId));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports a city with no attraction data as unavailable, with no days', () => {
    const result = generateItinerary(
      input({ cities: [availableCity(), { iata: 'JFK', available: false }] }),
    );

    expect(result.cities[1]).toEqual({ iata: 'JFK', name: null, available: false, days: [] });
  });

  it('falls back to the category VisitDuration when none is curated', () => {
    const result = generateItinerary(
      input({ cities: [availableCity({ attractions: attractions(3, null) })] }),
    );

    // DEFAULT_VISIT_MINUTES.LANDMARK
    expect(result.cities[0]!.days[0]!.slots[0]!.visitMinutes).toBe(30);
  });

  it('discloses an assumed opening window where the data has a gap', () => {
    const known = attractions(1)[0]!;
    const unknown = { ...attractions(1)[0]!, id: 'a2', name: 'Sight 2', openingHours: null };
    const result = generateItinerary(
      input({
        cities: [availableCity({ attractions: [known, unknown], walkMinutes: uniformWalk(2) })],
      }),
    );

    const slots = result.cities[0]!.days[0]!.slots;
    expect(slots[0]!.hoursAssumed).toBe(false);
    expect(slots[1]!.hoursAssumed).toBe(true);
  });

  it('is deterministic — the same input yields the same Itinerary', () => {
    const shared = input({ endDate: '2026-07-04' });
    expect(generateItinerary(shared)).toEqual(generateItinerary(shared));
  });
});
