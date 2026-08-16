export interface Coordinate {
  lat: number;
  lon: number;
}

/**
 * Pedestrian travel times between Attractions.
 *
 * The boundary exists so the Itinerary generator never learns where distances
 * come from: a self-hosted OSRM foot profile in production (ADR-0005), the
 * deterministic mock below everywhere else. Mirrors the FlightProvider
 * arrangement, and for the same reason — tests and CI must not need a service.
 */
export interface WalkingDistanceProvider {
  /**
   * Walking minutes for every ordered pair of `points`: `[from][to]`, with a
   * zero diagonal. Square and symmetric for the mock; OSRM may return a
   * slightly asymmetric matrix (one-way steps, bridges), which is why the
   * contract is a full matrix rather than an upper triangle.
   */
  matrix(points: Coordinate[]): Promise<number[][]>;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coordinate, b: Coordinate): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Average pedestrian speed, km/h — OSRM's own `foot` profile default. */
export const WALKING_SPEED_KMH = 5;

/**
 * Street networks are longer than straight lines. 1.3 is the mid-range of the
 * circuity factors reported for European city centres; it only has to make the
 * mock plausible, since the real figure comes from OSRM.
 */
export const DETOUR_FACTOR = 1.3;

/**
 * Straight-line distances inflated by a fixed detour factor.
 *
 * Deliberately crude: its job is to be *deterministic and dependency-free* so
 * every test and CI run gets the same Itinerary, not to be accurate. It will
 * happily walk across the Golden Horn — which is exactly why the OSRM
 * implementation exists.
 */
export class MockWalkingDistanceProvider implements WalkingDistanceProvider {
  async matrix(points: Coordinate[]): Promise<number[][]> {
    return points.map((from) =>
      points.map((to) => {
        const km = haversineKm(from, to) * DETOUR_FACTOR;
        if (km === 0) return 0;
        // Round up: a walk that exists never takes zero minutes.
        return Math.max(1, Math.ceil((km / WALKING_SPEED_KMH) * 60));
      }),
    );
  }
}
