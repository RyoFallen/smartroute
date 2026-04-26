import { describe, it, expect } from 'vitest';
import { enumerateOrderings } from '../../../src/services/optimizer/enumerate.js';

describe('enumerateOrderings', () => {
  it('returns N! orderings with no constraints', () => {
    expect(enumerateOrderings(['A', 'B', 'C'])).toHaveLength(6);
  });
  it('pins startCity', () => {
    const out = enumerateOrderings(['A', 'B', 'C'], { startCity: 'B' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[0] === 'B')).toBe(true);
  });
  it('pins endCity', () => {
    const out = enumerateOrderings(['A', 'B', 'C'], { endCity: 'C' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[o.length - 1] === 'C')).toBe(true);
  });
  it('pins both', () => {
    const out = enumerateOrderings(['A', 'B', 'C', 'D'], { startCity: 'A', endCity: 'D' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[0] === 'A' && o[o.length - 1] === 'D')).toBe(true);
  });
});
