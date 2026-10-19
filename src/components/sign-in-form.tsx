import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { registersAt, stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getMember } from '@/lib/company';
import { formatUSPhone, normalizeCode, sendEmailCode, sendPhoneCode, signInWithApple, toE164US, verifyEmailCode, verifyPhoneCode } from '@/lib/auth';
import { meta } from '@/lib/db';

type Method = 'phone' | 'email';

/**
 * Phone number first (a texted code iOS fills in for you), then Apple, with email one tap away.
 * `save` is the onboarding step after the plan: it attaches the number to the guest account that
 * already holds the company and the purchase. Without it, this is Sign in for an existing account.
 */
export function SignInForm({ save = false }: { save?: boolean }) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: save ? 'save_account' : 'sign_in' });
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, [save]);

  const fail = (e: unknown) => {
    if (e instanceof Error && e.message === 'account_exists') {
      Alert.alert(
        method === 'phone' ? 'That number already has an account' : 'That email already has an account',
        save ? 'Use a different one to save this account. Signing in to the other account would leave the setup you just did behind.' : 'Try signing in with it instead.',
      );
      return;
    }
    Alert.alert(save ? 'Could not save your account' : 'Could not sign in', e instanceof Error ? e.message : 'Try again.');
  };

  const done = (how: string) => {
    track(save ? 'account_saved' : 'sign_in', { method: how });
    // The guest became a real account just now; this is the registration ad networks should count.
    if (registersAt({ step: 'save', guest: save })) trackRegistration(getMember()?.role === 'member' ? 'join' : 'create');
    // Saving keeps going through onboarding; a sign-in goes back to the gate, which knows where this account belongs.
    router.replace(save ? '/(auth)/first-job' : '/');
  };

  const apple = async () => {
    setBusy(true);
    try {
      const { fullName } = await signInWithApple(save);
      if (fullName) await meta.set('pending_name', fullName);
      done('apple');
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED')) fail(e);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      if (method === 'phone') await sendPhoneCode(phone, save);
      else await sendEmailCode(email, save);
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
      if (method === 'phone') await verifyPhoneCode(phone, value, save);
      else await verifyEmailCode(email, value, save);
      done(method);
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

  const ready = method === 'phone' ? toE164US(phone) !== null : /^\S+@\S+\.\S+$/.test(email.trim());
  const sentTo = method === 'phone' ? phone : email.trim();

  return (
    <Screen>
      <View style={{ gap: Space.sm }}>
        {save ? <Mono color={Colors.ink2} size={11}>{stepLabel('save')}</Mono> : null}
        <Heading size={34} bold>{save ? 'Save your account' : 'Sign in'}</Heading>
        <Body color={Colors.ink2}>
          {save
            ? 'Last step. Your jobs, photos and plan stay safe if you lose or switch phones.'
            : 'Welcome back. Your jobs, photos and paperwork are waiting in your account.'}
        </Body>
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
                ? `We texted a 6-digit code to ${sentTo}. Tap it above the keyboard and you're in.`
                : `We sent a 6-digit code to ${sentTo}. Enter it below and you're in as soon as the sixth digit is typed.`}
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
            autoFocus
            testID="code"
          />
          <Button title="Verify code" onPress={() => void verify()} loading={busy} disabled={code.length < 6} testID="verify-code" />
          <Button title="Send a new code" variant="ghost" onPress={send} disabled={busy} testID="resend-code" />
          <Button title={method === 'phone' ? 'Use a different number' : 'Use a different email'} variant="ghost" onPress={() => switchTo(method)} />
        </View>
      ) : (
        <Button title={method === 'phone' ? 'Text me a code' : 'Email me a code'} onPress={send} loading={busy} disabled={!ready} testID="send-code" />
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
