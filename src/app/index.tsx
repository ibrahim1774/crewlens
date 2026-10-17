import { Redirect } from 'expo-router';

import { useSession } from '@/lib/auth';
import { useCompany } from '@/lib/company';

/** Routing gate: no session → welcome; session without company → name; else tabs. */
export default function Index() {
  const { session } = useSession();
  const company = useCompany();
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!company) return <Redirect href="/(auth)/name" />;
  return <Redirect href="/(tabs)" />;
}
