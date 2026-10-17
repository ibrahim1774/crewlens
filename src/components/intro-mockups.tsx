import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, View } from 'react-native';

import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius } from '@/constants/theme';
import type { IntroMockup } from '@/lib/intro';

/**
 * Static, self-contained renderings of the real product screens for the intro tour.
 * They use the same components and tokens as the app, with the job photos as content,
 * so what a person sees here is what they get after sign-in. No data hooks, no network.
 */

const P = {
  framing: require('@/assets/onboarding/02.jpg'),
  roof: require('@/assets/onboarding/03.jpg'),
  kitchen: require('@/assets/onboarding/04.jpg'),
  deck: require('@/assets/onboarding/05.jpg'),
  crack: require('@/assets/onboarding/06.jpg'),
  crew: require('@/assets/onboarding/07.jpg'),
  barn: require('@/assets/onboarding/08.jpg'),
  townhouses: require('@/assets/onboarding/09.jpg'),
  lot: require('@/assets/onboarding/10.jpg'),
  dusk: require('@/assets/onboarding/01.jpg'),
};
const ALL = [P.framing, P.roof, P.kitchen, P.deck, P.crack, P.crew, P.barn, P.townhouses, P.lot, P.dusk];

export const DEVICE_RATIO = 19.5 / 9;

type DeviceProps = PropsWithChildren<{ width: number; dark?: boolean }>;

/** The phone frame. Flat, ink border, 2px inner radius language scaled up. */
export function Device({ width, dark, children }: DeviceProps) {
  const height = Math.round(width * DEVICE_RATIO);
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 34,
        borderWidth: 3,
        borderColor: Colors.ink,
        backgroundColor: dark ? Colors.camera : Colors.canvas,
        overflow: 'hidden',
      }}>
      <View style={{ height: 34, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 86, height: 22, borderRadius: 11, backgroundColor: dark ? '#1C1D21' : Colors.ink }} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Tile({ source, size, time, initials, pending, dim }: { source: number; size: number; time?: string; initials?: string; pending?: boolean; dim?: boolean }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: Colors.hairline, opacity: dim ? 0.55 : 1 }}>
      <Image source={source} style={{ width: size, height: size }} contentFit="cover" />
      {time ? (
        <View style={{ position: 'absolute', left: 3, bottom: 3, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
          <Mono size={7} color={Colors.onCamera}>{time}</Mono>
        </View>
      ) : null}
      {initials ? (
        <View style={{ position: 'absolute', right: 3, top: 3, backgroundColor: Colors.slate, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
          <Mono size={7} color={Colors.onCamera} bold>{initials}</Mono>
        </View>
      ) : null}
      {pending ? <View style={{ position: 'absolute', right: 4, top: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.flag, borderWidth: 1, borderColor: Colors.onCamera }} /> : null}
    </View>
  );
}

function DayHeader({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 }}>
      <Mono size={8}>{label}</Mono>
    </View>
  );
}

function Grid({ sources, size, times, initials, pending }: { sources: number[]; size: number; times?: string[]; initials?: string[]; pending?: boolean[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 10 }}>
      {sources.map((s, i) => (
        <Tile key={i} source={s} size={size} time={times?.[i]} initials={initials?.[i]} pending={pending?.[i]} />
      ))}
    </View>
  );
}

function Chip({ label, meters, count, on, plus }: { label: string; meters?: number; count?: number; on?: boolean; plus?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 26,
        paddingHorizontal: 9,
        borderRadius: Radius.chip,
        backgroundColor: on ? Colors.flag : 'rgba(247,246,242,0.14)',
        borderWidth: 1,
        borderColor: on ? Colors.flag : 'rgba(247,246,242,0.3)',
      }}>
      {plus ? <SymbolView name="plus" size={9} tintColor={Colors.onCamera} /> : null}
      <Heading size={11} color={Colors.onCamera} numberOfLines={1}>{label}</Heading>
      {meters != null ? <Mono size={7} color={Colors.onCamera}>{meters}M</Mono> : null}
      {count ? (
        <View style={{ minWidth: 12, height: 12, borderRadius: 6, backgroundColor: Colors.onCamera, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Mono size={7} color={on ? Colors.flag : Colors.ink} bold>{count}</Mono>
        </View>
      ) : null}
    </View>
  );
}

function Shutter() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: Colors.onCamera, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.flag }} />
      </View>
    </View>
  );
}

