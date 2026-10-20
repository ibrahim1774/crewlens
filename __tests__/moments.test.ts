import { MOMENTS, activeStep, fixFor, quoteFor, sceneOf, scenesFor, type MomentId } from '@/constants/moments';

const ALL = ['organized', 'share', 'invoice'] as const;

test('five short options, each one line on a phone', () => {
  expect(MOMENTS).toHaveLength(5);
  for (const m of MOMENTS) expect(m.label.length).toBeLessThanOrEqual(32);
  expect(new Set(MOMENTS.map((m) => m.label)).size).toBe(5);
});

test('every moment maps to one of the three things Crew Lens is for', () => {
  for (const m of MOMENTS) expect(ALL).toContain(sceneOf(m.id));
  expect(sceneOf('camera_roll')).toBe('organized');
  expect(sceneOf('sending')).toBe('share');
  expect(sceneOf('invoice')).toBe('invoice');
});

test('scenes follow the order picked, play once each, skip scenes without a clip, and stop at three', () => {
  expect(scenesFor(['invoice', 'camera_roll', 'scattered', 'sending'], ALL)).toEqual(['invoice', 'organized', 'share']);
  expect(scenesFor(['sending', 'invoice'], ['organized', 'invoice'])).toEqual(['invoice']);
});

test('picks with no clip yet still show the organizing scene instead of a dead end', () => {
  expect(scenesFor([], ALL)).toEqual(['organized']);
  expect(scenesFor(['invoice'], ['organized'])).toEqual(['organized']);
});

test('the scene quotes the first moment picked for it', () => {
  const picked: MomentId[] = ['sending', 'scattered', 'camera_roll'];
  expect(quoteFor('organized', picked)).toBe('Photos scattered across phones');
  expect(quoteFor('share', [])).toBeNull();
});

test('every moment has a short fix for the summary', () => {
  for (const m of MOMENTS) expect(fixFor(m.id).length).toBeLessThanOrEqual(30);
});

test('the step list follows the clip: nothing lit during the opening moment, then each step as its part plays', () => {
  const steps = [{ at: 3.5 }, { at: 6.4 }, { at: 10.1 }];
  expect(activeStep(steps, 0)).toBe(-1);
  expect(activeStep(steps, 3.5)).toBe(0);
  expect(activeStep(steps, 8)).toBe(1);
  expect(activeStep(steps, 12)).toBe(2);
});
