import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SHARED_VERSION } from '@smartroute/shared';

export default function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SmartRoute</Text>
      <Text style={styles.subtitle}>shared v{SHARED_VERSION}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '600', color: '#0D9488' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#64748B' },
});