function CameraView({ source, chips, stampShown, children }: PropsWithChildren<{ source: number; chips: React.ReactNode; stampShown?: React.ReactNode }>) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: Colors.camera }}>
        <Image source={source} style={{ flex: 1 }} contentFit="cover" />
        {children}
        {stampShown}
      </View>
      <View style={{ backgroundColor: Colors.camera, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>{chips}</View>
        <Shutter />
      </View>
    </View>
  );
}

function JobLine({ name, address, meta, pending, archived, cover }: { name: string; address: string; meta: string; pending?: number; archived?: boolean; cover: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 6, marginHorizontal: 10, marginBottom: 6, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, opacity: archived ? 0.6 : 1 }}>
      <Image source={cover} style={{ width: 40, height: 40, borderRadius: Radius.chip }} contentFit="cover" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 1 }}>
        <Heading size={12} numberOfLines={1}>{name}</Heading>
        <Body size={8} color={Colors.ink2} numberOfLines={1}>{address}</Body>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Mono size={7}>{meta}</Mono>
          {pending ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.flag }} />
              <Mono size={7} color={Colors.flag}>{pending} UNSYNCED</Mono>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 6, gap: 1 }}>
      <Heading size={17} bold numberOfLines={1}>{title}</Heading>
      {sub ? <Body size={8} color={Colors.ink2} numberOfLines={1}>{sub}</Body> : null}
    </View>
  );
}

/* ---------- the ten mockups ---------- */

function CameraRoll({ w }: { w: number }) {
  const size = Math.floor((w - 6 - 2 * 2) / 3);
  const sources = [...ALL, ...ALL].slice(0, 15);
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface }}>
      <View style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Heading size={17} bold>Recents</Heading>
        <Body size={9} color={Colors.ink2}>4,312 Photos</Body>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 3 }}>
        {sources.map((s, i) => (
          <Tile key={i} source={s} size={size} dim={i % 4 !== 1} />
        ))}
      </View>
      <View style={{ position: 'absolute', left: 10, right: 10, bottom: 18, backgroundColor: Colors.flag, borderRadius: Radius.chip, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' }}>
        <Mono size={9} color={Colors.onCamera} bold numberOfLines={1}>NO JOB · NO TIME · NO PROOF</Mono>
      </View>
    </View>
  );
}

function StampCamera({ active }: { active: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    if (!active) return;
    const a = Animated.sequence([Animated.delay(700), Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 })]);
    a.start();
    return () => a.stop();
  }, [active, pop]);
  return (
    <CameraView
      source={P.framing}
      chips={
        <>
          <Chip plus label="New" />
          <Chip label="Hartley House" meters={38} count={12} on />
          <Chip label="Dunn Deck" meters={210} />
        </>
      }
      stampShown={
        <Animated.View style={{ position: 'absolute', left: 10, bottom: 10, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
          <Stamp photo={{ takenAt: '2026-10-17T07:42:00', lat: 41.8781, lng: -87.6298 }} initials="JOS" tone="dark" size={9} />
        </Animated.View>
      }>
      <View style={{ position: 'absolute', top: 8, left: 10, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.chip }}>
        <Mono size={8} color={Colors.onCamera}>HARTLEY HOUSE · 12 PHOTOS</Mono>
      </View>
    </CameraView>
  );
}

function Nearby() {
  return (
    <CameraView
      source={P.roof}
      chips={
        <>
          <Chip plus label="New" />
          <Chip label="Hartley Roof" meters={38} count={3} on />
          <Chip label="Dunn Deck" meters={210} />
          <Chip label="Park Ave" meters={1200} />
        </>
      }>
      <View style={{ position: 'absolute', top: 8, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.chip }}>
          <Mono size={8} color={Colors.onCamera}>NEARBY · 3 JOBS IN 300 M</Mono>
        </View>
        <View style={{ backgroundColor: Colors.flag, paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.chip }}>
          <Mono size={8} color={Colors.onCamera} bold>38 M</Mono>
        </View>
      </View>
    </CameraView>
  );
}

function Timeline({ w }: { w: number }) {
  const size = Math.floor((w - 20 - 4) / 3);
  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle title="Hartley Roof" sub="212 Maple St · 3 DAYS · 9 PHOTOS" />
      <DayHeader label="SAT OCT 17 · 3 PHOTOS" />
      <Grid sources={[P.roof, P.framing, P.deck]} size={size} times={['09:18', '09:21', '10:02']} />
      <DayHeader label="THU OCT 15 · 3 PHOTOS" />
      <Grid sources={[P.kitchen, P.crack, P.barn]} size={size} times={['07:55', '08:10', '13:40']} />
      <DayHeader label="MON OCT 13 · 3 PHOTOS" />
      <Grid sources={[P.lot, P.townhouses, P.dusk]} size={size} times={['06:48', '12:15', '17:31']} />
    </View>
  );
}

