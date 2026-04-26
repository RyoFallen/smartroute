# Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SmartRoute backend domain core: shared Zod contract, Clerk JWT auth, Prisma lifecycle, flight provider + cache, optimizer (scoring + enumeration + top-K), trips CRUD, and a uniform error envelope — all behind a real `POST /optimize` and full `/trips` API on top of the Plan 1 foundation.

**Architecture:** Pure-function optimizer & scoring (no I/O), thin Fastify routes that call services, JSONB-snapshot saved trips, Postgres-backed flight price cache with stale-fallback + partial-success semantics. Clerk owns identity; backend only verifies JWTs via JWKS. Zod is the single source of truth — all request/response shapes live in `packages/shared` and are reused by mobile in Plan 3.

**Tech Stack:** Node 22, Fastify 4, Prisma 6 (Postgres 16), Zod 3, `@clerk/backend` for JWT verification, Vitest, msw, Pino.

---

## Plan 1 Carry-Over Prerequisites

Two issues flagged by the Plan 1 whole-branch review must be resolved before any backend boot code lands. Task 1 handles both.

1. Backend has no env loader — `process.env.DATABASE_URL` will be undefined when `PrismaClient` instantiates.
2. `apps/backend/tsconfig.json` has `rootDir: "./src"` which will reject importing `@smartroute/shared`'s source files. We need TypeScript project references so imports resolve and stay typed without compiling shared into a separate `dist`.

## File Structure

```
packages/shared/src/
├── index.ts                       # re-exports
├── errors.ts                      # ErrorCode enum + ApiError schema
├── flights.ts                     # FlightLeg, CabinClass
├── routes.ts                      # RouteOption, Score
├── optimize.ts                    # OptimizeRequest, OptimizeResponse
└── trips.ts                       # Trip, CreateTripRequest

apps/backend/src/
├── index.ts                       # boot (already exists; updated)
├── server.ts                      # Fastify factory (already exists; extended)
├── env.ts                         # parsed env (zod-validated)
├── plugins/
│   ├── prisma.ts                  # decorates app.prisma + onClose
│   ├── auth.ts                    # Clerk JWT verifier; decorates request.userId
│   └── error-handler.ts           # uniform ApiError envelope
├── routes/
│   ├── health.route.ts            # already exists
│   ├── optimize.route.ts          # POST /optimize
│   └── trips.route.ts             # POST/GET/GET:id/DELETE /trips
├── services/
│   ├── flights/
│   │   ├── provider.ts            # FlightProvider interface + MockProvider
│   │   ├── cache.ts               # PriceCache (Prisma-backed)
│   │   └── index.ts               # FlightService (orchestrates cache + provider)
│   ├── optimizer/
│   │   ├── score.ts               # pure scoring
│   │   ├── enumerate.ts           # ordering enumeration
│   │   └── index.ts               # OptimizerService
│   └── trips/
│       └── index.ts               # TripService
└── lib/
    └── ApiError.ts                # throwable class mapping to envelope

apps/backend/tests/                # mirrors src/ paths
```

---

### Task 1: Prerequisites — env loading + TS project references

**Files:**
- Modify: `apps/backend/package.json` (add `dotenv` dep, change dev/start scripts)
- Modify: `apps/backend/tsconfig.json` (add reference to shared)
- Modify: `packages/shared/tsconfig.json` (mark composite)
- Create: `apps/backend/src/env.ts`
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Add dotenv to backend**

```bash
pnpm --filter @smartroute/backend add dotenv@^16.4.5
```

- [ ] **Step 2: Create `apps/backend/src/env.ts`**

```typescript
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof Env>;

export function loadEnv(): AppEnv {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
```

Add zod to backend if it isn't there yet:

```bash
pnpm --filter @smartroute/backend add zod@^3.23.8
```

- [ ] **Step 3: Load dotenv in `apps/backend/src/index.ts`**

Replace the file contents:

```typescript
import 'dotenv/config';
import { buildServer } from './server.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = await buildServer();
await app.listen({ port: env.PORT, host: env.HOST });
```

- [ ] **Step 4: Mark shared as composite in `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Reference shared from backend in `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck`
Expected: pass with zero errors.

Run: `pnpm --filter @smartroute/backend test`
Expected: 1 passing health test.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/package.json apps/backend/tsconfig.json apps/backend/src/env.ts apps/backend/src/index.ts packages/shared/tsconfig.json pnpm-lock.yaml
git commit -m "feat(backend): add env loading and shared tsconfig project references"
```

---

### Task 2: Error envelope + `ErrorCode` in shared

**Files:**
- Create: `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add zod to shared**

```bash
pnpm --filter @smartroute/shared add zod@^3.23.8
```

- [ ] **Step 2: Write `packages/shared/src/errors.ts`**

```typescript
import { z } from 'zod';

