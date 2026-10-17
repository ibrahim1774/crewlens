import { meta } from '@/lib/db';
import { notify, useVersion } from '@/lib/store';

/**
 * The ten-screen tour shown once before sign-in. Each screen is a device-framed mockup of the
 * real product UI (see components/intro-mockups.tsx); the "seen" flag lives in the local meta
 * table so it survives sign-out and never depends on the network.
 */

export type IntroMockup = 'cameraRoll' | 'stamp' | 'nearby' | 'timeline' | 'shareLink' | 'detail' | 'crew' | 'offline' | 'archive' | 'start';

export interface IntroSlide {
  key: string;
  /** Small mono label beside the counter. */
  eyebrow: string;
  title: string;
  body: string;
  mockup: IntroMockup;
}

export const INTRO_SLIDES: IntroSlide[] = [
  {
    key: 'problem',
    eyebrow: 'THE PROBLEM',
    title: 'Your camera roll is not a job record.',
    body: 'Thousands of photos with no job, no address and no proof of when. When a client says the damage was already there, you are scrolling.',
    mockup: 'cameraRoll',
  },
  {
    key: 'stamp',
    eyebrow: 'THE STAMP',
    title: 'Every photo gets the stamp.',
    body: 'Time, place and who shot it, burned in the moment the shutter fires. Not added later. Not editable.',
    mockup: 'stamp',
  },
  {
    key: 'filed',
    eyebrow: 'AUTO-FILED',
    title: 'Filed to the right job before you lower the phone.',
    body: 'Crew Lens checks where you are standing and picks the nearest job. Tap a chip to switch, or start a new job from the camera.',
    mockup: 'nearby',
  },
  {
    key: 'timeline',
    eyebrow: 'THE TIMELINE',
    title: 'Before. During. After. In order.',
    body: 'Each job keeps a day-by-day timeline. Scroll the whole history of a site in ten seconds.',
    mockup: 'timeline',
  },
  {
    key: 'link',
    eyebrow: 'ONE LINK',
    title: 'One link for the whole job.',
    body: 'Send the client a live link once. Every photo you take after that shows up for them. No selecting, no re-sending.',
    mockup: 'shareLink',
  },
  {
    key: 'dispute',
    eyebrow: 'THE DISPUTE',
    title: 'Win the argument before it starts.',
    body: 'Open any photo and the record is right there: when, where, who and which job. Export it with the stamp burned in.',
    mockup: 'detail',
  },
  {
    key: 'crew',
    eyebrow: 'THE CREW',
    title: 'Your whole crew, one record.',
    body: 'Everyone on the job shoots into the same timeline, with their initials on every stamp. You see it all from the truck.',
    mockup: 'crew',
  },
  {
    key: 'offline',
    eyebrow: 'OFFLINE',
    title: 'Works where the signal does not.',
    body: 'Basements, rural lots, steel buildings. Photos save on the phone and upload on their own once you are back in range.',
    mockup: 'offline',
  },
  {
    key: 'archive',
    eyebrow: 'THE ARCHIVE',
    title: 'Archive. Never delete.',
    body: 'Finished jobs move to the archive, free and unlimited. Pull one up two years later when the warranty call comes.',
    mockup: 'archive',
  },
  {
    key: 'start',
    eyebrow: 'START',
    title: 'Start the record.',
    body: 'Sign in, name your company, and open the camera on your next job. The first stamp takes four seconds.',
    mockup: 'start',
  },
];

/** Index helpers kept pure so they can be tested without a screen. */
export function clampSlide(index: number, count = INTRO_SLIDES.length): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

let seen: boolean | null = null;

/** Reads the flag once at boot. Until then `useIntroSeen()` returns null and the gate waits. */
export async function loadIntroSeen(): Promise<boolean> {
  seen = (await meta.get('intro_seen')) === '1';
  notify();
  return seen;
}

export function useIntroSeen(): boolean | null {
  useVersion();
  return seen;
}

export async function markIntroSeen(): Promise<void> {
  seen = true;
  notify();
  await meta.set('intro_seen', '1');
}

/** Used by "Watch the intro again" and by tests. */
export async function resetIntroSeen(): Promise<void> {
  seen = false;
  notify();
  await meta.set('intro_seen', null);
}
