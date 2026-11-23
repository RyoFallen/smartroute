import type { FastifyInstance } from 'fastify';
import { OptimizeRequest } from '@smartroute/shared';
import { OptimizerService } from '../services/optimizer/index.js';
import { FlightService } from '../services/flights/index.js';
import { PriceCache } from '../services/flights/cache.js';

export async function optimizeRoute(app: FastifyInstance): Promise<void> {
  app.post('/optimize', { preHandler: [app.requireAuth] }, async (req) => {
    const parsed = OptimizeRequest.parse(req.body);
    const cache = new PriceCache(app.prisma);
    const flights = new FlightService(cache, app.flightProvider);
    const optimizer = new OptimizerService(flights);
    return { ...(await optimizer.optimize(parsed)), currency: app.flightProvider.currency };
  });
}
