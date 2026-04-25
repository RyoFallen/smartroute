import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { healthRoute } from './routes/health.route.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(healthRoute);
  return app;
}
