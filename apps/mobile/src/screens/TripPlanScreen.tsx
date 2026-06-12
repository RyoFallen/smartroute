import {
  Linking,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { Attraction, TripPlanCity } from '@smartroute/shared';
import { Screen } from '../components/Screen';
import { useTripPlan } from '../hooks/useTripPlan';
import type { RootStackParamList } from '../navigation/RootNavigator';

const CATEGORY_META: Record<Attraction['category'], { emoji: string; label: string }> = {
  LANDMARK: { emoji: '📍', label: 'Landmark' },
  MUSEUM: { emoji: '🏛️', label: 'Museum' },
  RELIGIOUS: { emoji: '🕌', label: 'Religious' },
  PARK: { emoji: '🌳', label: 'Park' },
  VIEWPOINT: { emoji: '🌆', label: 'Viewpoint' },
  HISTORICAL: { emoji: '🏰', label: 'Historical' },
  MARKET: { emoji: '🛍️', label: 'Market' },
};

function openInMaps(a: Attraction): void {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${a.lat},${a.lon}&q=${encodeURIComponent(a.name)}`
      : `geo:${a.lat},${a.lon}?q=${encodeURIComponent(a.name)}`;
  void Linking.openURL(url);
}

type PlanSection = { title: string; available: boolean; data: Attraction[] };

export function TripPlanScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripPlan'>>();
  const { plan, error } = useTripPlan(route.params.id);

  if (error)
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  if (!plan)
    return (
      <Screen>
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );

  const sections: PlanSection[] = plan.cities.map((c: TripPlanCity, i: number) => ({
    title: `${i + 1}. ${c.name ?? c.iata}`,
    available: c.available,
    data: c.mustGo,
  }));

  return (
    <Screen>
      <SectionList<Attraction, PlanSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderSectionHeader={({ section }: { section: PlanSection }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderSectionFooter={({ section }: { section: PlanSection }) =>
          section.available ? null : (
            <Text style={styles.unavailable}>No guide for this city yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const meta = CATEGORY_META[item.category];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.chip}>
                  {meta.emoji} {meta.label}
                </Text>
              </View>
              <Text style={styles.description}>{item.description}</Text>
              <TouchableOpacity onPress={() => openInMaps(item)}>
                <Text style={styles.mapsLink}>Open in maps →</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  unavailable: { color: '#94A3B8', fontStyle: 'italic', marginBottom: 12 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '600', color: '#0F172A', fontSize: 15, flexShrink: 1 },
  chip: { color: '#475569', fontSize: 12, marginLeft: 8 },
  description: { color: '#475569', marginTop: 4 },
  mapsLink: { color: '#0D9488', fontWeight: '600', marginTop: 8 },
  loading: { color: '#64748B' },
  error: { color: '#DC2626' },
});
