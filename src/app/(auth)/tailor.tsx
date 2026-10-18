import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { identify, track } from '@/lib/analytics';
import { meta } from '@/lib/db';

export const ROLES = ['Owner', 'Field', 'Office', 'Project manager', 'Other'] as const;
export const CREW_SIZES = ['Just me', '2–5', '6–15', '16+'] as const;
export const SOURCES = ['App Store', 'Google', 'A friend', 'Facebook or Instagram', 'TikTok or YouTube', 'Other'] as const;

function Chips<T extends string>({ label, options, value, onChange, testPrefix }: { label: string; options: readonly T[]; value: T | ''; onChange: (v: T) => void; testPrefix: string }) {
  return (
    <View style={{ gap: Space.xs }}>
      <Mono color={Colors.ink2} size={11}>{label}</Mono>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`${testPrefix}-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              style={{
                paddingHorizontal: Space.md,
                height: 40,
                justifyContent: 'center',
                borderRadius: Radius.chip,
                borderWidth: 1,
                borderColor: on ? Colors.ink : Colors.hairline,
                backgroundColor: on ? Colors.ink : Colors.surface,
              }}>
              <Heading size={16} color={on ? Colors.surface : Colors.ink}>{o}</Heading>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Three quick answers that shape the first-run tips and the acquisition report. Skippable. */
export default function Tailor() {
  const [role, setRole] = useState<(typeof ROLES)[number] | ''>('');
  const [crew, setCrew] = useState<(typeof CREW_SIZES)[number] | ''>('');
  const [source, setSource] = useState<(typeof SOURCES)[number] | ''>('');

  useEffect(() => {
    track('onboarding_step', { step: 'tailor' });
  }, []);

  const next = async (skipped: boolean) => {
    if (!skipped) {
      await meta.set('profile_role', role || null);
      await meta.set('profile_crew', crew || null);
      await meta.set('profile_source', source || null);
      identify({ role: role || null, crew_size: crew || null, heard_from: source || null });
    }
    track(skipped ? 'tailor_skipped' : 'tailor_saved', { role: role || null, crew: crew || null, source: source || null });
    router.push('/(auth)/permissions');
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={() => next(false)} disabled={!role || !crew} testID="tailor-continue" />
          <Button title="Skip" variant="ghost" onPress={() => next(true)} testID="tailor-skip" />
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>Step 5 of 10</Mono>
        <Heading size={34} bold>Set it up for how you work</Heading>
        <Body color={Colors.ink2}>Thirty seconds. Owner alone or a six-truck crew, the first steps change. Nothing here is shared or sold.</Body>
      </View>
      <Chips label="YOUR ROLE" options={ROLES} value={role} onChange={setRole} testPrefix="role" />
      <Chips label="CREW SIZE" options={CREW_SIZES} value={crew} onChange={setCrew} testPrefix="crew" />
      <Chips label="HOW DID YOU HEAR ABOUT US" options={SOURCES} value={source} onChange={setSource} testPrefix="source" />
    </Screen>
  );
}
