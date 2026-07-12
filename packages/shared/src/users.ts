import { z } from 'zod';
import { InterestCategory, InterestRating } from './interests.js';

// Trip-pacing settings ("preferences" — never interest ratings; see glossary).
export const TripIntensity = z.enum(['RELAXED', 'MODERATE', 'PACKED']);
export type TripIntensity = z.infer<typeof TripIntensity>;

export const WakeUpTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected "HH:mm"');

export const InterestEntry = z.object({
  category: InterestCategory,
  rating: InterestRating,
});
export type InterestEntry = z.infer<typeof InterestEntry>;

export const UserProfile = z.object({
  intensity: TripIntensity,
  wakeUpTime: WakeUpTime,
  interests: z.array(InterestEntry),
});
export type UserProfile = z.infer<typeof UserProfile>;

// `profile: null` until the first write — the mobile onboarding-gate signal.
export const GetMeResponse = z.object({ profile: UserProfile.nullable() });
export type GetMeResponse = z.infer<typeof GetMeResponse>;

export const UpdatePreferencesRequest = z.object({
  intensity: TripIntensity,
  wakeUpTime: WakeUpTime,
});
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;

// Full replace: entries not in the payload are deleted.
export const ReplaceInterestsRequest = z.object({
  interests: z
    .array(InterestEntry)
    .refine(
      (entries) => new Set(entries.map((e) => e.category)).size === entries.length,
      'Duplicate interest categories',
    ),
});
export type ReplaceInterestsRequest = z.infer<typeof ReplaceInterestsRequest>;
