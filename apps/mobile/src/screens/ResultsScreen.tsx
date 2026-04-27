import { useMemo, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { RouteOption } from '../components/RouteOption';
import { RouteMap } from '../components/RouteMap';
import { useCreateTrip } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function ResultsScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Results'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const createTrip = useCreateTrip();
  const { response, request } = route.params;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => response.options[selectedIdx], [response, selectedIdx]);

  if (!response.options.length) {
    return (
      <Screen>
        <Text style={styles.title}>No routes found</Text>
        <Text style={styles.empty}>{response.reason ?? 'Try adjusting filters'}</Text>
        <Button title="Back" onPress={() => nav.goBack()} />
      </Screen>
    );
  }

  async function save(): Promise<void> {
    if (!selected) return;
    setSaving(true);
    try {
      const trip = await createTrip({
        name: `${request.cities.join(' → ')}`,
        startDate: request.departDate,
        endDate: request.departDate,
        cabinClass: 'ECONOMY',
        travelers: 1,
        cities: selected.order,
        flights: selected.flights,
        totalPriceCents: selected.totalPriceCents,
      });
      Alert.alert('Saved', 'Trip saved.', [
        { text: 'View', onPress: () => nav.navigate('TripDetail', { id: trip.id }) },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>Top routes</Text>
        {response.options.map((opt: (typeof response.options)[0], i: number) => (
          <View key={`${opt.label}-${i}`}>
            <RouteOption option={opt} onPress={() => setSelectedIdx(i)} />
            {selectedIdx === i ? <RouteMap order={opt.order} /> : null}
          </View>
        ))}
        <View style={{ marginTop: 16 }}>
          <Button
            title={saving ? 'Saving…' : 'Save selected trip'}
            onPress={save}
            disabled={saving}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  empty: { color: '#64748B', marginBottom: 16 },
});
