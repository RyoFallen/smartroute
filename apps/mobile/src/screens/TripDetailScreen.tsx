import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { RouteMap } from '../components/RouteMap';
import { useTrip } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function TripDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TripDetail'>>();
  const { trip, error } = useTrip(route.params.id);

  if (error)
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  if (!trip)
    return (
      <Screen>
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>{trip.name}</Text>
        <Text style={styles.meta}>
          {trip.startDate} – {trip.endDate} · {trip.travelers} traveler(s) · {trip.cabinClass}
        </Text>
        <View style={{ marginVertical: 16 }}>
          <RouteMap order={trip.cities} />
        </View>
        <View style={{ marginBottom: 16 }}>
          <Button title="Plan trip" onPress={() => nav.navigate('TripPlan', { id: trip.id })} />
        </View>
        <Text style={styles.section}>Flights</Text>
        {trip.flights.map((f, i) => (
          <View key={i} style={styles.leg}>
            <Text style={styles.legTitle}>
              {f.origin} → {f.destination} · {f.carrier}
            </Text>
            <Text style={styles.legMeta}>
              {new Date(f.depart).toLocaleString()} → {new Date(f.arrive).toLocaleString()}
            </Text>
            <Text style={styles.legMeta}>
              ${(f.priceCents / 100).toFixed(0)} · {Math.round(f.durationMin / 60)}h · {f.stops}{' '}
              stop(s)
            </Text>
          </View>
        ))}
        <Text style={styles.total}>Total: ${(trip.totalPriceCents / 100).toFixed(0)}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 8 },
  leg: { padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 8 },
  legTitle: { fontWeight: '600', color: '#0F172A' },
  legMeta: { color: '#475569', marginTop: 2 },
  total: { fontSize: 18, fontWeight: '700', marginTop: 16, color: '#0D9488' },
  loading: { color: '#64748B' },
  error: { color: '#DC2626' },
});
