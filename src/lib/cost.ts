import { BENEFITS } from '@/constants/benefits';

export const PHOTO_HOMES = ['Camera roll', 'Group texts', 'Google Drive or Dropbox', 'Another app', 'Nowhere, really'] as const;
export const HEADACHES = ['Finding the right photo', 'Proving the work got done', 'Clients asking for updates', 'Getting paid on time', 'Keeping the crew in sync'] as const;
export type PhotoHome = (typeof PHOTO_HOMES)[number];
export type Headache = (typeof HEADACHES)[number];

/** People behind each crew-size answer. Low ends of the ranges, so the estimate never inflates. */
const PEOPLE: Record<string, number> = { 'Just me': 1, '2–5': 3, '6–15': 10, '16+': 16 };
/** The stated assumption shown under the number. */
export const MINUTES_PER_DAY = 10;
const WORK_DAYS = 22;

const PAIN: Record<PhotoHome, string> = {
  'Camera roll': 'Job photos buried between family pictures and screenshots.',
  'Group texts': 'Photos scattered across text threads nobody can search.',
  'Google Drive or Dropbox': 'Folders sorted by hand after every job, when someone remembers.',
  'Another app': 'An app the crew has to remember to open, so half the photos never land.',
  'Nowhere, really': 'No record to show when a client says the work was not done.',
};

const HEADACHE_PAIN: Record<Headache, string> = {
  'Finding the right photo': 'Digging for the one photo you need while the client waits.',
  'Proving the work got done': 'Arguing about what was done, with nothing to show.',
  'Clients asking for updates': 'Calls and texts all day asking how the job is going.',
  'Getting paid on time': 'Invoices that sit until you are back at the office.',
  'Keeping the crew in sync': 'Everyone holding a different piece of the job on their own phone.',
};

const FIX_FOR: Record<Headache, number> = {
  'Finding the right photo': 0,
  'Proving the work got done': 1,
  'Clients asking for updates': 2,
  'Getting paid on time': 3,
  'Keeping the crew in sync': 4,
};

export interface CostReport {
  people: number;
  hoursPerMonth: number;
  pains: string[];
  fixes: { title: string; body: string }[];
}

/** "What that's costing you", built only from the person's own answers and one stated assumption. */
export function costReport(a: { crew?: string | null; photoHome?: string | null; headache?: string | null }): CostReport {
  const people = PEOPLE[a.crew ?? ''] ?? 1;
  const hoursPerMonth = Math.round((people * MINUTES_PER_DAY * WORK_DAYS) / 60);
  const pains: string[] = [];
  if (a.photoHome && a.photoHome in PAIN) pains.push(PAIN[a.photoHome as PhotoHome]);
  if (a.headache && a.headache in HEADACHE_PAIN) pains.push(HEADACHE_PAIN[a.headache as Headache]);
  if (!pains.length) pains.push(PAIN['Camera roll']);
  const first = a.headache && a.headache in FIX_FOR ? FIX_FOR[a.headache as Headache] : 0;
  const order = [first, ...BENEFITS.map((_, i) => i).filter((i) => i !== first)];
  return { people, hoursPerMonth, pains, fixes: order.slice(0, 3).map((i) => BENEFITS[i]) };
}
