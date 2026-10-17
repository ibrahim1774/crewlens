import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useJobs } from '@/lib/jobs';
import { dismissStartHere, START_STEPS, useStartHere, type StartStepKey } from '@/lib/start-here';

/** "Start here" progress card at the top of Jobs, modelled on a first-week checklist. */
export function StartHereCard() {
  const s = useStartHere();
  const jobs = useJobs();
  if (!s.visible) return null;
  const first = jobs.find((j) => j.status === 'active') ?? jobs[0];

  const go = (key: StartStepKey) => {
    track('start_here_tapped', { step: key });
    if (key === 'job') return router.push('/job/new');
    if (key === 'photo') return router.push(first ? { pathname: '/camera', params: { jobId: first.id } } : '/job/new');
    if (key === 'link') return router.push(first ? { pathname: '/job/[id]', params: { id: first.id } } : '/job/new');
    return router.push(first ? { pathname: '/job/[id]/documents', params: { id: first.id, pick: '1' } } : '/job/new');
  };

  return (
    <View testID="start-here" style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: Space.sm, marginBottom: Space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <View style={{ flex: 1 }}>
          <Heading size={20} bold>Start here</Heading>
          <Mono size={11} color={Colors.ink2}>{s.pct}% · {s.done.length} OF {START_STEPS.length} DONE</Mono>
        </View>
        <Pressable onPress={() => dismissStartHere()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss" testID="start-here-dismiss">
          <SymbolView name="xmark" size={16} tintColor={Colors.ink2} />
        </Pressable>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: Colors.hairline, overflow: 'hidden' }}>
        <View style={{ width: `${s.pct}%`, height: 4, backgroundColor: Colors.flag }} />
      </View>
      {START_STEPS.map((st) => {
        const done = s.done.includes(st.key);
        return (
          <Pressable key={st.key} onPress={() => (done ? null : go(st.key))} accessibilityRole="button" testID={`start-${st.key}`} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 6 }}>
            <SymbolView name={done ? 'checkmark.circle.fill' : 'circle'} size={20} tintColor={done ? Colors.ok : Colors.hairline} />
            <View style={{ flex: 1 }}>
              <Heading size={16} color={done ? Colors.ink2 : Colors.ink}>{st.title}</Heading>
              {!done ? <Body size={12} color={Colors.ink2}>{st.body}</Body> : null}
            </View>
            {!done ? <SymbolView name="chevron.right" size={12} tintColor={Colors.ink2} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
