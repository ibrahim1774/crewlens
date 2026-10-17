import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { posthog, screen } from '@/lib/analytics';
import { useBoot } from '@/lib/boot';

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

  return posthog ? (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>
      {app}
    </PostHogProvider>
  ) : (
    app
  );
}
