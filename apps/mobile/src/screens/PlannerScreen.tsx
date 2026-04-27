import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { Screen } from '../components/Screen';
import { CityPicker } from '../components/CityPicker';
import { useOptimize } from '../hooks/useOptimize';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function PlannerScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Planner'>>();
  const { signOut } = useAuth();
  const { state, run } = useOptimize();
  const [cities, setCities] = useState<string[]>(['JFK', 'CDG', 'FCO']);
  const [departDate, setDepartDate] = useState('2026-06-01');
  const [perCity, setPerCity] = useState('2');
  const [directOnly, setDirectOnly] = useState(false);

  useEffect(() => {
    if (state.status === 'success') {
      nav.navigate('Results', {
        response: state.data,
        request: { cities, departDate, directOnly },
      });
    }
  }, [state, cities, departDate, directOnly, nav]);

  async function submit(): Promise<void> {
    if (cities.length < 2) return;
    const days = Number(perCity) || 2;
    await run({
      cities,
      perCityDays: cities.map(() => days),
      departDate,
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly,
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Plan a trip</Text>
          <Button title="Sign out" onPress={() => signOut()} />
        </View>
        <Text style={styles.label}>Cities (2–8)</Text>
        <CityPicker selected={cities} onChange={setCities} />
        <Text style={styles.label}>Depart date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={departDate}
          onChangeText={setDepartDate}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Days per city</Text>
        <TextInput
          style={styles.input}
          value={perCity}
          onChangeText={setPerCity}
          keyboardType="number-pad"
        />
        <View style={styles.row}>
          <Text style={styles.label}>Direct flights only</Text>
          <Switch value={directOnly} onValueChange={setDirectOnly} />
        </View>
        <View style={{ marginTop: 16 }}>
          <Button
            title={state.status === 'loading' ? 'Optimizing…' : 'Find routes'}
            onPress={submit}
            disabled={state.status === 'loading' || cities.length < 2}
          />
        </View>
        <View style={{ marginTop: 12 }}>
          <Button title="My saved trips" onPress={() => nav.navigate('TripsList')} />
        </View>
        {state.status === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 14, color: '#475569', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  error: { color: '#DC2626', marginTop: 12 },
});
