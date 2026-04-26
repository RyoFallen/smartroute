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
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  cabinClass: string;
  travelers: number;
  cities: string[];
  flights: Prisma.JsonValue;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
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
