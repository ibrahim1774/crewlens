import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { initialsFor, useMember } from '@/lib/company';
import { addressFor, createJob, getLastFix, refreshFix, useJobs } from '@/lib/jobs';
import { LimitError } from '@/lib/supabase';

/**
 * Step 8: the first stamped photo. Creates "First job" at the current location if the account has
 * no job yet, then opens the camera on it. Coming back here after shooting shows the count.
 */
export default function FirstJob() {
  const jobs = useJobs();
  const member = useMember();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());
  const job = jobs.find((j) => j.status === 'active') ?? jobs[0] ?? null;
  const fix = getLastFix();
  const shot = (job?.photoCount ?? 0) > 0;

  useEffect(() => {
    track('onboarding_step', { step: 'first_job' });
    refreshFix().catch(() => {});
    const t = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(t);
  }, []);

  const open = async () => {
    setBusy(true);
    try {
      let target = job;
      if (!target) {
        const here = getLastFix();
        const address = here ? await addressFor(here).catch(() => '') : '';
        target = await createJob({ name: address ? address.split(',')[0] : 'First job', address, lat: here?.lat ?? null, lng: here?.lng ?? null });
        track('job_created', { from: 'onboarding' });
      }
      router.push({ pathname: '/camera', params: { jobId: target.id } });
    } catch (e) {
      Alert.alert('Could not start', e instanceof LimitError ? 'Your plan is at its active-job limit.' : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const next = (skipped: boolean) => {
    track(skipped ? 'first_job_skipped' : 'first_job_done', { photos: job?.photoCount ?? 0 });
    router.push('/(auth)/crew');
  };

  return (
    <Screen
      footer={
        shot ? (
          <Button title="Continue" onPress={() => next(false)} testID="first-job-continue" />
        ) : (
          <>
            <Button title={job ? `Open the camera on ${job.name}` : 'Open the camera'} onPress={open} loading={busy} testID="first-job-camera" />
            <Button title="Skip for now" variant="ghost" onPress={() => next(true)} testID="first-job-skip" />
          </>
        )
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('first-job')}</Mono>
        <Heading size={34} bold>Stamp a photo of the job you are on today.</Heading>
        <Body color={Colors.ink2}>It files to the job you are standing at with the time, place and your initials burned in. Backed up the moment it uploads. That photo is yours for good.</Body>
      </View>
      <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: Space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <SymbolView name="mappin.and.ellipse" size={18} tintColor={Colors.slate} />
          <Heading size={20} numberOfLines={1} style={{ flex: 1 }}>{job?.name ?? 'First job'}</Heading>
          {shot ? <Mono size={11} color={Colors.ok} bold>{job?.photoCount} stamped</Mono> : <Mono size={11} color={Colors.ink2}>0 Photos</Mono>}
        </View>
        <Body size={13} color={Colors.ink2}>{job?.address || (fix ? 'Address from your location' : 'Turn on location to file by GPS')}</Body>
        <View style={{ height: 150, borderRadius: Radius.chip, backgroundColor: Colors.ink, justifyContent: 'flex-end', padding: Space.sm }}>
          <Mono color={Colors.onCamera} size={10} style={{ position: 'absolute', top: Space.sm, left: Space.sm }}>
            {shot ? 'Last photo' : 'Your next photo'}
          </Mono>
          <Stamp photo={{ takenAt: now, lat: fix?.lat ?? null, lng: fix?.lng ?? null }} initials={initialsFor(member?.displayName ?? 'You')} tone="dark" size={12} />
        </View>
      </View>
    </Screen>
  );
}