export const ErrorCode = z.enum([
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'FLIGHT_API_TIMEOUT',
  'FLIGHT_API_UNAVAILABLE',
  'FLIGHT_API_NO_RESULTS',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
```

- [ ] **Step 3: Re-export from `packages/shared/src/index.ts`**

```typescript
export const SHARED_VERSION = '0.0.0';
export * from './errors.js';
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/errors.ts packages/shared/src/index.ts packages/shared/package.json pnpm-lock.yaml
git commit -m "feat(shared): add ApiError envelope and ErrorCode enum"
```

---

### Task 3: Domain Zod schemas in shared (flights, routes, optimize, trips)

**Files:**
- Create: `packages/shared/src/flights.ts`
- Create: `packages/shared/src/routes.ts`
- Create: `packages/shared/src/optimize.ts`
- Create: `packages/shared/src/trips.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/flights.ts`**

```typescript
import { z } from 'zod';

export const CabinClass = z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']);
export type CabinClass = z.infer<typeof CabinClass>;

export const Iata = z.string().length(3).regex(/^[A-Z]{3}$/);

export const FlightLeg = z.object({
  origin: Iata,
  destination: Iata,
  depart: z.string().datetime(),
  arrive: z.string().datetime(),
  carrier: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  durationMin: z.number().int().positive(),
  stops: z.number().int().nonnegative(),
});
export type FlightLeg = z.infer<typeof FlightLeg>;
```

- [ ] **Step 2: Write `packages/shared/src/routes.ts`**

```typescript
import { z } from 'zod';
import { FlightLeg, Iata } from './flights.js';

export const RouteLabel = z.enum(['cheapest', 'fastest', 'most_direct']);
export type RouteLabel = z.infer<typeof RouteLabel>;

export const Score = z.object({
  totalCostCents: z.number().int().nonnegative(),
  totalDurationMin: z.number().int().nonnegative(),
  totalStops: z.number().int().nonnegative(),
  composite: z.number(),
});
export type Score = z.infer<typeof Score>;

export const RouteOption = z.object({
  label: RouteLabel,
  cities: z.array(Iata).min(2).max(8),
  legs: z.array(FlightLeg),
  score: Score,
});
export type RouteOption = z.infer<typeof RouteOption>;
```

- [ ] **Step 3: Write `packages/shared/src/optimize.ts`**

```typescript
import { z } from 'zod';
import { CabinClass, Iata } from './flights.js';
import { RouteOption } from './routes.js';

export const OptimizeRequest = z
  .object({
    cities: z.array(Iata).min(2).max(8),
    startCity: Iata.optional(),
    endCity: Iata.optional(),
    departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    perCityDays: z.array(z.number().int().min(1).max(30)),
    travelers: z.number().int().min(1).max(9),
    cabinClass: CabinClass,
    directOnly: z.boolean().default(false),
  })
  .refine((v) => v.perCityDays.length === v.cities.length, {
    message: 'perCityDays length must match cities length',
    path: ['perCityDays'],
  })
  .refine((v) => !v.startCity || v.cities.includes(v.startCity), {
    message: 'startCity must be in cities',
    path: ['startCity'],
  })
  .refine((v) => !v.endCity || v.cities.includes(v.endCity), {
    message: 'endCity must be in cities',
    path: ['endCity'],
  });
export type OptimizeRequest = z.infer<typeof OptimizeRequest>;

export const OptimizeResponse = z.object({
  options: z.array(RouteOption),
  partial: z.boolean().optional(),
  staleCache: z.boolean().optional(),
  reason: z.string().optional(),
});
export type OptimizeResponse = z.infer<typeof OptimizeResponse>;
```

- [ ] **Step 4: Write `packages/shared/src/trips.ts`**

```typescript
import { z } from 'zod';
import { CabinClass, FlightLeg, Iata } from './flights.js';

export const Trip = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  cabinClass: CabinClass,
  travelers: z.number().int().min(1).max(9),
  cities: z.array(Iata).min(2).max(8),
  flights: z.array(FlightLeg),
  totalPriceCents: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof Trip>;

export const CreateTripRequest = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  cabinClass: CabinClass,
  travelers: z.number().int().min(1).max(9),
  cities: z.array(Iata).min(2).max(8),
  flights: z.array(FlightLeg),
  totalPriceCents: z.number().int().nonnegative(),
});
export type CreateTripRequest = z.infer<typeof CreateTripRequest>;
```

- [ ] **Step 5: Update `packages/shared/src/index.ts`**

```typescript
export const SHARED_VERSION = '0.0.0';
export * from './errors.js';
export * from './flights.js';
export * from './routes.js';
export * from './optimize.js';
export * from './trips.js';
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add flight, route, optimize, and trip Zod schemas"
```

---

### Task 4: Throwable `ApiError` class + global error handler plugin

**Files:**
- Create: `apps/backend/src/lib/ApiError.ts`
- Create: `apps/backend/src/plugins/error-handler.ts`
- Create: `apps/backend/tests/error-handler.test.ts`

- [ ] **Step 1: Write the failing test `apps/backend/tests/error-handler.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';
import { ApiError } from '../src/lib/ApiError.js';

describe('error handler', () => {
  it('maps ApiError to envelope with proper status', async () => {
    const app = await buildServer();
    app.get('/boom', async () => {
      throw new ApiError('NOT_FOUND', 'gone', 404);
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'gone' },
    });
  });

  it('maps ZodError to INVALID_INPUT 400', async () => {
    const app = await buildServer();
    const { z } = await import('zod');
    app.get('/zod', async () => {
      z.object({ x: z.string() }).parse({});
    });
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
  });

  it('maps unknown errors to INTERNAL_ERROR 500', async () => {
    const app = await buildServer();
    app.get('/unknown', async () => {
      throw new Error('kaboom');
    });
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `pnpm --filter @smartroute/backend test`
Expected: 3 failures (ApiError module not found).

- [ ] **Step 3: Implement `apps/backend/src/lib/ApiError.ts`**

```typescript
import type { ErrorCode } from '@smartroute/shared';

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 4: Implement `apps/backend/src/plugins/error-handler.ts`**

```typescript
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { ApiError } from '../lib/ApiError.js';

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: 'Validation failed',
          details: { issues: err.flatten().fieldErrors },
        },
      });
    }
    app.log.error({ err }, 'unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });
});
```

- [ ] **Step 5: Add `fastify-plugin` and register in `apps/backend/src/server.ts`**

```bash
pnpm --filter @smartroute/backend add fastify-plugin@^4.5.1
```

Update `server.ts`:

```typescript
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
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @smartroute/backend test`
Expected: 4 passing (health + 3 error-handler).

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add ApiError class and global error handler plugin"
```

---

### Task 5: Prisma plugin

**Files:**
- Create: `apps/backend/src/plugins/prisma.ts`
- Modify: `apps/backend/src/server.ts`

- [ ] **Step 1: Write `apps/backend/src/plugins/prisma.ts`**

```typescript
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Register in `server.ts`** (only when `DATABASE_URL` is set, so health tests don't need a DB)

```typescript
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { healthRoute } from './routes/health.route.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { prismaPlugin } from './plugins/prisma.js';

export interface BuildOptions {
  withDb?: boolean;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(errorHandlerPlugin);
  if (opts.withDb ?? Boolean(process.env.DATABASE_URL)) {
    await app.register(prismaPlugin);
  }
  await app.register(healthRoute);
  return app;
}
```

- [ ] **Step 3: Update `index.ts`** so prod boot uses DB:

```typescript
import 'dotenv/config';
import { buildServer } from './server.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = await buildServer({ withDb: true });
await app.listen({ port: env.PORT, host: env.HOST });
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @smartroute/backend test`
Expected: still 4 passing (no DB needed for current tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add Prisma lifecycle plugin"
```

