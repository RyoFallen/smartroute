// apps/mobile/App.tsx
import { ClerkProvider } from '@clerk/clerk-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { config } from './src/config';
import { tokenCache } from './src/auth/tokenCache';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App(): JSX.Element {
  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
