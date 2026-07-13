import type { FastifyInstance } from 'fastify';
import { ReplaceInterestsRequest, UpdatePreferencesRequest } from '@smartroute/shared';
import { UserService } from '../services/users/index.js';

export async function usersRoute(app: FastifyInstance): Promise<void> {
  app.get('/users/me', { preHandler: [app.requireAuth] }, async (req) =>
    new UserService(app.prisma).getMe(req.userId),
  );

  app.put('/users/me', { preHandler: [app.requireAuth] }, async (req) => {
    const parsed = UpdatePreferencesRequest.parse(req.body);
    const profile = await new UserService(app.prisma).upsertPreferences(req.userId, parsed);
    return { profile };
  });

  app.put('/users/me/interests', { preHandler: [app.requireAuth] }, async (req) => {
    const parsed = ReplaceInterestsRequest.parse(req.body);
    const profile = await new UserService(app.prisma).replaceInterests(
      req.userId,
      parsed.interests,
    );
    return { profile };
  });

  app.delete('/users/me', { preHandler: [app.requireAuth] }, async (req, reply) => {
    await new UserService(app.prisma).deleteAccount(req.userId, app.clerk);
    return reply.status(204).send();
  });
}
