import type { FastifyInstance } from 'fastify';
import { CityService } from '../services/cities/index.js';

export async function citiesRoute(app: FastifyInstance): Promise<void> {
  app.get('/cities', { preHandler: [app.requireAuth] }, async () =>
    new CityService(app.prisma).list(),
  );
}
