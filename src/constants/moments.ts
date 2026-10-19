/**
 * "Has this happened to you?": everyday moments that waste a contractor's time. Each one points at the thing
 * Crew Lens is for (photos organized by project, a link for the client, the invoice sent from the job), and the
 * person then watches a short scene of that feature, in the order they picked.
 */
export type MomentId = 'camera_roll' | 'scattered' | 'crew_phones' | 'sending' | 'updates' | 'invoice' | 'paperwork';
export type SceneId = 'organized' | 'share' | 'invoice';

export interface Moment {
  id: MomentId;
  icon: string;
  label: string;
}

type Rule = Moment & { scene: SceneId; fix: string; crewOnly?: boolean };

const RULES: Rule[] = [
  { id: 'camera_roll', scene: 'organized', icon: 'photo.on.rectangle.angled', label: 'Job photos get buried in your camera roll', fix: 'Every photo filed by project' },
  { id: 'scattered', scene: 'organized', icon: 'tray.full', label: 'Photos are spread across texts, email and apps', fix: 'One place for every project' },
  { id: 'crew_phones', scene: 'organized', icon: 'person.2', label: "Your crew's photos stay on their phones", fix: "Everyone's photos in one job", crewOnly: true },
  { id: 'sending', scene: 'share', icon: 'paperplane', label: 'Sending a client photos means texting them one by one', fix: 'A whole job in one link' },
  { id: 'updates', scene: 'share', icon: 'phone', label: 'Clients keep asking how the job is going', fix: 'A link they can check anytime' },
  { id: 'invoice', scene: 'invoice', icon: 'doc.text', label: 'Invoices go out days after the job is done', fix: 'Sign and send it on site' },
  { id: 'paperwork', scene: 'invoice', icon: 'folder', label: "Each job's paperwork is somewhere different", fix: 'Documents live with the job' },
];

export const MOMENTS: readonly { id: MomentId }[] = RULES.map(({ id }) => ({ id }));

/** The moments to offer. The crew one stays hidden only for someone who said they work alone. */
export function momentsFor(p: { crew: string | null }): Moment[] {
  return RULES.filter((r) => !r.crewOnly || p.crew !== 'Just me').map(({ id, icon, label }) => ({ id, icon, label }));
}

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
export function quoteFor(scene: SceneId, picked: MomentId[], p: { crew: string | null }): string | null {
  const id = picked.find((m) => sceneOf(m) === scene);
  return id ? (momentsFor(p).find((m) => m.id === id)?.label ?? null) : null;
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
