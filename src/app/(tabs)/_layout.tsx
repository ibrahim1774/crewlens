import { Redirect, Tabs } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useCompany } from '@/lib/company';

export default function TabsLayout() {
  const { session } = useSession();
  const company = useCompany();
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!company) return <Redirect href="/(auth)/name" />;
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.canvas } }} />;
}
