import { Redirect, router, Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useCompany } from '@/lib/company';

function icon(name: SFSymbol, active: SFSymbol) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <SymbolView name={focused ? active : name} size={22} tintColor={color} />
  );
}

/** The centre slot: a raised flag-orange circle that opens the camera as a modal. */
function CameraButton() {
  return (
    <Pressable
      onPress={() => router.push('/camera')}
      accessibilityRole="button"
      accessibilityLabel="Open camera"
      testID="tab-camera"
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'flex-start', top: -18, opacity: pressed ? 0.85 : 1 })}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: Colors.flag,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: Colors.canvas,
        }}>
        <SymbolView name="camera.fill" size={26} tintColor={Colors.surface} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { session } = useSession();
  const company = useCompany();
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!company) return <Redirect href="/(auth)/name" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.canvas },
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: Colors.ink2,
        tabBarLabelStyle: { fontFamily: Fonts.heading, fontSize: 12, letterSpacing: 0.2 },
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.hairline, borderTopWidth: 1, height: 84, paddingTop: 6 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: icon('briefcase', 'briefcase.fill') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('clock', 'clock.fill') }} />
      <Tabs.Screen name="camera-slot" options={{ title: '', tabBarButton: () => <CameraButton /> }} />
      <Tabs.Screen name="shared" options={{ title: 'Shared', tabBarIcon: icon('link', 'link') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('person', 'person.fill') }} />
    </Tabs>
  );
}
