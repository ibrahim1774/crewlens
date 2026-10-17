import { useEffect, useState } from 'react';

import { initAttribution } from '@/lib/analytics';
import { clearLocalIdentity, ensureMembershipChecked, getSession, initAuth } from '@/lib/auth';
import { companyLoaded, getCompany, getMember, loadCachedCompany, setMembershipChecked } from '@/lib/company';
import { meta, ready } from '@/lib/db';

export interface BootState {
  done: boolean;
  onboarded: boolean;
}

let bootPromise: Promise<BootState> | null = null;

/** Opens SQLite, restores the session, loads the cached company and refreshes it from the server. Idempotent. */
export function boot(): Promise<BootState> {
  if (!bootPromise) {
    bootPromise = (async () => {
      await ready();
      await initAuth();
      await loadCachedCompany();
      initAttribution().catch(() => {});
      const session = getSession();
      const cachedUser = getMember()?.userId ?? null;
      if (session && cachedUser && cachedUser !== session.user.id) {
        // Cache belongs to another account: wipe it before anything renders.
        await clearLocalIdentity();
      }
      if (session && !getCompany()) {
        await ensureMembershipChecked(session.user.id);
      } else if (!session) {
        setMembershipChecked(false);
      }
      const onboarded = (await meta.get('onboarded')) === '1';
      return { done: true, onboarded };
    })();
  }
  return bootPromise;
}

export function useBoot(): BootState {
  const [state, setState] = useState<BootState>({ done: false, onboarded: false });
  useEffect(() => {
    let alive = true;
    boot().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export { companyLoaded };
