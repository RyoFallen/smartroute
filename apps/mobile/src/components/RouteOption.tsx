import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteOption as RouteOptionT } from '@smartroute/shared';

const labelText: Record<string, string> = {
  cheapest: 'Cheapest',
  fastest: 'Fastest',
  most_direct: 'Most direct',
};

const labelColor: Record<string, string> = {
  cheapest: '#0D9488',
  fastest: '#2563EB',
  most_direct: '#7C3AED',
};

export function RouteOption({
  option,
  onPress,
}: {
  option: RouteOptionT;
  onPress?: () => void;
}): JSX.Element {
  const totalUsd = (option.totalPriceCents / 100).toFixed(0);
  const totalH = Math.round(option.totalDurationMin / 60);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.tag, { backgroundColor: labelColor[option.label] ?? '#64748B' }]}>
        <Text style={styles.tagText}>{labelText[option.label] ?? option.label}</Text>
      </View>
      <Text style={styles.order}>{option.order.join(' → ')}</Text>
      <Text style={styles.meta}>
        ${totalUsd} · {totalH}h · {option.flights.length} legs
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  order: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  meta: { marginTop: 6, color: '#475569' },
});
