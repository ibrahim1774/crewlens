import { useEffect, useState } from 'react';

import { meta } from '@/lib/db';
import { countAllDocuments } from '@/lib/documents';
import { useJobs } from '@/lib/jobs';
import { notify, useVersion } from '@/lib/store';

/** The four things a new account does in its first week, shown as a card at the top of Jobs. */
export interface StartHereState {
  jobs: number;
  photos: number;
  linkShared: boolean;
  documents: number;
  dismissed: boolean;
}

export const START_STEPS = [
  { key: 'job', title: 'Create a job', body: 'Name and address. Photos file here by GPS.' },
  { key: 'photo', title: 'Take a stamped photo', body: 'Time, place and initials burned in.' },
  { key: 'link', title: 'Share the live link', body: 'One link the client keeps for the whole job.' },
  { key: 'doc', title: 'Upload a document', body: 'Invoice or contract, edited and sent from here. Pro.' },
] as const;

export type StartStepKey = (typeof START_STEPS)[number]['key'];

export function startHereProgress(s: StartHereState): { done: StartStepKey[]; pct: number; visible: boolean } {
  const done: StartStepKey[] = [];
  if (s.jobs > 0) done.push('job');
  if (s.photos > 0) done.push('photo');
  if (s.linkShared) done.push('link');
  if (s.documents > 0) done.push('doc');
  const pct = Math.round((done.length / START_STEPS.length) * 100);
  return { done, pct, visible: !s.dismissed && done.length < START_STEPS.length };
}

export function useStartHere(): StartHereState & ReturnType<typeof startHereProgress> {
  const v = useVersion();
  const jobs = useJobs();
  const [extra, setExtra] = useState({ linkShared: false, documents: 0, dismissed: true });
  useEffect(() => {
    let alive = true;
    Promise.all([meta.get('link_shared'), countAllDocuments(), meta.get('start_here_dismissed')]).then(([l, d, x]) => {
      if (alive) setExtra({ linkShared: l === '1', documents: d, dismissed: x === '1' });
    });
    return () => {
      alive = false;
    };
  }, [v]);
  const state: StartHereState = { jobs: jobs.length, photos: jobs.reduce((n, j) => n + j.photoCount, 0), ...extra };
  return { ...state, ...startHereProgress(state) };
}

export async function dismissStartHere(): Promise<void> {
  await meta.set('start_here_dismissed', '1');
  notify();
}
