import { useSyncExternalStore } from 'react';

/**
 * Tiny change bus. Every db write calls notify(); screens subscribe with useStore.
 * The selector is re-run on each notify and the result cached, so selectors can
 * return fresh arrays without causing render loops.
 */
const listeners = new Set<() => void>();
let version = 0;

export function notify() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Re-renders when notify() fires. Returns the current version counter. */
export function useVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
