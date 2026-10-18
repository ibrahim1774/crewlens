import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

const THUMBS = [require('@/assets/onboarding/03.jpg'), require('@/assets/onboarding/02.jpg'), require('@/assets/onboarding/04.jpg'), require('@/assets/onboarding/05.jpg')];

const HOLD_MS = 2400;
const IN_MS = 420;
const OUT_MS = 280;

function Avatar({ initials }: { initials: string }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
      <Mono size={11} color={Colors.onCamera} bold>{initials}</Mono>
    </View>
  );
}

function CardHeader({ initials, title }: { initials: string; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
      <Avatar initials={initials} />
      <Heading size={20} bold>{title}</Heading>
    </View>
  );
}

/** Three things a crew does in Crew Lens every day. Cycles vertically; never mentions money. */
const CARDS = [
  {
    key: 'photos',
    render: () => (
      <View style={{ gap: Space.sm }}>
        <CardHeader initials="JOS" title="Added 4 photos" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {THUMBS.map((src, i) => (
            <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: Radius.chip, overflow: 'hidden', backgroundColor: Colors.hairline }}>
              <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <View style={{ position: 'absolute', left: 3, bottom: 3, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
                <Mono size={7} color={Colors.onCamera}>{['09:18', '09:21', '09:40', '10:02'][i]}</Mono>
              </View>
            </View>
          ))}
        </View>
        <Mono size={11} color={Colors.ink2}>Hartley Roof · Stamped · Filed by GPS</Mono>
      </View>
    ),
  },
  {
    key: 'link',
    render: () => (
      <View style={{ gap: Space.sm }}>
        <CardHeader initials="MRT" title="Shared the job link" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, padding: Space.sm, backgroundColor: Colors.canvas }}>
          <SymbolView name="link" size={16} tintColor={Colors.slate} />
          <Mono size={11} style={{ flex: 1 }} numberOfLines={1}>crewlens-share.vercel.app/s/k7f3q2</Mono>
          <View style={{ backgroundColor: Colors.ok, borderRadius: Radius.chip, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Mono size={9} color={Colors.onCamera} bold>Live</Mono>
          </View>
        </View>
        <Mono size={11} color={Colors.ink2}>Opened by the client · 2 Min ago · Updates as you shoot</Mono>
      </View>
    ),
  },
  {
    key: 'invoice',
    render: () => (
      <View style={{ gap: Space.sm }}>
        <CardHeader initials="JOS" title="Sent an invoice" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, padding: Space.sm, backgroundColor: Colors.canvas }}>
          <View style={{ width: 34, height: 42, borderRadius: 3, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Mono size={8} color={Colors.onCamera} bold>PDF</Mono>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Heading size={15} numberOfLines={1}>Invoice 0412 · Hartley Roof</Heading>
            <Mono size={10} color={Colors.ink2}>2 Pages · Signed in app</Mono>
          </View>
          <View style={{ backgroundColor: Colors.ok, borderRadius: Radius.chip, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Mono size={9} color={Colors.onCamera} bold>Sent · Text</Mono>
          </View>
        </View>
        <Mono size={11} color={Colors.ink2}>Edited on the phone · Texted to the client · Filed with the photos</Mono>
      </View>
    ),
  },
];

const OLD_WAY = ['4,000 photos, no job names', 'No date or address you can prove', 'Texting photos to the office at night', 'The invoice buried in email'];
const NEW_WAY = ['Filed to the job by GPS', 'Time, place and initials burned in', 'One live link the client keeps', 'Invoice signed and sent from the job'];

/** Side by side: the Photos app with an X, Crew Lens with a check. The argument in one glance. */
function Comparison() {
  const Col = ({ title, items, ok }: { title: string; items: string[]; ok: boolean }) => (
    <View style={{ flex: 1, gap: 6, padding: Space.sm, borderRadius: Radius.card, borderWidth: 1, borderColor: ok ? Colors.ink : Colors.hairline, backgroundColor: ok ? Colors.surface : Colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ok ? Colors.ok : Colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name={ok ? 'checkmark' : 'xmark'} size={11} tintColor={Colors.onCamera} />
        </View>
        <Mono size={10} bold color={ok ? Colors.ink : Colors.ink2}>{title}</Mono>
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {THUMBS.slice(0, 3).map((src, i) => (
          <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: 2, overflow: 'hidden', backgroundColor: Colors.hairline, opacity: ok ? 1 : 0.45 }}>
            <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            {ok ? (
              <View style={{ position: 'absolute', left: 2, bottom: 2, backgroundColor: 'rgba(11,11,13,0.65)', paddingHorizontal: 2, borderRadius: 2 }}>
                <Mono size={6} color={Colors.onCamera}>{['09:18', '09:21', '09:40'][i]} · JOS</Mono>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {items.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-start' }}>
          <Mono size={10} color={ok ? Colors.ok : Colors.danger} bold>{ok ? '✓' : '✕'}</Mono>
          <Body size={11} color={ok ? Colors.ink : Colors.ink2} style={{ flex: 1, lineHeight: 14 }}>{t}</Body>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm }} testID="welcome-comparison">
      <Col title="YOUR PHOTOS APP" items={OLD_WAY} ok={false} />
      <Col title="CREW LENS" items={NEW_WAY} ok />
    </View>
  );
}

function Deck({ reduceMotion }: { reduceMotion: boolean }) {
  const [index, setIndex] = useState(0);
  const t = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    let alive = true;
    const run = () => {
      t.setValue(0);
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: IN_MS, useNativeDriver: true }),
        Animated.delay(HOLD_MS),
        Animated.timing(t, { toValue: 2, duration: OUT_MS, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished || !alive) return;
        setIndex((i) => (i + 1) % CARDS.length);
      });
    };
    run();
    return () => {
      alive = false;
      t.stopAnimation();
    };
  }, [index, reduceMotion, t]);

  const translateY = t.interpolate({ inputRange: [0, 1, 2], outputRange: [36, 0, -28] });
  const opacity = t.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const scale = t.interpolate({ inputRange: [0, 1, 2], outputRange: [0.96, 1, 0.98] });
  const card = CARDS[index];

  return (
    <View style={{ minHeight: 150, justifyContent: 'center' }} accessibilityLabel="Examples of job activity: added photos, shared the job link, sent an invoice">
      <Animated.View
        key={card.key}
        testID={`welcome-card-${card.key}`}
        style={{
          backgroundColor: Colors.surface,
          borderWidth: 1,
          borderColor: Colors.hairline,
          borderRadius: Radius.card,
          padding: Space.md,
          opacity,
          transform: [{ translateY }, { scale }],
        }}>
        {card.render()}
      </Animated.View>
    </View>
  );
}

export default function Welcome() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    track('onboarding_step', { step: 'welcome' });
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const i = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <Screen
      footer={
        <>
          <Button title="Get started" onPress={() => router.push('/(auth)/sign-in')} testID="welcome-start" />
          <Button title="Sign in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} testID="welcome-sign-in" />
        </>
      }>
      <View style={{ flex: 1, justifyContent: 'center', gap: Space.lg }}>
        <View style={{ alignItems: 'center', gap: Space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <Stamp photo={{ takenAt: now, lat: null, lng: null }} initials="YOU" size={10} />
            <Heading size={22} bold>CREW LENS</Heading>
          </View>
          <Heading size={36} bold style={{ textAlign: 'center', lineHeight: 38, letterSpacing: 0.5 }} testID="welcome-headline">
            NEVER LOSE THE PHOTO{'\n'}THAT PROVES YOUR WORK.
          </Heading>
          <Body color={Colors.ink2} style={{ textAlign: 'center' }}>
            Every job-site photo and document, stamped with the time and place, filed to the job, backed up, and one link away for the client. Nothing lost in a camera roll or a text thread.
          </Body>
        </View>
        <Comparison />
        <Deck reduceMotion={reduceMotion} />
        <Pressable onPress={() => router.push('/(auth)/intro')} accessibilityRole="link" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: Space.xs }} testID="welcome-tour">
          <Mono size={12} color={Colors.slate} bold>See how it works</Mono>
        </Pressable>
      </View>
    </Screen>
  );
}
