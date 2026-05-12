import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadEnv } from '../src/env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/z?schema=public',
};

describe('env', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, REQUIRED);
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, orig);
  });

  it('defaults FLIGHT_PROVIDER to mock and accepts no DUFFEL_API_KEY', () => {
    const env = loadEnv();
    expect(env.FLIGHT_PROVIDER).toBe('mock');
    expect(env.DUFFEL_API_KEY).toBeUndefined();
  });

  it('accepts FLIGHT_PROVIDER=duffel when DUFFEL_API_KEY is set', () => {
    process.env.FLIGHT_PROVIDER = 'duffel';
    process.env.DUFFEL_API_KEY = 'duffel_test_abc';
    const env = loadEnv();
    expect(env.FLIGHT_PROVIDER).toBe('duffel');
    expect(env.DUFFEL_API_KEY).toBe('duffel_test_abc');
  });

  it('exits when FLIGHT_PROVIDER=duffel but DUFFEL_API_KEY is missing', () => {
    process.env.FLIGHT_PROVIDER = 'duffel';
    const exit = process.exit as unknown as (code?: number) => never;
    const spy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit called');
    }) as typeof exit);
    expect(() => loadEnv()).toThrow('exit called');
    spy.mockRestore();
  });
});
