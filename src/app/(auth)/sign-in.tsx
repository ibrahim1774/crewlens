import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { sendEmailCode, signInWithApple, verifyEmailCode } from '@/lib/auth';
import { meta } from '@/lib/db';

export default function SignIn() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'sign_in' });
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const fail = (e: unknown) => Alert.alert('Could not sign in', e instanceof Error ? e.message : 'Try again.');

  const apple = async () => {
    setBusy(true);
    try {
      const { fullName } = await signInWithApple();
      if (fullName) await meta.set('pending_name', fullName);
      track('sign_in', { method: 'apple' });
      router.replace('/');
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED')) fail(e);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      await sendEmailCode(email);
      setSent(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await verifyEmailCode(email, code);
      track('sign_in', { method: 'email' });
      router.replace('/');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>STEP 2 OF 10</Mono>
        <Heading size={34} bold>Sign in</Heading>
        <Body color={Colors.ink2}>Your photos sync to your account so the office and your crew see them.</Body>
      </View>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radius.card}
          style={{ height: 52 }}
          onPress={apple}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
        <Mono color={Colors.ink2} size={11}>OR EMAIL</Mono>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
      </View>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!sent}
        placeholder="you@company.com"
        testID="email"
      />
      {sent ? (
        <View style={{ gap: Space.sm }}>
          <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: 4 }}>
            <Heading size={18}>Check your email</Heading>
            <Body size={13} color={Colors.ink2}>Tap the sign-in link in the email from Crew Lens. It opens this app and signs you in. If the email shows a 6-digit code instead, enter it below.</Body>
          </View>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" testID="code" />
        </View>
      ) : null}
      {sent ? (
        <Button title="Verify code" onPress={verify} loading={busy} disabled={code.length < 6} variant="secondary" />
      ) : (
        <Button title="Send code" onPress={send} loading={busy} disabled={!email.includes('@')} variant="secondary" />
      )}
      {sent ? <Button title="Use a different email" variant="ghost" onPress={() => { setSent(false); setCode(''); }} /> : null}
    </Screen>
  );
}
