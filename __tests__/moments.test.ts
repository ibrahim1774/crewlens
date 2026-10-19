import { MOMENTS, activeStep, fixFor, momentsFor, quoteFor, sceneOf, scenesFor, type MomentId } from '@/constants/moments';

const ids = (list: { id: MomentId }[]) => list.map((m) => m.id);
const ALL = ['organized', 'share', 'invoice'] as const;

test('a solo contractor never sees the crew moment', () => {
  expect(ids(momentsFor({ crew: 'Just me' }))).not.toContain('crew_phones');
  expect(ids(momentsFor({ crew: 'Just me' }))).toContain('camera_roll');
});

test('owners with a crew, or who skipped the crew question, see it', () => {
  expect(ids(momentsFor({ crew: '6–15' }))).toContain('crew_phones');
  expect(ids(momentsFor({ crew: null }))).toContain('crew_phones');
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

test('no picks, or none with a clip yet, still show the organizing scene instead of a dead end', () => {
  expect(scenesFor([], ALL)).toEqual(['organized']);
  expect(scenesFor(['invoice'], ['organized'])).toEqual(['organized']);
});

test('the scene quotes the first moment picked for it', () => {
  expect(quoteFor('organized', ['sending', 'scattered', 'camera_roll'], { crew: null })).toBe('Photos are spread across texts, email and apps');
  expect(quoteFor('share', [], { crew: null })).toBeNull();
});

test('every moment has a short fix for the summary and a distinct label', () => {
  for (const m of MOMENTS) expect(fixFor(m.id).length).toBeLessThanOrEqual(30);
  const labels = momentsFor({ crew: '2–5' }).map((m) => m.label);
  expect(new Set(labels).size).toBe(labels.length);
  expect(labels).toHaveLength(MOMENTS.length);
});

test('the step list follows the clip: nothing lit during the opening moment, then each step as its part plays', () => {
  const steps = [{ at: 3.5 }, { at: 6.4 }, { at: 10.1 }];
  expect(activeStep(steps, 0)).toBe(-1);
  expect(activeStep(steps, 3.5)).toBe(0);
  expect(activeStep(steps, 8)).toBe(1);
  expect(activeStep(steps, 12)).toBe(2);
});