function ShareLink({ w }: { w: number }) {
  const size = Math.floor((w - 20 - 4) / 3);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, opacity: 0.35 }}>
        <ScreenTitle title="Dunn Deck" sub="48 Birch Ct · 2 DAYS · 6 PHOTOS" />
        <DayHeader label="FRI OCT 16 · 3 PHOTOS" />
        <Grid sources={[P.deck, P.framing, P.kitchen]} size={size} times={['17:51', '17:53', '18:04']} />
      </View>
      <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: Radius.card, borderTopRightRadius: Radius.card, borderTopWidth: 1, borderColor: Colors.hairline, padding: 10, gap: 8 }}>
        <Heading size={14}>Share Dunn Deck</Heading>
        <View style={{ gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderColor: Colors.hairline }}>
          <Heading size={12}>Live job link</Heading>
          <Body size={8} color={Colors.ink2}>Updates as you shoot. Never expires on Pro.</Body>
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flex: 1, backgroundColor: Colors.canvas, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.chip, paddingHorizontal: 6, paddingVertical: 5 }}>
              <Mono size={8} numberOfLines={1}>crewlens-share.vercel.app/s/k7f3q2</Mono>
            </View>
            <View style={{ backgroundColor: Colors.flag, borderRadius: Radius.card, paddingHorizontal: 9, paddingVertical: 6 }}>
              <Heading size={11} color={Colors.onCamera}>Copy link</Heading>
            </View>
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <Heading size={12}>Gallery link</Heading>
          <Body size={8} color={Colors.ink2}>Pick photos, or select all. A fixed set.</Body>
        </View>
      </View>
    </View>
  );
}

function Detail({ w }: { w: number }) {
  const h = Math.round(w * 0.95);
  const rows: [string, string][] = [
    ['TAKEN', '08:27 · OCT 9 2026'],
    ['WHERE', '42.3601N 71.0589W'],
    ['BY', 'JOS · Jo Smith'],
    ['JOB', 'Beacon St Basement'],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera }}>
      <View style={{ height: h }}>
        <Image source={P.crack} style={{ width: w, height: h }} contentFit="cover" />
        <View style={{ position: 'absolute', left: 8, bottom: 8 }}>
          <Stamp photo={{ takenAt: '2026-10-09T08:27:00', lat: 42.3601, lng: -71.0589 }} initials="JOS" tone="dark" size={9} />
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: Colors.canvas, padding: 10, gap: 7 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: Colors.hairline, paddingBottom: 5 }}>
            <Mono size={8} color={Colors.ink2}>{k}</Mono>
            <Mono size={8} bold>{v}</Mono>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <View style={{ flex: 1, height: 24, borderRadius: Radius.card, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Heading size={10} color={Colors.onCamera}>Export with stamp</Heading>
          </View>
          <View style={{ flex: 1, height: 24, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
            <Heading size={10}>Share</Heading>
          </View>
        </View>
      </View>
    </View>
  );
}

function Crew({ w }: { w: number }) {
  const size = Math.floor((w - 20 - 4) / 3);
  const team = ['JOS', 'MRT', 'KLW', 'ABR'];
  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle title="Park Ave Build" sub="900 Park Ave · TODAY · 6 PHOTOS" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8 }}>
        <Mono size={8}>TEAM · 4</Mono>
        {team.map((t) => (
          <View key={t} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
            <Mono size={6} color={Colors.onCamera} bold>{t}</Mono>
          </View>
        ))}
      </View>
      <DayHeader label="SAT OCT 17 · 6 PHOTOS" />
      <Grid sources={[P.crew, P.framing, P.roof, P.kitchen, P.deck, P.barn]} size={size} times={['06:58', '07:04', '07:40', '09:12', '11:30', '14:02']} initials={['ABR', 'JOS', 'MRT', 'KLW', 'JOS', 'ABR']} />
    </View>
  );
}

