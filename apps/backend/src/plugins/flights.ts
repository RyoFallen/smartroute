import fp from 'fastify-plugin';
import type { FlightProvider } from '../services/flights/provider.js';
import { MockFlightProvider } from '../services/flights/provider.js';
import { createDuffelClient } from '../services/flights/duffel/client.js';
import { DuffelFlightProvider } from '../services/flights/duffel/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    flightProvider: FlightProvider;
  }
}

export const flightsPlugin = fp(async (app) => {
  const which = process.env.FLIGHT_PROVIDER ?? 'mock';
  let provider: FlightProvider;

  if (which === 'duffel') {
    const token = process.env.DUFFEL_API_KEY;
    if (!token) {
      throw new Error('FLIGHT_PROVIDER=duffel but DUFFEL_API_KEY is not set');
    }
    const basePath = process.env.DUFFEL_BASE_URL;
    const duffel = createDuffelClient({ token, basePath });
    provider = new DuffelFlightProvider(duffel, app.log);
    app.log.info(
      { provider: 'duffel', basePath: basePath ?? 'https://api.duffel.com' },
      'flight provider selected',
    );
  } else {
    provider = new MockFlightProvider();
    app.log.info({ provider: 'mock' }, 'flight provider selected');
  }

  app.decorate('flightProvider', provider);
});
