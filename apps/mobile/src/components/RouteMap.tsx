import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { findAirport } from '../data/airports';

type Props = { order: string[]; height?: number };

export function RouteMap({ order, height = 280 }: Props) {
  const points = order
    .map((c) => findAirport(c))
    .filter((a): a is NonNullable<ReturnType<typeof findAirport>> => Boolean(a))
    .map((a) => ({ latitude: a.lat, longitude: a.lng, code: a.code, name: a.name }));

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Map unavailable</Text>
      </View>
    );
  }

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const region = {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    latitudeDelta: Math.max(...lats) - Math.min(...lats) + 10,
    longitudeDelta: Math.max(...lngs) - Math.min(...lngs) + 10,
  };

  return (
    <MapView style={[styles.map, { height }]} provider={PROVIDER_DEFAULT} initialRegion={region}>
      {points.map((p) => (
        <Marker
          key={p.code}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          title={p.code}
          description={p.name}
        />
      ))}
      <Polyline
        coordinates={points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
        strokeColor="#0D9488"
        strokeWidth={3}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 12, overflow: 'hidden' },
  empty: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#64748B' },
});
