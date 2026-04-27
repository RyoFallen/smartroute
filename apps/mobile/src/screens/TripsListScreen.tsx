import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { useTripsList } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function TripsListScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TripsList'>>();
  const { trips, error, loading, refresh } = useTripsList();

  return (
    <Screen>
      <Text style={styles.title}>Saved trips</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={trips ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No saved trips yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => nav.navigate('TripDetail', { id: item.id })}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.cities.join(' → ')} · ${(item.totalPriceCents / 100).toFixed(0)}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  name: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 4 },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 32 },
  error: { color: '#DC2626', marginBottom: 12 },
});
