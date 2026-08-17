/**
 * The largest city we will solve exactly.
 *
 * Held–Karp costs O(2^n · n²) time and O(2^n · n) doubles of memory, so the
 * bound is where "instant" stops being true: 15 nodes is ~7M operations over a
 * 3.9 MB table, 20 would be ~400M over 168 MB. The seed holds 10–15 attractions
 * per city and a seed-data test pins that, so the bound is a guarantee rather
 * than a hope — and `optimalWalkingRoute` throws rather than silently degrading
 * if it is ever broken, because a wrong-looking route is harder to notice than
 * a failure.
 */
export const MAX_EXACT_TOUR_NODES = 15;

/**
 * The shortest walking route through a city's attractions.
 *
 * This is a minimum-cost Hamiltonian **path**, not a cycle: the traveler is not
 * required to return to where they started, and charging them for a walk home
 * they will not take would distort every route. Both endpoints are therefore
 * free — the solver picks them.
 *
 * Solved exactly by Held–Karp dynamic programming, which is what lets the thesis
 * claim an optimal route rather than a good one: `g[mask][from]` is the cheapest
 * way to cover exactly the attractions in `mask` starting at `from`. The matrix
 * is read as directed (`[from][to]`), so an asymmetric OSRM matrix — one-way
 * steps, bridge ramps — is handled without special-casing.
 *
 * Ties are broken toward the lexicographically smallest route. Indices arrive in
 * the caller's priority order — Interest rating first, editorial rank breaking
 * that tie (see `selectAttractions`) — so where two walks cost the same the
 * attraction the traveler wants more goes first, and the result is stable for a
 * given matrix: the same Trip yields the same Itinerary every time the traveler
 * opens it.
 *
 * @param walkMinutes square matrix of walking minutes, `[from][to]`
 * @returns indices into that matrix, in the order they should be walked
 */
export function optimalWalkingRoute(walkMinutes: number[][]): number[] {
  const n = walkMinutes.length;
  if (n <= 1) return [...walkMinutes.keys()];
  if (n > MAX_EXACT_TOUR_NODES) {
    throw new Error(
      `Cannot solve ${n} attractions exactly: the exact walking route is bounded at ` +
        `${MAX_EXACT_TOUR_NODES} nodes`,
    );
  }

  const full = (1 << n) - 1;
  // g[mask * n + from]: cheapest walk covering `mask`, starting at `from`.
  const g = new Float64Array((full + 1) * n).fill(Infinity);
  for (let from = 0; from < n; from++) g[(1 << from) * n + from] = 0;

  // Ascending mask order is a valid evaluation order: dropping a bit only ever
  // makes the mask smaller, so every subproblem is solved before it is read.
  for (let mask = 1; mask <= full; mask++) {
    for (let from = 0; from < n; from++) {
      if ((mask & (1 << from)) === 0) continue;
      const rest = mask ^ (1 << from);
      if (rest === 0) continue;

      let best = Infinity;
      for (let to = 0; to < n; to++) {
        if ((rest & (1 << to)) === 0) continue;
        const cost = walkMinutes[from]![to]! + g[rest * n + to]!;
        if (cost < best) best = cost;
      }
      g[mask * n + from] = best;
    }
  }

  // Rebuilt forwards rather than by following parent pointers backwards: at
  // every step the lowest-numbered attraction among the equally-optimal
  // continuations wins, which is what makes the whole route the
  // lexicographically smallest optimum rather than merely one of them.
  const route: number[] = [];
  let mask = full;
  let from = lowestIndexMinimising(n, (start) => g[full * n + start]!);
  for (;;) {
    route.push(from);
    const rest = mask ^ (1 << from);
    if (rest === 0) return route;

    // By the DP recurrence the cheapest step out of `from` is exactly what
    // `g[mask][from]` already costed, so following the minimum here stays on an
    // optimal route — no need to re-derive it.
    const walkFromHere = walkMinutes[from]!;
    from = lowestIndexMinimising(n, (to) =>
      (rest & (1 << to)) === 0 ? Infinity : walkFromHere[to]! + g[rest * n + to]!,
    );
    mask = rest;
  }
}

/** The tie-break, in one place: among equal costs the lowest index wins. */
function lowestIndexMinimising(n: number, cost: (index: number) => number): number {
  let chosen = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const c = cost(i);
    if (c < best) {
      best = c;
      chosen = i;
    }
  }
  return chosen;
}