function Offline({ active }: { active: boolean }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    setOnline(false);
    if (!active) return;
    const t = setTimeout(() => setOnline(true), 1800);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginHorizontal: 10, marginTop: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: online ? Colors.ok : Colors.ink, borderRadius: Radius.chip, paddingHorizontal: 8, paddingVertical: 6 }}>
        <SymbolView name={online ? 'arrow.up.circle.fill' : 'antenna.radiowaves.left.and.right.slash'} size={11} tintColor={Colors.onCamera} />
        <Mono size={8} color={Colors.onCamera} bold>{online ? 'BACK ONLINE · UPLOADING 5 PHOTOS' : 'NO SIGNAL · SAVED ON YOUR PHONE'}</Mono>
      </View>
      <JobLine name="Miller Barn" address="Rural Route 4" meta="2 MIN AGO · 14 PHOTOS" pending={online ? undefined : 3} cover={P.barn} />
      <JobLine name="Beacon St Basement" address="77 Beacon St" meta="1 HR AGO · 31 PHOTOS" pending={online ? undefined : 2} cover={P.crack} />
      <JobLine name="Hartley Roof" address="212 Maple St" meta="YESTERDAY · 9 PHOTOS" cover={P.roof} />
      <JobLine name="Dunn Deck" address="48 Birch Ct" meta="2 DAYS AGO · 6 PHOTOS" cover={P.deck} />
    </View>
  );
}

function Archive() {
  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle title="Jobs" />
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.chip, borderWidth: 1, borderColor: Colors.hairline }}>
          <Mono size={8}>ACTIVE · 12</Mono>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.chip, backgroundColor: Colors.ink }}>
          <Mono size={8} color={Colors.onCamera} bold>ARCHIVED · 148</Mono>
        </View>
        <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.chip, backgroundColor: 'rgba(47,125,79,0.14)' }}>
          <Mono size={8} color={Colors.ok} bold>FREE · UNLIMITED</Mono>
        </View>
      </View>
      <JobLine archived name="Oakwood Townhomes" address="Phase 2, Lots 1–8" meta="ARCHIVED JUN 2026 · 412 PHOTOS" cover={P.townhouses} />
      <JobLine archived name="Dunn Deck" address="48 Birch Ct" meta="ARCHIVED OCT 2026 · 61 PHOTOS" cover={P.deck} />
      <JobLine archived name="Kessler Kitchen" address="14 Elm St" meta="ARCHIVED MAR 2025 · 203 PHOTOS" cover={P.kitchen} />
      <JobLine archived name="Riverside Lot" address="Lot 3, River Rd" meta="ARCHIVED SEP 2024 · 88 PHOTOS" cover={P.lot} />
    </View>
  );
}

function Start({ w, active }: { w: number; active: boolean }) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!active) return;
    setNow(new Date().toISOString());
    const t = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(t);
  }, [active]);
  const h = Math.round(w * 0.78);
  const checks = ['Stamped the moment you shoot', 'Filed to the job you are on', 'Shared with one live link'];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: h, margin: 10, borderRadius: Radius.card, overflow: 'hidden', borderWidth: 1, borderColor: Colors.hairline }}>
        <Image source={P.lot} style={{ width: w - 20, height: h }} contentFit="cover" />
        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.chip }}>
          <Mono size={8} color={Colors.onCamera}>JOB 001 · YOUR NEXT SITE</Mono>
        </View>
        <View style={{ position: 'absolute', left: 8, bottom: 8 }}>
          <Stamp photo={{ takenAt: now, lat: 40.7128, lng: -74.006 }} initials="YOU" tone="dark" size={9} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 10, gap: 6 }}>
        {checks.map((c) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, padding: 8 }}>
            <SymbolView name="checkmark.circle.fill" size={14} tintColor={Colors.ok} />
            <Heading size={12}>{c}</Heading>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Mockup({ name, width, active }: { name: IntroMockup; width: number; active: boolean }) {
  const inner = width - 6;
  const dark = name === 'stamp' || name === 'nearby' || name === 'detail';
  return (
    <Device width={width} dark={dark}>
      {name === 'cameraRoll' ? <CameraRoll w={inner} /> : null}
      {name === 'stamp' ? <StampCamera active={active} /> : null}
      {name === 'nearby' ? <Nearby /> : null}
      {name === 'timeline' ? <Timeline w={inner} /> : null}
      {name === 'shareLink' ? <ShareLink w={inner} /> : null}
      {name === 'detail' ? <Detail w={inner} /> : null}
      {name === 'crew' ? <Crew w={inner} /> : null}
      {name === 'offline' ? <Offline active={active} /> : null}
      {name === 'archive' ? <Archive /> : null}
      {name === 'start' ? <Start w={inner} active={active} /> : null}
    </Device>
  );
}
