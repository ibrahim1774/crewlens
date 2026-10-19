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
import { formatUSPhone, normalizeCode, sendEmailCode, sendPhoneCode, signInWithApple, toE164US, verifyEmailCode, verifyPhoneCode } from '@/lib/auth';
import { meta } from '@/lib/db';

type Method = 'phone' | 'email';

/** Phone number first (a texted code iOS fills in for you), then Apple, with email one tap away. */
export default function SignIn() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
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
      if (method === 'phone') await sendPhoneCode(phone);
      else await sendEmailCode(email);
      setSent(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (busy) return;
    setBusy(true);
    try {
      if (method === 'phone') await verifyPhoneCode(phone, value);
      else await verifyEmailCode(email, value);
      track('sign_in', { method });
      router.replace('/');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next: Method) => {
    setMethod(next);
    setSent(false);
    setCode('');
  };

  const ready = method === 'phone' ? toE164US(phone) !== null : email.includes('@');
  const sentTo = method === 'phone' ? phone : email.trim();

  return (
    <Screen>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>Step 2 of 10</Mono>
        <Heading size={34} bold>Sign in</Heading>
        <Body color={Colors.ink2}>Your jobs, photos and paperwork back up to your account. A lost or broken phone never means a lost job.</Body>
      </View>

      {method === 'phone' ? (
        <Field
          label="Mobile number"
          value={phone}
          onChangeText={(t) => setPhone(formatUSPhone(t))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={!sent}
          placeholder="(555) 555-0123"
          testID="phone"
        />
      ) : (
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
      )}

      {sent ? (
        <View style={{ gap: Space.sm }}>
          <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: 4 }}>
            <Heading size={18}>{method === 'phone' ? 'Check your texts' : 'Check your email'}</Heading>
            <Body size={13} color={Colors.ink2}>
              {method === 'phone'
                ? `We texted a 6-digit code to ${sentTo}. Tap it above the keyboard and you're signed in.`
                : `We sent a 6-digit code to ${sentTo}. Enter it below and you're signed in as soon as the sixth digit is in. On this phone you can also tap the link in the email.`}
            </Body>
          </View>
          <Field
            label="6-digit code"
            value={code}
            onChangeText={(t) => {
              const next = normalizeCode(t);
              setCode(next);
              if (next.length === 6) void verify(next);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            testID="code"
          />
          <Button title="Verify code" onPress={() => void verify()} loading={busy} disabled={code.length < 6} />
          <Button title={method === 'phone' ? 'Use a different number' : 'Use a different email'} variant="ghost" onPress={() => switchTo(method)} />
        </View>
      ) : (
        <Button title={method === 'phone' ? 'Text me a code' : 'Send code'} onPress={send} loading={busy} disabled={!ready} testID="send-code" />
      )}

      {!sent ? (
        <>
          {appleAvailable ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
                <Mono color={Colors.ink2} size={11}>Or</Mono>
                <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={Radius.card}
                style={{ height: 52 }}
                onPress={apple}
              />
            </>
          ) : null}
          <Button
            title={method === 'phone' ? 'Use email instead' : 'Use phone number instead'}
            variant="ghost"
            onPress={() => switchTo(method === 'phone' ? 'email' : 'phone')}
            testID={method === 'phone' ? 'use-email' : 'use-phone'}
          />
        </>
      ) : null}
    </Screen>
  );
}
