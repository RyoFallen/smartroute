import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { walkingPlugin } from '../../src/plugins/walking.js';
import { MockWalkingDistanceProvider } from '../../src/services/itinerary/walking.js';
import { OsrmWalkingDistanceProvider } from '../../src/services/itinerary/osrm.js';

async function decoratedProvider(): Promise<unknown> {
  const app = Fastify({ logger: false });
  await app.register(walkingPlugin);
  await app.ready();
  const provider = app.walkingProvider;
  await app.close();
  return provider;
}

describe('walkingPlugin', () => {
  const orig = { ...process.env };

  // Cleared before each case, not just after: running the suite with
  // `WALKING_PROVIDER=osrm` exported — which is exactly how the live OSRM test
  // is run — otherwise leaks that value into the "unset" case.
  beforeEach(() => {
    delete process.env.WALKING_PROVIDER;
    delete process.env.OSRM_BASE_URL;
  });

  afterEach(() => {
    process.env.WALKING_PROVIDER = orig.WALKING_PROVIDER;
    process.env.OSRM_BASE_URL = orig.OSRM_BASE_URL;
    if (orig.WALKING_PROVIDER === undefined) delete process.env.WALKING_PROVIDER;
    if (orig.OSRM_BASE_URL === undefined) delete process.env.OSRM_BASE_URL;
  });

  it('selects the mock when WALKING_PROVIDER is unset', async () => {
    expect(await decoratedProvider()).toBeInstanceOf(MockWalkingDistanceProvider);
  });

  it('selects the mock for WALKING_PROVIDER=mock', async () => {
    process.env.WALKING_PROVIDER = 'mock';
    expect(await decoratedProvider()).toBeInstanceOf(MockWalkingDistanceProvider);
  });

  it('selects OSRM for WALKING_PROVIDER=osrm', async () => {
    process.env.WALKING_PROVIDER = 'osrm';
    expect(await decoratedProvider()).toBeInstanceOf(OsrmWalkingDistanceProvider);
  });

  it('boots against OSRM without reaching the service', async () => {
    // Selection must not probe: the container may still be loading its graph
    // when the backend starts, and a health check at boot would make startup
    // order matter for no gain.
    process.env.WALKING_PROVIDER = 'osrm';
    process.env.OSRM_BASE_URL = 'http://127.0.0.1:1';
    await expect(decoratedProvider()).resolves.toBeInstanceOf(OsrmWalkingDistanceProvider);
  });
});
