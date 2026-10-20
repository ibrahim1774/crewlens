import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { registersAt } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getMember } from '@/lib/company';
import { normalizeCode, sendEmailCode, signInWithApple, verifyEmailCode } from '@/lib/auth';
import { meta } from '@/lib/db';

/**
 * Email code first, then Apple.
 * `save` is the onboarding step after the plan: it attaches the email or Apple ID to the guest account that
 * already holds the company and the purchase. Without it, this is Sign in for an existing account.
 */
export function SignInForm({ save = false }: { save?: boolean }) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Saving links the email or Apple ID to this guest account; if that one already has an account, they can switch to it.
  const [linking, setLinking] = useState(save);

  useEffect(() => {
    track('onboarding_step', { step: save ? 'save_account' : 'sign_in' });
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, [save]);

  const fail = (e: unknown, signInInstead?: () => void) => {
    if (e instanceof Error && e.message === 'account_exists') {
      if (linking && signInInstead) {
        Alert.alert('You already have an account', 'Use a different one to save this setup, or sign in to the account you have. Plans you bought restore from Plans in the You tab.', [
          { text: 'Use a different one', style: 'cancel' },
          {
            text: 'Sign in to it',
            onPress: () => {
              track('account_switched');
              setLinking(false);
              signInInstead();
            },
          },
        ]);
      } else Alert.alert('That email already has an account', 'Try signing in with it instead.');
      return;
    }
    Alert.alert(linking ? 'Could not save your account' : 'Could not sign in', e instanceof Error ? e.message : 'Try again.');
  };

  const done = (how: string, linked: boolean) => {
    track(linked ? 'account_saved' : 'sign_in', { method: how });
    // The guest became a real account just now; this is the registration ad networks should count.
    if (registersAt({ step: 'save', guest: linked })) trackRegistration(getMember()?.role === 'member' ? 'join' : 'create');
    // Saving keeps going through onboarding; a sign-in goes back to the gate, which knows where this account belongs.
    router.replace(linked ? '/(auth)/permissions' : '/');
  };

  const apple = async (link = linking) => {
    setBusy(true);
    try {
      const { fullName } = await signInWithApple(link);
      if (fullName) await meta.set('pending_name', fullName);
      done('apple', link);
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED')) fail(e, () => void apple(false));
    } finally {
      setBusy(false);
    }
  };

  const send = async (link = linking) => {
    setBusy(true);
    try {
      await sendEmailCode(email, link);
      setSent(true);
    } catch (e) {
      fail(e, () => void send(false));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (busy) return;
    setBusy(true);
    try {
      await verifyEmailCode(email, value, linking);
      done('email', linking);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSent(false);
    setCode('');
  };

  const ready = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen>
      <View style={{ gap: Space.sm }}>
        <Heading size={34} bold>{save ? 'Save your account' : 'Sign in'}</Heading>
        <Body color={Colors.ink2}>
          {save
            ? 'Last step. Your jobs, photos and plan stay safe if you lose or switch phones.'
            : 'Welcome back. Your jobs, photos and paperwork are waiting in your account.'}
        </Body>
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
            <Body size={13} color={Colors.ink2}>{`We sent a 6-digit code to ${email.trim()}. Enter it below and you're in as soon as the sixth digit is typed.`}</Body>
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
          <Button title="Send a new code" variant="ghost" onPress={() => void send()} disabled={busy} testID="resend-code" />
          <Button title="Use a different email" variant="ghost" onPress={reset} />
        </View>
      ) : (
        <Button title="Email me a code" onPress={() => void send()} loading={busy} disabled={!ready} testID="send-code" />
      )}

      {!sent && appleAvailable ? (
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
            onPress={() => void apple()}
          />
        </>
      ) : null}
    </Screen>
  );
}
