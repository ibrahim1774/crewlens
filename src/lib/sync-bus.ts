/** Lets data modules ask for a sync without importing the uploader (avoids a require cycle). */
let handler: (() => void) | null = null;

export function onSyncRequest(fn: () => void) {
  handler = fn;
}

export function requestSync() {
  handler?.();
}
