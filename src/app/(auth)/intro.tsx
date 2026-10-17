import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Pressable,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { INTRO_SLIDES, clampSlide, markIntroSeen, type IntroSlide } from '@/lib/intro';

const fadeBottom = require('@/assets/onboarding/fade-bottom.png');
const fadeTop = require('@/assets/onboarding/fade-top.png');

const FOOTER_H = 52 + Space.md * 2;

type SlideProps = { slide: IntroSlide; index: number; active: boolean; width: number; height: number; topInset: number; bottomInset: number; reduceMotion: boolean };

/**
 * One full-bleed photo with the stamp on it and the copy in the lower third.
 * The photo drifts slowly while the slide is in view; the copy rises in once.
 */
function Slide({ slide, index, active, width, height, topInset, bottomInset, reduceMotion }: SlideProps) {
  const drift = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!active) return;
    if (slide.stamp?.takenAt === 'now') {
      setNow(new Date().toISOString());
      const t = setInterval(() => setNow(new Date().toISOString()), 30000);
      return () => clearInterval(t);
    }
  }, [active, slide.stamp?.takenAt]);

  useEffect(() => {
    if (!active) {
      rise.setValue(0);
      drift.stopAnimation();
      drift.setValue(1);
      return;
    }
    Animated.timing(rise, { toValue: 1, duration: 520, delay: 90, useNativeDriver: true }).start();
    if (!reduceMotion) {
      Animated.timing(drift, { toValue: 1.08, duration: 9000, useNativeDriver: true }).start();
    }
  }, [active, drift, reduceMotion, rise]);

  const stamp = slide.stamp ? { ...slide.stamp, takenAt: slide.stamp.takenAt === 'now' ? now : slide.stamp.takenAt } : null;
  const copyShift = rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <View style={{ width, height, backgroundColor: Colors.camera }} testID={`intro-slide-${index + 1}`}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ scale: drift }] }}>
        <Image source={slide.image} style={{ width, height }} contentFit="cover" transition={active ? 180 : 0} priority={index < 2 ? 'high' : 'normal'} />
      </Animated.View>
      <Image source={fadeTop} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topInset + 180 }} contentFit="fill" />
      <Image source={fadeBottom} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(height * 0.6) }} contentFit="fill" />

      <View style={{ position: 'absolute', top: topInset + Space.lg + 14, left: Space.md }}>
        {stamp ? (
          <Stamp photo={{ takenAt: stamp.takenAt, lat: stamp.lat, lng: stamp.lng }} initials={stamp.initials} tone="dark" size={12} />
        ) : (
          <View style={{ backgroundColor: 'rgba(232,82,30,0.92)', borderRadius: Radius.chip, paddingHorizontal: Space.sm, paddingVertical: Space.xs }}>
            <Mono size={12} color={Colors.onCamera} bold>{slide.stampNote}</Mono>
          </View>
        )}
      </View>

      <Animated.View
        style={{
          position: 'absolute',
          left: Space.md,
          right: Space.md,
          bottom: bottomInset + FOOTER_H + Space.sm,
          gap: Space.sm,
          opacity: rise,
          transform: [{ translateY: copyShift }],
        }}>
        <Mono size={11} color={Colors.flag} bold>{String(index + 1).padStart(2, '0')} / {INTRO_SLIDES.length}  ·  {slide.eyebrow}</Mono>
        <Heading size={40} bold color={Colors.onCamera} style={{ lineHeight: 42 }} accessibilityRole="header">{slide.title}</Heading>
        <Body size={16} color={Colors.onCamera} style={{ opacity: 0.86, lineHeight: 23 }}>{slide.body}</Body>
      </Animated.View>
    </View>
  );
}

function Progress({ index, top }: { index: number; top: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: Space.md, right: Space.md, flexDirection: 'row', gap: 4 }}>
      {INTRO_SLIDES.map((s, i) => (
        <View
          key={s.key}
          style={{
            flex: 1,
            height: 3,
            borderRadius: Radius.chip,
            backgroundColor: i === index ? Colors.flag : i < index ? Colors.onCamera : 'rgba(247,246,242,0.32)',
          }}
        />
      ))}
    </View>
  );
}

export default function Intro() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const list = useRef<FlatList<IntroSlide>>(null);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const last = index === INTRO_SLIDES.length - 1;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    track('onboarding_step', { step: 'intro', slide: 1 });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const i = clampSlide(next);
      list.current?.scrollToIndex({ index: i, animated: true });
    },
    [],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = clampSlide(e.nativeEvent.contentOffset.x / width);
      setIndex((prev) => {
        if (prev !== i) {
          Haptics.selectionAsync().catch(() => {});
          track('onboarding_step', { step: 'intro', slide: i + 1 });
        }
        return i;
      });
    },
    [width],
  );

  const finish = useCallback(
    async (completed: boolean) => {
      track(completed ? 'intro_completed' : 'intro_skipped', { slide: index + 1 });
      await markIntroSeen();
      if (replay === '1') {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
        return;
      }
      router.replace('/(auth)/sign-in');
    },
    [index, replay],
  );

  const renderItem: ListRenderItem<IntroSlide> = useCallback(
    ({ item, index: i }) => (
      <Slide slide={item} index={i} active={i === index} width={width} height={height} topInset={insets.top} bottomInset={insets.bottom} reduceMotion={reduceMotion} />
    ),
    [height, index, insets.bottom, insets.top, reduceMotion, width],
  );

  const getItemLayout = useMemo(() => (_: unknown, i: number) => ({ length: width, offset: width * i, index: i }), [width]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera }}>
      <StatusBar style="light" />
      <FlatList
        ref={list}
        data={INTRO_SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        extraData={index}
      />
      <Progress index={index} top={insets.top + Space.md} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: Space.md,
          paddingTop: Space.md,
          paddingBottom: insets.bottom + Space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Space.md,
        }}>
        {last ? (
          <Button title={replay === '1' ? 'Done' : 'Get started'} onPress={() => finish(true)} style={{ flex: 1 }} testID="intro-finish" />
        ) : (
          <>
            <Pressable onPress={() => finish(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tour" testID="intro-skip" style={{ paddingVertical: Space.sm, paddingRight: Space.md }}>
              <Mono size={13} color={Colors.onCamera} bold>SKIP</Mono>
            </Pressable>
            <Button title="Next" onPress={() => goTo(index + 1)} style={{ flex: 1 }} testID="intro-next" />
          </>
        )}
      </View>
    </View>
  );
}
