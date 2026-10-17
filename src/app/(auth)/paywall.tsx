import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { ctaLabel, FEATURES, PLANS, priceLabel, productId, yearlySavingPct, type Period, type Plan } from '@/constants/plans';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { meta } from '@/lib/db';
import { superwallActive, usePaywall } from '@/lib/paywall';
import type { Tier } from '@/types/models';

async function finish(tier: Tier, period: Period, upgrade: boolean) {
  await meta.set('plan_choice', productId(tier, period));
  if (upgrade) {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
    return;
  }
  router.replace('/(auth)/first-job');
}

function PlanCard({ plan, period, selected, onPress }: { plan: Plan; period: Period; selected: boolean; onPress: () => void }) {
  const i = PLANS.indexOf(plan);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      testID={`plan-${plan.tier}`}
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? Colors.flag : plan.highlight ? Colors.ink : Colors.hairline,
        borderRadius: Radius.card,
        backgroundColor: Colors.surface,
        padding: Space.md,
        gap: Space.sm,
      }}>
      {plan.highlight ? (
        <View style={{ position: 'absolute', top: -11, left: Space.md, backgroundColor: Colors.flag, borderRadius: Radius.chip, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Mono size={10} color={Colors.onCamera} bold>MOST CONTRACTORS · {plan.trialDays}-DAY FREE TRIAL</Mono>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Heading size={26} bold>{plan.name}</Heading>
        <View style={{ alignItems: 'flex-end' }}>
          <Heading size={22} bold>{priceLabel(plan, period)}</Heading>
          {period === 'yearly' ? <Mono size={10} color={Colors.ok}>SAVE {yearlySavingPct(plan)}%</Mono> : null}
        </View>
      </View>
      <Body size={14} color={Colors.ink2}>{plan.blurb}</Body>
      <View style={{ gap: 6 }}>
        {FEATURES.map((f) => {
          const v = f.values[i];
          const off = v === '—';
          return (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
              <SymbolView name={off ? 'minus' : 'checkmark'} size={12} tintColor={off ? Colors.hairline : f.flagship && !off ? Colors.flag : Colors.ok} />
              <Body size={13} color={off ? Colors.ink2 : Colors.ink} style={{ flex: 1, opacity: off ? 0.6 : 1 }} bold={f.flagship && !off}>
                {f.label}
              </Body>
              <Mono size={11} color={off ? Colors.ink2 : f.flagship ? Colors.flag : Colors.slate} bold={f.flagship && !off}>{v.toUpperCase()}</Mono>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

export default function PaywallGate() {
  const { upgrade } = useLocalSearchParams<{ upgrade?: string }>();
  const fromUpgrade = upgrade === '1';
  const [period, setPeriod] = useState<Period>('monthly');
  const [tier, setTier] = useState<Tier>('pro');
  const show = usePaywall();
  const plan = PLANS.find((p) => p.tier === tier) ?? PLANS[1];

  useEffect(() => {
    track('onboarding_step', { step: 'plan', superwall: superwallActive });
  }, []);

  const choose = () => {
    track('plan_selected', { tier, period, product: productId(tier, period) });
    if (superwallActive) {
      void show(fromUpgrade ? 'upgrade_tapped' : 'onboarding_complete', () => void finish(tier, period, fromUpgrade));
      return;
    }
    void finish(tier, period, fromUpgrade);
  };

  return (
    <Screen
      footer={
        <>
          <Button title={ctaLabel(plan)} onPress={choose} testID="plan-continue" />
          <Body size={12} color={Colors.ink2} style={{ textAlign: 'center' }}>
            {plan.trialDays > 0 ? `Free for ${plan.trialDays} days, then ${priceLabel(plan, period)}. ` : `${priceLabel(plan, period)}. `}
            Cancel any time in the App Store. No free version.
          </Body>
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{fromUpgrade ? 'PLANS' : 'STEP 7 OF 10'}</Mono>
        <Heading size={34} bold>{fromUpgrade ? 'Upgrade your plan' : 'Pick your plan'}</Heading>
        <Body color={Colors.ink2}>Every plan stamps and files every photo. Pro adds the paperwork: upload an invoice or contract, edit and sign it on the phone, text it to the client.</Body>
      </View>
      <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, overflow: 'hidden' }}>
        {(['monthly', 'yearly'] as Period[]).map((p) => {
          const on = p === period;
          return (
            <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`period-${p}`} style={{ paddingHorizontal: Space.md, height: 36, justifyContent: 'center', backgroundColor: on ? Colors.ink : Colors.surface }}>
              <Heading size={14} color={on ? Colors.surface : Colors.ink}>{p === 'monthly' ? 'Monthly' : 'Yearly · save up to 33%'}</Heading>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: Space.md, paddingTop: Space.xs }}>
        {[PLANS[1], PLANS[0], PLANS[2]].map((p) => (
          <PlanCard key={p.tier} plan={p} period={period} selected={p.tier === tier} onPress={() => setTier(p.tier)} />
        ))}
      </View>
    </Screen>
  );
}
