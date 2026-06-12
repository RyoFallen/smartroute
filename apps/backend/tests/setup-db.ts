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
    prisma.attraction.deleteMany(),
    prisma.city.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
