import fp from 'fastify-plugin';
import { createClerkClient } from '@clerk/backend';
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { ApiError } from '../lib/ApiError.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: preHandlerHookHandler;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export const authPlugin = fp(async (app) => {
  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY ?? '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? '',
  });

  const requireAuth: preHandlerHookHandler = async (req: FastifyRequest, _reply: FastifyReply) => {
    const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(','));
    }
    const fetchReq = new Request(url, { method: req.method, headers });
    const result = await clerk.authenticateRequest(fetchReq);
    if (!result.isSignedIn) {
      throw new ApiError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const auth = result.toAuth();
    if (!auth?.userId) {
      throw new ApiError('UNAUTHORIZED', 'Authentication required', 401);
    }
    req.userId = auth.userId;
  };

  app.decorate('requireAuth', requireAuth);
  app.decorateRequest('userId', '');
});
