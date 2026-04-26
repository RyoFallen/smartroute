import 'dotenv/config';
import { buildServer } from './server.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = await buildServer({ withDb: true });
await app.listen({ port: env.PORT, host: env.HOST });