---

### Task 6: Clerk JWT auth plugin

**Files:**
- Create: `apps/backend/src/plugins/auth.ts`
- Create: `apps/backend/tests/auth.test.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/src/env.ts` (already has CLERK_* keys)

- [ ] **Step 1: Add Clerk SDK**

```bash
pnpm --filter @smartroute/backend add @clerk/backend@^1.13.0
```

- [ ] **Step 2: Write the failing test `apps/backend/tests/auth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth === 'Bearer good') {
        return { isAuthenticated: true, toAuth: () => ({ userId: 'user_123' }) };
      }
      return { isAuthenticated: false, toAuth: () => null };
    }),
  }),
}));

describe('auth plugin', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('rejects missing token with 401 UNAUTHORIZED', async () => {
    const app = await buildServer();
    app.get('/protected', { preHandler: [app.requireAuth] }, async (req) => ({ uid: req.userId }));
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('accepts valid bearer and exposes userId', async () => {
    const app = await buildServer();
    app.get('/protected', { preHandler: [app.requireAuth] }, async (req) => ({ uid: req.userId }));
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ uid: 'user_123' });
  });
});
```

- [ ] **Step 3: Run — verify it fails**

Run: `pnpm --filter @smartroute/backend test auth.test`
Expected: failures (`requireAuth` undefined).

- [ ] **Step 4: Implement `apps/backend/src/plugins/auth.ts`**

```typescript
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
    if (!result.isAuthenticated) {
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
```

- [ ] **Step 5: Register in `server.ts`** (after error handler, before routes):

```typescript
import { authPlugin } from './plugins/auth.js';
// ...
await app.register(errorHandlerPlugin);
await app.register(authPlugin);
if (opts.withDb ?? Boolean(process.env.DATABASE_URL)) {
  await app.register(prismaPlugin);
}
await app.register(healthRoute);
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @smartroute/backend test`
Expected: 6 passing (4 prior + 2 auth).

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add Clerk JWT auth plugin with requireAuth preHandler"
```

---

### Task 7: Flight provider interface + mock

**Files:**
- Create: `apps/backend/src/services/flights/provider.ts`
- Create: `apps/backend/tests/services/flights/provider.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { MockFlightProvider } from '../../../src/services/flights/provider.js';

