import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BENCHMARK_AIRPORTS, BENCHMARK_CITIES } from '../../../src/services/benchmark/index.js';

describe('BENCHMARK_AIRPORTS', () => {
  it('gives every curated city an airport list that includes its own code', () => {
    expect(Object.keys(BENCHMARK_AIRPORTS).sort()).toEqual([...BENCHMARK_CITIES].sort());
    for (const city of BENCHMARK_CITIES) {
      expect(BENCHMARK_AIRPORTS[city].map((a) => a.iata)).toContain(city);
    }
  });

  it('never puts one airport in two cities', () => {
    const all = Object.values(BENCHMARK_AIRPORTS).flatMap((list) => list.map((a) => a.iata));
    expect(new Set(all).size).toBe(all.length);
  });

  // The protocol is what the operator reads during a session, so its table must
  // name exactly the airports the Nomad links search.
  it('matches the airport table in capture-protocol.md', () => {
    const protocol = readFileSync(
      new URL('../../../../../docs/benchmark/capture-protocol.md', import.meta.url),
      'utf8',
    );
    for (const city of BENCHMARK_CITIES) {
      const row = protocol.split('\n').find((line) => line.includes(`(\`${city}\`)`));
      expect(row, `no protocol row for ${city}`).toBeDefined();
      const listed = [...row!.split('|')[2]!.matchAll(/\b([A-Z]{3}) \d+/g)].map((m) => m[1]);
      expect(listed).toEqual(BENCHMARK_AIRPORTS[city].map((a) => a.iata));
    }
  });
});
