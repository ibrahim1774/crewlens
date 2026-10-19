import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Heading, Mono } from '@/components/text';
import { activeStep, quoteFor, scenesFor, type MomentId, type SceneId } from '@/constants/moments';
import { SCENE_MEDIA, SCENES_WITH_CLIP } from '@/constants/scene-media';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useCompany } from '@/lib/company';
import { meta } from '@/lib/db';

function Clip({ scene, still, onTime }: { scene: SceneId; still: boolean; onTime: (t: number, d: number) => void }) {
  const media = SCENE_MEDIA[scene];
  const player = useVideoPlayer(still ? null : media.video, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.2;
    p.play();
  });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  useEffect(() => {
    if (!still) onTime(currentTime, player.duration || 1);
  }, [currentTime, still, player, onTime]);
  return (
    <View
      style={{ flex: 1, alignSelf: 'center', aspectRatio: 4 / 5, maxWidth: '100%', borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.hairline }}
      accessible
      accessibilityLabel={`Video: ${media.headline}. ${media.steps.map((s) => s.label).join('. ')}.`}
      testID="scene-clip">
      <Image source={media.poster} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
      {!still ? <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} /> : null}
    </View>
  );
}

/** One scene per thing they picked: their words, a short clip of the moment and the real app handling it, the steps. */
export default function Scene() {
  const { i = '0' } = useLocalSearchParams<{ i?: string }>();
  const index = Number(i) || 0;
  const insets = useSafeAreaInsets();
  const company = useCompany();
  const [scenes, setScenes] = useState<SceneId[] | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  const [time, setTime] = useState({ t: 0, d: 1 });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
    Promise.all([meta.get('profile_moments'), meta.get('profile_crew')]).then(([saved, crew]) => {
      const picked = (saved ? saved.split(',') : []) as MomentId[];
      const list = scenesFor(picked, SCENES_WITH_CLIP);
      setScenes(list);
      const scene = list[Math.min(index, list.length - 1)];
      setQuote(quoteFor(scene, picked, { crew }));
      track('onboarding_step', { step: 'scene', scene, index });
    });
  }, [index]);

  if (!scenes) return <View style={{ flex: 1, backgroundColor: Colors.canvas }} />;
  const scene = scenes[Math.min(index, scenes.length - 1)];
  const media = SCENE_MEDIA[scene];
  const last = index >= scenes.length - 1;
  const lit = still ? media.steps.length - 1 : activeStep(media.steps, time.t);

  const next = () => {
    track('scene_next', { scene, index, watched_s: Math.round(time.t) });
    if (last) router.push('/(auth)/setup');
    else router.push({ pathname: '/(auth)/scene', params: { i: String(index + 1) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + Space.sm, paddingHorizontal: Space.md, gap: Space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID="scene-back">
          <SymbolView name="chevron.left" size={16} weight="semibold" tintColor={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {scenes.map((s, k) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.hairline, overflow: 'hidden' }}>
              <View style={{ height: 4, backgroundColor: Colors.ink, width: k < index || still ? '100%' : k === index ? `${Math.min(100, (time.t / time.d) * 100)}%` : '0%' }} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        {quote ? (
          <View style={{ gap: 2 }}>
            <Mono size={11} color={Colors.ink2}>YOU SAID</Mono>
            <Body size={15} color={Colors.ink2} numberOfLines={2}>{`“${quote}”`}</Body>
          </View>
        ) : null}
        <Heading size={28} bold style={{ lineHeight: 32 }}>{media.headline}</Heading>
      </View>

      <Clip key={scene} scene={scene} still={still} onTime={(t, d) => setTime({ t, d })} />

      <View style={{ gap: 6 }}>
        {media.steps.map((s, k) => {
          const on = k <= lit;
          return (
            <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }} testID={`scene-step-${k}`}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Colors.flag : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: Colors.hairline }}>
                <Mono size={10} bold color={on ? Colors.surface : Colors.ink2}>{k + 1}</Mono>
              </View>
              <Body size={15} bold={on} color={on ? Colors.ink : Colors.ink2}>{s.label}</Body>
            </View>
          );
        })}
      </View>
      {company ? <Body size={14} color={Colors.ink2}>{media.personal(company.name)}</Body> : null}

      <Button title={last ? 'See my setup' : 'Next'} onPress={next} testID="scene-next" />
    </View>
  );
}
