import type { Coordinate, WalkingDistanceProvider } from './walking.js';
import { estimatedWalkMinutes } from './walking.js';

/**
 * OSRM's own default for `--max-table-size`, and the value `docker-compose.yml`
 * passes explicitly so the two cannot drift apart. Asking for more comes back as
 * a `TooBig` error, so we check first and say which number was refused —
 * SmartRoute never needs more than `MAX_EXACT_TOUR_NODES` anyway, and hitting
 * this means something upstream stopped capping.
 */
export const OSRM_MAX_TABLE_SIZE = 100;

/** Long enough for a cold table on a city extract; short enough to fail a request. */
export const OSRM_TIMEOUT_MS = 10_000;

/** The subset of `FastifyBaseLogger` this provider needs. */
interface WarnLogger {
  warn(obj: object, msg: string): void;
}

export interface OsrmOptions {
  /** Root of the `osrm-routed` HTTP service, e.g. `http://localhost:5000`. */
  baseUrl: string;
  fetchFn?: typeof fetch;
  logger?: WarnLogger;
  timeoutMs?: number;
}

interface OsrmTableResponse {
  code?: string;
  message?: string;
  durations?: (number | null)[][];
}

/**
 * Real pedestrian travel times from a self-hosted OSRM foot profile (ADR-0005).
 *
 * Everything the Itinerary generator sees is identical to the mock's output —
 * whole minutes, zero diagonal, at least one minute for any walk that exists —
 * so switching providers changes the numbers and nothing else. What it buys is
 * that the numbers follow streets and bridges: the mock will happily walk
 * straight across Istanbul's Golden Horn.
 *
 * The matrix is deliberately not forced symmetric. OSRM returns genuinely
 * different durations in each direction where one-way steps or a bridge
 * approach differ, and `optimalWalkingRoute` reads the matrix as directed
 * precisely so that asymmetry survives.
 */
export class OsrmWalkingDistanceProvider implements WalkingDistanceProvider {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: WarnLogger | undefined;
  private readonly timeoutMs: number;

  constructor(opts: OsrmOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchFn = opts.fetchFn ?? fetch;
    this.logger = opts.logger;
    this.timeoutMs = opts.timeoutMs ?? OSRM_TIMEOUT_MS;
  }

  async matrix(points: Coordinate[]): Promise<number[][]> {
    // A table of one is the zero diagonal and nothing else, and a table of none
    // is empty — neither is worth a round trip, and OSRM rejects the empty one.
    if (points.length === 0) return [];
    if (points.length === 1) return [[0]];
    if (points.length > OSRM_MAX_TABLE_SIZE) {
      throw new Error(
        `OSRM table request of ${points.length} coordinates exceeds the service limit of ${OSRM_MAX_TABLE_SIZE}`,
      );
    }

    const durations = await this.requestTable(points);
    if (
      durations.length !== points.length ||
      durations.some((row) => row.length !== points.length)
    ) {
      throw new Error(
        `OSRM returned a table that is not ${points.length}x${points.length} as requested`,
      );
    }

    // A `null` duration means OSRM could not route the pair at all — typically
    // an attraction snapped to a pedestrian island, or a coordinate just outside
    // the clipped extract. Degrading that one pair to the mock's own estimate is
    // deliberate: the alternative is failing a whole Itinerary over a single
    // unreachable attraction.
    let unroutable = 0;
    const matrix = durations.map((row, from) =>
      row.map((seconds, to) => {
        if (from === to) return 0;
        if (seconds === null) {
          unroutable++;
          return estimatedWalkMinutes(points[from]!, points[to]!);
        }
        return minutesFromSeconds(seconds);
      }),
    );

    // One line per table, not per cell: a single unreachable attraction in a
    // twelve-attraction city accounts for 22 of them on its own.
    if (unroutable > 0) {
      this.logger?.warn(
        { unroutable, pairs: points.length * (points.length - 1), points },
        'OSRM found no pedestrian route for some attraction pairs; those pairs fell back to a straight-line estimate',
      );
    }
    return matrix;
  }

  private async requestTable(points: Coordinate[]): Promise<(number | null)[][]> {
    // OSRM speaks lon,lat — the reverse of the lat/lon order used everywhere
    // else in this codebase, including the `Coordinate` it is handed.
    const coords = points.map((p) => `${p.lon},${p.lat}`).join(';');
    const url = `${this.baseUrl}/table/v1/foot/${coords}?annotations=duration`;

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      throw new Error(`OSRM request failed: ${errorMessage(err)}`, { cause: err });
    }

    if (!response.ok) {
      throw new Error(`OSRM responded ${response.status} ${response.statusText}`);
    }

    let body: OsrmTableResponse;
    try {
      body = (await response.json()) as OsrmTableResponse;
    } catch (err) {
      throw new Error(`OSRM returned a body that is not JSON: ${errorMessage(err)}`, {
        cause: err,
      });
    }

    if (body.code !== 'Ok' || !Array.isArray(body.durations)) {
      throw new Error(`OSRM table request rejected: ${body.code ?? 'no code'}`);
    }
    return body.durations;
  }
}

/** Whole minutes, rounded up, and never zero for a walk that exists. */
function minutesFromSeconds(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
