import type { PrismaClient } from '@prisma/client';
import type { CitySummary } from '@smartroute/shared';

export class CityService {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<CitySummary[]> {
    const rows = await this.db.city.findMany({
      orderBy: { name: 'asc' },
      select: { iata: true, name: true, country: true },
    });
    return rows;
  }
}