describe('MockFlightProvider', () => {
  it('returns deterministic price for same triple', async () => {
    const p = new MockFlightProvider();
    const a = await p.getPrices([{ origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' }]);
    const b = await p.getPrices([{ origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' }]);
    expect(a[0].priceCents).toBe(b[0].priceCents);
    expect(a[0].priceCents).toBeGreaterThan(0);
  });

  it('returns one result per requested triple', async () => {
    const p = new MockFlightProvider();
    const out = await p.getPrices([
      { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' },
      { origin: 'CDG', destination: 'FCO', departDate: '2026-06-04', cabinClass: 'ECONOMY' },
    ]);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @smartroute/backend test provider.test`
Expected: module not found.

- [ ] **Step 3: Implement `apps/backend/src/services/flights/provider.ts`**

```typescript
import type { CabinClass, FlightLeg } from '@smartroute/shared';

export interface PriceQuery {
  origin: string;
  destination: string;
  departDate: string;
  cabinClass: CabinClass;
}

export interface PriceResult extends Omit<FlightLeg, 'depart' | 'arrive'> {
  departDate: string;
  cabinClass: CabinClass;
}

export interface FlightProvider {
  getPrices(queries: PriceQuery[]): Promise<PriceResult[]>;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export class MockFlightProvider implements FlightProvider {
  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    return queries.map((q) => {
      const seed = hash(`${q.origin}-${q.destination}-${q.departDate}-${q.cabinClass}`);
      const priceCents = 15_000 + (seed % 80_000);
      const durationMin = 90 + (seed % 600);
      const stops = seed % 4 === 0 ? 0 : seed % 3 === 0 ? 1 : 0;
      return {
        origin: q.origin,
        destination: q.destination,
        departDate: q.departDate,
        cabinClass: q.cabinClass,
        priceCents,
        durationMin,
        stops,
        carrier: ['AA', 'BA', 'AF', 'LH'][seed % 4] ?? null,
      };
    });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartroute/backend test provider.test`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add FlightProvider interface and deterministic mock"
```

---

### Task 8: Flight price cache (Postgres-backed)

**Files:**
- Create: `apps/backend/src/services/flights/cache.ts`
- Create: `apps/backend/tests/services/flights/cache.test.ts`
- Modify: `apps/backend/vitest.config.ts` (set test timeout to 20s for DB tests)

**Note on test DB:** Tests run against the local Postgres started by `docker-compose up -d`. CI does the same via the Postgres service container in `.github/workflows/ci.yml`. Migrations are applied with `prisma migrate deploy` before the test run.

- [ ] **Step 1: Add a vitest setup file `apps/backend/tests/setup-db.ts`**

```typescript
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const prisma = new PrismaClient();

beforeAll(() => {
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.trip.deleteMany(),
    prisma.flightPriceCache.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

- [ ] **Step 2: Update `apps/backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20_000,
    setupFiles: process.env.SKIP_DB_TESTS ? [] : ['./tests/setup-db.ts'],
  },
});
```

- [ ] **Step 3: Write the failing test `apps/backend/tests/services/flights/cache.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { PriceCache } from '../../../src/services/flights/cache.js';
import { prisma } from '../../setup-db.js';

const Q = { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' as const };

describe('PriceCache', () => {
  it('returns empty when nothing is cached', async () => {
    const cache = new PriceCache(prisma);
    const hits = await cache.lookup([Q]);
    expect(hits.size).toBe(0);
  });

  it('stores and retrieves a price', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([
      { ...Q, priceCents: 50_000, durationMin: 420, stops: 0, carrier: 'AF' },
    ]);
    const hits = await cache.lookup([Q]);
    expect(hits.size).toBe(1);
    const v = hits.get(`${Q.origin}|${Q.destination}|${Q.departDate}|${Q.cabinClass}`);
    expect(v?.priceCents).toBe(50_000);
  });

  it('reports stale entries via maxAgeMs', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([
      { ...Q, priceCents: 50_000, durationMin: 420, stops: 0, carrier: 'AF' },
    ]);
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await cache.lookup([Q], { maxAgeMs: 10 });
    const all = await cache.lookup([Q]);
    expect(fresh.size).toBe(0);
    expect(all.size).toBe(1);
  });
});
```

- [ ] **Step 4: Verify failure**

Run: `pnpm --filter @smartroute/backend test cache.test`
Expected: module not found.

- [ ] **Step 5: Implement `apps/backend/src/services/flights/cache.ts`**

```typescript
import type { PrismaClient } from '@prisma/client';
import type { CabinClass } from '@smartroute/shared';
import type { PriceQuery, PriceResult } from './provider.js';

export type CacheKey = string;

export function keyOf(q: { origin: string; destination: string; departDate: string; cabinClass: CabinClass }): CacheKey {
  return `${q.origin}|${q.destination}|${q.departDate}|${q.cabinClass}`;
}

export interface LookupOptions {
  maxAgeMs?: number;
}

export class PriceCache {
  constructor(private readonly db: PrismaClient) {}

  async lookup(queries: PriceQuery[], opts: LookupOptions = {}): Promise<Map<CacheKey, PriceResult>> {
    if (queries.length === 0) return new Map();
    const ors = queries.map((q) => ({
      origin: q.origin,
      destination: q.destination,
      departDate: new Date(q.departDate),
      cabinClass: q.cabinClass,
    }));
    const rows = await this.db.flightPriceCache.findMany({ where: { OR: ors } });
    const map = new Map<CacheKey, PriceResult>();
    const now = Date.now();
    for (const r of rows) {
      if (opts.maxAgeMs && now - r.fetchedAt.getTime() > opts.maxAgeMs) continue;
      const key = keyOf({
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate.toISOString().slice(0, 10),
        cabinClass: r.cabinClass as CabinClass,
      });
      map.set(key, {
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate.toISOString().slice(0, 10),
        cabinClass: r.cabinClass as CabinClass,
        priceCents: r.priceCents,
        durationMin: r.durationMin,
        stops: r.stops,
        carrier: r.carrier,
      });
    }
    return map;
  }

  async upsert(results: PriceResult[]): Promise<void> {
    await Promise.all(
      results.map((r) =>
        this.db.flightPriceCache.upsert({
          where: {
            origin_destination_departDate_cabinClass: {
              origin: r.origin,
              destination: r.destination,
              departDate: new Date(r.departDate),
              cabinClass: r.cabinClass,
            },
          },
          create: {
            origin: r.origin,
            destination: r.destination,
            departDate: new Date(r.departDate),
            cabinClass: r.cabinClass,
            priceCents: r.priceCents,
            durationMin: r.durationMin,
            stops: r.stops,
            carrier: r.carrier,
          },
          update: {
            priceCents: r.priceCents,
            durationMin: r.durationMin,
            stops: r.stops,
            carrier: r.carrier,
            fetchedAt: new Date(),
          },
        }),
      ),
    );
  }
}
```

- [ ] **Step 6: Run tests**

```bash
docker compose up -d
pnpm --filter @smartroute/backend test cache.test
```

Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add Prisma-backed flight price cache"
```

---

### Task 9: FlightService (cache + provider orchestration)

**Files:**
- Create: `apps/backend/src/services/flights/index.ts`
- Create: `apps/backend/tests/services/flights/service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { FlightService } from '../../../src/services/flights/index.js';
import { PriceCache, keyOf } from '../../../src/services/flights/cache.js';
import type { FlightProvider, PriceQuery, PriceResult } from '../../../src/services/flights/provider.js';
import { prisma } from '../../setup-db.js';

const Q1: PriceQuery = { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' };
const Q2: PriceQuery = { origin: 'CDG', destination: 'FCO', departDate: '2026-06-04', cabinClass: 'ECONOMY' };
const r = (q: PriceQuery, p: number): PriceResult => ({ ...q, priceCents: p, durationMin: 300, stops: 0, carrier: 'AF' });

class FakeProvider implements FlightProvider {
  constructor(private readonly results: PriceResult[]) {}
  getPrices = vi.fn(async (qs: PriceQuery[]) => qs.map((q) => this.results.find((x) => keyOf(x) === keyOf(q))!));
}

describe('FlightService', () => {
  it('serves all from cache when fresh', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    const provider = new FakeProvider([]);
    const svc = new FlightService(cache, provider);
    const out = await svc.getPrices([Q1]);
    expect(provider.getPrices).not.toHaveBeenCalled();
    expect(out.prices.size).toBe(1);
    expect(out.partial).toBe(false);
    expect(out.staleCache).toBe(false);
  });

  it('fetches missing pairs and caches them', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    const provider = new FakeProvider([r(Q2, 30_000)]);
    const svc = new FlightService(cache, provider);
    const out = await svc.getPrices([Q1, Q2]);
    expect(provider.getPrices).toHaveBeenCalledOnce();
    expect(provider.getPrices).toHaveBeenCalledWith([Q2]);
    expect(out.prices.size).toBe(2);
    const reHit = await cache.lookup([Q2]);
    expect(reHit.size).toBe(1);
  });

  it('falls back to stale cache when provider throws', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    await new Promise((r) => setTimeout(r, 30));
    const provider: FlightProvider = { getPrices: vi.fn(async () => { throw new Error('vendor down'); }) };
    const svc = new FlightService(cache, provider, { freshMs: 10 });
    const out = await svc.getPrices([Q1]);
    expect(out.prices.size).toBe(1);
    expect(out.staleCache).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @smartroute/backend test service.test`
Expected: module not found.

- [ ] **Step 3: Implement `apps/backend/src/services/flights/index.ts`**

```typescript
import { PriceCache, keyOf, type CacheKey } from './cache.js';
import type { FlightProvider, PriceQuery, PriceResult } from './provider.js';

export interface FlightServiceOptions {
  freshMs?: number;
}

export interface FlightServiceResult {
  prices: Map<CacheKey, PriceResult>;
  partial: boolean;
  staleCache: boolean;
}

export class FlightService {
  constructor(
    private readonly cache: PriceCache,
    private readonly provider: FlightProvider,
    private readonly opts: FlightServiceOptions = {},
  ) {}

  async getPrices(queries: PriceQuery[]): Promise<FlightServiceResult> {
    const freshMs = this.opts.freshMs ?? 1000 * 60 * 60 * 6; // 6h default
    const fresh = await this.cache.lookup(queries, { maxAgeMs: freshMs });
    const missing = queries.filter((q) => !fresh.has(keyOf(q)));

    if (missing.length === 0) {
      return { prices: fresh, partial: false, staleCache: false };
    }

    try {
      const fetched = await this.provider.getPrices(missing);
      await this.cache.upsert(fetched);
      const merged = new Map(fresh);
      for (const r of fetched) merged.set(keyOf(r), r);
      const partial = fetched.length < missing.length;
      return { prices: merged, partial, staleCache: false };
    } catch {
      const stale = await this.cache.lookup(queries);
      return { prices: stale, partial: stale.size < queries.length, staleCache: true };
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartroute/backend test service.test`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add FlightService with cache, batch fetch, stale fallback"
```

---

### Task 10: Optimizer scoring (pure)

**Files:**
- Create: `apps/backend/src/services/optimizer/score.ts`
- Create: `apps/backend/tests/services/optimizer/score.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { scoreOrdering, compositeScore } from '../../../src/services/optimizer/score.js';
import type { PriceResult } from '../../../src/services/flights/provider.js';

const leg = (origin: string, destination: string, price: number, durationMin: number, stops = 0): PriceResult => ({
  origin, destination, departDate: '2026-06-01', cabinClass: 'ECONOMY', priceCents: price, durationMin, stops, carrier: 'X',
});

describe('scoreOrdering', () => {
  it('sums cost, duration, stops across legs', () => {
    const s = scoreOrdering([leg('A', 'B', 100, 60, 0), leg('B', 'C', 200, 90, 1)]);
    expect(s.totalCostCents).toBe(300);
    expect(s.totalDurationMin).toBe(150);
    expect(s.totalStops).toBe(1);
  });
});

describe('compositeScore', () => {
  it('produces lower (better) score for cheaper-faster-more-direct route', () => {
    const cheap = scoreOrdering([leg('A', 'B', 100, 60, 0)]);
    const expensive = scoreOrdering([leg('A', 'B', 1000, 600, 3)]);
    const cheapComp = compositeScore(cheap, { maxCostCents: 1000, maxDurationMin: 600, maxStops: 3 });
    const expComp = compositeScore(expensive, { maxCostCents: 1000, maxDurationMin: 600, maxStops: 3 });
    expect(cheapComp).toBeLessThan(expComp);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `SKIP_DB_TESTS=1 pnpm --filter @smartroute/backend test score.test`
Expected: not found.

- [ ] **Step 3: Implement `apps/backend/src/services/optimizer/score.ts`**

```typescript
import type { Score } from '@smartroute/shared';
import type { PriceResult } from '../flights/provider.js';

export interface Bounds {
  maxCostCents: number;
  maxDurationMin: number;
  maxStops: number;
}

export const DEFAULT_WEIGHTS = { cost: 0.5, duration: 0.3, stops: 0.2 };

export function scoreOrdering(legs: PriceResult[]): Omit<Score, 'composite'> {
  let totalCostCents = 0;
  let totalDurationMin = 0;
  let totalStops = 0;
  for (const l of legs) {
    totalCostCents += l.priceCents;
    totalDurationMin += l.durationMin;
    totalStops += l.stops;
  }
  return { totalCostCents, totalDurationMin, totalStops };
}

export function compositeScore(
  s: Omit<Score, 'composite'>,
  b: Bounds,
  w = DEFAULT_WEIGHTS,
): number {
  const c = b.maxCostCents > 0 ? s.totalCostCents / b.maxCostCents : 0;
  const d = b.maxDurationMin > 0 ? s.totalDurationMin / b.maxDurationMin : 0;
  const t = b.maxStops > 0 ? s.totalStops / b.maxStops : 0;
  return w.cost * c + w.duration * d + w.stops * t;
}
```

- [ ] **Step 4: Run tests**

Run: `SKIP_DB_TESTS=1 pnpm --filter @smartroute/backend test score.test`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(optimizer): add pure scoring functions"
```

---

### Task 11: Optimizer enumeration + service (top-K with dedup)

**Files:**
- Create: `apps/backend/src/services/optimizer/enumerate.ts`
- Create: `apps/backend/src/services/optimizer/index.ts`
- Create: `apps/backend/tests/services/optimizer/enumerate.test.ts`
- Create: `apps/backend/tests/services/optimizer/optimizer.test.ts`

- [ ] **Step 1: Write `enumerate.test.ts` (failing)**

```typescript
import { describe, it, expect } from 'vitest';
import { enumerateOrderings } from '../../../src/services/optimizer/enumerate.js';

describe('enumerateOrderings', () => {
  it('returns N! orderings with no constraints', () => {
    expect(enumerateOrderings(['A', 'B', 'C'])).toHaveLength(6);
  });
  it('pins startCity', () => {
    const out = enumerateOrderings(['A', 'B', 'C'], { startCity: 'B' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[0] === 'B')).toBe(true);
  });
  it('pins endCity', () => {
    const out = enumerateOrderings(['A', 'B', 'C'], { endCity: 'C' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[o.length - 1] === 'C')).toBe(true);
  });
  it('pins both', () => {
    const out = enumerateOrderings(['A', 'B', 'C', 'D'], { startCity: 'A', endCity: 'D' });
    expect(out).toHaveLength(2);
    expect(out.every((o) => o[0] === 'A' && o[o.length - 1] === 'D')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `apps/backend/src/services/optimizer/enumerate.ts`**

```typescript
export interface EnumerateOptions {
  startCity?: string;
  endCity?: string;
}

export function enumerateOrderings(cities: string[], opts: EnumerateOptions = {}): string[][] {
  const head = opts.startCity ? [opts.startCity] : [];
  const tail = opts.endCity ? [opts.endCity] : [];
  const middle = cities.filter((c) => c !== opts.startCity && c !== opts.endCity);
  const perms = permute(middle);
  return perms.map((p) => [...head, ...p, ...tail]);
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}
```

- [ ] **Step 3: Run enumerate tests — expect 4 passing**

Run: `SKIP_DB_TESTS=1 pnpm --filter @smartroute/backend test enumerate.test`

- [ ] **Step 4: Write `optimizer.test.ts` (failing)**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OptimizerService } from '../../../src/services/optimizer/index.js';
import type { FlightService } from '../../../src/services/flights/index.js';
import { keyOf } from '../../../src/services/flights/cache.js';
import type { PriceResult, PriceQuery } from '../../../src/services/flights/provider.js';

function fakeFlights(map: Record<string, Partial<PriceResult>>): FlightService {
  return {
    getPrices: vi.fn(async (qs: PriceQuery[]) => {
      const prices = new Map<string, PriceResult>();
      for (const q of qs) {
        const k = keyOf(q);
        const base = map[`${q.origin}-${q.destination}`] ?? { priceCents: 50_000, durationMin: 300, stops: 0 };
        prices.set(k, { ...q, carrier: 'X', ...base } as PriceResult);
      }
      return { prices, partial: false, staleCache: false };
    }),
  } as unknown as FlightService;
}

describe('OptimizerService', () => {
  it('returns up to 3 deduped labeled options', async () => {
    const svc = new OptimizerService(fakeFlights({}));
    const res = await svc.optimize({
      cities: ['JFK', 'CDG', 'FCO'],
      perCityDays: [2, 2, 2],
      departDate: '2026-06-01',
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly: false,
    });
    expect(res.options.length).toBeGreaterThan(0);
    expect(res.options.length).toBeLessThanOrEqual(3);
    const labels = new Set(res.options.map((o) => o.label));
    expect(labels.size).toBe(res.options.length);
  });

  it('drops legs with stops when directOnly is true', async () => {
    const svc = new OptimizerService(
      fakeFlights({
        'JFK-CDG': { priceCents: 50_000, durationMin: 300, stops: 1 },
        'CDG-JFK': { priceCents: 50_000, durationMin: 300, stops: 1 },
      }),
    );
    const res = await svc.optimize({
      cities: ['JFK', 'CDG'],
      perCityDays: [2, 2],
      departDate: '2026-06-01',
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly: true,
    });
    expect(res.options).toHaveLength(0);
    expect(res.reason).toMatch(/direct/i);
  });
});
```

- [ ] **Step 5: Implement `apps/backend/src/services/optimizer/index.ts`**

```typescript
import type { CabinClass, OptimizeRequest, OptimizeResponse, RouteLabel, RouteOption, FlightLeg } from '@smartroute/shared';
import type { FlightService } from '../flights/index.js';
import type { PriceQuery, PriceResult } from '../flights/provider.js';
import { keyOf } from '../flights/cache.js';
import { enumerateOrderings } from './enumerate.js';
import { compositeScore, scoreOrdering, type Bounds } from './score.js';

export class OptimizerService {
  constructor(private readonly flights: FlightService) {}

  async optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
    const orderings = enumerateOrderings(req.cities, { startCity: req.startCity, endCity: req.endCity });
    const triples = collectTriples(orderings, req.perCityDays, req.cities, req.departDate, req.cabinClass);

    const { prices, partial, staleCache } = await this.flights.getPrices(triples);

    const candidates: Array<{ ordering: string[]; legs: PriceResult[] }> = [];
    for (const ordering of orderings) {
      const legs = legsFor(ordering, req.perCityDays, req.cities, req.departDate, req.cabinClass, prices);
      if (legs.length !== ordering.length - 1) continue;
      if (req.directOnly && legs.some((l) => l.stops > 0)) continue;
      candidates.push({ ordering, legs });
    }

    if (candidates.length === 0) {
      return {
        options: [],
        reason: req.directOnly ? 'No direct-only routes available; try disabling directOnly.' : 'No viable routes found.',
        ...(partial && { partial }),
        ...(staleCache && { staleCache }),
      };
    }

    const bounds: Bounds = {
      maxCostCents: Math.max(...candidates.map((c) => sumProp(c.legs, 'priceCents'))) || 1,
      maxDurationMin: Math.max(...candidates.map((c) => sumProp(c.legs, 'durationMin'))) || 1,
      maxStops: Math.max(...candidates.map((c) => sumProp(c.legs, 'stops'))) || 1,
    };

    const cheapest = pickBy(candidates, (c) => sumProp(c.legs, 'priceCents'));
    const fastest = pickBy(candidates, (c) => sumProp(c.legs, 'durationMin'));
    const direct = pickBy(candidates, (c) => sumProp(c.legs, 'stops') * 1e9 + sumProp(c.legs, 'priceCents'));

    const labeled: Array<{ label: RouteLabel; pick: (typeof candidates)[number] }> = [
      { label: 'cheapest', pick: cheapest },
      { label: 'fastest', pick: fastest },
      { label: 'most_direct', pick: direct },
    ];

    const seen = new Set<string>();
    const options: RouteOption[] = [];
    for (const { label, pick } of labeled) {
      const key = pick.ordering.join('>');
      if (seen.has(key)) continue;
      seen.add(key);
      const totals = scoreOrdering(pick.legs);
      options.push({
        label,
        cities: pick.ordering,
        legs: pick.legs.map(toFlightLeg),
        score: { ...totals, composite: compositeScore(totals, bounds) },
      });
    }

    return {
      options,
      ...(partial && { partial }),
      ...(staleCache && { staleCache }),
    };
  }
}

function collectTriples(
  orderings: string[][],
  perCityDays: number[],
  cities: string[],
  departDate: string,
  cabinClass: CabinClass,
): PriceQuery[] {
  const seen = new Set<string>();
  const out: PriceQuery[] = [];
  for (const ordering of orderings) {
    let date = new Date(departDate);
    for (let i = 0; i < ordering.length - 1; i++) {
      const origin = ordering[i]!;
      const destination = ordering[i + 1]!;
      const departDateStr = date.toISOString().slice(0, 10);
      const k = `${origin}|${destination}|${departDateStr}|${cabinClass}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ origin, destination, departDate: departDateStr, cabinClass });
      }
      const idx = cities.indexOf(origin);
      const stay = perCityDays[idx] ?? 1;
      date = new Date(date.getTime() + stay * 86400_000);
    }
  }
  return out;
}

function legsFor(
  ordering: string[],
  perCityDays: number[],
  cities: string[],
  departDate: string,
  cabinClass: CabinClass,
  prices: Map<string, PriceResult>,
): PriceResult[] {
  const out: PriceResult[] = [];
  let date = new Date(departDate);
  for (let i = 0; i < ordering.length - 1; i++) {
    const origin = ordering[i]!;
    const destination = ordering[i + 1]!;
    const departDateStr = date.toISOString().slice(0, 10);
    const r = prices.get(keyOf({ origin, destination, departDate: departDateStr, cabinClass }));
    if (!r) return out;
    out.push(r);
    const idx = cities.indexOf(origin);
    const stay = perCityDays[idx] ?? 1;
    date = new Date(date.getTime() + stay * 86400_000);
  }
  return out;
}

function sumProp(legs: PriceResult[], prop: 'priceCents' | 'durationMin' | 'stops'): number {
  return legs.reduce((s, l) => s + l[prop], 0);
}

function pickBy<T>(arr: T[], score: (t: T) => number): T {
  let best = arr[0]!;
  let bestScore = score(best);
  for (let i = 1; i < arr.length; i++) {
    const s = score(arr[i]!);
    if (s < bestScore) {
      best = arr[i]!;
      bestScore = s;
    }
  }
  return best;
}

function toFlightLeg(r: PriceResult): FlightLeg {
  const depart = new Date(`${r.departDate}T08:00:00.000Z`);
  const arrive = new Date(depart.getTime() + r.durationMin * 60_000);
  return {
    origin: r.origin,
    destination: r.destination,
    depart: depart.toISOString(),
    arrive: arrive.toISOString(),
    carrier: r.carrier,
    priceCents: r.priceCents,
    durationMin: r.durationMin,
    stops: r.stops,
  };
}
```

- [ ] **Step 6: Run tests**

Run: `SKIP_DB_TESTS=1 pnpm --filter @smartroute/backend test optimizer.test`
Expected: 2 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git commit -m "feat(optimizer): add enumeration and top-K labeled route selection"
```

---

### Task 12: `POST /optimize` route

**Files:**
- Create: `apps/backend/src/routes/optimize.route.ts`
- Create: `apps/backend/tests/routes/optimize.route.test.ts`
- Modify: `apps/backend/src/server.ts`

- [ ] **Step 1: Write the failing test `apps/backend/tests/routes/optimize.route.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      if (req.headers.get('authorization') === 'Bearer good') {
        return { isAuthenticated: true, toAuth: () => ({ userId: 'u1' }) };
      }
      return { isAuthenticated: false, toAuth: () => null };
    }),
  }),
}));

describe('POST /optimize', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('rejects unauth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/optimize', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('400s on invalid input', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: { cities: ['JFK'] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
  });

  it('returns options on valid input', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: {
        cities: ['JFK', 'CDG', 'FCO'],
        perCityDays: [2, 2, 2],
        departDate: '2026-06-01',
        travelers: 1,
        cabinClass: 'ECONOMY',
        directOnly: false,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().options.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement `apps/backend/src/routes/optimize.route.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { OptimizeRequest } from '@smartroute/shared';
import { OptimizerService } from '../services/optimizer/index.js';
import { FlightService } from '../services/flights/index.js';
import { PriceCache } from '../services/flights/cache.js';
import { MockFlightProvider } from '../services/flights/provider.js';

export async function optimizeRoute(app: FastifyInstance): Promise<void> {
  app.post('/optimize', { preHandler: [app.requireAuth] }, async (req) => {
    const parsed = OptimizeRequest.parse(req.body);
    const cache = app.prisma ? new PriceCache(app.prisma) : null;
    const provider = new MockFlightProvider();
    const flights = cache
      ? new FlightService(cache, provider)
      : new FlightService({ lookup: async () => new Map(), upsert: async () => {} } as unknown as PriceCache, provider);
    const optimizer = new OptimizerService(flights);
    return await optimizer.optimize(parsed);
  });
}
```

- [ ] **Step 3: Register in `server.ts`**

```typescript
import { optimizeRoute } from './routes/optimize.route.js';
// ... after authPlugin/prismaPlugin:
await app.register(optimizeRoute);
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartroute/backend test optimize.route`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add POST /optimize route"
```

---

### Task 13: TripService

**Files:**
- Create: `apps/backend/src/services/trips/index.ts`
- Create: `apps/backend/tests/services/trips/trips.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { TripService } from '../../../src/services/trips/index.js';
import { ApiError } from '../../../src/lib/ApiError.js';
import { prisma } from '../../setup-db.js';

const sample = {
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  cabinClass: 'ECONOMY' as const,
  travelers: 1,
  cities: ['JFK', 'CDG', 'FCO'],
  flights: [
    { origin: 'JFK', destination: 'CDG', depart: '2026-06-01T08:00:00.000Z', arrive: '2026-06-01T14:00:00.000Z', carrier: 'AF', priceCents: 50_000, durationMin: 360, stops: 0 },
    { origin: 'CDG', destination: 'FCO', depart: '2026-06-04T08:00:00.000Z', arrive: '2026-06-04T10:00:00.000Z', carrier: 'AF', priceCents: 20_000, durationMin: 120, stops: 0 },
  ],
  totalPriceCents: 70_000,
};

describe('TripService', () => {
  it('creates and retrieves a trip', async () => {
    const svc = new TripService(prisma);
    const created = await svc.create('u1', sample);
    expect(created.id).toBeDefined();
    const fetched = await svc.findById('u1', created.id);
    expect(fetched.name).toBe('Eurotrip');
  });

  it('lists trips for one user only', async () => {
    const svc = new TripService(prisma);
    await svc.create('u1', sample);
    await svc.create('u2', sample);
    const list = await svc.list('u1');
    expect(list).toHaveLength(1);
  });

  it('throws NOT_FOUND for other user trip', async () => {
    const svc = new TripService(prisma);
    const c = await svc.create('u1', sample);
    await expect(svc.findById('u2', c.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes own trip', async () => {
    const svc = new TripService(prisma);
    const c = await svc.create('u1', sample);
    await svc.delete('u1', c.id);
    await expect(svc.findById('u1', c.id)).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Implement `apps/backend/src/services/trips/index.ts`**

```typescript
import type { PrismaClient, Prisma } from '@prisma/client';
import type { CreateTripRequest, Trip, CabinClass, FlightLeg } from '@smartroute/shared';
import { ApiError } from '../../lib/ApiError.js';

export class TripService {
  constructor(private readonly db: PrismaClient) {}

  async create(userId: string, input: CreateTripRequest): Promise<Trip> {
    const row = await this.db.trip.create({
      data: {
        userId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        cabinClass: input.cabinClass,
        travelers: input.travelers,
        cities: input.cities,
        flights: input.flights as unknown as Prisma.InputJsonValue,
        totalPrice: input.totalPriceCents,
      },
    });
    return toTrip(row);
  }

  async list(userId: string): Promise<Trip[]> {
    const rows = await this.db.trip.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toTrip);
  }

  async findById(userId: string, id: string): Promise<Trip> {
    const row = await this.db.trip.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new ApiError('NOT_FOUND', 'Trip not found', 404);
    }
    return toTrip(row);
  }

  async delete(userId: string, id: string): Promise<void> {
    const row = await this.db.trip.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new ApiError('NOT_FOUND', 'Trip not found', 404);
    }
    await this.db.trip.delete({ where: { id } });
  }
}

function toTrip(row: {
  id: string; name: string; startDate: Date; endDate: Date; cabinClass: string;
  travelers: number; cities: string[]; flights: Prisma.JsonValue; totalPrice: number;
  createdAt: Date; updatedAt: Date;
}): Trip {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    cabinClass: row.cabinClass as CabinClass,
    travelers: row.travelers,
    cities: row.cities,
    flights: row.flights as unknown as FlightLeg[],
    totalPriceCents: row.totalPrice,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @smartroute/backend test trips.test`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add TripService with user-scoped CRUD"
```

---

### Task 14: `/trips` CRUD routes

**Files:**
- Create: `apps/backend/src/routes/trips.route.ts`
- Create: `apps/backend/tests/routes/trips.route.test.ts`
- Modify: `apps/backend/src/server.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { prisma } from '../setup-db.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer u_')) {
        return { isAuthenticated: true, toAuth: () => ({ userId: auth.slice(7) }) };
      }
      return { isAuthenticated: false, toAuth: () => null };
    }),
  }),
}));

const body = {
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  cabinClass: 'ECONOMY',
  travelers: 1,
  cities: ['JFK', 'CDG', 'FCO'],
  flights: [
    { origin: 'JFK', destination: 'CDG', depart: '2026-06-01T08:00:00.000Z', arrive: '2026-06-01T14:00:00.000Z', carrier: 'AF', priceCents: 50000, durationMin: 360, stops: 0 },
  ],
  totalPriceCents: 50000,
};

describe('/trips', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('full CRUD lifecycle', async () => {
    const app = await buildServer({ withDb: true });
    const auth = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

    const create = await app.inject({ method: 'POST', url: '/trips', headers: auth, payload: body });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;

    const list = await app.inject({ method: 'GET', url: '/trips', headers: auth });
    expect(list.json()).toHaveLength(1);

    const get = await app.inject({ method: 'GET', url: `/trips/${id}`, headers: auth });
    expect(get.statusCode).toBe(200);

    const otherAuth = { authorization: 'Bearer u_bob' };
    const cross = await app.inject({ method: 'GET', url: `/trips/${id}`, headers: otherAuth });
    expect(cross.statusCode).toBe(404);

    const del = await app.inject({ method: 'DELETE', url: `/trips/${id}`, headers: auth });
    expect(del.statusCode).toBe(204);
  });
});
```

- [ ] **Step 2: Implement `apps/backend/src/routes/trips.route.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { CreateTripRequest } from '@smartroute/shared';
import { TripService } from '../services/trips/index.js';

export async function tripsRoute(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/trips')) {
      await app.requireAuth(req, reply);
    }
  });

  app.post('/trips', async (req, reply) => {
    const parsed = CreateTripRequest.parse(req.body);
    const trip = await new TripService(app.prisma).create(req.userId, parsed);
    return reply.status(201).send(trip);
  });

  app.get('/trips', async (req) => new TripService(app.prisma).list(req.userId));

  app.get<{ Params: { id: string } }>('/trips/:id', async (req) =>
    new TripService(app.prisma).findById(req.userId, req.params.id),
  );

  app.delete<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    await new TripService(app.prisma).delete(req.userId, req.params.id);
    return reply.status(204).send();
  });
}
```

- [ ] **Step 3: Register in `server.ts`**

```typescript
import { tripsRoute } from './routes/trips.route.js';
// ...
await app.register(tripsRoute);
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartroute/backend test trips.route`
Expected: 1 passing (the lifecycle test).

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add /trips CRUD routes"
```

---

### Task 15: Update README + verify full suite

**Files:**
- Modify: `README.md`
- Modify: `.env.example` (already has CLERK_*, no change unless missing)

- [ ] **Step 1: Update README backend section** to document required env vars and dev workflow:

```markdown
## Backend Development

1. `cp .env.example .env` and fill in `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
2. `docker compose up -d` to start Postgres
3. `pnpm --filter @smartroute/backend db:migrate` to apply schema
4. `pnpm --filter @smartroute/backend dev` to start the API on `http://localhost:3000`

Endpoints:
- `GET /health` — liveness
- `POST /optimize` — auth required; returns top-K routes
- `POST /trips`, `GET /trips`, `GET /trips/:id`, `DELETE /trips/:id` — saved trips
```

- [ ] **Step 2: Run full suite from repo root**

```bash
docker compose up -d
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document backend dev workflow and endpoints"
```

---

## Coverage check against the spec

| Spec section | Covered by |
| --- | --- |
| §5.2 backend modules | Tasks 4–14 |
| §5.3 data model usage | Tasks 8 (cache), 13 (trips) |
| §5.4 shared package | Tasks 2–3 |
| §6.1 optimize flow (batched pricing, dedupe, directOnly hard filter) | Tasks 9, 11, 12 |
| §6.2 save trip flow | Tasks 13–14 |
| §6.3 list/view trips | Task 14 |
| §7 errors (envelope, ZodError → 400, NOT_FOUND for cross-user) | Tasks 4, 13, 14 |
| §7.2 partial / staleCache flags | Task 9 |
| §7.5 Clerk JWT verification | Task 6 |
| §8 testing (Vitest, Postgres test container, Fastify inject) | Tasks 4, 6, 8, 9, 13, 14 |

Real flight provider integration, Sentry, and msw HTTP mocks for a real vendor are deferred to Plan 4 (Real Flight Integration). Mobile consumption is Plan 3. Deployment is Plan 5.
