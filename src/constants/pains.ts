/** "How it goes today": where job photos live now and what hurts most. Answers go to analytics and the paywall. */
export const PHOTO_HOMES = ['Camera roll', 'Group texts', 'Google Drive or Dropbox', 'Another app', 'Nowhere, really'] as const;
export const HEADACHES = ['Finding the right photo', 'Proving the work got done', 'Clients asking for updates', 'Getting paid on time', 'Keeping the crew in sync'] as const;
export type PhotoHome = (typeof PHOTO_HOMES)[number];
export type Headache = (typeof HEADACHES)[number];
