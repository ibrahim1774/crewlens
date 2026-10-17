/** One-shot hand-off from the new-job sheet back to the camera underneath it. */
let pending: string | null = null;

export function setCameraJob(id: string) {
  pending = id;
}

export function consumeCameraJob(): string | null {
  const v = pending;
  pending = null;
  return v;
}
