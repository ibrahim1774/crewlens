import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Heading, Mono } from '@/components/text';
import { ctaLabel, FEATURES, PLANS, priceLabel, productId, suggestedTier, yearlySavingPct, type Period } from '@/constants/plans';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { isGuest } from '@/lib/auth';
import { meta } from '@/lib/db';
import { superwallActive, usePaywall, useRestorePurchases } from '@/lib/paywall';
import type { Tier } from '@/types/models';

const TERMS_URL = 'https://crewlens-share.vercel.app/terms';
const PRIVACY_URL = 'https://crewlens-share.vercel.app/privacy';

async function finish(tier: Tier, period: Period, upgrade: boolean) {
  await meta.set('plan_choice', productId(tier, period));
  if (upgrade) {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
    return;
  }
  // The plan is bought on the guest account; saving it with a phone number comes next.
  router.replace(isGuest() ? '/(auth)/save' : '/(auth)/first-job');
}

/** Short cell copy so three columns fit a phone without scrolling. */
function cell(v: string): string {
  return v.replace('Never expire', 'Never\nexpire').replace('Edit, sign, text', 'Edit, sign\n& text').replace(' per job', '/job');
}

/**
 * Every plan on one screen: a column per plan, a row per feature, Pro highlighted.
 * Tap a column to pick it; the button at the bottom follows the choice.
 */
