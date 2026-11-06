import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { registersAt } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getMember } from '@/lib/company';
import { GOOGLE_CANCELLED, normalizeCode, passwordProblem, sendEmailCode, setNewPassword, signInWithApple, signInWithGoogle, signInWithPassword, signUpWithPassword, verifyEmailCode } from '@/lib/auth';
import { meta } from '@/lib/db';

/**
 * Email and password, then Apple and Google. Forgot password uses an emailed code, then asks for a new password.
 * `save` is the onboarding step after the plan: it attaches the email or Apple ID to the guest account that
 * already holds the company and the purchase. Without it, this is Sign in for an existing account.
 */
export function SignInForm({ save = false }: { save?: boolean }) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPasswordState] = useState('');
  // iOS can fill the field itself (Automatic Strong Password) without firing onChangeText, so the latest
  // value is also taken from onEndEditing, which reports the field's real text, and read from a ref.
  const passwordRef = useRef('');
  const setPassword = (t: string) => {
    passwordRef.current = t;
    setPasswordState(t);
  };
  const [busy, setBusy] = useState(false);
  // Forgot password: emailed code -> signed in -> choose a new password.
  const [forgot, setForgot] = useState<'off' | 'code' | 'new'>('off');
  const [code, setCode] = useState('');
  const [newPassword, setNewPasswordValue] = useState('');
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
      } else Alert.alert('That email already has an account', 'Sign in with it instead.');
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

  const google = async (link = linking) => {
    setBusy(true);
    try {
      const { fullName } = await signInWithGoogle(link);
      if (fullName) await meta.set('pending_name', fullName);
      done('google', link);
    } catch (e) {
      if (!(e instanceof Error && e.message === GOOGLE_CANCELLED)) fail(e, () => void google(false));
    } finally {
      setBusy(false);
    }
  };

  /** Save mode creates the account; Sign in mode signs in. `create` forces a sign-up from the Sign in screen. */
  const submit = async (create = save) => {
    if (busy) return;
    setBusy(true);
    // Ending the edit makes iOS report a filled-in password through onEndEditing.
    Keyboard.dismiss();
    await new Promise((r) => setTimeout(r, 120));
    const password = passwordRef.current;
    try {
      if (create) {
        await signUpWithPassword(email, password, linking);
        done('password', linking);
      } else {
        await signInWithPassword(email, password);
        done('password', false);
      }
    } catch (e) {
      fail(e, () => {
        // They said they already have the account: sign in with what they typed.
        setBusy(false);
        void submit(false);
      });
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    try {
      await sendEmailCode(email, false);
      setForgot('code');
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
      await verifyEmailCode(email, value, false);
      setForgot('new');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async () => {
    setBusy(true);
    try {
      await setNewPassword(newPassword);
      done('password_reset', false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen>
      <View style={{ gap: Space.sm }}>
        <Heading size={34} bold>{forgot !== 'off' ? 'Reset your password' : save ? 'Save your account' : 'Sign in'}</Heading>
        <Body color={Colors.ink2}>
          {forgot !== 'off'
            ? 'We email you a 6-digit code, then you choose a new password.'
            : save
              ? 'Last step. Create a password so your jobs, photos and plan stay safe if you lose or switch phones.'
              : 'Welcome back. Your jobs, photos and paperwork are waiting in your account.'}
        </Body>
      </View>

      {forgot === 'off' ? (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" keyboardType="email-address" placeholder="you@company.com" testID="email" />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            onEndEditing={(e) => setPassword(e.nativeEvent.text)}
            // Creating a password: iOS's Automatic Strong Password took over this field and swallowed the
            // typing, so autofill is off here ("oneTimeCode" is the documented switch). Signing in keeps
            // normal password autofill and iOS's "Save Password?" offer.
            autoComplete={save ? 'off' : 'current-password'}
            textContentType={save ? 'oneTimeCode' : 'password'}
            placeholder={save ? 'At least 8 characters' : 'Your password'}
            onSubmitEditing={() => void submit()}
            testID="password"
          />
          <Button title={save ? 'Create account' : 'Sign in'} onPress={() => void submit()} loading={busy} disabled={!validEmail || (!save && password.length === 0)} testID="password-submit" />
          {!save ? (
            <Button title="Create an account" variant="ghost" onPress={() => void submit(true)} disabled={busy || !validEmail} testID="password-create" />
          ) : null}
          {!linking ? <Button title="Forgot password?" variant="ghost" onPress={() => void sendCode()} disabled={busy || !validEmail} testID="forgot-password" /> : null}
        </>
      ) : null}

      {forgot === 'code' ? (
        <View style={{ gap: Space.sm }}>
          <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: 4 }}>
            <Heading size={18}>Check your email</Heading>
            <Body size={13} color={Colors.ink2}>{`We sent a 6-digit code to ${email.trim()}. Enter it below.`}</Body>
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
          <Button title="Send a new code" variant="ghost" onPress={() => void sendCode()} disabled={busy} testID="resend-code" />
          <Button title="Back to sign in" variant="ghost" onPress={() => { setForgot('off'); setCode(''); }} />
        </View>
      ) : null}

      {forgot === 'new' ? (
        <View style={{ gap: Space.sm }}>
          <Field label="New password" value={newPassword} onChangeText={setNewPasswordValue} autoCapitalize="none" autoCorrect={false} secureTextEntry autoComplete="off" textContentType="oneTimeCode" placeholder="At least 8 characters" testID="new-password" />
          <Button title="Save new password" onPress={() => void saveNewPassword()} loading={busy} disabled={passwordProblem(newPassword) !== null} testID="save-new-password" />
        </View>
      ) : null}

      {forgot === 'off' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
            <Mono color={Colors.ink2} size={11}>Or</Mono>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
          </View>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
              cornerRadius={Radius.card}
              style={{ height: 52 }}
              onPress={() => void apple()}
            />
          ) : null}
          <Button title="Continue with Google" variant="ghost" onPress={() => void google()} disabled={busy} testID="google-sign-in" style={{ height: 52, borderRadius: Radius.card }} />
        </>
      ) : null}
    </Screen>
  );
}
