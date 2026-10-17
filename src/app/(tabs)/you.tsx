import * as Application from 'expo-application';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { TIER_LABEL } from '@/constants/limits';
import { Colors, Radius, Space } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { useCompany, useMember } from '@/lib/company';
import * as db from '@/lib/db';
import { effectiveTier, limitsFor, paywallEnabled } from '@/lib/plan';
import { useVersion } from '@/lib/store';

function Row({ title, value, onPress, destructive, icon }: { title: string; value?: string; onPress?: () => void; destructive?: boolean; icon?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.hairline, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Heading size={18} color={destructive ? Colors.flag : Colors.ink}>{title}</Heading>
        {value ? <Body size={13} color={Colors.ink2}>{value}</Body> : null}
      </View>
      {onPress && !destructive ? <SymbolView name={(icon ?? 'chevron.right') as never} size={14} tintColor={Colors.ink2} /> : null}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Mono size={11} color={Colors.ink2} style={{ paddingBottom: Space.xs }}>{title.toUpperCase()}</Mono>
      <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, paddingHorizontal: Space.md }}>{children}</View>
    </View>
  );
}

export default function You() {
  const company = useCompany();
  const member = useMember();
  const v = useVersion();
  const [active, setActive] = useState(0);
  const [sync, setSync] = useState({ pending: 0, failed: 0 });
  const tier = effectiveTier(company?.tier ?? null, true);
  const limits = limitsFor(tier);

  useEffect(() => {
    db.jobs.countActive().then(setActive);
    db.photos.countUnsynced().then(setSync);
  }, [v]);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', sync.pending + sync.failed > 0 ? `${sync.pending + sync.failed} photos have not uploaded yet and will be lost on this device.` : 'Your photos stay in the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/welcome')) },
    ]);

  const pct = Math.min(1, active / limits.activeJobs);

  return (
    <Screen>
      <Heading size={30} bold>You</Heading>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, backgroundColor: Colors.ink, borderRadius: Radius.card }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading size={22} color={Colors.surface}>{member?.displayName ?? ''}</Heading>
          <Body size={13} color="rgba(247,246,242,0.7)">{company?.name ?? ''}{company?.trade ? ` · ${company.trade}` : ''}</Body>
        </View>
        <Stamp photo={{ takenAt: new Date().toISOString(), lat: null, lng: null }} initials={member?.initials ?? '???'} tone="dark" size={11} />
      </View>

      <Section title="Plan">
        <View style={{ paddingVertical: 14, gap: Space.sm, borderBottomWidth: 1, borderColor: Colors.hairline }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Heading size={18}>{TIER_LABEL[tier]}{paywallEnabled ? '' : ' · early access'}</Heading>
            <Mono>{active} OF {limits.activeJobs} ACTIVE JOBS</Mono>
          </View>
          <View style={{ height: 6, backgroundColor: Colors.canvas, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: pct >= 0.9 ? Colors.flag : Colors.slate }} />
          </View>
          <Mono size={11} color={Colors.ink2}>
            {limits.photosPerJob} PHOTOS PER JOB · {limits.videosPerJob ? `VIDEO ${limits.videoMaxS}S` : 'NO VIDEO'} · LINKS {limits.linkDays ? `${limits.linkDays} DAYS` : 'NEVER EXPIRE'}
          </Mono>
        </View>
        <Row title="Plans" value="Solo, Pro with documents, Crew" onPress={() => router.push({ pathname: '/(auth)/paywall', params: { upgrade: '1' } })} icon="chevron.right" />
        <Row title="Manage subscription" value="Change or cancel in the App Store" onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')} icon="arrow.up.right" />
        <Row title="Sync" value={sync.failed ? `${sync.failed} failed, ${sync.pending} waiting` : sync.pending ? `${sync.pending} waiting to upload` : 'Everything is uploaded'} />
      </Section>

      <Section title="Company">
        <Row title={company?.name ?? ''} value={company?.trade ? company.trade[0].toUpperCase() + company.trade.slice(1) : undefined} />
        <Row title="Team" value={`${company?.seats ?? 1} ${(company?.seats ?? 1) === 1 ? 'seat' : 'seats'} · invite by text`} onPress={() => router.push('/team')} icon="chevron.right" />
      </Section>

      <Section title="Support">
        <Row title="Email support" value="support@davoxa.com" onPress={() => Linking.openURL('mailto:support@davoxa.com?subject=Crew%20Lens')} icon="arrow.up.right" />
        <Row title="Watch the intro again" onPress={() => router.push({ pathname: '/(auth)/intro', params: { replay: '1' } })} icon="play" />
        <Row title="Privacy policy" onPress={() => Linking.openURL('https://crewlens-share.vercel.app/privacy')} icon="arrow.up.right" />
        <Row title="Terms of use" onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')} icon="arrow.up.right" />
        <Row title="Sign out" destructive onPress={confirmSignOut} />
      </Section>

      <Mono size={11} color={Colors.ink2} style={{ textAlign: 'center' }}>
        CREW LENS {Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? '1'})
      </Mono>
    </Screen>
  );
}
