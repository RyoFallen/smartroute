import { describe, it, expect } from 'vitest';
import { AttractionCategory } from '@smartroute/shared';
import {
  DEFAULT_VISIT_MINUTES,
  visitMinutesFor,
} from '../../../src/services/plan/visit-duration.js';

describe('visitMinutesFor', () => {
  it('prefers an explicit curated value', () => {
    expect(visitMinutesFor('MUSEUM', 180)).toBe(180);
  });

  it('falls back to the category default when no value is curated', () => {
    expect(visitMinutesFor('MUSEUM', null)).toBe(DEFAULT_VISIT_MINUTES.MUSEUM);
    expect(visitMinutesFor('MUSEUM', undefined)).toBe(DEFAULT_VISIT_MINUTES.MUSEUM);
  });

  it('covers every AttractionCategory, so no category can silently have no default', () => {
    for (const category of AttractionCategory.options) {
      expect(DEFAULT_VISIT_MINUTES[category], category).toBeGreaterThan(0);
      expect(visitMinutesFor(category, null), category).toBeGreaterThan(0);
    }
  });

  it('treats a curated zero as absent rather than as a zero-length visit', () => {
    // A zero-minute visit is never meaningful; it can only be bad data.
    expect(visitMinutesFor('PARK', 0)).toBe(DEFAULT_VISIT_MINUTES.PARK);
  });

  it('gives enclosed, ticketed categories longer defaults than pass-through ones', () => {
    // The whole reason a per-category default is defensible: a museum visit and
    // walking past a landmark are not the same kind of stop.
    expect(DEFAULT_VISIT_MINUTES.MUSEUM).toBeGreaterThan(DEFAULT_VISIT_MINUTES.LANDMARK);
    expect(DEFAULT_VISIT_MINUTES.HISTORICAL).toBeGreaterThan(DEFAULT_VISIT_MINUTES.VIEWPOINT);
  });
});
