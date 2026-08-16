import fp from 'fastify-plugin';
import type { WalkingDistanceProvider } from '../services/itinerary/walking.js';
import { MockWalkingDistanceProvider } from '../services/itinerary/walking.js';

declare module 'fastify' {
  interface FastifyInstance {
    walkingProvider: WalkingDistanceProvider;
  }
}

export const walkingPlugin = fp(async (app) => {
  const which = process.env.WALKING_PROVIDER ?? 'mock';

  if (which === 'osrm') {
    // The seam is here so nothing downstream changes when the container lands;
    // failing loudly beats silently serving straight-line distances as if they
    // were pedestrian routes.
    throw new Error('WALKING_PROVIDER=osrm is not implemented yet');
  }

  app.log.info({ provider: 'mock' }, 'walking distance provider selected');
  app.decorate('walkingProvider', new MockWalkingDistanceProvider());
});
