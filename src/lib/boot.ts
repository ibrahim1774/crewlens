import { useEffect, useState } from 'react';

import { initAttribution } from '@/lib/analytics';
import { getSession, initAuth } from '@/lib/auth';
import { companyLoaded, fetchMembership, getCompany, loadCachedCompany } from '@/lib/company';
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
      if (session && !getCompany()) {
        await fetchMembership(session.user.id).catch(() => null);
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
