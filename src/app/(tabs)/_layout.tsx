import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, router, Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useCompany, useMembershipChecked } from '@/lib/company';
import { routeFor } from '@/lib/gate';

const TABS: Record<string, { label: string; icon: SFSymbol; active: SFSymbol; testID: string }> = {
  index: { label: 'Jobs', icon: 'square.grid.2x2', active: 'square.grid.2x2.fill', testID: 'tab-jobs' },
  activity: { label: 'Activity', icon: 'clock', active: 'clock.fill', testID: 'tab-activity' },
  shared: { label: 'Shared', icon: 'link', active: 'link', testID: 'tab-shared' },
  you: { label: 'You', icon: 'person', active: 'person.fill', testID: 'tab-you' },
};

/** Floating white pill with round icon buttons and a wide black camera button in the middle. */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => r.name !== 'camera-slot');
  const half = Math.ceil(routes.length / 2);

  const TabButton = ({ name, routeKey }: { name: string; routeKey: string }) => {
    const meta = TABS[name];
    if (!meta) return null;
    const focused = state.routes[state.index]?.key === routeKey;
    return (
      <Pressable
        onPress={() => {
          const e = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(name as never);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        testID={meta.testID}
        hitSlop={4}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? Colors.canvas : 'transparent',
          opacity: pressed ? 0.6 : 1,
        })}>
        <SymbolView name={focused ? meta.active : meta.icon} size={21} tintColor={focused ? Colors.ink : Colors.ink2} />
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12), alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          padding: 8,
          borderRadius: Radius.pill,
          backgroundColor: Colors.surface,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}>
        {routes.slice(0, half).map((r) => (
          <TabButton key={r.key} name={r.name} routeKey={r.key} />
        ))}
        <Pressable
          onPress={() => router.push('/camera')}
          accessibilityRole="button"
          accessibilityLabel="Open camera"
          testID="tab-camera"
          style={({ pressed }) => ({ width: 92, height: 48, borderRadius: 24, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <SymbolView name="camera.fill" size={22} tintColor={Colors.surface} />
        </Pressable>
        {routes.slice(half).map((r) => (
          <TabButton key={r.key} name={r.name} routeKey={r.key} />
        ))}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { session } = useSession();
  const company = useCompany();
  const checked = useMembershipChecked();
  const route = routeFor({ session: !!session, membershipChecked: checked, company: !!company });
  if (route && route !== '/(tabs)') return <Redirect href={route} />;
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.canvas } }}>
      <Tabs.Screen name="index" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="camera-slot" options={{ title: '' }} />
      <Tabs.Screen name="shared" options={{ title: 'Shared' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
