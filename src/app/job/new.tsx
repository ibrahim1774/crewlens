import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { LimitSheet } from '@/components/limit-sheet';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { useCompany } from '@/lib/company';
import { setCameraJob } from '@/lib/handoff';
import { formatCoords } from '@/lib/geo';
import { addressFor, createJob, getLastFix, refreshFix } from '@/lib/jobs';
import { effectiveTier } from '@/lib/plan';
import { LimitError } from '@/lib/supabase';

/** Create a job. Location defaults to where the user is standing; address is reverse geocoded. */
export default function NewJob() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const company = useCompany();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [fix, setFix] = useState(getLastFix());
  const [useLocation, setUseLocation] = useState(true);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<LimitError | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const f = (await refreshFix()) ?? getLastFix();
      if (!alive || !f) return;
      setFix(f);
      if (!address) {
        const a = await addressFor(f);
        if (alive && a) setAddress(a);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const job = await createJob({ name, address, clientName: client, lat: useLocation && fix ? fix.lat : null, lng: useLocation && fix ? fix.lng : null });
      if (params.returnTo === 'camera') {
        setCameraJob(job.id);
        router.back();
      } else {
        router.replace({ pathname: '/job/[id]', params: { id: job.id } });
      }
    } catch (e) {
      if (e instanceof LimitError) setLimit(e);
      else Alert.alert('Could not create job', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Create job" onPress={create} loading={busy} disabled={name.trim().length < 2} />}>
      <View style={{ gap: Space.xs }}>
        <Heading size={30} bold>New job</Heading>
        <Body color={Colors.ink2}>Photos taken within 300 m will suggest this job.</Body>
      </View>
      <Field label="Job name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Johnson House" autoFocus testID="job-name" />
      <Field label="Address" value={address} onChangeText={setAddress} autoCapitalize="words" placeholder="1010 Do Good Blvd" testID="job-address" />
      <Field label="Client (optional)" value={client} onChangeText={setClient} autoCapitalize="words" placeholder="Jo Johnson" />
      <View style={{ gap: Space.xs }}>
        <Mono size={11} color={Colors.ink2}>Location</Mono>
        {fix ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Mono>{useLocation ? formatCoords(fix.lat, fix.lng) : 'Not pinned'}</Mono>
            <Button title={useLocation ? 'Do not pin' : 'Pin here'} variant="ghost" onPress={() => setUseLocation((v) => !v)} style={{ height: 36 }} />
          </View>
        ) : (
          <Mono color={Colors.ink2}>No GPS · Job will not appear as nearby</Mono>
        )}
      </View>
      <LimitSheet error={limit} tier={effectiveTier(company?.tier ?? null, true)} onClose={() => setLimit(null)} />
    </Screen>
  );
}
