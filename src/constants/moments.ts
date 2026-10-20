/**
 * "What slows you down?": everyday moments that waste a contractor's time. Each one points at the thing
 * Crew Lens is for (photos organized by project, a link for the client, the invoice sent from the job), and the
 * person then watches a short scene of that feature, in the order they picked.
 */
export type MomentId = 'camera_roll' | 'scattered' | 'sending' | 'updates' | 'invoice';
export type SceneId = 'organized' | 'share' | 'invoice';

export interface Moment {
  id: MomentId;
  icon: string;
  label: string;
}

type Rule = Moment & { scene: SceneId; fix: string };

const RULES: Rule[] = [
  { id: 'camera_roll', scene: 'organized', icon: 'photo.on.rectangle.angled', label: 'Photos lost in my camera roll', fix: 'Every photo filed by project' },
  { id: 'scattered', scene: 'organized', icon: 'person.2', label: 'Photos scattered across phones', fix: "Everyone's photos in one place" },
  { id: 'sending', scene: 'share', icon: 'paperplane', label: 'Texting photos one by one', fix: 'A whole job in one link' },
  { id: 'updates', scene: 'share', icon: 'phone', label: 'Clients asking for updates', fix: 'A link they can check anytime' },
  { id: 'invoice', scene: 'invoice', icon: 'doc.text', label: 'Invoices going out late', fix: 'Sign and send it on site' },
];

/** The five options, in the order shown. */
export const MOMENTS: readonly Moment[] = RULES.map(({ id, icon, label }) => ({ id, icon, label }));

const rule = (id: MomentId) => RULES.find((r) => r.id === id)!;

/** Which of the three scenes answers a moment. */
export function sceneOf(id: MomentId): SceneId {
  return rule(id).scene;
}

/** The feature that handles a moment, for the "Your Crew Lens" summary. */
export function fixFor(id: MomentId): string {
  return rule(id).fix;
}

/** "You said": the first moment they picked that this scene answers, or null when it plays as the fallback. */
export function quoteFor(scene: SceneId, picked: MomentId[]): string | null {
  const id = picked.find((m) => sceneOf(m) === scene);
  return id ? rule(id).label : null;
}

export const MAX_SCENES = 3;

/**
 * Scenes to play: one per thing they picked, in the order picked, only those with a finished clip, at most three.
 * With nothing left (no picks, or none with a clip yet), the organizing scene plays so the flow never dead-ends.
 */
export function scenesFor(picked: MomentId[], withClip: readonly SceneId[]): SceneId[] {
  const list: SceneId[] = [];
  for (const id of picked) {
    const s = sceneOf(id);
    if (withClip.includes(s) && !list.includes(s)) list.push(s);
  }
  return list.length ? list.slice(0, MAX_SCENES) : ['organized'];
}

/** Which step of a scene is playing at a point in its clip: -1 during the opening moment, before the app appears. */
export function activeStep(steps: { at: number }[], t: number): number {
  let i = -1;
  steps.forEach((s, k) => {
    if (t >= s.at) i = k;
  });
  return i;
}
