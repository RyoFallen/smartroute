import { describe, it, expect } from 'vitest';
import { MockWalkingDistanceProvider } from '../../../src/services/itinerary/walking.js';

const HAGIA_SOPHIA = { lat: 41.0086, lon: 28.9802 };
const BLUE_MOSQUE = { lat: 41.0054, lon: 28.9768 };
const GALATA_TOWER = { lat: 41.0256, lon: 28.9744 };

describe('MockWalkingDistanceProvider', () => {
  it('returns a square matrix with a zero diagonal', async () => {
    const matrix = await new MockWalkingDistanceProvider().matrix([
      HAGIA_SOPHIA,
      BLUE_MOSQUE,
      GALATA_TOWER,
    ]);

    expect(matrix).toHaveLength(3);
    expect(matrix.every((row) => row.length === 3)).toBe(true);
    expect(matrix.map((row, i) => row[i])).toEqual([0, 0, 0]);
  });

  it('is deterministic and symmetric', async () => {
    const provider = new MockWalkingDistanceProvider();
    const first = await provider.matrix([HAGIA_SOPHIA, GALATA_TOWER]);
    const second = await provider.matrix([HAGIA_SOPHIA, GALATA_TOWER]);

    expect(first).toEqual(second);
    expect(first[0]![1]).toBe(first[1]![0]);
  });

  it('costs at least a minute for any real walk, and more for a longer one', async () => {
    const matrix = await new MockWalkingDistanceProvider().matrix([
      HAGIA_SOPHIA,
      BLUE_MOSQUE,
      GALATA_TOWER,
    ]);

    expect(matrix[0]![1]).toBeGreaterThanOrEqual(1);
    // Galata Tower is across the Golden Horn; Blue Mosque is next door.
    expect(matrix[0]![2]).toBeGreaterThan(matrix[0]![1]!);
  });
});
