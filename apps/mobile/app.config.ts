import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'SmartRoute',
  slug: 'smartroute',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  splash: { resizeMode: 'contain', backgroundColor: '#ffffff' },
  ios: { supportsTablet: false, bundleIdentifier: 'com.smartroute.app' },
  android: {
    package: 'com.smartroute.app',
    adaptiveIcon: { backgroundColor: '#ffffff' },
  },
  assetBundlePatterns: ['**/*'],
  plugins: ['expo-secure-store'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  },
};

export default config;