export default function PaywallGate() {
  const { upgrade } = useLocalSearchParams<{ upgrade?: string }>();
  const fromUpgrade = upgrade === '1';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const [period, setPeriod] = useState<Period>('monthly');
  const [tier, setTier] = useState<Tier>('pro');
  const [answers, setAnswers] = useState<Record<string, string> | null>(fromUpgrade ? {} : null);
  const show = usePaywall();
  const restore = useRestorePurchases();
  const plan = PLANS.find((p) => p.tier === tier) ?? PLANS[1];

  useEffect(() => {
    track('onboarding_step', { step: 'plan', superwall: superwallActive });
  }, []);

  // Their answers pick the starting plan here and reach Superwall as placement parameters.
  useEffect(() => {
    if (fromUpgrade) return;
    void Promise.all(['profile_crew', 'profile_trade', 'profile_photo_home', 'profile_headache'].map((k) => meta.get(k))).then(([crew, trade, home, headache]) => {
      const suggested = suggestedTier(crew);
      setTier(suggested);
      setAnswers({ crew_size: crew ?? '', trade: trade ?? '', photo_home: home ?? '', headache: headache ?? '', suggested_plan: suggested });
    });
  }, [fromUpgrade]);

  // With Superwall on, its paywall is the plan picker (all plans, both periods), so open it straight away.
  // Closing it leaves this table underneath, whose button opens it again.
  const opened = useRef(false);
  useEffect(() => {
    if (!superwallActive || opened.current || !answers) return;
    opened.current = true;
    void show(fromUpgrade ? 'upgrade_tapped' : 'onboarding_complete', () => void finish(tier, 'monthly', fromUpgrade), answers);
  }, [show, fromUpgrade, answers, tier]);

  const choose = () => {
    track('plan_selected', { tier, period, product: productId(tier, period) });
    if (superwallActive) {
      void show(fromUpgrade ? 'upgrade_tapped' : 'onboarding_complete', () => void finish(tier, period, fromUpgrade), answers ?? undefined);
      return;
    }
    void finish(tier, period, fromUpgrade);
  };

  const labelW = compact ? 92 : 104;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top + Space.sm, paddingHorizontal: Space.md }}>
      <View style={{ gap: 4 }}>
        <Mono color={Colors.ink2} size={11}>{fromUpgrade ? 'Plans' : stepLabel('paywall')}</Mono>
        <Heading size={compact ? 28 : 32} bold>{fromUpgrade ? 'Upgrade your plan' : 'Pick your plan'}</Heading>
        <Body size={compact ? 13 : 14} color={Colors.ink2}>Every plan keeps every photo stamped, filed and backed up. Pro adds the paperwork: sign the invoice on the phone and text it to the client.</Body>
      </View>

      <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: Space.sm, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, overflow: 'hidden' }}>
        {(['monthly', 'yearly'] as Period[]).map((p) => {
          const on = p === period;
          return (
            <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`period-${p}`} style={{ paddingHorizontal: Space.md, height: 32, justifyContent: 'center', backgroundColor: on ? Colors.ink : Colors.surface }}>
              <Heading size={13} color={on ? Colors.surface : Colors.ink}>{p === 'monthly' ? 'Monthly' : `Yearly · save ${yearlySavingPct(PLANS[1])}%`}</Heading>
            </Pressable>
          );
        })}
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: 'row', marginTop: Space.sm, gap: 4 }}>
        <View style={{ width: labelW }} />
        {PLANS.map((p) => {
          const on = p.tier === tier;
          return (
            <Pressable
              key={p.tier}
              onPress={() => setTier(p.tier)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`plan-${p.tier}`}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.card, borderWidth: on ? 2 : 1, borderColor: on ? Colors.ok : p.highlight ? Colors.ink : Colors.hairline, backgroundColor: p.highlight ? Colors.ink : Colors.surface, gap: 2 }}>
              {p.highlight ? <Mono size={8} color={Colors.onCamera} bold>{p.trialDays}-day free trial</Mono> : <Mono size={8} color={Colors.ink2}>{p.tier === 'solo' ? 'One person' : 'Teams'}</Mono>}
              <Heading size={compact ? 18 : 20} bold color={p.highlight ? Colors.surface : Colors.ink}>{p.name}</Heading>
              <Mono size={compact ? 10 : 11} color={p.highlight ? Colors.surface : Colors.ink} bold>{priceLabel(p, period)}</Mono>
            </Pressable>
          );
        })}
      </View>

      {/* Feature rows */}
      <View style={{ marginTop: 6, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, overflow: 'hidden' }}>
        {FEATURES.map((f, ri) => (
          <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: ri ? 1 : 0, borderColor: Colors.hairline, backgroundColor: f.flagship ? 'rgba(34,33,30,0.06)' : undefined }}>
            <View style={{ width: labelW, paddingVertical: compact ? 7 : 9, paddingHorizontal: Space.sm }}>
              <Body size={compact ? 11 : 12} bold={f.flagship} color={f.flagship ? Colors.flag : Colors.ink}>{f.label}</Body>
            </View>
            {PLANS.map((p, ci) => {
              const v = f.values[ci];
              const off = v === '—';
              const on = p.tier === tier;
              return (
                <Pressable key={p.tier} onPress={() => setTier(p.tier)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: compact ? 5 : 7, backgroundColor: on ? 'rgba(34,33,30,0.08)' : undefined }}>
                  {off ? (
                    <SymbolView name="minus" size={11} tintColor={Colors.hairline} />
                  ) : (
                    <Mono size={compact ? 9 : 10} bold color={f.flagship ? Colors.flag : Colors.ink} style={{ textAlign: 'center' }}>{cell(v)}</Mono>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ paddingBottom: insets.bottom + Space.sm, gap: Space.xs }}>
        <Button title={ctaLabel(plan)} onPress={choose} testID="plan-continue" />
        <Body size={11} color={Colors.ink2} style={{ textAlign: 'center' }}>
          {plan.trialDays > 0 ? `Free for ${plan.trialDays} days, then ${priceLabel(plan, period)}, renews automatically. ` : `${priceLabel(plan, period)}, renews automatically. `}
          Cancel any time in the App Store.
        </Body>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Space.lg }}>
          <Pressable onPress={restore} accessibilityRole="button" hitSlop={8} testID="plan-restore">
            <Mono size={12} color={Colors.ink} bold>Restore</Mono>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link" hitSlop={8}>
            <Mono size={12} color={Colors.ink}>Terms</Mono>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}>
            <Mono size={12} color={Colors.ink}>Privacy</Mono>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
