import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';
import type { OptimizeResponse } from '@smartroute/shared';
import { SignInScreen } from '../screens/SignInScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { TripsListScreen } from '../screens/TripsListScreen';
import { TripDetailScreen } from '../screens/TripDetailScreen';

export type RootStackParamList = {
  SignIn: undefined;
  Planner: undefined;
  Results: {
    response: OptimizeResponse;
    request: { cities: string[]; departDate: string; directOnly: boolean };
  };
  TripsList: undefined;
  TripDetail: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isSignedIn ? (
          <>
            <Stack.Screen
              name="Planner"
              component={PlannerScreen}
              options={{ title: 'SmartRoute' }}
            />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Routes' }} />
            <Stack.Screen
              name="TripsList"
              component={TripsListScreen}
              options={{ title: 'My Trips' }}
            />
            <Stack.Screen
              name="TripDetail"
              component={TripDetailScreen}
              options={{ title: 'Trip' }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
