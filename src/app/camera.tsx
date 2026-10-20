import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LimitSheet } from '@/components/limit-sheet';
import { JobChipStrip } from '@/components/job-chip-strip';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { useCompany, useMember } from '@/lib/company';
import { consumeCameraJob } from '@/lib/handoff';
import { useFix, useJobs } from '@/lib/jobs';
import { atPhotoCap, capture, captureVideo, formatDuration } from '@/lib/photos';
import * as dbm from '@/lib/db';
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
  const [mic, requestMic] = useMicrophonePermissions();
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recordStart = useRef(0);
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

  const videoAllowed = limitsFor(tier).videosPerJob > 0;

  const toggleMode = useCallback(async () => {
    if (recording) return;
    if (mode === 'video') {
      setMode('picture');
      return;
    }
    if (!videoAllowed) {
      setToast('Video is on Pro and Crew.');
      return;
    }
    if (!mic?.granted) {
      const r = await requestMic();
      if (!r.granted) {
        setToast('Microphone is off. Clips record without sound.');
      }
    }
    setMode('video');
  }, [mic?.granted, mode, recording, requestMic, videoAllowed]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - recordStart.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  const record = useCallback(async () => {
    if (!ready || !cam.current) return;
    if (selected === 'new') {
      router.push({ pathname: '/job/new', params: { returnTo: 'camera' } });
      return;
    }
    if (recording) {
      cam.current.stopRecording();
      return;
    }
    const cap = limitsFor(tier).videosPerJob;
    if ((await dbm.photos.countByJob(selected, 'video')) >= cap) {
      setToast(`${cap} clips per job on your plan.`);
      return;
    }
    const maxS = limitsFor(tier).videoMaxS;
    setRecording(true);
    setElapsed(0);
    recordStart.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const rec = await cam.current.recordAsync({ maxDuration: maxS });
      const durationS = (Date.now() - recordStart.current) / 1000;
      setRecording(false);
      if (!rec?.uri) return;
      setBusy(true);
      const clip = await captureVideo({ jobId: selected, uri: rec.uri, durationS, fix });
      setLast(clip);
      setCounts((c) => ({ ...c, [selected]: (c[selected] ?? 0) + 1 }));
    } catch (e) {
      setRecording(false);
      Alert.alert('Could not save clip', e instanceof Error && e.message === 'no_company' ? 'Sign in again to keep shooting.' : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [ready, selected, recording, tier, fix]);

  const longPress = useCallback(() => {
    if (mode === 'picture') void toggleMode();
  }, [mode, toggleMode]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: Colors.camera }} />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.camera, padding: Space.lg, paddingTop: insets.top + Space.lg, gap: Space.md, justifyContent: 'center' }}>
        <Heading size={30} color={Colors.onCamera}>Camera access is off.</Heading>
        <Body color={Colors.onCamera}>Crew Lens needs the camera to take job photos.</Body>
        {/* iOS asks only once; after a no, the switch lives in Settings. */}
        {permission.canAskAgain ? (
          <Button title="Continue" onPress={() => requestPermission()} />
        ) : (
          <Button title="Open Settings" onPress={() => Linking.openSettings()} />
        )}
        <Button title="Close" variant="ghost" onPress={() => router.back()} style={{ borderColor: 'rgba(247,246,242,0.3)' }} />
      </View>
    );
  }

  const initials = member?.initials ?? '???';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera }}>
      <CameraView ref={cam} style={{ flex: 1 }} facing={facing} flash={flash} mode={mode} mute={!mic?.granted} onCameraReady={() => setReady(true)} responsiveOrientationWhenOrientationLocked />

      {/* Top bar */}
      <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.sm }}>
        <IconButton name="xmark" label="Close camera" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          {recording ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.onCamera }} />
              <Mono size={11} color={Colors.onCamera} bold>REC {formatDuration(elapsed)} / {formatDuration(limitsFor(tier).videoMaxS)}</Mono>
            </View>
          ) : (
            <Mono size={11} color={Colors.onCamera}>{fix ? `GPS ±${Math.round(fix.accuracyM ?? 0)} m` : 'No GPS'}</Mono>
          )}
        </View>
        <IconButton name={mode === 'video' ? 'camera' : 'video'} label={mode === 'video' ? 'Switch to photo' : 'Switch to video'} onPress={() => void toggleMode()} />
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
            onPress={mode === 'video' ? record : shoot}
            onLongPress={longPress}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel={selected === 'new' ? 'Create a job here' : mode === 'video' ? (recording ? 'Stop recording' : 'Record video') : 'Take photo'}
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
            <View style={{ width: recording ? 30 : 60, height: recording ? 30 : 60, borderRadius: recording ? 6 : 30, backgroundColor: busy ? Colors.ink2 : recording ? Colors.danger : Colors.onCamera, alignItems: 'center', justifyContent: 'center' }}>
              {selected === 'new' ? <SymbolView name="plus" size={26} tintColor={Colors.ink} /> : mode === 'video' && !recording ? <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.danger }} /> : null}
            </View>
          </Pressable>
        </View>
      </View>
      <LimitSheet error={limit} tier={tier} onClose={() => setLimit(null)} />
    </View>
  );
}
