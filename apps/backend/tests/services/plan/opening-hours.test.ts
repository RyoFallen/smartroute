import { describe, it, expect } from 'vitest';
import { assertValidOpeningHours } from '../../../src/services/plan/opening-hours.js';

describe('assertValidOpeningHours', () => {
  it('accepts a concrete weekly schedule', () => {
    expect(() => assertValidOpeningHours('Tu-Su 09:00-17:00', 'IST/Test')).not.toThrow();
  });

  it('accepts 24/7 — the marker for a genuinely unconstrained attraction', () => {
    expect(() => assertValidOpeningHours('24/7', 'IST/Test')).not.toThrow();
  });

  it('accepts multi-rule schedules with explicit closure dates', () => {
    const v = 'Mo,Th,Sa-Su 09:00-18:00; Tu off; We,Fr 09:00-21:00; Jan 01,Dec 25 off';
    expect(() => assertValidOpeningHours(v, 'CDG/Louvre')).not.toThrow();
  });

  it('accepts seasonal and sun-relative forms', () => {
    expect(() => assertValidOpeningHours('Mar-Oct Sa-Th 10:00-20:00', 'x')).not.toThrow();
    expect(() => assertValidOpeningHours('sunrise-sunset', 'WAW/Park')).not.toThrow();
  });

  it('accepts the real values sourced for the Istanbul attractions', () => {
    for (const v of [
      'Mo-Su 09:00-19:30',
      'Mo, We-Su 09:00-18:00',
      'Mo-Sa 9:00-19:00',
      'Mo-Sa 08:00-19:00; Su 09:30-19:00',
      '09:00-18:00',
    ]) {
      expect(() => assertValidOpeningHours(v, 'IST/x'), v).not.toThrow();
    }
  });

  it('rejects syntactic garbage', () => {
    expect(() => assertValidOpeningHours('totally not valid ~~~', 'IST/Bad')).toThrow();
  });

  it('rejects an empty value rather than treating it as unconstrained', () => {
    expect(() => assertValidOpeningHours('', 'IST/Bad')).toThrow();
  });

  it('rejects an out-of-range time', () => {
    expect(() => assertValidOpeningHours('Mo-Fr 99:00-17:00', 'IST/Bad')).toThrow();
  });

  it('rejects public-holiday macros, which are unevaluable for two of our countries', () => {
    // Not merely unsupported: even given a country code the parser cannot
    // evaluate PH for `tr` or `gb` (Istanbul and London). Accepting one would
    // store a value the closure checker could never evaluate, so it has to fail
    // here — loudly, at seed time — rather than at request time. Curated data
    // uses explicit dates instead (see the multi-rule case above).
    expect(() => assertValidOpeningHours('Mo-Fr 09:00-17:00; PH off', 'IST/Bad')).toThrow();
    expect(() => assertValidOpeningHours('Mo-Fr 09:00-17:00; SH off', 'IST/Bad')).toThrow();
  });

  it('throws a real Error carrying the context, not the library bare string', () => {
    // The upstream parser throws plain strings. Callers (the seed loader) rely on
    // Error semantics and need to know WHICH attraction failed.
    let caught: unknown;
    try {
      assertValidOpeningHours('nonsense ~~~', 'FCO/Colosseum');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('FCO/Colosseum');
  });
});
