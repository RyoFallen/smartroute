import type { PrismaClient } from '@prisma/client';
import type {
  GetMeResponse,
  InterestEntry,
  InterestRating,
  TripIntensity,
  UpdatePreferencesRequest,
  UserProfile,
} from '@smartroute/shared';

export class UserService {
  constructor(private readonly db: PrismaClient) {}

  async getMe(userId: string): Promise<GetMeResponse> {
    const row = await this.db.userProfile.findUnique({ where: { userId } });
    if (!row) return { profile: null };
    const interests = await this.db.interest.findMany({
      where: { userId },
      orderBy: { category: 'asc' },
    });
    return {
      profile: {
        intensity: row.intensity as TripIntensity,
        wakeUpTime: row.wakeUpTime,
        interests: interests.map((i) => ({
          category: i.category as InterestEntry['category'],
          rating: i.rating as InterestRating,
        })),
      },
    };
  }

  async upsertPreferences(userId: string, input: UpdatePreferencesRequest): Promise<UserProfile> {
    await this.db.userProfile.upsert({
      where: { userId },
      create: { userId, intensity: input.intensity, wakeUpTime: input.wakeUpTime },
      update: { intensity: input.intensity, wakeUpTime: input.wakeUpTime },
    });
    const me = await this.getMe(userId);
    // upsert above guarantees the row exists
    return me.profile as UserProfile;
  }

  async replaceInterests(userId: string, interests: InterestEntry[]): Promise<UserProfile> {
    await this.db.$transaction([
      this.db.userProfile.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.db.interest.deleteMany({ where: { userId } }),
      this.db.interest.createMany({
        data: interests.map((i) => ({ userId, category: i.category, rating: i.rating })),
      }),
    ]);
    const me = await this.getMe(userId);
    return me.profile as UserProfile;
  }
}
