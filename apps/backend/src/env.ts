import { z } from 'zod';

const Env = z
  .object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
    FLIGHT_PROVIDER: z.enum(['mock', 'duffel']).default('mock'),
    DUFFEL_API_KEY: z.string().min(1).optional(),
    DUFFEL_BASE_URL: z.string().url().default('https://api.duffel.com'),
    WALKING_PROVIDER: z.enum(['mock', 'osrm']).default('mock'),
    // `.url()` alone is too weak here: `new URL('localhost:5000')` succeeds
    // with protocol `localhost:`, so the commonest misconfiguration — dropping
    // the scheme — would validate and then fail on every fetch instead.
    OSRM_BASE_URL: z
      .string()
      .url()
      .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
        message: 'must be an http(s) URL, e.g. http://localhost:5050',
      })
      .default('http://localhost:5050'),
  })
  .refine((e) => e.FLIGHT_PROVIDER !== 'duffel' || !!e.DUFFEL_API_KEY, {
    message: 'DUFFEL_API_KEY is required when FLIGHT_PROVIDER=duffel',
    path: ['DUFFEL_API_KEY'],
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
