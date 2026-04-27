import { airports, findAirport, AIRPORT_CODES } from '../../src/data/airports';

describe('airports', () => {
  it('contains at least 30 entries', () => {
    expect(AIRPORT_CODES.length).toBeGreaterThanOrEqual(30);
  });

  it('has unique IATA codes', () => {
    expect(new Set(AIRPORT_CODES).size).toBe(AIRPORT_CODES.length);
  });

  it('lat/lng are valid numbers', () => {
    for (const code of AIRPORT_CODES) {
      const a = airports[code]!;
      expect(a.lat).toBeGreaterThanOrEqual(-90);
      expect(a.lat).toBeLessThanOrEqual(90);
      expect(a.lng).toBeGreaterThanOrEqual(-180);
      expect(a.lng).toBeLessThanOrEqual(180);
    }
  });

  it('findAirport returns entry for known code', () => {
    expect(findAirport('JFK')?.name).toMatch(/Kennedy/i);
  });

  it('findAirport returns undefined for unknown', () => {
    expect(findAirport('ZZZ')).toBeUndefined();
  });
});
