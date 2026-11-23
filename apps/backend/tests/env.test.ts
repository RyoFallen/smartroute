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

  it('accepts FLIGHT_PROVIDER=recorded with an optional session path', () => {
    process.env.FLIGHT_PROVIDER = 'recorded';
    process.env.RECORDED_FARES_SESSION = 'docs/benchmark/sessions/2026-11-01.json';
    const env = loadEnv();
    expect(env.FLIGHT_PROVIDER).toBe('recorded');
    expect(env.RECORDED_FARES_SESSION).toBe('docs/benchmark/sessions/2026-11-01.json');
    delete process.env.RECORDED_FARES_SESSION;
  });

  it('exits when FLIGHT_PROVIDER=duffel but DUFFEL_API_KEY is missing', () => {
    process.env.FLIGHT_PROVIDER = 'duffel';
    const spy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('exit called');
    }) as never);
    expect(() => loadEnv()).toThrow('exit called');
    spy.mockRestore();
  });

  it('defaults WALKING_PROVIDER to mock, so tests and CI never need a service', () => {
    expect(loadEnv().WALKING_PROVIDER).toBe('mock');
  });

  it('accepts WALKING_PROVIDER=osrm against the local container by default', () => {
    process.env.WALKING_PROVIDER = 'osrm';
    const env = loadEnv();
    expect(env.WALKING_PROVIDER).toBe('osrm');
    expect(env.OSRM_BASE_URL).toBe('http://localhost:5050');
  });

  it('exits when OSRM_BASE_URL omits its scheme, which `new URL` would accept', () => {
    process.env.WALKING_PROVIDER = 'osrm';
    process.env.OSRM_BASE_URL = 'localhost:5000';
    const spy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('exit called');
    }) as never);
    expect(() => loadEnv()).toThrow('exit called');
    spy.mockRestore();
  });
});
