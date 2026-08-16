import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { citiesRoute } from './routes/cities.route.js';
import { healthRoute } from './routes/health.route.js';
import { optimizeRoute } from './routes/optimize.route.js';
import { tripsRoute } from './routes/trips.route.js';
import { usersRoute } from './routes/users.route.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { flightsPlugin } from './plugins/flights.js';
import { walkingPlugin } from './plugins/walking.js';

export interface BuildOptions {
  withDb?: boolean;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  if (opts.withDb ?? Boolean(process.env.DATABASE_URL)) {
    await app.register(prismaPlugin);
    await app.register(flightsPlugin);
    await app.register(walkingPlugin);
    await app.register(optimizeRoute);
    await app.register(tripsRoute);
    await app.register(usersRoute);
    await app.register(citiesRoute);
  }
  await app.register(healthRoute);
  return app;
}
