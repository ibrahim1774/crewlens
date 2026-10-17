import { consumeCameraJob, setCameraJob } from '@/lib/handoff';

test('camera job hand-off is read once', () => {
  expect(consumeCameraJob()).toBeNull();
  setCameraJob('j1');
  expect(consumeCameraJob()).toBe('j1');
  expect(consumeCameraJob()).toBeNull();
});
