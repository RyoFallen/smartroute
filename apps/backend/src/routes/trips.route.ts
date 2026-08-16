import type { FastifyInstance } from 'fastify';
import { CreateTripRequest } from '@smartroute/shared';
import { TripService } from '../services/trips/index.js';
import { PlanService } from '../services/plan/index.js';
import { ItineraryService } from '../services/itinerary/index.js';

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

  app.get<{ Params: { id: string } }>(
    '/trips/:id/plan',
    { preHandler: [app.requireAuth] },
    async (req) => new PlanService(app.prisma).planForTrip(req.userId, req.params.id),
  );

  app.get<{ Params: { id: string } }>(
    '/trips/:id/itinerary',
    { preHandler: [app.requireAuth] },
    async (req) =>
      new ItineraryService(app.prisma, app.walkingProvider, req.log).itineraryForTrip(
        req.userId,
        req.params.id,
      ),
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
