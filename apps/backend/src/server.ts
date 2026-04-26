import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { healthRoute } from './routes/health.route.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(errorHandlerPlugin);
  await app.register(healthRoute);
  return app;
}
