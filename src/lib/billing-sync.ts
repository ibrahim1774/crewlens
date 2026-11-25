import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/lib/auth';
import { refreshEntitlement, setBillingUser } from '@/lib/billing';
import { useMember } from '@/lib/company';

/**
 * Keeps the entitlement fresh: on sign-in or account change, when the app comes to the foreground,
 * and after the membership is fetched (the company's owner is who pays). Mount once, with or without Superwall.
 */
export function BillingSync(): null {
  const { session } = useSession();
  const member = useMember();
  const uid = session?.user.id ?? null;
  const companyId = member?.companyId ?? null;

  useEffect(() => {
    setBillingUser(uid);
    void refreshEntitlement();
  }, [uid, companyId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshEntitlement();
    });
    return () => sub.remove();
  }, []);

  return null;
}
