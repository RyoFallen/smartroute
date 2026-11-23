import fp from 'fastify-plugin';
import type { FlightProvider } from '../services/flights/provider.js';
import { MockFlightProvider } from '../services/flights/provider.js';
import { createDuffelClient } from '../services/flights/duffel/client.js';
import { DuffelFlightProvider } from '../services/flights/duffel/index.js';
import { loadRecordedSession } from '../services/benchmark/session.js';
import { RecordedFareProvider, resolveRecordedSessionPath } from '../services/flights/recorded.js';

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
    provider = new DuffelFlightProvider(duffel, app.log, app.prisma);
    app.log.info(
      { provider: 'duffel', basePath: basePath ?? 'https://api.duffel.com' },
      'flight provider selected',
    );
  } else if (which === 'recorded') {
    const file = resolveRecordedSessionPath(process.env.RECORDED_FARES_SESSION);
    const session = loadRecordedSession(file);
    provider = new RecordedFareProvider(session);
    app.log.info(
      { provider: 'recorded', session: session.date, file, currency: provider.currency },
      'flight provider selected',
    );
  } else if (which === 'mock') {
    provider = new MockFlightProvider();
    app.log.info({ provider: 'mock' }, 'flight provider selected');
  } else {
    // A typo must not quietly fall back to synthetic prices.
    throw new Error(`Unknown FLIGHT_PROVIDER "${which}" (expected mock, duffel or recorded)`);
  }

  app.decorate('flightProvider', provider);
});
