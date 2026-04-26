import type { FastifyInstance } from 'fastify';
import { CreateTripRequest } from '@smartroute/shared';
import { TripService } from '../services/trips/index.js';

export async function tripsRoute(app: FastifyInstance): Promise<void> {
  app.post('/trips', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const parsed = CreateTripRequest.parse(req.body);
    const trip = await new TripService(app.prisma).create(req.userId, parsed);
    return reply.status(201).send(trip);
  });

  app.get('/trips', { preHandler: [app.requireAuth] }, async (req) =>
    new TripService(app.prisma).list(req.userId),
  );

  app.get<{ Params: { id: string } }>(
    '/trips/:id',
    { preHandler: [app.requireAuth] },
    async (req) => new TripService(app.prisma).findById(req.userId, req.params.id),
  );

  app.delete<{ Params: { id: string } }>(
    '/trips/:id',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      await new TripService(app.prisma).delete(req.userId, req.params.id);
      return reply.status(204).send();
    },
  );
}
