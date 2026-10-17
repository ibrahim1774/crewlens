import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LimitSheet } from '@/components/limit-sheet';
import { JobChipStrip } from '@/components/job-chip-strip';
import { Stamp } from '@/components/stamp';
import { Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { useCompany, useMember } from '@/lib/company';
import { consumeCameraJob } from '@/lib/handoff';
import { useFix, useJobs } from '@/lib/jobs';
import { atPhotoCap, capture } from '@/lib/photos';
import { effectiveTier, limitsFor } from '@/lib/plan';
import { stripOrder } from '@/lib/strip';
import { LimitError } from '@/lib/supabase';
import type { Photo } from '@/types/models';

function IconButton({ name, onPress, label }: { name: string; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <SymbolView name={name as never} size={22} tintColor={Colors.onCamera} />
    </Pressable>
  );
}

/**
 * Full-screen viewfinder. The nearest active job is pre-selected in the strip; every shot is
 * compressed, stamped and queued without waiting for the network.
 */
export default function Camera() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const company = useCompany();
  const member = useMember();
  const jobs = useJobs();
  const fix = useFix();
  const cam = useRef<CameraView>(null);

  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<string | null>(params.jobId ?? null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Photo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [limit, setLimit] = useState<LimitError | null>(null);
  const tier = effectiveTier(company?.tier ?? null, true);

  useFocusEffect(
    useCallback(() => {
      const handed = consumeCameraJob();
      if (handed) setManual(handed);
    }, [])
  );

  const strip = useMemo(() => stripOrder(jobs, fix, manual), [jobs, fix, manual]);
  const selected = strip.selected;

  useEffect(() => {
    if (params.jobId) setManual(params.jobId);
  }, [params.jobId]);

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 1200);
    return () => clearTimeout(t);
  }, [last]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const onSelect = useCallback((id: string) => {
    if (id === 'new') {
      router.push({ pathname: '/job/new', params: { returnTo: 'camera' } });
      return;
    }
    setManual(id);
  }, []);

  const shoot = useCallback(async () => {
    if (!ready || busy || !cam.current) return;
    if (selected === 'new') {
      router.push({ pathname: '/job/new', params: { returnTo: 'camera' } });
      return;
    }
    const cap = limitsFor(tier).photosPerJob;
    if (await atPhotoCap(selected, cap)) {
      setLimit(new LimitError('photos_per_job', cap));
      return;
    }
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const pic = await cam.current.takePictureAsync({ quality: 1, exif: false });
      const photo = await capture({ jobId: selected, uri: pic.uri, width: pic.width, height: pic.height, fix });
      setLast(photo);
      setCounts((c) => ({ ...c, [selected]: (c[selected] ?? 0) + 1 }));
    } catch (e) {
      Alert.alert('Could not save photo', e instanceof Error && e.message === 'no_company' ? 'Sign in again to keep shooting.' : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [ready, busy, selected, fix, tier]);

  const longPress = useCallback(() => {
    setToast(limitsFor(tier).videosPerJob === 0 ? 'Video is on Pro and Crew.' : 'Video is coming soon.');
  }, [tier]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: Colors.camera }} />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.camera, padding: Space.lg, paddingTop: insets.top + Space.lg, gap: Space.md, justifyContent: 'center' }}>
        <Heading size={30} color={Colors.onCamera}>Camera access is off.</Heading>
        <Button title="Allow camera" onPress={() => requestPermission()} />
        <Button title="Close" variant="ghost" onPress={() => router.back()} style={{ borderColor: 'rgba(247,246,242,0.3)' }} />
      </View>
    );
  }

  const initials = member?.initials ?? '???';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera }}>
      <CameraView ref={cam} style={{ flex: 1 }} facing={facing} flash={flash} onCameraReady={() => setReady(true)} responsiveOrientationWhenOrientationLocked />

      {/* Top bar */}
      <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.sm }}>
        <IconButton name="xmark" label="Close camera" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Mono size={11} color={Colors.onCamera}>{fix ? `GPS ±${Math.round(fix.accuracyM ?? 0)} M` : 'NO GPS'}</Mono>
        </View>
        <IconButton name={flash === 'off' ? 'bolt.slash' : 'bolt.fill'} label="Toggle flash" onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))} />
        <IconButton name="arrow.triangle.2.circlepath.camera" label="Flip camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
      </View>

      {/* Stamp flash after capture */}
      {last ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(300)} style={{ position: 'absolute', left: Space.md, bottom: insets.bottom + 190 }}>
          <Stamp photo={last} initials={initials} tone="dark" size={13} />
        </Animated.View>
      ) : null}

      {toast ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(300)} style={{ position: 'absolute', alignSelf: 'center', bottom: insets.bottom + 190, backgroundColor: 'rgba(11,11,13,0.8)', paddingHorizontal: Space.md, paddingVertical: Space.sm, borderRadius: 2 }}>
          <Heading size={15} color={Colors.onCamera}>{toast}</Heading>
        </Animated.View>
      ) : null}

      {/* Bottom: strip + shutter */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + Space.md, gap: Space.md, backgroundColor: 'rgba(11,11,13,0.55)', paddingTop: Space.md }}>
        <JobChipStrip chips={strip.chips} selected={selected} counts={counts} onSelect={onSelect} />
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 88 }}>
          <Pressable
            onPress={shoot}
            onLongPress={longPress}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel={selected === 'new' ? 'Create a job here' : 'Take photo'}
            testID="shutter"
            style={({ pressed }) => ({
              width: 76,
              height: 76,
              borderRadius: 38,
              borderWidth: 4,
              borderColor: Colors.onCamera,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !ready ? 0.5 : pressed ? 0.8 : 1,
            })}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: busy ? Colors.ink2 : Colors.flag, alignItems: 'center', justifyContent: 'center' }}>
              {selected === 'new' ? <SymbolView name="plus" size={26} tintColor={Colors.onCamera} /> : null}
            </View>
          </Pressable>
        </View>
      </View>
      <LimitSheet error={limit} tier={tier} onClose={() => setLimit(null)} />
    </View>
  );
}
