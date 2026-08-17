import { describe, it, expect, vi } from 'vitest';
import { OsrmWalkingDistanceProvider } from '../../../src/services/itinerary/osrm.js';
import { estimatedWalkMinutes } from '../../../src/services/itinerary/walking.js';

const SULEYMANIYE = { lat: 41.0165, lon: 28.9639 };
const GALATA_TOWER = { lat: 41.0256, lon: 28.9744 };

/** A `fetch` stand-in that records its calls and replies with one canned body. */
function stubFetch(body: unknown, init: { status?: number } = {}) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const OK = (durations: (number | null)[][]) => ({ code: 'Ok', durations });

describe('OsrmWalkingDistanceProvider', () => {
  it('asks the foot profile for a duration table, in OSRM lon,lat order', async () => {
    const { fn, calls } = stubFetch(
      OK([
        [0, 1980],
        [1980, 0],
      ]),
    );
    const provider = new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
    });

    await provider.matrix([SULEYMANIYE, GALATA_TOWER]);

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!);
    expect(url.origin).toBe('http://osrm:5000');
    // lon,lat — the reverse of every other coordinate in this codebase.
    expect(url.pathname).toBe('/table/v1/foot/28.9639,41.0165;28.9744,41.0256');
    expect(url.searchParams.get('annotations')).toBe('duration');
  });

  it('converts seconds to whole minutes, keeping a zero diagonal', async () => {
    const { fn } = stubFetch(
      OK([
        [0, 1980],
        [1974, 0],
      ]),
    );

    const matrix = await new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
    }).matrix([SULEYMANIYE, GALATA_TOWER]);

    expect(matrix).toEqual([
      [0, 33],
      // 32.9 minutes rounds up: a walk that exists is never shorter than the
      // clock says.
      [33, 0],
    ]);
  });

  it('never reports a real walk as instant', async () => {
    const { fn } = stubFetch(
      OK([
        [0, 4],
        [4, 0],
      ]),
    );

    const matrix = await new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
    }).matrix([SULEYMANIYE, GALATA_TOWER]);

    expect(matrix[0]![1]).toBe(1);
  });

  it('preserves an asymmetric table rather than averaging it', async () => {
    const { fn } = stubFetch(
      OK([
        [0, 600],
        [900, 0],
      ]),
    );

    const matrix = await new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
    }).matrix([SULEYMANIYE, GALATA_TOWER]);

    expect(matrix[0]![1]).toBe(10);
    expect(matrix[1]![0]).toBe(15);
  });

  it('falls back to the straight-line estimate for an unroutable pair', async () => {
    const { fn } = stubFetch(
      OK([
        [0, null],
        [null, 0],
      ]),
    );
    const warn = vi.fn();

    const matrix = await new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
      logger: { warn },
    }).matrix([SULEYMANIYE, GALATA_TOWER]);

    // The mock provider's estimate for the same pair — one unroutable
    // attraction degrades its own pair, it does not sink the Itinerary.
    expect(matrix[0]![1]).toBe(estimatedWalkMinutes(SULEYMANIYE, GALATA_TOWER));
    // Summarised once for the whole table, not once per cell.
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatchObject({ unroutable: 2, pairs: 2 });
  });

  it('makes no request at all for an empty or single coordinate list', async () => {
    const { fn, calls } = stubFetch(OK([[0]]));
    const provider = new OsrmWalkingDistanceProvider({
      baseUrl: 'http://osrm:5000',
      fetchFn: fn,
    });

    expect(await provider.matrix([])).toEqual([]);
    expect(await provider.matrix([SULEYMANIYE])).toEqual([[0]]);
    expect(calls).toEqual([]);
  });

  it('throws with context when OSRM answers with an error code', async () => {
    const { fn } = stubFetch({ code: 'NoTable', message: 'no route' });

    await expect(
      new OsrmWalkingDistanceProvider({ baseUrl: 'http://osrm:5000', fetchFn: fn }).matrix([
        SULEYMANIYE,
        GALATA_TOWER,
      ]),
    ).rejects.toThrow(/NoTable/);
  });

  it('throws when OSRM is unreachable rather than inventing distances', async () => {
    const fn = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    await expect(
      new OsrmWalkingDistanceProvider({ baseUrl: 'http://osrm:5000', fetchFn: fn }).matrix([
        SULEYMANIYE,
        GALATA_TOWER,
      ]),
    ).rejects.toThrow(/OSRM/);
  });

  it('throws when the table does not cover every requested pair', async () => {
    const { fn } = stubFetch(OK([[0, 600]]));

    await expect(
      new OsrmWalkingDistanceProvider({ baseUrl: 'http://osrm:5000', fetchFn: fn }).matrix([
        SULEYMANIYE,
        GALATA_TOWER,
      ]),
    ).rejects.toThrow(/2x2/);
  });

  it('refuses a request larger than OSRM will serve, before making it', async () => {
    const { fn, calls } = stubFetch(OK([[0]]));
    const points = Array.from({ length: 101 }, (_, i) => ({
      lat: 41 + i / 1000,
      lon: 29,
    }));

    await expect(
      new OsrmWalkingDistanceProvider({ baseUrl: 'http://osrm:5000', fetchFn: fn }).matrix(points),
    ).rejects.toThrow(/101/);
    expect(calls).toEqual([]);
  });
});
