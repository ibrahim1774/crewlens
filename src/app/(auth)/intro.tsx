import * as Haptics from 'expo-haptics';
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
import { DEVICE_RATIO, Mockup } from '@/components/intro-mockups';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { INTRO_SLIDES, clampSlide, markIntroSeen, type IntroSlide } from '@/lib/intro';

const FOOTER_H = 52 + Space.md * 2;
const COPY_H = 168;

type SlideProps = { slide: IntroSlide; index: number; active: boolean; width: number; deviceW: number; topInset: number; reduceMotion: boolean };

/**
 * One screen of the tour: counter, a device-framed rendering of the real product UI,
 * then the headline and one paragraph. The device rises in once when the slide is shown.
 */
function Slide({ slide, index, active, width, deviceW, topInset, reduceMotion }: SlideProps) {
  const rise = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!active) {
      rise.setValue(reduceMotion ? 1 : 0);
      return;
    }
    Animated.timing(rise, { toValue: 1, duration: reduceMotion ? 0 : 480, delay: 60, useNativeDriver: true }).start();
  }, [active, reduceMotion, rise]);

  const shift = rise.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  return (
    <View style={{ width, flex: 1, paddingTop: topInset + Space.lg + 10, paddingHorizontal: Space.md }} testID={`intro-slide-${index + 1}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <View style={{ backgroundColor: Colors.flag, borderRadius: Radius.chip, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Mono size={11} color={Colors.onCamera} bold>{String(index + 1).padStart(2, '0')} / {INTRO_SLIDES.length}</Mono>
        </View>
        <Mono size={11} color={Colors.ink2} bold>{slide.eyebrow}</Mono>
      </View>

      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: rise, transform: [{ translateY: shift }] }}>
        <Mockup name={slide.mockup} width={deviceW} active={active} />
      </Animated.View>

      <Animated.View style={{ height: COPY_H, gap: Space.sm, opacity: rise }}>
        <Heading size={32} bold style={{ lineHeight: 34 }} accessibilityRole="header">{slide.title}</Heading>
        <Body size={15} color={Colors.ink2}>{slide.body}</Body>
      </Animated.View>
    </View>
  );
}

function Progress({ index, top }: { index: number; top: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: Space.md, right: Space.md, flexDirection: 'row', gap: 4 }}>
      {INTRO_SLIDES.map((s, i) => (
        <View key={s.key} style={{ flex: 1, height: 3, borderRadius: Radius.chip, backgroundColor: i === index ? Colors.flag : i < index ? Colors.ink : Colors.hairline }} />
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

  // The device must fit between the counter and the copy block on every phone size.
  const deviceW = useMemo(() => {
    const footer = FOOTER_H + insets.bottom;
    const available = height - (insets.top + Space.lg + 10 + 22) - COPY_H - footer - Space.lg * 2;
    return Math.floor(Math.min(width * 0.68, available / DEVICE_RATIO));
  }, [height, insets.bottom, insets.top, width]);

  const goTo = useCallback((next: number) => {
    list.current?.scrollToIndex({ index: clampSlide(next), animated: true });
  }, []);

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
      router.replace('/(auth)/benefits');
    },
    [index, replay],
  );

  const renderItem: ListRenderItem<IntroSlide> = useCallback(
    ({ item, index: i }) => <Slide slide={item} index={i} active={i === index} width={width} deviceW={deviceW} topInset={insets.top} reduceMotion={reduceMotion} />,
    [deviceW, index, insets.top, reduceMotion, width],
  );

  const getItemLayout = useMemo(() => (_: unknown, i: number) => ({ length: width, offset: width * i, index: i }), [width]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <StatusBar style="dark" />
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
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: FOOTER_H + insets.bottom }}
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
          backgroundColor: Colors.canvas,
        }}>
        {last ? (
          <Button title={replay === '1' ? 'Done' : 'Get started'} onPress={() => finish(true)} style={{ flex: 1 }} testID="intro-finish" />
        ) : (
          <>
            <Pressable onPress={() => finish(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tour" testID="intro-skip" style={{ paddingVertical: Space.sm, paddingRight: Space.md }}>
              <Mono size={13} color={Colors.ink} bold>Skip</Mono>
            </Pressable>
            <Button title="Next" onPress={() => goTo(index + 1)} style={{ flex: 1 }} testID="intro-next" />
          </>
        )}
      </View>
    </View>
  );
}
