import type { ClerkClient } from '@clerk/backend';
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
    return this.requireProfile(userId);
  }

  async replaceInterests(userId: string, interests: InterestEntry[]): Promise<UserProfile> {
    await this.db.$transaction([
      this.db.userProfile.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.db.interest.deleteMany({ where: { userId } }),
      this.db.interest.createMany({
        data: interests.map((i) => ({ userId, category: i.category, rating: i.rating })),
      }),
    ]);
    return this.requireProfile(userId);
  }

  /** Re-read after a write that guarantees the profile row exists. */
  private async requireProfile(userId: string): Promise<UserProfile> {
    const me = await this.getMe(userId);
    return me.profile as UserProfile;
  }

  /**
   * GDPR erasure. The local wipe is transactional and runs before the Clerk
   * call, so a failure can never leave the Clerk identity gone while personal
   * data remains. If Clerk fails afterwards, a retry wipes nothing locally
   * and calls Clerk again.
   */
  async deleteAccount(userId: string, clerk: ClerkClient): Promise<void> {
    await this.db.$transaction([
      this.db.interest.deleteMany({ where: { userId } }),
      this.db.userProfile.deleteMany({ where: { userId } }),
      this.db.trip.deleteMany({ where: { userId } }),
    ]);
    await clerk.users.deleteUser(userId);
  }
}
