import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { findAirport } from '../data/airports';

type Props = { selected: string[]; onChange: (next: string[]) => void };

export function CityPicker({ selected, onChange }: Props): JSX.Element {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(): void {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (selected.length >= 8) {
      setError('Maximum 8 cities');
      return;
    }
    if (selected.includes(code)) {
      setError('Already added');
      return;
    }
    if (!findAirport(code)) {
      setError('Unknown airport code');
      return;
    }
    onChange([...selected, code]);
    setDraft('');
    setError(null);
  }

  function remove(code: string): void {
    onChange(selected.filter((c) => c !== code));
  }

  return (
    <View>
      <View style={styles.chips}>
        {selected.map((code) => (
          <Pressable key={code} onPress={() => remove(code)} style={styles.chip}>
            <Text style={styles.chipText}>{code} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Add airport (e.g. CDG)"
        autoCapitalize="characters"
        autoCorrect={false}
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          setError(null);
        }}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: '#0D9488', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  chipText: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#DC2626', marginTop: 6 },
});
