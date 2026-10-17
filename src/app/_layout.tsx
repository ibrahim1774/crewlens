import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SuperwallProvider } from 'expo-superwall';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { posthog, screen, track } from '@/lib/analytics';
import { handleAuthUrl } from '@/lib/auth';
import { useBoot } from '@/lib/boot';
import { SubscriptionSync, SUPERWALL_KEY, superwallActive } from '@/lib/paywall';
import { startUploader } from '@/lib/uploader';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.canvas,
    card: Colors.surface,
    text: Colors.ink,
    primary: Colors.flag,
    border: Colors.hairline,
  },
};

function ScreenTracker() {
  const path = usePathname();
  useEffect(() => {
    screen(path);
  }, [path]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const { done } = useBoot();
  const ready = (fontsLoaded || !!fontError) && done;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Magic-link sign-in: the email's link opens crewlens://auth/callback with the session tokens.
  useEffect(() => {
    if (!ready) return;
    const handle = (url: string | null) => {
      if (!url) return;
      handleAuthUrl(url)
        .then((signedIn) => {
          if (signedIn) {
            track('sign_in', { method: 'magic_link' });
            router.replace('/');
          }
        })
        .catch((e: unknown) => Alert.alert('Could not sign in', e instanceof Error && e.message !== 'missing_code' ? e.message : 'Open the newest email and try the link again.'));
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    return startUploader();
  }, [ready]);

  if (!ready) return null;

  const app = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <ScreenTracker />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="job/new" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 12 }} />
          <Stack.Screen name="job/edit" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 12 }} />
          <Stack.Screen name="job/[id]" />
          <Stack.Screen name="photo/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );

  const tracked = posthog ? (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>
      {app}
    </PostHogProvider>
  ) : (
    app
  );

  if (!superwallActive) return tracked;
  return (
    <SuperwallProvider
      apiKeys={{ ios: SUPERWALL_KEY }}
      options={{ testModeBehavior: __DEV__ ? 'always' : 'never' }}
      onConfigurationError={(e) => console.warn('Superwall configuration failed', e)}>
      <SubscriptionSync />
      {tracked}
    </SuperwallProvider>
  );
}
