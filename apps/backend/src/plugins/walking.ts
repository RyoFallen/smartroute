import fp from 'fastify-plugin';
import type { WalkingDistanceProvider } from '../services/itinerary/walking.js';
import { MockWalkingDistanceProvider } from '../services/itinerary/walking.js';
import { OsrmWalkingDistanceProvider } from '../services/itinerary/osrm.js';

declare module 'fastify' {
  interface FastifyInstance {
    walkingProvider: WalkingDistanceProvider;
  }
}

/** Matches the `OSRM_BASE_URL` default in `env.ts` and the compose port mapping. */
const DEFAULT_OSRM_BASE_URL = 'http://localhost:5050';

export const walkingPlugin = fp(async (app) => {
  const which = process.env.WALKING_PROVIDER ?? 'mock';
  let provider: WalkingDistanceProvider;

  if (which === 'osrm') {
    const baseUrl = process.env.OSRM_BASE_URL ?? DEFAULT_OSRM_BASE_URL;
    provider = new OsrmWalkingDistanceProvider({ baseUrl, logger: app.log });
    app.log.info({ provider: 'osrm', baseUrl }, 'walking distance provider selected');
  } else {
    provider = new MockWalkingDistanceProvider();
    app.log.info({ provider: 'mock' }, 'walking distance provider selected');
  }

  app.decorate('walkingProvider', provider);
});
