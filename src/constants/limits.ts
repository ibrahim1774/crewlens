import type { Tier } from '@/types/models';

/** Jobs within this distance of the user count as "nearby". */
export const NEARBY_RADIUS_M = 300;
/** After this many failed uploads a photo is marked failed and waits for a manual retry. */
export const MAX_UPLOAD_ATTEMPTS = 8;

export interface PlanLimits {
  activeJobs: number;
  photosPerJob: number;
  videosPerJob: number;
  videoMaxS: number;
  /** null means links never expire. */
  linkDays: number | null;
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  solo: { activeJobs: 25, photosPerJob: 100, videosPerJob: 0, videoMaxS: 0, linkDays: 30 },
  pro: { activeJobs: 100, photosPerJob: 250, videosPerJob: 10, videoMaxS: 60, linkDays: null },
  crew: { activeJobs: 500, photosPerJob: 500, videosPerJob: 25, videoMaxS: 120, linkDays: null },
};

export const TIER_LABEL: Record<Tier, string> = { solo: 'Solo', pro: 'Pro', crew: 'Crew' };
