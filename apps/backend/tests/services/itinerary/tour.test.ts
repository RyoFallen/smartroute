import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../../src/services/optimizer/ga.js';
import { MAX_EXACT_TOUR_NODES, optimalWalkingRoute } from '../../../src/services/itinerary/tour.js';

/**
 * Oracle: the shortest Hamiltonian path found by walking every permutation.
 *
 * Deliberately the dumbest correct implementation there is — the whole point of
 * an equivalence test is that the oracle be obviously right rather than fast.
 * It scores routes with its own cost function rather than borrowing one from
 * `tour.ts`, so a wrong answer cannot cancel out against a wrong scorer. Same
 * arrangement as the subset-sum-versus-enumerator test in the optimizer.
 */
function shortestByEnumeration(matrix: number[][]): number {
  let best = Infinity;
  for (const route of permute([...matrix.keys()])) {
    best = Math.min(best, walkedMinutes(matrix, route));
  }
  return best;
}

function walkedMinutes(matrix: number[][], route: number[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += matrix[route[i - 1]!]![route[i]!]!;
  return total;
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}

/** Symmetric matrix — what the mock provider and a well-behaved OSRM return. */
function symmetricMatrix(n: number, rng: () => number): number[][] {
  const m = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const minutes = 1 + Math.floor(rng() * 60);
      m[i]![j] = minutes;
      m[j]![i] = minutes;
    }
  }
  return m;
}

/** OSRM can disagree with itself across a pair — one-way steps, bridge ramps. */
function asymmetricMatrix(n: number, rng: () => number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : 1 + Math.floor(rng() * 60))),
  );
}

describe('optimalWalkingRoute', () => {
  it('matches the enumeration oracle on symmetric matrices (n=2..8)', () => {
    const rng = mulberry32(7);
    for (let n = 2; n <= 8; n++) {
      for (let trial = 0; trial < 5; trial++) {
        const matrix = symmetricMatrix(n, rng);
        const route = optimalWalkingRoute(matrix);

        expect(new Set(route), `n=${n} trial=${trial} visits every attraction once`).toEqual(
          new Set(matrix.keys()),
        );
        expect(walkedMinutes(matrix, route), `n=${n} trial=${trial}`).toBe(
          shortestByEnumeration(matrix),
        );
      }
    }
  });

  it('matches the enumeration oracle on asymmetric matrices (n=2..7)', () => {
    const rng = mulberry32(11);
    for (let n = 2; n <= 7; n++) {
      for (let trial = 0; trial < 5; trial++) {
        const matrix = asymmetricMatrix(n, rng);
        const route = optimalWalkingRoute(matrix);

        expect(new Set(route), `n=${n} trial=${trial} visits every attraction once`).toEqual(
          new Set(matrix.keys()),
        );
        expect(walkedMinutes(matrix, route), `n=${n} trial=${trial}`).toBe(
          shortestByEnumeration(matrix),
        );
      }
    }
  });

  it('is deterministic — the same matrix always yields the same route', () => {
    const matrix = symmetricMatrix(9, mulberry32(3));

    expect(optimalWalkingRoute(matrix)).toEqual(optimalWalkingRoute(matrix));
  });

  it('breaks ties by editorial rank, so equal-cost walks read in rank order', () => {
    // Every walk costs the same, so all 120 routes are optimal. Indices are
    // editorial rank, and the lexicographically smallest route is rank order.
    const uniform = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => (i === j ? 0 : 10)),
    );

    expect(optimalWalkingRoute(uniform)).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles the degenerate sizes', () => {
    expect(optimalWalkingRoute([])).toEqual([]);
    expect(optimalWalkingRoute([[0]])).toEqual([0]);
  });

  it('refuses a matrix too large to solve exactly, rather than hanging on it', () => {
    const n = MAX_EXACT_TOUR_NODES + 1;
    const tooBig = Array.from({ length: n }, () => Array.from({ length: n }, () => 1));

    expect(() => optimalWalkingRoute(tooBig)).toThrow(/exact/i);
  });

  it('stays negligible at the largest size we allow', () => {
    const matrix = symmetricMatrix(MAX_EXACT_TOUR_NODES, mulberry32(23));

    const started = performance.now();
    optimalWalkingRoute(matrix);

    // ~25 ms on a 2021 laptop. The bound is loose enough not to flake on a
    // loaded CI runner and tight enough that losing the DP — falling back to
    // anything factorial — blows straight through it.
    expect(performance.now() - started).toBeLessThan(250);
  });
});
