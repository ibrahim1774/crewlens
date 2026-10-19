import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { meta } from '@/lib/db';
import { useJobs } from '@/lib/jobs';
import { getOrCreateLiveLink, linkUrl } from '@/lib/links';

function Row({ icon, title, body, action, onPress, done, testID }: { icon: string; title: string; body: string; action: string; onPress: () => void; done?: boolean; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, opacity: pressed ? 0.7 : 1 })}>
      <SymbolView name={icon as never} size={22} tintColor={done ? Colors.ok : Colors.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Heading size={18}>{title}</Heading>
        <Body size={13} color={Colors.ink2}>{body}</Body>
      </View>
      <Mono size={11} color={done ? Colors.ok : Colors.ink} bold>{done ? 'Done' : action}</Mono>
    </Pressable>
  );
}

/** Step 10: the two things that end the back-and-forth: one live link, and the paperwork beside the photos. */
export default function ShareDocs() {
  const jobs = useJobs();
  const job = jobs.find((j) => j.status === 'active') ?? null;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'share_docs' });
  }, []);

  const copy = async () => {
    if (!job || busy) return;
    setBusy(true);
    try {
      const link = await getOrCreateLiveLink(job.id);
      await Clipboard.setStringAsync(linkUrl(link.token));
      setCopied(true);
      track('live_link_copied', { from: 'onboarding' });
    } catch {
      // Offline: the link is created when the job syncs; the job screen offers it again.
    } finally {
      setBusy(false);
    }
  };

  const upload = () => {
    track('document_upload_tapped', { from: 'onboarding' });
    if (job) router.push({ pathname: '/job/[id]/documents', params: { id: job.id, pick: '1' } });
    else router.push('/job/new');
  };

  const finish = async () => {
    await meta.set('onboarded', '1');
    track('onboarding_complete', { copied, hasJob: !!job });
    router.replace('/(tabs)');
  };

  return (
    <Screen footer={<Button title="Go to my jobs" onPress={finish} testID="onboarding-finish" />}>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('share-docs')}</Mono>
        <Heading size={34} bold>One link for the client. The paperwork next to the proof.</Heading>
        <Body color={Colors.ink2}>The live link shows every photo as you shoot. Documents keep the invoice and contract with the job, so nothing gets lost in email or a text thread.</Body>
      </View>
      <Row icon="link" title="Copy the live job link" body={job ? `${job.name} updates for the client as you shoot.` : 'Create a job first and the link is one tap away.'} action={job ? (busy ? '…' : 'Copy') : 'Later'} onPress={copy} done={copied} testID="share-copy" />
      <Row icon="doc.text" title="Upload a document" body="Invoice, proposal or contract. Edit and sign it in the app, then text it. Pro plan." action="Upload" onPress={upload} testID="share-upload" />
    </Screen>
  );
}
