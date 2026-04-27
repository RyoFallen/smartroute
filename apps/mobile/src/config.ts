import Constants from 'expo-constants';

type Extras = { apiUrl: string; clerkPublishableKey: string };

const extras = (Constants.expoConfig?.extra ?? {}) as Partial<Extras>;

if (!extras.apiUrl) {
  throw new Error('Missing extra.apiUrl in app.config.ts');
}
if (!extras.clerkPublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env var');
}

export const config = {
  apiUrl: extras.apiUrl,
  clerkPublishableKey: extras.clerkPublishableKey,
};
