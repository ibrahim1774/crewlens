import { meta } from '@/lib/db';
import { notify, useVersion } from '@/lib/store';

/**
 * The ten-screen tour shown once before sign-in. The "seen" flag lives in the local meta table
 * so it survives sign-out and never depends on the network.
 */

export interface IntroStamp {
  takenAt: string;
  lat: number | null;
  lng: number | null;
  initials: string;
}

export interface IntroSlide {
  key: string;
  /** Small mono label above the headline. */
  eyebrow: string;
  title: string;
  body: string;
  image: number;
  /** The evidence stamp drawn on the photo. Omitted on the "problem" slide, which has no stamp on purpose. */
  stamp: IntroStamp | null;
  /** Shown in the stamp's place when there is no stamp. */
  stampNote?: string;
}

export const INTRO_SLIDES: IntroSlide[] = [
  {
    key: 'problem',
    eyebrow: 'THE PROBLEM',
    title: 'Your camera roll is not a job record.',
    body: 'Four thousand photos. No address, no proof of when. When the homeowner says the damage was already there, you are scrolling.',
    image: require('@/assets/onboarding/01.jpg'),
    stamp: null,
    stampNote: 'NO JOB · NO TIME · NO PROOF',
  },
  {
    key: 'stamp',
    eyebrow: 'THE STAMP',
    title: 'Every photo gets the stamp.',
    body: 'Time, place and who shot it, burned in the moment the shutter fires. Not added later. Not editable.',
    image: require('@/assets/onboarding/02.jpg'),
    stamp: { takenAt: '2026-10-17T07:42:00', lat: 41.8781, lng: -87.6298, initials: 'JOS' },
  },
  {
    key: 'filed',
    eyebrow: 'AUTO-FILED',
    title: 'Filed to the right job before you lower the phone.',
    body: 'Crew Lens checks where you are standing and drops the photo on the nearest job. No album picking, no sorting at night.',
    image: require('@/assets/onboarding/03.jpg'),
    stamp: { takenAt: '2026-10-17T09:18:00', lat: 39.7392, lng: -104.9903, initials: 'MRT' },
  },
  {
    key: 'timeline',
    eyebrow: 'THE TIMELINE',
    title: 'Before. During. After. In order.',
    body: 'Each job keeps a day-by-day timeline. Scroll the whole history of a site in ten seconds.',
    image: require('@/assets/onboarding/04.jpg'),
    stamp: { takenAt: '2026-10-14T11:05:00', lat: 33.4484, lng: -112.074, initials: 'KLW' },
  },
  {
    key: 'link',
    eyebrow: 'ONE LINK',
    title: 'One link for the whole job.',
    body: 'Send the client a live link once. Every photo you take after that shows up for them. No selecting, no re-sending.',
    image: require('@/assets/onboarding/05.jpg'),
    stamp: { takenAt: '2026-10-16T17:51:00', lat: 35.2271, lng: -80.8431, initials: 'DNA' },
  },
  {
    key: 'dispute',
    eyebrow: 'THE DISPUTE',
    title: 'Win the argument before it starts.',
    body: 'A stamped photo of the crack, the leak or the finish ends the conversation. Your word becomes your record.',
    image: require('@/assets/onboarding/06.jpg'),
    stamp: { takenAt: '2026-10-09T08:27:00', lat: 42.3601, lng: -71.0589, initials: 'JOS' },
  },
  {
    key: 'crew',
    eyebrow: 'THE CREW',
    title: 'Your whole crew, one record.',
    body: 'Everyone on the job shoots into the same timeline, with their initials on every stamp. You see it all from the truck.',
    image: require('@/assets/onboarding/07.jpg'),
    stamp: { takenAt: '2026-10-17T06:58:00', lat: 32.7767, lng: -96.797, initials: 'ABR' },
  },
  {
    key: 'offline',
    eyebrow: 'OFFLINE',
    title: 'Works where the signal does not.',
    body: 'Basements, rural lots, steel buildings. Photos save on the phone and upload on their own once you are back in range.',
    image: require('@/assets/onboarding/08.jpg'),
    stamp: { takenAt: '2026-10-15T14:33:00', lat: 44.0121, lng: -92.4802, initials: 'TPK' },
  },
  {
    key: 'archive',
    eyebrow: 'THE ARCHIVE',
    title: 'Archive. Never delete.',
    body: 'Finished jobs move to the archive, free and unlimited. Pull one up two years later when the warranty call comes.',
    image: require('@/assets/onboarding/09.jpg'),
    stamp: { takenAt: '2024-06-21T18:12:00', lat: 30.2672, lng: -97.7431, initials: 'JOS' },
  },
  {
    key: 'start',
    eyebrow: 'START',
    title: 'Start the record.',
    body: 'Open the camera on your next job. The first stamp takes four seconds.',
    image: require('@/assets/onboarding/10.jpg'),
    stamp: { takenAt: 'now', lat: null, lng: null, initials: 'YOU' },
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
