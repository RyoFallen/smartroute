import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Screen } from '../components/Screen';

export function SignInScreen(): JSX.Element {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);

  async function sendCode(): Promise<void> {
    if (!isLoaded) return;
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
      if (!factor) throw new Error('Email code not available for this account');
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: (factor as { emailAddressId: string }).emailAddressId,
      });
      setStage('code');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify(): Promise<void> {
    if (!isLoaded) return;
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Sign-in incomplete');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>SmartRoute</Text>
      <Text style={styles.subtitle}>Sign in to plan your trip</Text>
      {stage === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Send code" onPress={sendCode} />
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Button title="Verify" onPress={verify} />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '700', color: '#0D9488', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  error: { color: '#DC2626', marginTop: 12 },
});
