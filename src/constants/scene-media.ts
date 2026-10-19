import type { SceneId } from '@/constants/moments';

/**
 * The onboarding scene clips (store/video/make_scenes.py): the everyday moment, then the real app doing the job.
 * `at` is when each step's part of the clip starts, in seconds, printed by the script; the step list lights up with it.
 */
export interface SceneMedia {
  video: number;
  poster: number;
  headline: string;
  /** One line with their company name in it. */
  personal: (company: string) => string;
  steps: { label: string; at: number }[];
}

export const SCENE_MEDIA: Record<SceneId, SceneMedia> = {
  organized: {
    video: require('@/assets/video/scenes/organized.mp4'),
    poster: require('@/assets/video/scenes/organized.jpg'),
    headline: 'Every photo lands in the right project',
    personal: (c) => `${c}'s photos, sorted by job and day, the moment they're taken.`,
    steps: [
      { label: 'Every project in its own folder', at: 3.5 },
      { label: 'Sorted by day, automatically', at: 6.4 },
      { label: 'Stamped with time and place', at: 10.1 },
    ],
  },
  share: {
    video: require('@/assets/video/scenes/share.mp4'),
    poster: require('@/assets/video/scenes/share.jpg'),
    headline: 'Send the whole job in one link',
    personal: (c) => `Keep ${c}'s clients in the loop without a single photo texted one by one.`,
    steps: [
      { label: 'The whole job, or a few photos', at: 4.1 },
      { label: 'One tap makes the link', at: 10.1 },
      { label: 'Text it. No app needed.', at: 12.1 },
    ],
  },
  invoice: {
    video: require('@/assets/video/scenes/invoice.mp4'),
    poster: require('@/assets/video/scenes/invoice.jpg'),
    headline: 'Sign and send the invoice on site',
    personal: (c) => `Sent from ${c} before you leave the driveway.`,
    steps: [
      { label: 'The invoice lives with the job', at: 4.1 },
      { label: 'Sign it with your finger', at: 6.7 },
      { label: 'Send it before you leave', at: 12.9 },
    ],
  },
};

export const SCENES_WITH_CLIP = Object.keys(SCENE_MEDIA) as SceneId[];

